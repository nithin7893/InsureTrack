from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import Policy, Company, db
from sqlalchemy import func, case, extract
from utils.auth import get_current_user, branch_filter
import logging

analytics_bp = Blueprint('analytics', __name__)
logger = logging.getLogger(__name__)


def _company_lookup():
    """Map (lower(name), insurance_type) to the companies table row.

    If a name/type pair exists more than once (legacy data), prefer the active
    row so analytics reports it as canonical.
    """
    rows = Company.query.with_entities(
        Company.name, Company.insurance_type, Company.is_active
    ).all()
    index = {}
    for row in rows:
        key = (row.name.lower(), row.insurance_type)
        current = index.get(key)
        if current is None or (row.is_active and not current.is_active):
            index[key] = row
    return index


@analytics_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_summary():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    base_query = Policy.query
    base_query = branch_filter(base_query, Policy, current_user)

    total_policies = base_query.count()

    if total_policies == 0:
        return jsonify({
            'total_policies': 0,
            'total_premium': 0,
            'life_count': 0,
            'health_count': 0,
            'general_count': 0
        }), 200

    total_premium = base_query.with_entities(func.sum(Policy.total_premium)).scalar() or 0
    life_count = base_query.filter_by(insurance_type='Life').count()
    health_count = base_query.filter_by(insurance_type='Health').count()
    general_count = base_query.filter_by(insurance_type='General').count()

    return jsonify({
        'total_policies': total_policies,
        'total_premium': float(total_premium),
        'life_count': life_count,
        'health_count': health_count,
        'general_count': general_count
    }), 200


@analytics_bp.route('/premium-by-type', methods=['GET'])
@jwt_required()
def get_premium_by_type():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    base_query = Policy.query
    base_query = branch_filter(base_query, Policy, current_user)

    results = base_query.with_entities(
        Policy.insurance_type,
        func.sum(Policy.total_premium).label('premium'),
        func.count(Policy.id).label('count')
    ).group_by(Policy.insurance_type).all()

    return jsonify([
        {
            'type': r.insurance_type,
            'premium': float(r.premium),
            'count': r.count
        }
        for r in results
    ]), 200


@analytics_bp.route('/monthly-revenue', methods=['GET'])
@jwt_required()
def get_monthly_revenue():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    base_query = Policy.query
    base_query = branch_filter(base_query, Policy, current_user)

    is_sqlite = 'sqlite' in str(db.engine.url)

    if is_sqlite:
        month_col = func.strftime('%Y-%m', Policy.created_at)
    else:
        month_col = func.to_char(Policy.created_at, 'YYYY-MM')

    results = base_query.with_entities(
        month_col.label('month'),
        func.sum(Policy.total_premium).label('revenue'),
        func.count(Policy.id).label('count')
    ).group_by('month').order_by('month').all()

    return jsonify([
        {
            'month': r.month,
            'revenue': float(r.revenue),
            'count': r.count
        }
        for r in results
    ]), 200


@analytics_bp.route('/premium-by-company', methods=['GET'])
@jwt_required()
def get_premium_by_company():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    base_query = Policy.query
    base_query = branch_filter(base_query, Policy, current_user)

    results = base_query.with_entities(
        Policy.company,
        Policy.insurance_type,
        func.sum(Policy.total_premium).label('premium'),
        func.count(Policy.id).label('count')
    ).group_by(Policy.company, Policy.insurance_type).order_by(func.sum(Policy.total_premium).desc()).all()

    lookup = _company_lookup()
    rows = []
    for r in results:
        match = lookup.get((r.company.lower(), r.insurance_type))
        rows.append({
            'company': r.company,
            'canonical_company': match.name if match else r.company,
            'insurance_type': r.insurance_type,
            'premium': float(r.premium),
            'count': r.count,
            'matched': match is not None,
            'is_active': bool(match.is_active) if match else False
        })
    return jsonify(rows), 200


@analytics_bp.route('/premium-by-branch', methods=['GET'])
@jwt_required()
def get_premium_by_branch():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    base_query = Policy.query
    base_query = branch_filter(base_query, Policy, current_user)

    results = base_query.with_entities(
        Policy.location,
        func.sum(Policy.total_premium).label('premium'),
        func.count(Policy.id).label('count')
    ).group_by(Policy.location).order_by(func.sum(Policy.total_premium).desc()).all()

    return jsonify([
        {
            'branch': r.location or 'Unassigned',
            'premium': float(r.premium),
            'count': r.count
        }
        for r in results
    ]), 200


@analytics_bp.route('/premium-by-mode', methods=['GET'])
@jwt_required()
def get_premium_by_mode():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    base_query = Policy.query
    base_query = branch_filter(base_query, Policy, current_user)

    results = base_query.with_entities(
        Policy.premium_mode,
        func.sum(Policy.total_premium).label('premium'),
        func.count(Policy.id).label('count')
    ).filter(Policy.premium_mode.isnot(None)).group_by(Policy.premium_mode).all()

    return jsonify([
        {
            'mode': r.premium_mode,
            'premium': float(r.premium),
            'count': r.count
        }
        for r in results
    ]), 200


@analytics_bp.route('/agent-performance', methods=['GET'])
@jwt_required()
def get_agent_performance():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    base_query = Policy.query
    base_query = branch_filter(base_query, Policy, current_user)

    results = base_query.with_entities(
        Policy.agent_name,
        func.sum(Policy.total_premium).label('premium'),
        func.count(Policy.id).label('count')
    ).filter(Policy.agent_name.isnot(None)).group_by(Policy.agent_name).all()

    return jsonify([
        {
            'agent': r.agent_name,
            'premium': float(r.premium),
            'count': r.count
        }
        for r in results
    ]), 200
