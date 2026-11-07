import json
from collections import Counter
from datetime import date
from pathlib import Path

from conftest import auth_header
from models import Company, Policy, ProductMaster, db

CATALOGUE_PATH = Path(__file__).resolve().parents[2] / 'docs' / 'migrations' / 'company-catalogue.json'


def add_policy(app, *, company, insurance_type='Life', policy_number,
               premium=1000, location='Branch A', product='Term Plan'):
    with app.app_context():
        policy = Policy(
            insurance_type=insurance_type,
            company=company,
            category='',
            sub_category='',
            product_category='',
            product=product,
            customer_name='Analytics Customer',
            primary_phone='9876543210',
            policy_number=policy_number,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
            premium_mode='Annual',
            base_premium=premium,
            rider_premium=0,
            gst=0,
            total_premium=premium,
            policy_status='Fresh',
            agent_name='Agent A',
            location=location,
        )
        db.session.add(policy)
        db.session.commit()
        return policy.id


def test_authoritative_catalogue_file_is_complete_and_consistent():
    data = json.loads(CATALOGUE_PATH.read_text(encoding='utf-8'))
    entries = data['entries']

    assert Counter(e['insurance_type'] for e in entries) == {
        'Life': 26, 'Health': 8, 'General': 28,
    }
    assert len(entries) == 62

    existing_ids = sorted(e['existing_id'] for e in entries if e['existing_id'] is not None)
    assert existing_ids == [3, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19]
    assert sum(1 for e in entries if e['existing_id'] is None) == 51

    keys = {(e['official_name'].lower(), e['insurance_type']) for e in entries}
    assert len(keys) == len(entries)
    for entry in entries:
        name = entry['official_name']
        assert name == name.strip()
        assert 0 < len(name) <= 100


