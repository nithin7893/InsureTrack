import os

os.environ.setdefault('SECRET_KEY', 'test-secret-key-238hfernu3nu2rn-nf2jf2n')
os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt-secret-key-y9y2y823hbf2b3j2')
os.environ.setdefault('FLASK_ENV', 'production')

import pytest

from app import create_app
from models import db, User, Location
from werkzeug.security import generate_password_hash


@pytest.fixture()
def app(tmp_path, monkeypatch):
    db_path = tmp_path / 'test.db'
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv('FLASK_ENV', 'production')
    monkeypatch.setenv('SECRET_KEY', 'x' * 40)
    monkeypatch.setenv('JWT_SECRET_KEY', 'y' * 40)

    application = create_app()
    application.config['TESTING'] = True
    application.config['RATELIMIT_ENABLED'] = False

    yield application

    with application.app_context():
        db.session.remove()
        db.engine.dispose()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def users(app):
    """Create two locations, an admin, and one agent per branch."""
    with app.app_context():
        loc_a = Location(name='Branch A')
        loc_b = Location(name='Branch B')
        db.session.add_all([loc_a, loc_b])
        db.session.flush()

        admin = User(
            email='admin@test.com',
            password=generate_password_hash('Admin@123'),
            role='central_admin',
            name='Admin Test',
        )
        branch_a = User(
            email='branch@test.com',
            password=generate_password_hash('Branch@123'),
            role='branch_admin',
            name='Branch Admin A',
            location='Branch A',
            location_id=loc_a.id,
        )
        agent_a = User(
            email='agent@test.com',
            password=generate_password_hash('Agent@123'),
            role='agent',
            name='Agent A',
            location='Branch A',
            location_id=loc_a.id,
        )
        agent_b = User(
            email='agentb@test.com',
            password=generate_password_hash('Agent@123'),
            role='agent',
            name='Agent B',
            location='Branch B',
            location_id=loc_b.id,
        )
        db.session.add_all([admin, branch_a, agent_a, agent_b])
        db.session.commit()

        return {
            'admin': admin.email,
            'branch_a': branch_a.email,
            'agent_a': agent_a.email,
            'agent_b': agent_b.email,
            'loc_a': loc_a.id,
            'loc_b': loc_b.id,
        }


def login(client, email, password):
    return client.post('/api/auth/login', json={'email': email, 'password': password})


def auth_header(client, email, password):
    resp = login(client, email, password)
    assert resp.status_code == 200, resp.get_json()
    token = resp.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}