from conftest import auth_header, login
from models import User, db
from werkzeug.security import generate_password_hash


def test_health(client):
    resp = client.get('/api/health')
    assert resp.status_code == 200
    assert resp.get_json()['status'] == 'healthy'
    assert resp.get_json()['database'] == 'healthy'


def test_login_success(client, users):
    resp = login(client, 'agent@test.com', 'Agent@123')
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['access_token']
    assert body['refresh_token']
    assert body['user']['email'] == 'agent@test.com'


def test_login_wrong_password(client, users):
    resp = login(client, 'agent@test.com', 'WrongPass@1')
    assert resp.status_code == 401


def test_login_unknown_user(client, users):
    resp = login(client, 'nobody@test.com', 'Whatever@1')
    assert resp.status_code == 401
    assert 'Invalid email or password' in resp.get_json()['error']


def test_login_deactivated_account(client, app):
    with app.app_context():
        user = User(
            email='disabled@test.com',
            password=generate_password_hash('Disabled@123'),
            role='agent',
            name='Disabled',
            is_active=False,
        )
        db.session.add(user)
        db.session.commit()
    resp = login(client, 'disabled@test.com', 'Disabled@123')
    assert resp.status_code == 403


def test_login_rejects_oversized_input(client):
    resp = login(client, 'a' * 300, 'short')
    assert resp.status_code == 400


def test_protected_route_requires_token(client):
    resp = client.get('/api/policies')
    assert resp.status_code == 401


def test_invalid_token_rejected(client):
    resp = client.get('/api/policies', headers={'Authorization': 'Bearer invalid.token.here'})
    assert resp.status_code == 401


def test_me_returns_profile(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = client.get('/api/auth/me', headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()['email'] == 'admin@test.com'
    assert 'password' not in resp.get_json()


def test_logout_revokes_access_token(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = client.post('/api/auth/logout', headers=headers)
    assert resp.status_code == 200
    # The same access token is now revoked.
    resp2 = client.get('/api/policies', headers=headers)
    assert resp2.status_code == 401


def test_refresh_rotation_revokes_old_refresh_token(client, users):
    resp = login(client, 'agent@test.com', 'Agent@123')
    old_refresh = resp.get_json()['refresh_token']

    resp2 = client.post('/api/auth/refresh', headers={'Authorization': f'Bearer {old_refresh}'})
    assert resp2.status_code == 200
    assert resp2.get_json()['access_token']

    # Old refresh token must be dead after rotation (reuse detection).
    resp3 = client.post('/api/auth/refresh', headers={'Authorization': f'Bearer {old_refresh}'})
    assert resp3.status_code == 401