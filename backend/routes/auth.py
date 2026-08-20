from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import check_password_hash
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from models import User, RevokedToken, db
from datetime import datetime
from app import limiter
import re

auth_bp = Blueprint('auth', __name__)

# --- Password Validation ---
def validate_password_strength(password):
    """Enforce minimum password complexity."""
    errors = []
    if len(password) < 8:
        errors.append('Password must be at least 8 characters long')
    if len(password) > 128:
        errors.append('Password must not exceed 128 characters')
    if not re.search(r'[A-Z]', password):
        errors.append('Password must contain at least one uppercase letter')
    if not re.search(r'[a-z]', password):
        errors.append('Password must contain at least one lowercase letter')
    if not re.search(r'[0-9]', password):
        errors.append('Password must contain at least one digit')
    return errors


def is_token_revoked(jwt_header, jwt_payload):
    """Check if a JWT token has been revoked."""
    jti = jwt_payload.get('jti')
    if not jti:
        return True
    return db.session.query(RevokedToken).filter_by(jti=jti).first() is not None


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10/minute")
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    # Input length limits
    if len(email) > 255 or len(password) > 128:
        return jsonify({'error': 'Invalid input'}), 400

    user = User.query.filter_by(email=email).first()

    # Constant-time comparison: always hash even on miss to prevent timing attacks
    if not user:
        # Perform a dummy hash to prevent timing-based user enumeration
        from werkzeug.security import generate_password_hash
        generate_password_hash('dummy_password_for_timing')
        return jsonify({'error': 'Invalid email or password'}), 401

    if not check_password_hash(user.password, password):
        current_app.logger.warning(f"Failed login attempt for {email} from {request.remote_addr}")
        return jsonify({'error': 'Invalid email or password'}), 401

    if not user.is_active:
        current_app.logger.warning(f"Login attempt on deactivated account: {email}")
        return jsonify({'error': 'Account is deactivated'}), 403

    if user.role != 'central_admin' and not user.location_id:
        return jsonify({'error': 'No branch assigned. Please contact your administrator.'}), 403

    additional_claims = {
        'role': user.role,
        'name': user.name,
        'location_id': user.location_id
    }

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims=additional_claims
    )
    refresh_token = create_refresh_token(
        identity=str(user.id),
        additional_claims={'role': user.role}
    )

    current_app.logger.info(f"Successful login: {email} from {request.remote_addr}")

    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict()
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Issue a new access token using a valid refresh token."""
    identity = get_jwt_identity()
    user = db.session.get(User, int(identity))

    if not user or not user.is_active:
        return jsonify({'error': 'User not found or deactivated'}), 401

    # Revoke the current refresh token (token rotation)
    old_jti = get_jwt().get('jti')
    if old_jti:
        revoked = RevokedToken(jti=old_jti)
        db.session.add(revoked)
        db.session.commit()

    additional_claims = {
        'role': user.role,
        'name': user.name,
        'location_id': user.location_id
    }

    new_access_token = create_access_token(
        identity=str(user.id),
        additional_claims=additional_claims
    )
    new_refresh_token = create_refresh_token(
        identity=str(user.id),
        additional_claims={'role': user.role}
    )

    return jsonify({
        'access_token': new_access_token,
        'refresh_token': new_refresh_token
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required(verify_type=False)
def logout():
    """Revoke the current access or refresh token."""
    jwt_data = get_jwt()
    jti = jwt_data.get('jti')
    if jti:
        revoked = RevokedToken(jti=jti)
        db.session.add(revoked)
        db.session.commit()

    current_app.logger.info(f"User {get_jwt_identity()} logged out")
    return jsonify({'message': 'Successfully logged out'}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    """Return the current authenticated user's profile."""
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active:
        return jsonify({'error': 'User not found'}), 401
    return jsonify(user.to_dict()), 200
