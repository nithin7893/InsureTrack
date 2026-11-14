from conftest import auth_header
from models import Policy, User, db


def valid_life_policy(policy_number):
    return {
        'insurance_type': 'Life',
        'company': 'Life Insurance Corporation of India',
        'category': 'Non Linked',
        'product': 'Term Plan',
        'customer_name': 'Approval Test Customer',
        'primary_phone': '9876543210',
        'policy_number': policy_number,
        'policy_term': 10,
        'start_date': '2026-01-01',
        'end_date': '2036-01-01',
        'premium_mode': 'Annual',
        'base_premium': 10000,
        'policy_status': 'Fresh',
    }


def enable_approval(app, email):
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        user.requires_policy_approval = True
        db.session.commit()


def test_create_user_with_policy_approval_flag(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = client.post('/api/users', json={
        'email': 'needsapproval@test.com',
        'password': 'StrongPass@123',
        'name': 'Needs Approval',
        'role': 'agent',
        'location_id': users['loc_a'],
        'requires_policy_approval': True,
    }, headers=headers)
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()['requires_policy_approval'] is True


def test_policy_stays_hidden_until_approved(client, users, app):
    enable_approval(app, 'agent@test.com')
    headers = auth_header(client, 'agent@test.com', 'Agent@123')

    created = client.post('/api/policies', json=valid_life_policy('APPROVE/2026/001'), headers=headers)
    assert created.status_code == 201, created.get_json()
    policy_id = created.get_json()['id']
    assert created.get_json()['approval_status'] == 'pending'

    # Hidden from the policies list for both the agent and central admin.
    agent_list = client.get('/api/policies', headers=headers).get_json()
    assert all(p['id'] != policy_id for p in agent_list['policies'])

    admin_headers = auth_header(client, 'admin@test.com', 'Admin@123')
    admin_list = client.get('/api/policies', headers=admin_headers).get_json()
    assert all(p['id'] != policy_id for p in admin_list['policies'])

    # Central admin is notified through the pending queue.
    count = client.get('/api/policy-approvals/pending-count', headers=admin_headers)
    assert count.get_json()['count'] == 1
    pending = client.get('/api/policy-approvals', headers=admin_headers).get_json()
    assert [p['id'] for p in pending] == [policy_id]

    approved = client.put(f'/api/policy-approvals/{policy_id}/approve', headers=admin_headers)
    assert approved.status_code == 200, approved.get_json()
    assert approved.get_json()['approval_status'] == 'approved'

    # Once approved the policy appears in the normal list.
    agent_list = client.get('/api/policies', headers=headers).get_json()
    assert any(p['id'] == policy_id for p in agent_list['policies'])

    count = client.get('/api/policy-approvals/pending-count', headers=admin_headers)
    assert count.get_json()['count'] == 0


def test_rejected_policy_is_removed(client, users, app):
    enable_approval(app, 'agent@test.com')
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    admin_headers = auth_header(client, 'admin@test.com', 'Admin@123')

    created = client.post('/api/policies', json=valid_life_policy('REJECT/2026/001'), headers=headers)
    assert created.status_code == 201
    policy_id = created.get_json()['id']

    rejected = client.put(f'/api/policy-approvals/{policy_id}/reject', headers=admin_headers)
    assert rejected.status_code == 200, rejected.get_json()

    with app.app_context():
        assert db.session.get(Policy, policy_id) is None

    agent_list = client.get('/api/policies', headers=headers).get_json()
    assert all(p['id'] != policy_id for p in agent_list['policies'])


def test_only_central_admin_can_review_approvals(client, users, app):
    enable_approval(app, 'agent@test.com')
    headers = auth_header(client, 'agent@test.com', 'Agent@123')

    created = client.post('/api/policies', json=valid_life_policy('FORBIDDEN/2026/001'), headers=headers)
    policy_id = created.get_json()['id']

    resp = client.put(f'/api/policy-approvals/{policy_id}/approve', headers=headers)
    assert resp.status_code == 403

    branch_headers = auth_header(client, 'branch@test.com', 'Branch@123')
    resp = client.get('/api/policy-approvals', headers=branch_headers)
    assert resp.status_code == 403
