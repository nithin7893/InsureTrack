from flask import Blueprint, request, jsonify, Response, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Policy, PolicyCover, PolicyRider, Vehicle, User, Location, CustomField, db
from datetime import datetime
from utils.auth import (
    get_current_user, branch_filter, validate_phone,
    sanitize_search_input, validate_sort_field, validate_sort_order
)
from app import limiter
import csv
import io
import logging

policies_bp = Blueprint('policies', __name__)
logger = logging.getLogger(__name__)

SORT_FIELDS = {
    'created_at', 'total_premium', 'customer_name', 'start_date',
    'policy_status', 'company', 'insurance_type'
}

VALID_STATUSES = {'Fresh', 'Renewal', 'Other Company Renewal', 'Lapsed', 'Matured', 'Surrendered'}

RIDER_FIELDS = [
    'rider_health_sickness', 'rider_accident_disability', 'rider_term_rider',
    'rider_other_pwb', 'rider_adb', 'rider_atpd', 'rider_permanent_disability',
    'rider_critical_illness', 'rider_waiver_of_premium', 'rider_terminal_illness'
]


def parse_covers(data):
    """Validate and normalize the 'covers' payload. Returns None when absent,
    a list of cover dicts, or raises ValueError on invalid data."""
    covers = data.get('covers')
    if covers is None:
        return None
    if not isinstance(covers, list):
        raise ValueError('covers must be a list')
    parsed = []
    for i, c in enumerate(covers):
        if not isinstance(c, dict):
            raise ValueError(f'covers[{i}] must be an object')
        category = str(c.get('category') or '').strip()
        sub_category = str(c.get('sub_category') or '').strip()
        if not category or not sub_category:
            raise ValueError(f'covers[{i}]: category and sub_category are required')
        try:
            sum_insured = c.get('sum_insured')
            sum_insured = float(sum_insured) if sum_insured not in (None, '') else None
        except (TypeError, ValueError):
            raise ValueError(f'covers[{i}]: invalid sum_insured')
        try:
            premium = float(c.get('premium') or 0)
        except (TypeError, ValueError):
            raise ValueError(f'covers[{i}]: invalid premium')
        if sum_insured is not None and sum_insured < 0:
            raise ValueError(f'covers[{i}]: sum_insured cannot be negative')
        if premium < 0:
            raise ValueError(f'covers[{i}]: premium cannot be negative')
        parsed.append({
            'category': category[:100],
            'sub_category': sub_category[:100],
            'sum_insured': sum_insured,
            'premium': premium,
        })
    return parsed


def covers_to_models(covers):
    return [PolicyCover(**c) for c in covers]


def validate_custom_values(values, insurance_type):
    """Validate configured custom field values.

    Returns {field_id(str): value(str)} and raises ValueError on any invalid
    or missing required value. Only active fields that apply to the policy's
    insurance type are considered.
    """
    if values is None:
        values = {}
    if not isinstance(values, dict):
        raise ValueError('custom_values must be an object')
    if not values:
        result = {}
    else:
        fields = CustomField.query.filter_by(is_active=True).all()
        field_map = {
            str(f.id): f
            for f in fields
            if not f.insurance_type or f.insurance_type == insurance_type
        }
        result = {}
        for field_id, value in values.items():
            field = field_map.get(str(field_id))
            if not field:
                raise ValueError(f'custom_values contains an unknown field')
            cleaned = str(value or '').strip()
            if cleaned == '':
                continue
            if field.field_type == 'number':
                try:
                    cleaned = str(float(cleaned))
                except (TypeError, ValueError):
                    raise ValueError(f'{field.label} must be a number')
            elif field.field_type == 'date':
                try:
                    datetime.strptime(cleaned, '%Y-%m-%d')
                except ValueError:
                    raise ValueError(f'{field.label} must be a valid date (YYYY-MM-DD)')
            elif field.field_type == 'select':
                if cleaned not in (field.options or []):
                    raise ValueError(f'{field.label} has an invalid option')
            result[str(field_id)] = cleaned[:500]

    for field in CustomField.query.filter_by(is_active=True).all():
        if (
            field.is_required
            and (not field.insurance_type or field.insurance_type == insurance_type)
            and str(field.id) not in result
        ):
            raise ValueError(f'{field.label} is required')

    return result


