from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required
from models import db, Location
from utils.auth import get_current_user, require_role, validate_string_field
import logging

locations_bp = Blueprint('locations', __name__)
logger = logging.getLogger(__name__)


@locations_bp.route('', methods=['GET'])
def get_locations():
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    query = Location.query
    if not include_inactive:
        query = query.filter_by(is_active=True)
    locations = query.all()
    return jsonify([l.to_dict() for l in locations])


@locations_bp.route('', methods=['POST'])
@jwt_required()
def create_location():
    user = get_current_user()
    if not user or user.role != 'central_admin':
        return jsonify({'error': 'Only central admin can create branches'}), 403

    data = request.get_json(silent=True)
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    name = data['name'].strip()
    if not validate_string_field(name, max_length=255):
        return jsonify({'error': 'Name must be 1-255 characters'}), 400

    if Location.query.filter_by(name=name).first():
        return jsonify({'error': 'Location already exists'}), 400

    location = Location(name=name[:255])
    db.session.add(location)
    db.session.commit()

    logger.info(f"Location created: {name} by user {user.id}")
    return jsonify(location.to_dict()), 201


@locations_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_location(id):
    user = get_current_user()
    if not user or user.role != 'central_admin':
        return jsonify({'error': 'Only central admin can update branches'}), 403

    location = db.session.get(Location, id)
    if not location:
        abort(404)
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    if data.get('name'):
        name = data['name'].strip()
        if not validate_string_field(name, max_length=255):
            return jsonify({'error': 'Name must be 1-255 characters'}), 400
        existing = Location.query.filter(Location.name == name, Location.id != id).first()
        if existing:
            return jsonify({'error': 'Location already exists'}), 400
        location.name = name[:255]
    if 'is_active' in data:
        location.is_active = bool(data['is_active'])

    db.session.commit()
    return jsonify(location.to_dict())


@locations_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_location(id):
    user = get_current_user()
    if not user or user.role != 'central_admin':
        return jsonify({'error': 'Only central admin can deactivate branches'}), 403

    location = db.session.get(Location, id)
    if not location:
        abort(404)
    location.is_active = False
    db.session.commit()

    logger.info(f"Location deactivated: {location.name} by user {user.id}")
    return jsonify({'message': 'Location deactivated'})
