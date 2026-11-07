from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from models import db, Company, User
from utils.auth import validate_string_field
import logging

companies_bp = Blueprint('companies', __name__)
logger = logging.getLogger(__name__)

VALID_INSURANCE_TYPES = frozenset({'Life', 'Health', 'General'})


def require_admin():
    identity = None
    from flask_jwt_extended import get_jwt_identity
    identity = get_jwt_identity()
    if not identity:
        return False
    user = db.session.get(User, int(identity))
    return user and user.role in ('central_admin', 'branch_admin')


def _clean_name(value):
    return (value or '').strip() if isinstance(value, str) else ''


def _active_duplicate_exists(name, insurance_type, exclude_id=None):
    """Return an active company with the same (case-insensitive) name and type."""
    query = Company.query.filter(
        Company.insurance_type == insurance_type,
        Company.is_active.is_(True),
        func.lower(Company.name) == name.lower(),
    )
    if exclude_id is not None:
        query = query.filter(Company.id != exclude_id)
    return query.first()


@companies_bp.route('', methods=['GET'])
@jwt_required()
def get_companies():
    insurance_type = request.args.get('insurance_type')
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'

    query = Company.query
    if not include_inactive:
        query = query.filter_by(is_active=True)
    if insurance_type and insurance_type in VALID_INSURANCE_TYPES:
        query = query.filter_by(insurance_type=insurance_type)

    companies = query.order_by(Company.insurance_type.asc(), Company.name.asc()).all()
    return jsonify([c.to_dict() for c in companies])


@companies_bp.route('', methods=['POST'])
@jwt_required()
def create_company():
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    name = _clean_name(data.get('name'))
    insurance_type = _clean_name(data.get('insurance_type'))

    if not name or not insurance_type:
        return jsonify({'error': 'Name and insurance_type are required'}), 400

    if not validate_string_field(name, max_length=100):
        return jsonify({'error': 'Name must be 1-100 characters'}), 400

    if insurance_type not in VALID_INSURANCE_TYPES:
        return jsonify({'error': f'insurance_type must be one of: {", ".join(sorted(VALID_INSURANCE_TYPES))}'}), 400

    if _active_duplicate_exists(name, insurance_type):
        return jsonify({'error': 'Company already exists for this insurance type'}), 400

    company = Company(
        name=name[:100],
        insurance_type=insurance_type
    )
    db.session.add(company)
    db.session.commit()

    logger.info(f"Company created: {name} ({insurance_type})")
    return jsonify(company.to_dict()), 201


@companies_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_company(id):
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403

    company = db.session.get(Company, id)
    if not company:
        abort(404)
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    name = company.name
    if 'name' in data:
        name = _clean_name(data.get('name'))
        if not validate_string_field(name, max_length=100):
            return jsonify({'error': 'Name must be 1-100 characters'}), 400

    insurance_type = company.insurance_type
    if data.get('insurance_type'):
        insurance_type = _clean_name(data['insurance_type'])
        if insurance_type not in VALID_INSURANCE_TYPES:
            return jsonify({'error': 'Invalid insurance_type'}), 400

    is_active = company.is_active
    if 'is_active' in data:
        is_active = bool(data['is_active'])

    if name != company.name or insurance_type != company.insurance_type or is_active:
        if _active_duplicate_exists(name, insurance_type, exclude_id=company.id):
            return jsonify({'error': 'Company already exists for this insurance type'}), 400

    company.name = name[:100]
    company.insurance_type = insurance_type
    if 'is_active' in data:
        company.is_active = is_active

    db.session.commit()
    return jsonify(company.to_dict())


@companies_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_company(id):
    if not require_admin():
        return jsonify({'error': 'Admin access required'}), 403

    company = db.session.get(Company, id)
    if not company:
        abort(404)
    company.is_active = False
    db.session.commit()
    return jsonify({'message': 'Company deactivated'})


@companies_bp.route('/types', methods=['GET'])
@jwt_required()
def get_insurance_types():
    types = db.session.query(Company.insurance_type).distinct().filter_by(is_active=True).all()
    return jsonify([t[0] for t in types])