def apply_policy_payload(policy, data):
    """Validate and apply field updates to a Policy. Raises ValueError on invalid data.

    Shared by the update_policy route and the renewal endpoint so both use the
    same validation and premium calculation rules.
    """
    # Validate insurance_type if provided
    if 'insurance_type' in data and data['insurance_type'] not in ('Life', 'Health', 'General'):
        raise ValueError('Invalid insurance_type')

    # Validate phone if provided
    if 'primary_phone' in data and data['primary_phone'] and not validate_phone(data['primary_phone']):
        raise ValueError('Invalid primary_phone format')

    # Validate dates if provided
    if 'start_date' in data:
        try:
            policy.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        except ValueError:
            raise ValueError('Invalid start_date format')
    if 'end_date' in data:
        try:
            policy.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        except ValueError:
            raise ValueError('Invalid end_date format')

    # Validate premium if provided
    if 'base_premium' in data:
        try:
            val = float(data['base_premium'])
            if val < 0:
                raise ValueError('base_premium cannot be negative')
        except (TypeError, ValueError):
            raise ValueError('Invalid base_premium')

    # Validate policy_number uniqueness if changed
    if 'policy_number' in data and data['policy_number'] != policy.policy_number:
        if Policy.query.filter_by(policy_number=data['policy_number']).first():
            raise ValueError('policy_number already exists')

    policy.insurance_type = data.get('insurance_type', policy.insurance_type)
    policy.company = data.get('company', policy.company)[:100] if data.get('company') else policy.company
    policy.category = data.get('category', policy.category)
    policy.sub_category = data.get('sub_category', policy.sub_category)
    policy.product = data.get('product', policy.product)[:100] if data.get('product') else policy.product
    policy.customer_name = data.get('customer_name', policy.customer_name)[:255]
    policy.primary_phone = data.get('primary_phone', policy.primary_phone)[:20]
    policy.alternate_phone = data.get('alternate_phone', policy.alternate_phone)
    policy.policy_number = data.get('policy_number', policy.policy_number)[:100]
    policy.policy_term = data.get('policy_term', policy.policy_term)
    policy.vehicle_id = data.get('vehicle_id', policy.vehicle_id)

    if data.get('premium_payment_mode'):
        if policy.insurance_type == 'Health':
            policy.premium_payment_mode = None
            policy.ppt_term = None
        else:
            policy.premium_payment_mode = data['premium_payment_mode']
            if data['premium_payment_mode'] == 'Limited':
                policy.ppt_term = data.get('ppt_term', policy.ppt_term)
            else:
                policy.ppt_term = data.get('policy_term', policy.policy_term)
    elif policy.insurance_type == 'Health':
        policy.premium_payment_mode = None
        policy.ppt_term = None

    if data.get('sum_assured') is not None:
        policy.sum_assured = float(data['sum_assured'])
    if data.get('sum_insured') is not None:
        policy.sum_insured = float(data['sum_insured'])

    if data.get('number_of_lives') is not None:
        policy.number_of_lives = data['number_of_lives']
    elif 'number_of_lives' in data and data['number_of_lives'] is None:
        policy.number_of_lives = None

    if 'health_rider' in data:
        policy.health_rider = data['health_rider'][:500] if data['health_rider'] else ''

    policy.premium_mode = data.get('premium_mode', policy.premium_mode)

    if data.get('base_premium') is not None:
        policy.base_premium = float(data['base_premium'])

    for field in RIDER_FIELDS:
        if data.get(field) is not None:
            setattr(policy, field, float(data[field]))

    if 'covers' in data:
        new_covers = parse_covers(data)
        if new_covers is None:
            raise ValueError('covers must be a list')
        policy.covers = covers_to_models(new_covers)
        policy.base_premium = sum(c['premium'] for c in new_covers)

    if 'general_riders' in data and policy.insurance_type == 'General':
        general_riders = data.get('general_riders', [])
        policy.riders = []
        rider_premium = 0
        for rider_data in general_riders:
            if isinstance(rider_data, dict):
                rider_id = rider_data.get('rider_id')
                premium = float(rider_data.get('premium', 0) or 0)
                sum_insured = float(rider_data.get('sum_insured', 0) or 0)
                excess_type = rider_data.get('excess_type', 'percentage')
                excess_value = float(rider_data.get('excess_value', 0) or 0)
                
                if excess_type == 'percentage':
                    excess_amount = sum_insured * excess_value / 100
                else:
                    excess_amount = excess_value
                
                if rider_id:
                    policy_rider = PolicyRider(
                        rider_id=rider_id,
                        sum_insured=sum_insured,
                        premium=premium,
                        excess_type=excess_type,
                        excess_value=excess_value,
                        excess_amount=excess_amount
                    )
                    policy.riders.append(policy_rider)
                    rider_premium += premium
        policy.rider_premium = rider_premium

    base_premium = float(policy.base_premium)
    rider_premium = sum(float(getattr(policy, field) or 0) for field in RIDER_FIELDS)
    policy.rider_premium = rider_premium

    if policy.insurance_type == 'General':
        policy.gst = (base_premium + rider_premium) * 0.18
    elif policy.insurance_type == 'Health' and data.get('product_category') == 'GPA':
        policy.gst = base_premium * 0.18
    else:
        policy.gst = 0

    policy.total_premium = base_premium + rider_premium + policy.gst

    if 'policy_status' in data:
        if data['policy_status'] not in VALID_STATUSES:
            raise ValueError('Invalid policy_status')
        policy.policy_status = data['policy_status']
    policy.agent_name = data.get('agent_name', policy.agent_name)

    if 'custom_values' in data:
        policy.custom_values = validate_custom_values(data.get('custom_values'), policy.insurance_type)

    return policy


