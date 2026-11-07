from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import ProductMaster, Company, db, User
from utils.auth import validate_string_field
import logging

products_bp = Blueprint('products', __name__)
logger = logging.getLogger(__name__)

VALID_INSURANCE_TYPES = frozenset({'Life', 'Health', 'General'})


def require_admin():
    user = db.session.get(User, int(get_jwt_identity()))
    return user and user.role in ('central_admin', 'branch_admin')


def validate_product_company(company_name, insurance_type):
    """Validate an optional product company against the insurance type.

    A blank company means the product applies to all companies and is always
    allowed. Raises ValueError for an unknown/inactive/wrong-type company.
    """
    cleaned = (company_name or '').strip()
    if not cleaned:
        return ''
    if len(cleaned) > 100:
        raise ValueError('company_name must be at most 100 characters')
    match = Company.query.filter_by(
        name=cleaned,
        insurance_type=insurance_type,
        is_active=True,
    ).first()
    if not match:
        raise ValueError('company_name must be an active company for the selected insurance_type')
    return cleaned


@products_bp.route('', methods=['GET'])
def get_products():
    insurance_type = request.args.get('insurance_type', '')
    company_name = request.args.get('company_name', '').strip()
    category = request.args.get('category', '')
    sub_category = request.args.get('sub_category', '')
    product_category = request.args.get('product_category', '')
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'

    query = ProductMaster.query

    if not include_inactive:
        query = query.filter_by(is_active=True)

    if insurance_type:
        query = query.filter(ProductMaster.insurance_type == insurance_type)

    if company_name:
        # Case-insensitive so preserved legacy rows (for example the uppercase
        # "GO DIGIT GENERAL INSURANCE LIMITED" product) still match the renamed
        # canonical company. Blank/NULL products apply to all companies.
        query = query.filter(
            (db.func.lower(ProductMaster.company_name) == company_name.lower()) |
            (ProductMaster.company_name.is_(None)) |
            (ProductMaster.company_name == '')
        )

    if category:
        query = query.filter(
            (ProductMaster.category == category) |
            (ProductMaster.category.is_(None)) |
            (ProductMaster.category == '')
        )

    if sub_category:
        query = query.filter(
            (ProductMaster.sub_category == sub_category) |
            (ProductMaster.sub_category.is_(None)) |
            (ProductMaster.sub_category == '')
        )

    if product_category:
        query = query.filter(
            (ProductMaster.product_category == product_category) |
            (ProductMaster.product_category.is_(None)) |
            (ProductMaster.product_category == '')
        )

    query = query.order_by(ProductMaster.product_name.asc())

    products = query.all()
    return jsonify([p.to_dict() for p in products])


@products_bp.route('', methods=['POST'])
@jwt_required()
def create_product():
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    if not data.get('insurance_type') or not data.get('product_name'):
        return jsonify({'error': 'insurance_type and product_name are required'}), 400

    if data['insurance_type'] not in VALID_INSURANCE_TYPES:
        return jsonify({'error': 'Invalid insurance_type'}), 400

    if not validate_string_field(data['product_name'], max_length=100):
        return jsonify({'error': 'product_name must be 1-100 characters'}), 400

    try:
        company_name = validate_product_company(data.get('company_name'), data['insurance_type'])
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    existing = ProductMaster.query.filter_by(
        insurance_type=data['insurance_type'],
        company_name=company_name,
        category=data.get('category') or '',
        sub_category=data.get('sub_category') or '',
        product_category=data.get('product_category') or '',
        product_name=data['product_name']
    ).first()

    if existing:
        return jsonify({'error': 'Product already exists for this combination'}), 400

    product = ProductMaster(
        insurance_type=data['insurance_type'],
        company_name=company_name,
        category=(data.get('category') or '')[:100],
        sub_category=(data.get('sub_category') or '')[:100],
        product_category=(data.get('product_category') or '')[:100],
        product_name=data['product_name'][:100],
        is_active=True
    )

    db.session.add(product)
    db.session.commit()

    logger.info(f"Product created: {data['product_name']}")
    return jsonify(product.to_dict()), 201


@products_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_product(id):
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403

    product = db.session.get(ProductMaster, id)
    if not product:
        abort(404)
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    new_insurance_type = data.get('insurance_type') or product.insurance_type
    if data.get('insurance_type'):
        if data['insurance_type'] not in VALID_INSURANCE_TYPES:
            return jsonify({'error': 'Invalid insurance_type'}), 400

    existing_company = (product.company_name or '').strip()
    company_provided = 'company_name' in data and bool(str(data.get('company_name') or '').strip())
    incoming_company = str(data.get('company_name') or '').strip() if company_provided else ''
    company_changed = company_provided and incoming_company != existing_company
    type_changed = new_insurance_type != product.insurance_type

    if company_provided and (company_changed or type_changed):
        try:
            incoming_company = validate_product_company(incoming_company, new_insurance_type)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
    elif type_changed and existing_company:
        try:
            validate_product_company(existing_company, new_insurance_type)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

    product.insurance_type = new_insurance_type
    if 'company_name' in data:
        product.company_name = incoming_company[:100] if company_provided else ''
    if 'category' in data:
        product.category = (data['category'] or '')[:100]
    if 'sub_category' in data:
        product.sub_category = (data['sub_category'] or '')[:100]
    if 'product_category' in data:
        product.product_category = (data['product_category'] or '')[:100]
    if data.get('product_name'):
        product.product_name = data['product_name'][:100]
    if 'is_active' in data:
        product.is_active = bool(data['is_active'])

    db.session.commit()
    return jsonify(product.to_dict())


@products_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_product(id):
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403

    product = db.session.get(ProductMaster, id)
    if not product:
        abort(404)
    product.is_active = False
    db.session.commit()

    logger.info(f"Product deactivated: {product.product_name}")
    return jsonify({'message': 'Product deactivated'})
