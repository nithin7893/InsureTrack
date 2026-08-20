from flask import Blueprint, request, jsonify, current_app, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from models import db, User, Location
from werkzeug.security import generate_password_hash
from utils.auth import get_current_user, branch_filter, validate_email, validate_string_field
import logging

users_bp = Blueprint('users', __name__)
logger = logging.getLogger(__name__)

VALID_ROLES = frozenset({'central_admin', 'branch_admin', 'agent'})


@users_bp.route('', methods=['GET'])
@jwt_required()
def get_users():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role == 'agent':
        return jsonify({'error': 'Forbidden'}), 403

    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    query = User.query
    if not include_inactive:
        query = query.filter_by(is_active=True)

    query = branch_filter(query, User, current_user)
    users = query.all()
    return jsonify([u.to_dict() for u in users])


@users_bp.route('', methods=['POST'])
@jwt_required()
def create_user():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role not in ('central_admin', 'branch_admin'):
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    required = ['email', 'password', 'name', 'role']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    email = data['email'].strip().lower()
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400

    if not validate_string_field(data['name'], min_length=1, max_length=255):
        return jsonify({'error': 'Name is required (max 255 characters)'}), 400

    if data['role'] not in VALID_ROLES:
        return jsonify({'error': f'Role must be one of: {", ".join(sorted(VALID_ROLES))}'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400

    if current_user.role == 'branch_admin':
        if data['role'] not in ('agent', 'branch_admin'):
            return jsonify({'error': 'Branch admin can only create agents or branch admins'}), 403
        data['location_id'] = current_user.location_id

    if data['role'] == 'central_admin' and current_user.role != 'central_admin':
        return jsonify({'error': 'Only central admin can create central admins'}), 403

    location_id = data.get('location_id')
    if location_id is not None:
        try:
            location_id = int(location_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid location_id'}), 400
        loc = db.session.get(Location, location_id)
        if not loc:
            return jsonify({'error': 'Invalid location_id'}), 400
        data['location'] = loc.name

    # Enforce password complexity
    from routes.auth import validate_password_strength
    pwd_errors = validate_password_strength(data['password'])
    if pwd_errors:
        return jsonify({'error': '; '.join(pwd_errors)}), 400

    user = User(
        email=email,
        password=generate_password_hash(data['password']),
        name=data['name'][:255],
        role=data['role'],
        location=data.get('location', ''),
        location_id=location_id if location_id else None,
        is_active=True
    )
    db.session.add(user)
    db.session.commit()

    logger.info(f"User created: {email} (role={data['role']}) by user {current_user.id}")
    return jsonify(user.to_dict()), 201


@users_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_user(id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role not in ('central_admin', 'branch_admin'):
        return jsonify({'error': 'Forbidden'}), 403

    user = db.session.get(User, id)
    if not user:
        abort(404)

    if current_user.role == 'branch_admin':
        if user.location_id != current_user.location_id:
            return jsonify({'error': 'Cannot modify users from another branch'}), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    if data.get('name'):
        user.name = data['name'][:255]
    if data.get('role') and data['role'] in VALID_ROLES:
        if current_user.role == 'branch_admin' and data['role'] not in ('agent', 'branch_admin'):
            return jsonify({'error': 'Branch admin cannot assign this role'}), 403
        if data['role'] == 'central_admin' and current_user.role != 'central_admin':
            return jsonify({'error': 'Only central admin can assign central_admin role'}), 403
        user.role = data['role']
    if 'location_id' in data:
        if current_user.role == 'central_admin':
            if data['location_id']:
                try:
                    loc = db.session.get(Location, int(data['location_id']))
                except (TypeError, ValueError):
                    loc = None
            else:
                loc = None
            user.location_id = int(data['location_id']) if data['location_id'] else None
            user.location = loc.name if loc else ''
    if 'is_active' in data:
        user.is_active = bool(data['is_active'])
    if data.get('password'):
        from routes.auth import validate_password_strength
        pwd_errors = validate_password_strength(data['password'])
        if pwd_errors:
            return jsonify({'error': '; '.join(pwd_errors)}), 400
        user.password = generate_password_hash(data['password'])

    db.session.commit()
    logger.info(f"User updated: {user.email} by user {current_user.id}")
    return jsonify(user.to_dict())


@users_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def deactivate_user(id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role not in ('central_admin', 'branch_admin'):
        return jsonify({'error': 'Forbidden'}), 403

    current_user_id = int(get_jwt_identity())
    if id == current_user_id:
        return jsonify({'error': 'Cannot deactivate your own account'}), 400

    user = db.session.get(User, id)
    if not user:
        abort(404)

    if current_user.role == 'branch_admin':
        if user.location_id != current_user.location_id:
            return jsonify({'error': 'Cannot deactivate users from another branch'}), 403

    user.is_active = False
    db.session.commit()
    logger.info(f"User deactivated: {user.email} by user {current_user.id}")
    return jsonify({'message': 'User deactivated'})