def test_list_companies_returns_active_only(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = client.get('/api/companies', headers=headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert len(body) == 9
    assert all(c['is_active'] for c in body)
    assert 'lic' not in {c['name'] for c in body}


def test_list_companies_can_include_inactive(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = client.get('/api/companies?include_inactive=true', headers=headers)
    assert resp.status_code == 200
    legacy = [c for c in resp.get_json() if c['name'] == 'lic']
    assert len(legacy) == 1
    assert legacy[0]['is_active'] is False


def test_companies_filter_by_insurance_type(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = client.get('/api/companies?insurance_type=Health', headers=headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body
    assert {c['insurance_type'] for c in body} == {'Health'}


def test_duplicate_active_company_is_rejected_case_insensitively(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = client.post('/api/companies', json={
        'name': 'care health insurance ltd.',
        'insurance_type': 'Health',
    }, headers=headers)
    assert resp.status_code == 400
    assert 'already exists' in resp.get_json()['error'].lower()


def test_same_name_can_exist_for_different_insurance_type(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    name = 'Generali Central Insurance Company Limited'
    resp = client.post('/api/companies', json={
        'name': name,
        'insurance_type': 'General',
    }, headers=headers)
    assert resp.status_code == 201

    resp = client.post('/api/companies', json={
        'name': name,
        'insurance_type': 'Health',
    }, headers=headers)
    assert resp.status_code == 201


def test_company_update_prevents_duplicate(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    with client.application.app_context():
        target = Company.query.filter_by(
            name='Star Health & Allied Insurance Co.Ltd.',
            insurance_type='Health',
        ).first()
        target_id = target.id
    resp = client.put(f'/api/companies/{target_id}', json={
        'name': 'Care Health Insurance Ltd.',
    }, headers=headers)
    assert resp.status_code == 400


def test_policy_company_must_match_insurance_type(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    payload = {
        'insurance_type': 'Health',
        'company': 'Life Insurance Corporation of India',
        'product': 'Health Plan',
        'customer_name': 'Test Customer',
        'primary_phone': '9876543210',
        'policy_number': 'VALIDATION/2026/001',
        'start_date': '2026-01-01',
        'end_date': '2027-01-01',
        'premium_mode': 'Annual',
        'base_premium': 10000,
        'policy_status': 'Fresh',
    }
    resp = client.post('/api/policies', json=payload, headers=headers)
    assert resp.status_code == 400
    assert 'active company' in resp.get_json()['error'].lower()

    payload['company'] = 'Care Health Insurance Ltd.'
    resp = client.post('/api/policies', json=payload, headers=headers)
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()['company'] == 'Care Health Insurance Ltd.'


def test_legacy_policy_edit_preserves_unmatched_company(client, users, app):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    legacy_id = add_policy(
        app,
        company='DIGIT GLOW PLUS TERM LIFE INSURANCE',
        policy_number='LEGACY/2026/001',
    )

    resp = client.put(f'/api/policies/{legacy_id}', json={
        'customer_name': 'Renamed Customer',
    }, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['company'] == 'DIGIT GLOW PLUS TERM LIFE INSURANCE'

    # Explicitly selecting a company of another insurance type is rejected.
    resp = client.put(f'/api/policies/{legacy_id}', json={
        'company': 'Care Health Insurance Ltd.',
    }, headers=headers)
    assert resp.status_code == 400


def test_policy_type_change_revalidates_echoed_company(client, users, app):
    policy_id = add_policy(
        app,
        company='Life Insurance Corporation of India',
        policy_number='VALIDATION/2026/UPDATE',
    )
    headers = auth_header(client, 'admin@test.com', 'Admin@123')

    resp = client.put(f'/api/policies/{policy_id}', json={
        'insurance_type': 'Health',
        'company': 'Life Insurance Corporation of India',
    }, headers=headers)
    assert resp.status_code == 400
    assert 'active company' in resp.get_json()['error'].lower()


def test_product_company_must_match_insurance_type(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    payload = {
        'insurance_type': 'Health',
        'company_name': 'Life Insurance Corporation of India',
        'product_name': 'Health Product',
    }
    resp = client.post('/api/products', json=payload, headers=headers)
    assert resp.status_code == 400

    payload['company_name'] = 'Care Health Insurance Ltd.'
    resp = client.post('/api/products', json=payload, headers=headers)
    assert resp.status_code == 201, resp.get_json()

    payload['company_name'] = ''
    payload['product_name'] = 'Any Company Health Product'
    resp = client.post('/api/products', json=payload, headers=headers)
    assert resp.status_code == 201, resp.get_json()


def test_product_listing_matches_legacy_company_case_insensitively(client, users, app):
    with app.app_context():
        product = ProductMaster(
            insurance_type='General',
            company_name='GO DIGIT GENERAL INSURANCE LIMITED',
            category='',
            sub_category='',
            product_category='',
            product_name='Legacy Case Product',
            is_active=True,
        )
        db.session.add(product)
        db.session.commit()

    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = client.get(
        '/api/products?insurance_type=General&company_name=Go%20Digit%20General%20Insurance%20Limited',
        headers=headers,
    )
    assert resp.status_code == 200
    assert 'Legacy Case Product' in {p['product_name'] for p in resp.get_json()}


def test_legacy_product_edit_preserves_inactive_company(client, users, app):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    with app.app_context():
        product = ProductMaster(
            insurance_type='Life',
            company_name='lic',
            category='',
            sub_category='',
            product_category='',
            product_name='Legacy LIC Product',
            is_active=True,
        )
        db.session.add(product)
        db.session.commit()
        product_id = product.id

    resp = client.put(f'/api/products/{product_id}', json={
        'product_name': 'Legacy LIC Product Updated',
    }, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['company_name'] == 'lic'


def test_premium_by_company_keeps_digit_life_and_general_separate(client, users, app):
    add_policy(app, company='Care Health Insurance Ltd.', insurance_type='Health',
               policy_number='AN/2026/CARE', premium=1000)
    add_policy(app, company='Go Digit Life Insurance Limited.',
               policy_number='AN/2026/DIGITLIFE', premium=2000)
    add_policy(app, company='Go Digit General Insurance Limited', insurance_type='General',
               policy_number='AN/2026/DIGITGEN', premium=3000)

    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = client.get('/api/analytics/premium-by-company', headers=headers)
    assert resp.status_code == 200

    rows = {row['company']: row for row in resp.get_json()}
    assert rows['Care Health Insurance Ltd.']['premium'] == 1000.0
    assert rows['Go Digit Life Insurance Limited.']['premium'] == 2000.0
    assert rows['Go Digit General Insurance Limited']['premium'] == 3000.0
    assert rows['Go Digit Life Insurance Limited.']['insurance_type'] == 'Life'
    assert rows['Go Digit General Insurance Limited']['insurance_type'] == 'General'
    assert all(row['matched'] for row in rows.values())


def test_premium_by_company_flags_unmatched_legacy_value(client, users, app):
    add_policy(app, company='DIGIT GLOW PLUS TERM LIFE INSURANCE',
               policy_number='AN/2026/LEGACY', premium=5000)

    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = client.get('/api/analytics/premium-by-company', headers=headers)
    assert resp.status_code == 200
    row = next(r for r in resp.get_json() if r['company'] == 'DIGIT GLOW PLUS TERM LIFE INSURANCE')
    assert row['matched'] is False
    assert row['is_active'] is False


def test_premium_by_branch(client, users, app):
    add_policy(app, company='Life Insurance Corporation of India',
               policy_number='AN/2026/BRANCHA', premium=1000, location='Branch A')
    add_policy(app, company='Life Insurance Corporation of India',
               policy_number='AN/2026/BRANCHB', premium=2500, location='Branch B')

    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = client.get('/api/analytics/premium-by-branch', headers=headers)
    assert resp.status_code == 200
    rows = {row['branch']: row for row in resp.get_json()}
    assert rows['Branch A']['premium'] == 1000.0
    assert rows['Branch B']['premium'] == 2500.0
    assert rows['Branch A']['count'] == 1
