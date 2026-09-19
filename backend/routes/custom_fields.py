from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required
from models import db, CustomField, User
from utils.auth import get_current_user, validate_string_field
import logging

custom_fields_bp = Blueprint('custom_fields', __name__)
logger = logging.getLogger(__name__)

VALID_INSURANCE_TYPES = frozenset({'Life', 'Health', 'General'})


def require_central_admin():
    current_user = get_current_user()
    return current_user is not None and current_user.role == 'central_admin'


def validate_field_type(value):
    return value in CustomField.VALID_TYPES


def validate_options(field_type, options):
    if field_type != 'select':
        return None
    if not isinstance(options, list) or not options:
        return []
    cleaned = [str(o).strip()[:100] for o in options]
    cleaned = [o for o in cleaned if o]
    return cleaned


@custom_fields_bp.route('', methods=['GET'])
@jwt_required()
def get_custom_fields():
    # Agents see only active fields. Admins can opt into inactive ones.
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    insurance_type = request.args.get('insurance_type', '').strip()

    current_user = get_current_user()
    is_admin = current_user and current_user.role in ('central_admin', 'branch_admin')

    query = CustomField.query
    if not (is_admin and include_inactive):
        query = query.filter_by(is_active=True)

    fields = query.order_by(CustomField.id.asc()).all()

    # Fields apply globally (insurance_type empty) or to the requested type.
    if insurance_type:
        fields = [f for f in fields if (not f.insurance_type or f.insurance_type == insurance_type)]

    return jsonify([f.to_dict() for f in fields])


@custom_fields_bp.route('', methods=['POST'])
@jwt_required()
def create_custom_field():
    if not require_central_admin():
        return jsonify({'error': 'Central admin access required'}), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    label = str(data.get('label') or '').strip()
    if not label:
        return jsonify({'error': 'Label is required'}), 400
    if not validate_string_field(label, max_length=255):
        return jsonify({'error': 'Label must be 1-255 characters'}), 400

    field_type = str(data.get('field_type') or 'text').strip().lower()
    if not validate_field_type(field_type):
        return jsonify({'error': f'field_type must be one of: {", ".join(sorted(CustomField.VALID_TYPES))}'}), 400

    insurance_type = data.get('insurance_type') or None
    if insurance_type and insurance_type not in VALID_INSURANCE_TYPES:
        return jsonify({'error': f'insurance_type must be one of: {", ".join(sorted(VALID_INSURANCE_TYPES))} or empty for all'}), 400

    options = validate_options(field_type, data.get('options'))
    if field_type == 'select' and not options:
        return jsonify({'error': 'select fields require at least one option'}), 400

    field = CustomField(
        label=label[:255],
        insurance_type=insurance_type,
        field_type=field_type,
        options=options,
        is_required=bool(data.get('is_required', False)),
        is_active=True,
    )
    db.session.add(field)
    db.session.commit()

    logger.info(f"Custom field created: {field.label} by user {get_current_user().id}")
    return jsonify(field.to_dict()), 201


@custom_fields_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_custom_field(id):
    if not require_central_admin():
        return jsonify({'error': 'Central admin access required'}), 403

    field = db.session.get(CustomField, id)
    if not field:
        abort(404)

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    if data.get('label'):
        label = str(data['label']).strip()
        if not validate_string_field(label, max_length=255):
            return jsonify({'error': 'Label must be 1-255 characters'}), 400
        field.label = label[:255]

    if data.get('field_type'):
        field_type = str(data['field_type']).strip().lower()
        if not validate_field_type(field_type):
            return jsonify({'error': f'field_type must be one of: {", ".join(sorted(CustomField.VALID_TYPES))}'}), 400
        field.field_type = field_type
        if field_type != 'select':
            field.options = None
        elif 'options' in data:
            options = validate_options(field_type, data.get('options'))
            if not options:
                return jsonify({'error': 'select fields require at least one option'}), 400
            field.options = options

    if 'insurance_type' in data:
        insurance_type = data.get('insurance_type') or None
        if insurance_type and insurance_type not in VALID_INSURANCE_TYPES:
            return jsonify({'error': f'insurance_type must be one of: {", ".join(sorted(VALID_INSURANCE_TYPES))} or empty for all'}), 400
        field.insurance_type = insurance_type

    if 'is_required' in data:
        field.is_required = bool(data['is_required'])
    if 'is_active' in data:
        field.is_active = bool(data['is_active'])

    db.session.commit()
    logger.info(f"Custom field updated: {field.label} by user {get_current_user().id}")
    return jsonify(field.to_dict())


@custom_fields_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_custom_field(id):
    if not require_central_admin():
        return jsonify({'error': 'Central admin access required'}), 403

    field = db.session.get(CustomField, id)
    if not field:
        abort(404)

    field.is_active = False
    db.session.commit()
    return jsonify({'message': 'Custom field deactivated'})