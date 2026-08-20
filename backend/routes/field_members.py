from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required
from models import db, FieldMember, User, Location
from utils.auth import get_current_user, branch_filter, validate_string_field
import logging

field_members_bp = Blueprint('field_members', __name__)
logger = logging.getLogger(__name__)


@field_members_bp.route('', methods=['GET'])
@jwt_required()
def get_field_members():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    include_pending = request.args.get('include_pending', 'false').lower() == 'true'
    pending_only = request.args.get('pending_only', 'false').lower() == 'true'

    query = FieldMember.query

    if pending_only and current_user.role == 'central_admin':
        query = query.filter_by(approval_status='pending')
    else:
        if not include_pending:
            query = query.filter_by(approval_status='approved')

    if not include_inactive:
        query = query.filter_by(is_active=True)

    query = branch_filter(query, FieldMember, current_user)
    members = query.all()
    return jsonify([m.to_dict() for m in members])


@field_members_bp.route('/pending-count', methods=['GET'])
@jwt_required()
def get_pending_count():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role != 'central_admin':
        return jsonify({'count': 0})

    count = FieldMember.query.filter_by(approval_status='pending').count()
    return jsonify({'count': count})


@field_members_bp.route('', methods=['POST'])
@jwt_required()
def create_field_member():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role not in ('central_admin', 'branch_admin'):
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    if not data.get('name') or not validate_string_field(data['name'], max_length=255):
        return jsonify({'error': 'Name is required (max 255 characters)'}), 400

    location_id = data.get('location_id')
    if not location_id and current_user.role != 'central_admin':
        location_id = current_user.location_id

    if not location_id:
        return jsonify({'error': 'location_id is required'}), 400

    try:
        location_id = int(location_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid location_id'}), 400

    if current_user.role == 'branch_admin' and location_id != current_user.location_id:
        return jsonify({'error': 'Cannot create field members for another branch'}), 403

    loc = db.session.get(Location, location_id)
    if not loc:
        return jsonify({'error': 'Invalid location_id'}), 400

    approval_status = 'approved' if current_user.role == 'central_admin' else 'pending'

    member = FieldMember(
        name=data['name'][:255],
        location=loc.name,
        location_id=location_id,
        is_active=True,
        approval_status=approval_status,
        requested_by=current_user.id,
        requested_by_name=current_user.name
    )
    db.session.add(member)
    db.session.commit()

    logger.info(f"Field member created: {data['name']} by user {current_user.id} (status={approval_status})")
    return jsonify(member.to_dict()), 201


@field_members_bp.route('/<int:id>/approve', methods=['PUT'])
@jwt_required()
def approve_field_member(id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role != 'central_admin':
        return jsonify({'error': 'Only central admin can approve field members'}), 403

    member = db.session.get(FieldMember, id)
    if not member:
        abort(404)
    if member.approval_status != 'pending':
        return jsonify({'error': 'Member is not pending approval'}), 400

    member.approval_status = 'approved'
    db.session.commit()

    logger.info(f"Field member approved: {member.name} by user {current_user.id}")
    return jsonify(member.to_dict())


@field_members_bp.route('/<int:id>/reject', methods=['PUT'])
@jwt_required()
def reject_field_member(id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role != 'central_admin':
        return jsonify({'error': 'Only central admin can reject field members'}), 403

    member = db.session.get(FieldMember, id)
    if not member:
        abort(404)
    if member.approval_status != 'pending':
        return jsonify({'error': 'Member is not pending approval'}), 400

    member.approval_status = 'rejected'
    member.is_active = False
    db.session.commit()

    logger.info(f"Field member rejected: {member.name} by user {current_user.id}")
    return jsonify(member.to_dict())


@field_members_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_field_member(id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role not in ('central_admin', 'branch_admin'):
        return jsonify({'error': 'Forbidden'}), 403

    member = db.session.get(FieldMember, id)
    if not member:
        abort(404)

    if current_user.role == 'branch_admin' and member.location_id != current_user.location_id:
        return jsonify({'error': 'Cannot modify field members from another branch'}), 403

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid request body'}), 400

    if data.get('name'):
        member.name = data['name'][:255]
    if 'location_id' in data:
        if current_user.role == 'central_admin' or (
            current_user.role == 'branch_admin' and data['location_id'] == current_user.location_id
        ):
            if data['location_id']:
                try:
                    loc = db.session.get(Location, int(data['location_id']))
                except (TypeError, ValueError):
                    loc = None
            else:
                loc = None
            if loc:
                member.location_id = loc.id
                member.location = loc.name
    if 'is_active' in data:
        member.is_active = bool(data['is_active'])

    db.session.commit()
    return jsonify(member.to_dict())


@field_members_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def deactivate_field_member(id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.role not in ('central_admin', 'branch_admin'):
        return jsonify({'error': 'Forbidden'}), 403

    member = db.session.get(FieldMember, id)
    if not member:
        abort(404)

    if current_user.role == 'branch_admin' and member.location_id != current_user.location_id:
        return jsonify({'error': 'Cannot deactivate field members from another branch'}), 403

    member.is_active = False
    db.session.commit()

    logger.info(f"Field member deactivated: {member.name} by user {current_user.id}")
    return jsonify({'message': 'Field member deactivated'})