@policies_bp.route('', methods=['GET'])
@jwt_required()
def get_policies():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 10, type=int), 100)
    search = sanitize_search_input(request.args.get('search', ''))
    company = sanitize_search_input(request.args.get('company', ''), 100)
    insurance_type = sanitize_search_input(request.args.get('insurance_type', ''), 50)
    policy_status = sanitize_search_input(request.args.get('policy_status', ''), 50)
    agent_name = sanitize_search_input(request.args.get('agent_name', ''), 255)
    min_premium = request.args.get('min_premium', type=float)
    max_premium = request.args.get('max_premium', type=float)
    start_date_from = request.args.get('start_date_from', '')
    start_date_to = request.args.get('start_date_to', '')
    product = sanitize_search_input(request.args.get('product', ''), 100)
    location = sanitize_search_input(request.args.get('location', ''), 255)
    sort_by = validate_sort_field(request.args.get('sort_by', 'created_at'), SORT_FIELDS)
    sort_order = validate_sort_order(request.args.get('sort_order', 'desc'))

    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 10

    query = Policy.query
    current_user = get_current_user()
    query = branch_filter(query, Policy, current_user)

    if search:
        query = query.filter(
            (Policy.customer_name.ilike(f'%{search}%')) |
            (Policy.policy_number.ilike(f'%{search}%'))
        )
    if company:
        query = query.filter(Policy.company == company)
    if insurance_type:
        query = query.filter(Policy.insurance_type == insurance_type)
    if policy_status:
        query = query.filter(Policy.policy_status == policy_status)
    if agent_name:
        query = query.filter(Policy.agent_name.ilike(f'%{agent_name}%'))
    if product:
        query = query.filter(Policy.product == product)
    if location:
        query = query.filter(Policy.location == location)
    if min_premium is not None and min_premium >= 0:
        query = query.filter(Policy.total_premium >= min_premium)
    if max_premium is not None and max_premium >= min_premium:
        query = query.filter(Policy.total_premium <= max_premium)

    if start_date_from:
        try:
            query = query.filter(Policy.start_date >= datetime.strptime(start_date_from, '%Y-%m-%d').date())
        except ValueError:
            pass
    if start_date_to:
        try:
            query = query.filter(Policy.start_date <= datetime.strptime(start_date_to, '%Y-%m-%d').date())
        except ValueError:
            pass

    sort_column = getattr(Policy, sort_by, Policy.created_at)
    if sort_order == 'asc':
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'policies': [policy.to_dict() for policy in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    }), 200


