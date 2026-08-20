from functools import wraps
import re

from flask import jsonify, request, current_app
from flask_jwt_extended import get_jwt_identity
from models import User, db


VALID_ROLES = frozenset({'central_admin', 'branch_admin', 'agent'})

BRANCH_SCOPED_MODELS = {}


def set_branch_scoped_models(models_dict):
    BRANCH_SCOPED_MODELS.update(models_dict)


def get_current_user():
    identity = get_jwt_identity()
    if identity is None:
        return None
    try:
        return db.session.get(User, int(identity))
    except (TypeError, ValueError):
        return None


def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            if not user.is_active:
                return jsonify({'error': 'Account is deactivated'}), 403
            if user.role not in roles:
                current_app.logger.warning(
                    f"Role escalation attempt: user {user.id} (role={user.role}) "
                    f"accessed endpoint requiring {roles}"
                )
                return jsonify({'error': 'Forbidden: insufficient permissions'}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


def branch_filter(query, model, user):
    if not user:
        return query
    if user.role == 'central_admin':
        return query
    if user.role in ('branch_admin', 'agent') and user.location_id is not None:
        return query.filter(model.location_id == user.location_id)
    return query


def get_branch_id(user, request_location_id=None):
    if user.role == 'central_admin' and request_location_id is not None:
        try:
            return int(request_location_id)
        except (TypeError, ValueError):
            pass
    if user.role in ('branch_admin', 'agent'):
        return user.location_id
    return None


# --- Input Validation Helpers ---
def validate_email(email):
    """Validate email format."""
    if not email or not isinstance(email, str):
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip().lower())) and len(email) <= 255


def validate_string_field(value, min_length=1, max_length=255, allow_empty=False):
    """Validate a string field length and type."""
    if value is None:
        return not min_length  # None is ok only if min_length is 0
    if not isinstance(value, str):
        return False
    if not allow_empty and not value.strip():
        return False
    return min_length <= len(value.strip()) <= max_length


def validate_phone(phone):
    """Validate phone number format (digits only, 10-15 chars)."""
    if not phone or not isinstance(phone, str):
        return False
    cleaned = re.sub(r'[\s\-\(\)\+]', '', phone)
    return cleaned.isdigit() and 10 <= len(cleaned) <= 15


def validate_sort_field(sort_by, allowed_fields):
    """Ensure sort_by is in the allowed list."""
    if sort_by not in allowed_fields:
        return 'created_at'
    return sort_by


def validate_sort_order(sort_order):
    """Ensure sort_order is asc or desc."""
    if sort_order not in ('asc', 'desc'):
        return 'desc'
    return sort_order


def sanitize_search_input(value, max_length=200):
    """Sanitize search input to prevent abuse."""
    if not value or not isinstance(value, str):
        return ''
    return value.strip()[:max_length]
