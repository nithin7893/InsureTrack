from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import Policy, db
from sqlalchemy import func, case, extract
from utils.auth import get_current_user, branch_filter
import logging

analytics_bp = Blueprint('analytics', __name__)
logger = logging.getLogger(__name__)


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
        func.sum(Policy.total_premium).label('premium'),
        func.count(Policy.id).label('count')
    ).group_by(Policy.company).order_by(func.sum(Policy.total_premium).desc()).all()

    return jsonify([
        {
            'company': r.company,
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
