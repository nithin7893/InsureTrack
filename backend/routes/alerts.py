from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import date, timedelta
from calendar import monthrange
from models import Policy, Location, PolicyHistory, db
from routes.policies import apply_policy_payload
from utils.auth import get_current_user, branch_filter
import logging

alerts_bp = Blueprint('alerts', __name__)
logger = logging.getLogger(__name__)

GRACE_DAYS = 30
TERMINAL_STATUSES = {'Matured', 'Surrendered'}


def add_years(d, years):
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        last_day = monthrange(d.year + years, d.month)[1]
        return d.replace(year=d.year + years, day=last_day)


def add_months(d, months):
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    try:
        return d.replace(year=year, month=month)
    except ValueError:
        last_day = monthrange(year, month)[1]
        return d.replace(year=year, month=month, day=last_day)


PREMIUM_FREQUENCIES = {
    'Monthly': 1,
    'Quarterly': 3,
    'Semi Annual': 6,
    'Annual': 12,
}


def policy_location_name(user, policy):
    if user.role == 'central_admin' and policy.location_id:
        loc = db.session.get(Location, policy.location_id)
        return loc.name if loc else None
    if user.location:
        return user.location
    return None


def compute_alerts(user, days_ahead=90, alert_type=None):
    today = date.today()
    cutoff = today + timedelta(days=days_ahead)

    query = Policy.query
    query = branch_filter(query, Policy, user)

    policies = query.all()
    alerts = []

    for policy in policies:
        if not policy.start_date or not policy.end_date:
            continue

        start = policy.start_date
        end = policy.end_date

        if policy.policy_status in TERMINAL_STATUSES:
            continue

        # Grace / Lapsed handling (policy coverage ended and not renewed, or
        # explicitly marked as not renewed).
        if end < today or policy.policy_status == 'Lapsed':
            days_past = (today - end).days
            if days_past < 0:
                days_past = 0

            if days_past <= GRACE_DAYS:
                status = 'grace'
            else:
                status = 'lapsed'

            alerts.append({
                'policy_id': policy.id,
                'customer_name': policy.customer_name,
                'primary_phone': policy.primary_phone,
                'policy_number': policy.policy_number,
                'insurance_type': policy.insurance_type,
                'company': policy.company,
                'product': policy.product,
                'renewal_date': end.isoformat(),
                'days_until_renewal': -days_past,
                'total_premium': float(policy.total_premium),
                'status': status,
                'location': policy_location_name(user, policy),
                'year': None,
                'grace_until': (end + timedelta(days=GRACE_DAYS)).isoformat(),
            })
            continue

        ppt_limited = (
            policy.premium_payment_mode == 'Limited'
            and policy.ppt_term is not None
            and policy.ppt_term > 0
        )
        ppt_until = add_years(start, policy.ppt_term) if ppt_limited else end

        freq_months = PREMIUM_FREQUENCIES.get(policy.premium_mode, 12)

        n = 1
        while True:
            due = add_months(start, n * freq_months)

            if due > end or due > ppt_until:
                break

            days_until = (due - today).days

            if days_until <= GRACE_DAYS:
                status = 'urgent'
            else:
                status = 'upcoming'

            if due >= today and due <= cutoff:
                alerts.append({
                    'policy_id': policy.id,
                    'customer_name': policy.customer_name,
                    'primary_phone': policy.primary_phone,
                    'policy_number': policy.policy_number,
                    'insurance_type': policy.insurance_type,
                    'company': policy.company,
                    'product': policy.product,
                    'renewal_date': due.isoformat(),
                    'days_until_renewal': days_until,
                    'total_premium': float(policy.total_premium),
                    'status': status,
                    'location': policy_location_name(user, policy),
                    'year': n,
                })

            n += 1

    alerts.sort(key=lambda a: a['days_until_renewal'])

    if alert_type and alert_type != 'all':
        alerts = [a for a in alerts if a['status'] == alert_type]

    return alerts


