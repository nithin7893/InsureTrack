from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import ProductMaster, db, User
from utils.auth import validate_string_field
import logging

products_bp = Blueprint('products', __name__)
logger = logging.getLogger(__name__)

VALID_INSURANCE_TYPES = frozenset({'Life', 'Health', 'General'})


def require_admin():
    user = db.session.get(User, int(get_jwt_identity()))
    return user and user.role in ('central_admin', 'branch_admin')


@products_bp.route('', methods=['GET'])
def get_products():
    insurance_type = request.args.get('insurance_type', '')
    company_name = request.args.get('company_name', '')
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
        query = query.filter(
            (ProductMaster.company_name == company_name) |
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

    existing = ProductMaster.query.filter_by(
        insurance_type=data['insurance_type'],
        company_name=data.get('company_name') or '',
        category=data.get('category') or '',
        sub_category=data.get('sub_category') or '',
        product_category=data.get('product_category') or '',
        product_name=data['product_name']
    ).first()

    if existing:
        return jsonify({'error': 'Product already exists for this combination'}), 400

    product = ProductMaster(
        insurance_type=data['insurance_type'],
        company_name=(data.get('company_name') or '')[:100],
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

    if data.get('insurance_type'):
        if data['insurance_type'] not in VALID_INSURANCE_TYPES:
            return jsonify({'error': 'Invalid insurance_type'}), 400
        product.insurance_type = data['insurance_type']
    if 'company_name' in data:
        product.company_name = (data['company_name'] or '')[:100]
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
