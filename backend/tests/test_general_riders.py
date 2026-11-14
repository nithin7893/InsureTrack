from conftest import auth_header
from models import ProductMaster, db


def seed_general_products(app):
    with app.app_context():
        db.session.add_all([
            ProductMaster(
                insurance_type='General',
                category='Fire',
                sub_category='Standard Fire and Special Perils (SFSP)',
                product_name='Fire Shield Plan',
            ),
            ProductMaster(
                insurance_type='General',
                category='Fire',
                sub_category='Floating Fire Policy',
                product_name='Fire Float Plan',
            ),
            ProductMaster(
                insurance_type='General',
                category='Motor',
                sub_category='Private Car',
                product_name='Motor Secure',
            ),
        ])
        db.session.commit()


def test_create_rider_for_specific_products(client, users, app):
    seed_general_products(app)
    headers = auth_header(client, 'admin@test.com', 'Admin@123')

    resp = client.post('/api/general-riders', json={
        'name': 'Fire Loss Rider',
        'description': 'Covers fire losses',
        'category': 'Fire',
        'product_names': ['Fire Shield Plan'],
    }, headers=headers)

    assert resp.status_code == 201, resp.get_json()
    body = resp.get_json()
    assert body['product_names'] == ['Fire Shield Plan']

    listing = client.get('/api/general-riders?category=Fire', headers=headers).get_json()
    rider = next(r for r in listing if r['id'] == body['id'])
    assert rider['product_names'] == ['Fire Shield Plan']


def test_rider_with_unknown_product_is_rejected(client, users, app):
    seed_general_products(app)
    headers = auth_header(client, 'admin@test.com', 'Admin@123')

    resp = client.post('/api/general-riders', json={
        'name': 'Bad Rider',
        'category': 'Fire',
        'product_names': ['Does Not Exist'],
    }, headers=headers)

    assert resp.status_code == 400
    assert 'Unknown product' in resp.get_json()['error']


def test_riders_filtered_by_selected_product(client, users, app):
    seed_general_products(app)
    headers = auth_header(client, 'admin@test.com', 'Admin@123')

    specific = client.post('/api/general-riders', json={
        'name': 'Fire Shield Rider',
        'category': 'Fire',
        'product_names': ['Fire Shield Plan'],
    }, headers=headers)
    generic = client.post('/api/general-riders', json={
        'name': 'All Fire Rider',
        'category': 'Fire',
        'product_names': [],
    }, headers=headers)
    assert specific.status_code == 201
    assert generic.status_code == 201

    matching = client.get(
        '/api/general-riders?category=Fire&product=Fire%20Shield%20Plan',
        headers=headers,
    ).get_json()
    names = {r['name'] for r in matching}
    assert names == {'Fire Shield Rider', 'All Fire Rider'}

    other = client.get(
        '/api/general-riders?category=Fire&product=Fire%20Float%20Plan',
        headers=headers,
    ).get_json()
    assert {r['name'] for r in other} == {'All Fire Rider'}


def test_update_rider_products(client, users, app):
    seed_general_products(app)
    headers = auth_header(client, 'admin@test.com', 'Admin@123')

    created = client.post('/api/general-riders', json={
        'name': 'Editable Rider',
        'category': 'Fire',
        'product_names': ['Fire Shield Plan'],
    }, headers=headers)
    rider_id = created.get_json()['id']

    resp = client.put(f'/api/general-riders/{rider_id}', json={
        'product_names': ['Fire Shield Plan', 'Fire Float Plan'],
    }, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['product_names'] == ['Fire Shield Plan', 'Fire Float Plan']

    cleared = client.put(f'/api/general-riders/{rider_id}', json={
        'product_names': [],
    }, headers=headers)
    assert cleared.status_code == 200
    assert cleared.get_json()['product_names'] == []


def test_agent_cannot_create_rider(client, users, app):
    seed_general_products(app)
    headers = auth_header(client, 'agent@test.com', 'Agent@123')

    resp = client.post('/api/general-riders', json={
        'name': 'Forbidden Rider',
        'category': 'Fire',
        'product_names': ['Fire Shield Plan'],
    }, headers=headers)
    assert resp.status_code == 403


def test_rider_can_use_standard_sub_category(client, users, app):
    """General policies fall back to the standard sub-category as their
    product when no product-master entry exists, so riders must accept those
    values too."""
    headers = auth_header(client, 'admin@test.com', 'Admin@123')

    resp = client.post('/api/general-riders', json={
        'name': 'GMC Rider',
        'category': 'Health',
        'product_names': ['GMC'],
    }, headers=headers)
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()['product_names'] == ['GMC']

    matching = client.get(
        '/api/general-riders?category=Health&product=GMC',
        headers=headers,
    ).get_json()
    assert any(r['name'] == 'GMC Rider' for r in matching)

    other = client.get(
        '/api/general-riders?category=Health&product=Floater',
        headers=headers,
    ).get_json()
    assert all(r['name'] != 'GMC Rider' for r in other)
