"""Central-admin approval queue for policies that require review.

When a user has ``requires_policy_approval`` enabled, the policies they create
are stored with ``approval_status='pending'`` and never appear in the normal
policies list until a central admin approves them. The pending policies double
as the central admin's notifications: approving publishes the policy, while
rejecting removes it entirely.
"""
from datetime import datetime, timezone

from flask import Blueprint, abort, jsonify
from flask_jwt_extended import jwt_required

from models import Policy, Vehicle, db
from utils.auth import get_current_user

policy_approvals_bp = Blueprint('policy_approvals', __name__)


def _require_central_admin():
    current_user = get_current_user()
    if not current_user:
        return None, (jsonify({'error': 'Authentication required'}), 401)
    if current_user.role != 'central_admin':
        return None, (jsonify({'error': 'Only central admin can review policy approvals'}), 403)
    return current_user, None


@policy_approvals_bp.route('', methods=['GET'])
@jwt_required()
def get_pending_approvals():
    current_user, error = _require_central_admin()
    if error:
        return error

    policies = (
        Policy.query
        .filter(Policy.approval_status == 'pending')
        .order_by(Policy.created_at.asc())
        .all()
    )
    return jsonify([p.to_dict() for p in policies]), 200


@policy_approvals_bp.route('/pending-count', methods=['GET'])
@jwt_required()
def get_pending_approval_count():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401
    if current_user.role != 'central_admin':
        return jsonify({'count': 0}), 200

    count = Policy.query.filter(Policy.approval_status == 'pending').count()
    return jsonify({'count': count}), 200


@policy_approvals_bp.route('/<int:policy_id>/approve', methods=['PUT'])
@jwt_required()
def approve_policy(policy_id):
    current_user, error = _require_central_admin()
    if error:
        return error

    policy = db.session.get(Policy, policy_id)
    if not policy:
        abort(404)
    if policy.approval_status != 'pending':
        return jsonify({'error': 'Policy is not pending approval'}), 400

    policy.approval_status = 'approved'
    policy.approved_by = current_user.id
    policy.approved_by_name = current_user.name or current_user.email
    policy.approved_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.commit()

    return jsonify(policy.to_dict()), 200


@policy_approvals_bp.route('/<int:policy_id>/reject', methods=['PUT'])
@jwt_required()
def reject_policy(policy_id):
    current_user, error = _require_central_admin()
    if error:
        return error

    policy = db.session.get(Policy, policy_id)
    if not policy:
        abort(404)
    if policy.approval_status != 'pending':
        return jsonify({'error': 'Policy is not pending approval'}), 400

    vehicle_id = policy.vehicle_id
    policy_number = policy.policy_number

    # Remove the rejected policy and any vehicle that belonged only to it.
    db.session.delete(policy)
    db.session.flush()
    if vehicle_id:
        remaining = Policy.query.filter_by(vehicle_id=vehicle_id).count()
        if remaining == 0:
            vehicle = db.session.get(Vehicle, vehicle_id)
            if vehicle:
                db.session.delete(vehicle)

    db.session.commit()
    return jsonify({
        'message': 'Policy request rejected and removed',
        'policy_number': policy_number,
    }), 200