@alerts_bp.route('', methods=['GET'])
@jwt_required()
def get_alerts():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    days_ahead = request.args.get('days', 90, type=int)
    alert_type = request.args.get('type', 'all')

    if days_ahead < 1:
        days_ahead = 90
    if days_ahead > 365:
        days_ahead = 365

    if alert_type not in ('all', 'urgent', 'upcoming', 'grace', 'lapsed'):
        alert_type = 'all'

    alerts = compute_alerts(current_user, days_ahead, alert_type)

    return jsonify({
        'alerts': alerts,
        'total': len(alerts),
        'days_ahead': days_ahead,
    }), 200


@alerts_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_alerts_summary():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    all_alerts = compute_alerts(current_user, days_ahead=365)

    urgent = sum(1 for a in all_alerts if a['status'] == 'urgent')
    upcoming = sum(1 for a in all_alerts if a['status'] == 'upcoming')
    grace = sum(1 for a in all_alerts if a['status'] == 'grace')
    lapsed = sum(1 for a in all_alerts if a['status'] == 'lapsed')

    return jsonify({
        'urgent': urgent,
        'upcoming': upcoming,
        'grace': grace,
        'lapsed': lapsed,
        'total': len(all_alerts),
    }), 200


def _get_scoped_policy(policy_id):
    """Fetch a policy with branch scoping applied. Returns (policy, error_response)."""
    policy = db.session.get(Policy, policy_id)
    if not policy:
        return None, (jsonify({'error': 'Policy not found'}), 404)
    current_user = get_current_user()
    if current_user and current_user.role in ('branch_admin', 'agent') and policy.location_id != current_user.location_id:
        return None, (jsonify({'error': 'Forbidden'}), 403)
    return policy, None


@alerts_bp.route('/<int:policy_id>/renew', methods=['POST'])
@jwt_required()
def renew_policy(policy_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    policy, error = _get_scoped_policy(policy_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    renewed = data.get('renewed', True)
    if not isinstance(renewed, bool):
        return jsonify({'error': 'Invalid renewed value. Must be true or false'}), 400

    try:
        if not renewed:
            if policy.policy_status == 'Lapsed':
                return jsonify({'error': 'Policy is already marked as not renewed'}), 400
            policy.policy_status = 'Lapsed'
            db.session.add(PolicyHistory(
                policy_id=policy.id,
                action='not_renewed',
                details=policy.to_dict(),
                renewed_by=current_user.id,
                renewed_by_name=current_user.name or current_user.email,
            ))
            db.session.commit()
            logger.info(f"Policy {policy.policy_number} marked as not renewed by user {current_user.id}")
            return jsonify({'message': 'Policy marked as not renewed', 'policy': policy.to_dict()}), 200

        old_details = policy.to_dict()

        apply_policy_payload(policy, data)

        if not data.get('policy_status'):
            policy.policy_status = 'Renewal'

        if policy.end_date <= policy.start_date:
            db.session.rollback()
            return jsonify({'error': 'Renewal end_date must be after the start_date'}), 400

        db.session.add(PolicyHistory(
            policy_id=policy.id,
            action='renewed',
            details=old_details,
            renewed_by=current_user.id,
            renewed_by_name=current_user.name or current_user.email,
        ))
        db.session.commit()
        logger.info(f"Policy renewed: {policy.policy_number} by user {current_user.id}")
        return jsonify({'message': 'Policy renewed successfully', 'policy': policy.to_dict()}), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to renew policy {policy_id}: {e}")
        return jsonify({'error': 'Failed to renew policy'}), 400


@alerts_bp.route('/<int:policy_id>/history', methods=['GET'])
@jwt_required()
def get_policy_history(policy_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    policy, error = _get_scoped_policy(policy_id)
    if error:
        return error

    history = (PolicyHistory.query
               .filter_by(policy_id=policy_id)
               .order_by(PolicyHistory.created_at.desc())
               .all())

    return jsonify({'history': [h.to_dict() for h in history]}), 200
