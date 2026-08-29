from conftest import auth_header, login


def valid_life_policy(policy_number='TEST/2026/001'):
    return {
        'insurance_type': 'Life',
        'company': 'LIC',
        'category': 'Non Linked',
        'product': 'Term Plan',
        'customer_name': 'Test Customer',
        'primary_phone': '9876543210',
        'policy_number': policy_number,
        'policy_term': 10,
        'start_date': '2026-01-01',
        'end_date': '2036-01-01',
        'premium_mode': 'Annual',
        'base_premium': 10000,
        'policy_status': 'Fresh',
    }


def test_agent_cannot_list_users(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = client.get('/api/users', headers=headers)
    assert resp.status_code == 403


def test_admin_can_list_users(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = client.get('/api/users', headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) >= 4


def test_create_policy_success(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = client.post('/api/policies', json=valid_life_policy(), headers=headers)
    assert resp.status_code == 201, resp.get_json()
    body = resp.get_json()
    assert body['total_premium'] == 10000
    assert body['location_id'] == users['loc_a']


def test_create_policy_invalid_phone(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    payload = valid_life_policy(policy_number='TEST/2026/002')
    payload['primary_phone'] = 'abc'
    resp = client.post('/api/policies', json=payload, headers=headers)
    assert resp.status_code == 400


def test_create_policy_invalid_status(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    payload = valid_life_policy(policy_number='TEST/2026/003')
    payload['policy_status'] = 'Bogus'
    resp = client.post('/api/policies', json=payload, headers=headers)
    assert resp.status_code == 400


def test_create_policy_duplicate_number(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = client.post('/api/policies', json=valid_life_policy(), headers=headers)
    assert resp.status_code == 201
    resp2 = client.post('/api/policies', json=valid_life_policy(), headers=headers)
    assert resp2.status_code == 400


def test_agent_cannot_read_other_branch_policy(client, users, app):
    from datetime import date
    from models import Policy, db

    with app.app_context():
        policy = Policy(
            insurance_type='Life',
            company='LIC',
            product='Term Plan',
            customer_name='Other Branch Customer',
            primary_phone='9876543211',
            policy_number='TEST/2026/BRANCHB',
            start_date=date(2026, 1, 1),
            end_date=date(2036, 1, 1),
            premium_mode='Annual',
            base_premium=5000,
            gst=0,
            total_premium=5000,
            policy_status='Fresh',
            location='Branch B',
            location_id=users['loc_b'],
        )
        db.session.add(policy)
        db.session.commit()
        policy_id = policy.id

    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = client.get(f'/api/policies/{policy_id}', headers=headers)
    assert resp.status_code == 403


def test_agent_cannot_delete_policy(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    created = client.post('/api/policies', json=valid_life_policy(), headers=headers)
    assert created.status_code == 201
    policy_id = created.get_json()['id']

    resp = client.delete(f'/api/policies/{policy_id}', headers=headers)
    assert resp.status_code == 403


def test_update_policy_success(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    created = client.post('/api/policies', json=valid_life_policy(), headers=headers)
    assert created.status_code == 201
    policy_id = created.get_json()['id']

    resp = client.put(
        f'/api/policies/{policy_id}',
        json={'customer_name': 'Renamed Customer'},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()['customer_name'] == 'Renamed Customer'


def test_policies_list_pagination(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = client.get('/api/policies?per_page=5', headers=headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert 'policies' in body
    assert body['per_page'] == 5


def test_export_requires_auth(client):
    resp = client.get('/api/policies/export', headers={'Authorization': 'Bearer bad'})
    assert resp.status_code == 401