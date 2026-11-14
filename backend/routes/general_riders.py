from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import GeneralRider, ProductMaster, PolicyRider, db
from utils.auth import get_current_user
from utils.general_catalogue import GENERAL_SUB_CATEGORY_NAMES
import logging

general_riders_bp = Blueprint('general_riders', __name__)
logger = logging.getLogger(__name__)

MAX_PRODUCTS_PER_RIDER = 200


def parse_product_names(data):
    """Validate the optional product_names list from a rider payload.

    Returns None when the key is absent so callers can skip the update.
    """
    if 'product_names' not in data:
        return None
    raw = data.get('product_names')
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError('product_names must be a list')

    cleaned = []
    for value in raw:
        if not isinstance(value, str):
            raise ValueError('Each product name must be text')
        name = value.strip()
        if not name:
            continue
        if len(name) > 100:
            raise ValueError('Product name is too long')
        if name not in cleaned:
            cleaned.append(name)

    if len(cleaned) > MAX_PRODUCTS_PER_RIDER:
        raise ValueError(f'A rider can be linked to at most {MAX_PRODUCTS_PER_RIDER} products')

    if cleaned:
        known = {
            row.product_name
            for row in ProductMaster.query.filter(
                ProductMaster.insurance_type == 'General',
                ProductMaster.product_name.in_(cleaned),
            ).all()
        }
        unknown = [
            name
            for name in cleaned
            if name not in known and name not in GENERAL_SUB_CATEGORY_NAMES
        ]
        if unknown:
            raise ValueError(f"Unknown product or sub-category: {', '.join(unknown[:5])}")

    return cleaned


@general_riders_bp.route('', methods=['GET'])
@jwt_required()
def get_general_riders():
    """Get all general riders, optionally filtered by category."""
    category = request.args.get('category', '')
    product = request.args.get('product', '').strip()
    show_inactive = request.args.get('show_inactive', 'false').lower() == 'true'
    
    query = GeneralRider.query
    if not show_inactive:
        query = query.filter_by(is_active=True)
    if category:
        query = query.filter_by(category=category)
    
    riders = query.order_by(GeneralRider.category, GeneralRider.name).all()

    # Product-scoped riders only apply to the selected product; riders with no
    # product mapping apply to every product in their category.
    if product:
        riders = [
            r for r in riders
            if not r.product_names or product in r.product_names
        ]

    return jsonify([r.to_dict() for r in riders]), 200


@general_riders_bp.route('', methods=['POST'])
@jwt_required()
def create_general_rider():
    """Create a new general rider. Requires admin role."""
    current_user = get_current_user()
    if not current_user or current_user.role not in ('central_admin', 'branch_admin'):
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400
    
    name = str(data.get('name', '')).strip()
    description = str(data.get('description', '')).strip()
    category = str(data.get('category', '')).strip()
    
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if not category:
        return jsonify({'error': 'Category is required'}), 400

    try:
        product_names = parse_product_names(data) or []
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    
    rider = GeneralRider(
        name=name[:255],
        description=description[:500] if description else None,
        category=category[:100],
        product_names=product_names,
    )
    
    try:
        db.session.add(rider)
        db.session.commit()
        logger.info(f"General rider created: {rider.name} by user {current_user.id}")
        return jsonify(rider.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create general rider: {e}")
        return jsonify({'error': 'Failed to create rider'}), 400


@general_riders_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_general_rider(id):
    """Update a general rider. Requires admin role."""
    current_user = get_current_user()
    if not current_user or current_user.role not in ('central_admin', 'branch_admin'):
        return jsonify({'error': 'Admin access required'}), 403
    
    rider = db.session.get(GeneralRider, id)
    if not rider:
        return jsonify({'error': 'Rider not found'}), 404
    
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400
    
    if 'name' in data:
        rider.name = str(data['name']).strip()[:255]
    if 'description' in data:
        rider.description = str(data['description']).strip()[:500] if data['description'] else None
    if 'category' in data:
        rider.category = str(data['category']).strip()[:100]
    try:
        product_names = parse_product_names(data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    if product_names is not None:
        rider.product_names = product_names
    if 'is_active' in data:
        rider.is_active = bool(data['is_active'])
    
    try:
        db.session.commit()
        logger.info(f"General rider updated: {rider.name} by user {current_user.id}")
        return jsonify(rider.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update general rider {id}: {e}")
        return jsonify({'error': 'Failed to update rider'}), 400


@general_riders_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_general_rider(id):
    """Delete a general rider. Requires admin role."""
    current_user = get_current_user()
    if not current_user or current_user.role not in ('central_admin', 'branch_admin'):
        return jsonify({'error': 'Admin access required'}), 403
    
    rider = db.session.get(GeneralRider, id)
    if not rider:
        return jsonify({'error': 'Rider not found'}), 404
    
    try:
        db.session.delete(rider)
        db.session.commit()
        logger.info(f"General rider deleted: {rider.name} by user {current_user.id}")
        return jsonify({'message': 'Rider deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to delete general rider {id}: {e}")
        return jsonify({'error': 'Failed to delete rider'}), 400
