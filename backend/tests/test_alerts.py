from conftest import auth_header
from datetime import date, timedelta
from calendar import monthrange


def add_months(d, months):
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    try:
        return d.replace(year=year, month=month)
    except ValueError:
        last_day = monthrange(year, month)[1]
        return d.replace(year=year, month=month, day=last_day)


def add_years(d, years):
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        last_day = monthrange(d.year + years, d.month)[1]
        return d.replace(year=d.year + years, day=last_day)


def expected_due_dates(start, step_months, premium_paid_until, cutoff):
    due_dates = set()
    n = 1
    while True:
        due = add_months(start, n * step_months)
        if due > premium_paid_until:
            break
        if due <= cutoff:
            due_dates.add(due.isoformat())
        n += 1
    return due_dates


def create_life_policy(client, headers, policy_number, **overrides):
    payload = {
        'insurance_type': 'Life',
        'company': 'LIC',
        'category': 'Non Linked',
        'product': 'Term Plan',
        'customer_name': 'Test Customer',
        'primary_phone': '9876543210',
        'policy_number': policy_number,
        'policy_term': 10,
        'start_date': date.today().isoformat(),
        'end_date': add_years(date.today(), 10).isoformat(),
        'premium_mode': 'Annual',
        'base_premium': 10000,
        'policy_status': 'Fresh',
    }
    payload.update(overrides)
    return client.post('/api/policies', json=payload, headers=headers)


def test_alerts_monthly_premium_frequency(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    created = create_life_policy(client, headers, 'TEST/ALERT/MONTHLY', premium_mode='Monthly')
    assert created.status_code == 201, created.get_json()

    resp = client.get('/api/alerts?days=90', headers=headers)
    assert resp.status_code == 200
    alerts = [a for a in resp.get_json()['alerts'] if a['policy_number'] == 'TEST/ALERT/MONTHLY']

    today = date.today()
    cutoff = today + timedelta(days=90)
    expected = expected_due_dates(today, 1, add_years(today, 10), cutoff)

    assert {a['renewal_date'] for a in alerts} == expected
    assert len(alerts) >= 2


def test_alerts_quarterly_premium_frequency(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    created = create_life_policy(client, headers, 'TEST/ALERT/QUARTERLY', premium_mode='Quarterly')
    assert created.status_code == 201, created.get_json()

    resp = client.get('/api/alerts?days=180', headers=headers)
    assert resp.status_code == 200
    alerts = [a for a in resp.get_json()['alerts'] if a['policy_number'] == 'TEST/ALERT/QUARTERLY']

    today = date.today()
    cutoff = today + timedelta(days=180)
    expected = expected_due_dates(today, 3, add_years(today, 10), cutoff)

    assert {a['renewal_date'] for a in alerts} == expected
    assert len(alerts) >= 1


def test_alerts_limited_ppt_stops_after_ppt_term(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    created = create_life_policy(
        client, headers, 'TEST/ALERT/LIMITED',
        premium_mode='Quarterly',
        premium_payment_mode='Limited',
        ppt_term=1,
    )
    assert created.status_code == 201, created.get_json()

    resp = client.get('/api/alerts?days=365', headers=headers)
    assert resp.status_code == 200
    alerts = [a for a in resp.get_json()['alerts'] if a['policy_number'] == 'TEST/ALERT/LIMITED']

    today = date.today()
    cutoff = today + timedelta(days=365)
    expected = expected_due_dates(today, 3, add_years(today, 1), cutoff)

    assert {a['renewal_date'] for a in alerts} == expected
    if expected:
        assert max(date.fromisoformat(d) for d in {a['renewal_date'] for a in alerts}) <= add_years(today, 1)


def test_alerts_annual_premium_unchanged(client, users):
    headers = auth_header(client, 'agent@test.com', 'Agent@123')
    created = create_life_policy(client, headers, 'TEST/ALERT/ANNUAL', premium_mode='Annual')
    assert created.status_code == 201, created.get_json()

    resp = client.get('/api/alerts?days=365', headers=headers)
    assert resp.status_code == 200
    alerts = [a for a in resp.get_json()['alerts'] if a['policy_number'] == 'TEST/ALERT/ANNUAL']

    today = date.today()
    cutoff = today + timedelta(days=365)
    expected = expected_due_dates(today, 12, add_years(today, 10), cutoff)

    assert {a['renewal_date'] for a in alerts} == expected