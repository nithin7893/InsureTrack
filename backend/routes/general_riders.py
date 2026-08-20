from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import GeneralRider, PolicyRider, db
from utils.auth import get_current_user
import logging

general_riders_bp = Blueprint('general_riders', __name__)
logger = logging.getLogger(__name__)


@general_riders_bp.route('', methods=['GET'])
@jwt_required()
def get_general_riders():
    """Get all general riders, optionally filtered by category."""
    category = request.args.get('category', '')
    show_inactive = request.args.get('show_inactive', 'false').lower() == 'true'
    
    query = GeneralRider.query
    if not show_inactive:
        query = query.filter_by(is_active=True)
    if category:
        query = query.filter_by(category=category)
    
    riders = query.order_by(GeneralRider.category, GeneralRider.name).all()
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
    
    rider = GeneralRider(
        name=name[:255],
        description=description[:500] if description else None,
        category=category[:100]
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
