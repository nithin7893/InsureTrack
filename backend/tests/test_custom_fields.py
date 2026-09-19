from conftest import auth_header


def create_field(client, headers, **overrides):
    payload = {
        'label': 'Nominee Name',
        'insurance_type': None,
        'field_type': 'text',
        'is_required': False,
    }
    payload.update(overrides)
    return client.post('/api/custom-fields', json=payload, headers=headers)


def test_agent_cannot_create_custom_field(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = create_field(client, headers)
    assert resp.status_code == 403


def test_branch_admin_cannot_create_custom_field(client, users):
    headers = auth_header(client, 'branch@test.com', 'Branch@123')
    resp = create_field(client, headers)
    assert resp.status_code == 403


def test_central_admin_can_create_and_list_custom_field(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = create_field(client, headers)
    assert resp.status_code == 201, resp.get_json()
    body = resp.get_json()
    assert body['label'] == 'Nominee Name'
    assert body['insurance_type'] is None
    assert body['is_active'] is True

    resp = client.get('/api/custom-fields', headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) == 1


def test_agent_can_list_active_fields(client, users):
    admin_headers = auth_header(client, 'admin@test.com', 'Admin@123')
    create_field(client, admin_headers, label='Field A')
    create_field(client, admin_headers, label='Field B')

    # Deactivate Field B
    fields = client.get('/api/custom-fields', headers=admin_headers).get_json()
    field_b = next(f for f in fields if f['label'] == 'Field B')
    resp = client.delete(f'/api/custom-fields/{field_b["id"]}', headers=admin_headers)
    assert resp.status_code == 200

    agent_headers = auth_header(client, 'agent@test.com', 'Agent@123')
    visible = client.get('/api/custom-fields', headers=agent_headers).get_json()
    assert len(visible) == 1
    assert visible[0]['label'] == 'Field A'


def test_insurance_type_filter(client, users):
    admin_headers = auth_header(client, 'admin@test.com', 'Admin@123')
    create_field(client, admin_headers, label='All Type Field', insurance_type=None)
    create_field(client, admin_headers, label='Life Only Field', insurance_type='Life')

    agent_headers = auth_header(client, 'agent@test.com', 'Agent@123')
    life_fields = client.get('/api/custom-fields?insurance_type=Life', headers=agent_headers).get_json()
    labels = {f['label'] for f in life_fields}
    assert labels == {'All Type Field', 'Life Only Field'}

    health_fields = client.get('/api/custom-fields?insurance_type=Health', headers=agent_headers).get_json()
    health_labels = {f['label'] for f in health_fields}
    assert health_labels == {'All Type Field'}


def test_select_field_requires_options(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = create_field(client, headers, label='Gender', field_type='select', options=[])
    assert resp.status_code == 400
    assert 'option' in resp.get_json()['error'].lower()


def test_update_custom_field(client, users):
    headers = auth_header(client, 'admin@test.com', 'Admin@123')
    resp = create_field(client, headers)
    field_id = resp.get_json()['id']

    resp = client.put(f'/api/custom-fields/{field_id}', json={
        'label': 'Updated Label',
        'is_required': True,
    }, headers=headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['label'] == 'Updated Label'
    assert body['is_required'] is True


def create_policy_with_custom_values(client, headers, custom_values):
    payload = {
        'insurance_type': 'Life',
        'company': 'LIC',
        'category': 'Non Linked',
        'product': 'Term Plan',
        'customer_name': 'Test Customer',
        'primary_phone': '9876543210',
        'policy_number': 'CUSTOM/2026/001',
        'policy_term': 10,
        'start_date': '2026-01-01',
        'end_date': '2036-01-01',
        'premium_mode': 'Annual',
        'base_premium': 10000,
        'policy_status': 'Fresh',
        'custom_values': custom_values,
    }
    return client.post('/api/policies', json=payload, headers=headers)


def test_create_policy_saves_custom_values(client, users):
    admin_headers = auth_header(client, 'admin@test.com', 'Admin@123')
    field = create_field(client, admin_headers, label='Nominee Name').get_json()

    agent_headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = create_policy_with_custom_values(client, agent_headers, {str(field['id']): 'Jane Doe'})
    assert resp.status_code == 201, resp.get_json()
    body = resp.get_json()
    assert body['custom_values'] == {str(field['id']): 'Jane Doe'}


def test_create_policy_rejects_unknown_field(client, users):
    admin_headers = auth_header(client, 'admin@test.com', 'Admin@123')
    create_field(client, admin_headers, label='Nominee Name')

    agent_headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = create_policy_with_custom_values(client, agent_headers, {'999999': 'Jane Doe'})
    assert resp.status_code == 400
    assert 'unknown' in resp.get_json()['error'].lower()


def test_create_policy_rejects_missing_required_field(client, users):
    admin_headers = auth_header(client, 'admin@test.com', 'Admin@123')
    create_field(client, admin_headers, label='Nominee Name', is_required=True)

    agent_headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = create_policy_with_custom_values(client, agent_headers, {})
    assert resp.status_code == 400
    assert 'required' in resp.get_json()['error'].lower()


def test_select_field_rejects_invalid_option(client, users):
    admin_headers = auth_header(client, 'admin@test.com', 'Admin@123')
    field = create_field(client, admin_headers, label='Gender', field_type='select',
                         options=['Male', 'Female']).get_json()

    agent_headers = auth_header(client, 'agent@test.com', 'Agent@123')
    resp = create_policy_with_custom_values(client, agent_headers, {str(field['id']): 'Other'})
    assert resp.status_code == 400