@policies_bp.route('/export', methods=['GET'])
@jwt_required()
@limiter.limit("5/minute")
def export_policies():
    query = Policy.query
    current_user = get_current_user()
    query = branch_filter(query, Policy, current_user)
    policies = query.all()

    output = io.StringIO()
    writer = csv.writer(output)

    custom_fields = CustomField.query.filter_by(is_active=True).order_by(CustomField.id.asc()).all()

    writer.writerow([
        'ID', 'Insurance Type', 'Company', 'Category', 'Sub Category', 'Product',
        'Customer Name', 'Primary Phone', 'Alternate Phone', 'Policy Number', 'Policy Term',
        'Premium Payment Mode', 'PPT Term', 'Sum Assured', 'Start Date',
        'End Date', 'Premium Mode', 'Base Premium', 'Rider Premium',
        'GST', 'Total Premium', 'Policy Status', 'Agent Name',
        'Vehicle Number', 'Vehicle Model', 'Vehicle Year', 'Owner Name',
        'Covers', 'Created At',
    ] + [f.field.label for f in custom_fields])

    for p in policies:
        covers = '; '.join(
            f"{c.sub_category} (SI {float(c.sum_insured) if c.sum_insured else 0}, Prem {float(c.premium)})"
            for c in p.covers
        )
        custom_values = p.custom_values or {}
        writer.writerow([
            p.id, p.insurance_type, p.company, p.category, p.sub_category or '', p.product,
            p.customer_name, p.primary_phone, p.alternate_phone or '', p.policy_number, p.policy_term,
            p.premium_payment_mode or '', p.ppt_term or '', float(p.sum_assured) if p.sum_assured else '',
            p.start_date,
            p.end_date, p.premium_mode, float(p.base_premium), float(p.rider_premium),
            float(p.gst), float(p.total_premium), p.policy_status, p.agent_name,
            p.vehicle.vehicle_number if p.vehicle else '', p.vehicle.vehicle_model if p.vehicle else '',
            p.vehicle.vehicle_year if p.vehicle else '', p.vehicle.owner_name if p.vehicle else '',
            covers,
            p.created_at.strftime('%Y-%m-%d %H:%M:%S') if p.created_at else '',
        ] + [custom_values.get(str(f.id), '') for f in custom_fields])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment;filename=policies_export.csv'}
    )


@policies_bp.route('', methods=['POST'])
@jwt_required()
def create_policy():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    required_fields = [
        'insurance_type', 'company', 'product', 'customer_name',
        'primary_phone', 'policy_number', 'start_date', 'end_date', 'premium_mode',
        'base_premium', 'policy_status'
    ]

    for field in required_fields:
        if field == 'base_premium' and data.get('covers') is not None:
            continue
        value = data.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            return jsonify({'error': f'{field} is required'}), 400

    # Validate insurance_type
    if data['insurance_type'] not in ('Life', 'Health', 'General'):
        return jsonify({'error': 'Invalid insurance_type. Must be Life, Health, or General'}), 400

    # Validate policy_status
    valid_statuses = {'Fresh', 'Renewal', 'Other Company Renewal', 'Lapsed', 'Matured', 'Surrendered'}
    if data['policy_status'] not in valid_statuses:
        return jsonify({'error': f'Invalid policy_status. Must be one of: {", ".join(sorted(valid_statuses))}'}), 400

    # Validate phone
    if not validate_phone(data['primary_phone']):
        return jsonify({'error': 'Invalid primary_phone format'}), 400

    # Validate dates
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    if end_date <= start_date:
        return jsonify({'error': 'end_date must be after start_date'}), 400

    # Validate base_premium
    if data.get('covers') is not None:
        base_premium = 0
    else:
        try:
            base_premium = float(data['base_premium'])
            if base_premium < 0:
                return jsonify({'error': 'base_premium cannot be negative'}), 400
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid base_premium'}), 400

    # Validate policy_number uniqueness at application level
    if Policy.query.filter_by(policy_number=data['policy_number']).first():
        return jsonify({'error': 'policy_number already exists'}), 400

    vehicle_id = None
    if data.get('insurance_type') == 'General' and data.get('vehicle_number'):
        vehicle = Vehicle(
            vehicle_number=str(data.get('vehicle_number', ''))[:20],
            vehicle_year=data.get('vehicle_year'),
            vehicle_model=str(data.get('vehicle_model', ''))[:100] if data.get('vehicle_model') else None,
            owner_name=str(data.get('owner_name', ''))[:255] if data.get('owner_name') else None
        )
        db.session.add(vehicle)
        db.session.flush()
        vehicle_id = vehicle.id

    rider_health_sickness = float(data.get('rider_health_sickness', 0) or 0)
    rider_accident_disability = float(data.get('rider_accident_disability', 0) or 0)
    rider_term_rider = float(data.get('rider_term_rider', 0) or 0)
    rider_other_pwb = float(data.get('rider_other_pwb', 0) or 0)
    rider_adb = float(data.get('rider_adb', 0) or 0)
    rider_atpd = float(data.get('rider_atpd', 0) or 0)
    rider_permanent_disability = float(data.get('rider_permanent_disability', 0) or 0)
    rider_critical_illness = float(data.get('rider_critical_illness', 0) or 0)
    rider_waiver_of_premium = float(data.get('rider_waiver_of_premium', 0) or 0)
    rider_terminal_illness = float(data.get('rider_terminal_illness', 0) or 0)

    rider_premium = (rider_health_sickness + rider_accident_disability + rider_term_rider +
                     rider_other_pwb + rider_adb + rider_atpd + rider_permanent_disability +
                     rider_critical_illness + rider_waiver_of_premium + rider_terminal_illness)

    covers = None
    try:
        covers = parse_covers(data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    if covers is not None:
        base_premium = sum(c['premium'] for c in covers)

    gst = 0
    if data['insurance_type'] == 'General':
        gst = (base_premium + rider_premium) * 0.18
    elif data['insurance_type'] == 'Health' and data.get('product_category') == 'GPA':
        gst = base_premium * 0.18

    total_premium = base_premium + rider_premium + gst

    premium_payment_mode = data.get('premium_payment_mode', 'Regular')
    if data['insurance_type'] == 'Health':
        ppt_term = None
        premium_payment_mode = None
    elif premium_payment_mode == 'Limited':
        ppt_term = data.get('ppt_term')
    else:
        ppt_term = data.get('policy_term')

    location_id = None
    policy_location = ''
    if current_user.role == 'central_admin' and data.get('location_id'):
        try:
            location_id = int(data['location_id'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid location_id'}), 400
        loc = db.session.get(Location, location_id)
        if loc:
            policy_location = loc.name
    elif current_user.role in ('branch_admin', 'agent') and current_user.location_id:
        location_id = current_user.location_id
        loc = db.session.get(Location, location_id)
        if loc:
            policy_location = loc.name
    else:
        policy_location = data.get('location') or (current_user.location if current_user else '')

    policy = Policy(
        insurance_type=data['insurance_type'],
        company=data['company'][:100],
        category=data.get('category', '')[:50] if data.get('category') else '',
        sub_category=data.get('sub_category', '')[:50] if data.get('sub_category') else '',
        product=data['product'][:100],
        customer_name=data['customer_name'][:255],
        primary_phone=data['primary_phone'][:20],
        alternate_phone=data.get('alternate_phone', '')[:20] if data.get('alternate_phone') else '',
        policy_number=data['policy_number'][:100],
        policy_term=data.get('policy_term'),
        premium_payment_mode=premium_payment_mode,
        ppt_term=ppt_term,
        number_of_lives=data.get('number_of_lives'),
        health_rider=data.get('health_rider', '')[:500] if data.get('health_rider') else '',
        sum_assured=float(data['sum_assured']) if data.get('sum_assured') else None,
        sum_insured=float(data['sum_insured']) if data.get('sum_insured') else None,
        start_date=start_date,
        end_date=end_date,
        premium_mode=data['premium_mode'][:50],
        base_premium=base_premium,
        rider_premium=rider_premium,
        rider_health_sickness=rider_health_sickness,
        rider_accident_disability=rider_accident_disability,
        rider_term_rider=rider_term_rider,
        rider_other_pwb=rider_other_pwb,
        rider_adb=rider_adb,
        rider_atpd=rider_atpd,
        rider_permanent_disability=rider_permanent_disability,
        rider_critical_illness=rider_critical_illness,
        rider_waiver_of_premium=rider_waiver_of_premium,
        rider_terminal_illness=rider_terminal_illness,
        gst=gst,
        total_premium=total_premium,
        policy_status=data['policy_status'],
        agent_name=data.get('agent_name', '')[:255] if data.get('agent_name') else '',
        location=policy_location[:255] if policy_location else '',
        location_id=location_id,
        vehicle_id=vehicle_id
    )

    if covers is not None:
        policy.covers = covers_to_models(covers)

    general_riders = data.get('general_riders', [])
    if general_riders and data['insurance_type'] == 'General':
        rider_premium = 0
        for rider_data in general_riders:
            if isinstance(rider_data, dict):
                rider_id = rider_data.get('rider_id')
                premium = float(rider_data.get('premium', 0) or 0)
                sum_insured = float(rider_data.get('sum_insured', 0) or 0)
                excess_type = rider_data.get('excess_type', 'percentage')
                excess_value = float(rider_data.get('excess_value', 0) or 0)
                
                if excess_type == 'percentage':
                    excess_amount = sum_insured * excess_value / 100
                else:
                    excess_amount = excess_value
                
                if rider_id:
                    policy_rider = PolicyRider(
                        rider_id=rider_id,
                        sum_insured=sum_insured,
                        premium=premium,
                        excess_type=excess_type,
                        excess_value=excess_value,
                        excess_amount=excess_amount
                    )
                    policy.riders.append(policy_rider)
                    rider_premium += premium
        policy.rider_premium = rider_premium
        policy.total_premium = float(policy.base_premium) + rider_premium + float(policy.gst)

    try:
        policy.custom_values = validate_custom_values(data.get('custom_values'), data['insurance_type'])
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

    try:
        db.session.add(policy)
        db.session.commit()
        logger.info(f"Policy created: {policy.policy_number} by user {current_user.id}")
        return jsonify(policy.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create policy: {e}")
        return jsonify({'error': 'Failed to create policy'}), 400


@policies_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_policy(id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    policy = db.session.get(Policy, id)
    if not policy:
        abort(404)
    if current_user.role in ('branch_admin', 'agent') and policy.location_id != current_user.location_id:
        return jsonify({'error': 'Forbidden'}), 403
    return jsonify(policy.to_dict()), 200


@policies_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_policy(id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    policy = db.session.get(Policy, id)
    if not policy:
        abort(404)
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    if current_user.role in ('branch_admin', 'agent') and policy.location_id != current_user.location_id:
        return jsonify({'error': 'Forbidden'}), 403

    try:
        apply_policy_payload(policy, data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    try:
        db.session.commit()
        logger.info(f"Policy updated: {policy.policy_number} by user {current_user.id}")
        return jsonify(policy.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update policy {id}: {e}")
        return jsonify({'error': 'Failed to update policy'}), 400


@policies_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_policy(id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    policy = db.session.get(Policy, id)
    if not policy:
        abort(404)

    if current_user.role in ('branch_admin', 'agent') and policy.location_id != current_user.location_id:
        return jsonify({'error': 'Forbidden'}), 403

    # Agents cannot delete policies
    if current_user.role == 'agent':
        return jsonify({'error': 'Agents cannot delete policies'}), 403

    try:
        policy_number = policy.policy_number
        db.session.delete(policy)
        db.session.commit()
        logger.info(f"Policy deleted: {policy_number} by user {current_user.id}")
        return jsonify({'message': 'Policy deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to delete policy {id}: {e}")
        return jsonify({'error': 'Failed to delete policy'}), 400
