import logging
import os
import re
import secrets
import sys
from datetime import timedelta, timezone

import sqlalchemy as sa
from dotenv import load_dotenv
from flask import Flask, current_app, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from flask_sqlalchemy import SQLAlchemy
from logging.handlers import RotatingFileHandler
from werkzeug.middleware.proxy_fix import ProxyFix

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

from models import db, User, Policy, PolicyCover, Company, Vehicle, Location, FieldMember, RevokedToken, GeneralRider

jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address, in_memory_fallback_enabled=True)

# --- Structured Logging ---
def setup_logging(app):
    log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
    log_format = '%(asctime)s %(levelname)s [%(name)s] %(message)s'

    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format=log_format,
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # File handler for production
    log_dir = os.path.join(basedir, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, 'insuretrack.log'),
        maxBytes=10 * 1024 * 1024,
        backupCount=10,
    )
    file_handler.setFormatter(logging.Formatter(log_format))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)

    # Suppress noisy libraries
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)


def create_app():
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(
        app.wsgi_app,
        x_for=1,
        x_proto=1,
        x_host=1
    )

    # --- Security: Require all secrets from environment ---
    secret_key = os.environ.get('SECRET_KEY')
    if not secret_key or len(secret_key) < 32:
        raise RuntimeError(
            'SECRET_KEY must be set in environment and at least 32 characters. '
            'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
        )
    app.config['SECRET_KEY'] = secret_key

    jwt_secret = os.environ.get('JWT_SECRET_KEY')
    if not jwt_secret or len(jwt_secret) < 32:
        raise RuntimeError(
            'JWT_SECRET_KEY must be set in environment and at least 32 characters. '
            'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
        )
    app.config['JWT_SECRET_KEY'] = jwt_secret

    # --- Rate Limiting (Redis in production, in-memory fallback for dev) ---
    redis_url = os.environ.get('REDIS_URL', '')
    if redis_url:
        app.config['RATELIMIT_STORAGE_URI'] = redis_url

    # --- Database ---
    db_url = os.environ.get('DATABASE_URL', '')
    if not db_url:
        db_path = os.path.join(basedir, 'insurance.db')
        app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
        app.config['_IS_SQLITE'] = True
    elif db_url.startswith('sqlite://'):
        if not os.path.isabs(db_url.replace('sqlite:///', '')):
            db_path = os.path.join(basedir, db_url.replace('sqlite:///', ''))
            app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
        else:
            app.config['SQLALCHEMY_DATABASE_URI'] = db_url
        app.config['_IS_SQLITE'] = True
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = db_url
        app.config['_IS_SQLITE'] = False
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'pool_size': int(os.environ.get('DB_POOL_SIZE', 10)),
            'pool_recycle': int(os.environ.get('DB_POOL_RECYCLE', 300)),
            'pool_pre_ping': True,
            'max_overflow': int(os.environ.get('DB_MAX_OVERFLOW', 20)),
        }

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # --- JWT Configuration ---
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=int(os.environ.get('JWT_ACCESS_MINUTES', 30)))
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=int(os.environ.get('JWT_REFRESH_DAYS', 30)))
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    app.config['JWT_IDENTITY_CLAIM'] = 'sub'
    app.config['JWT_DECODE_ALGORITHMS'] = ['HS256']

    # --- CORS ---
    cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',')
    CORS(app, resources={
        r"/api/*": {
            "origins": cors_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Content-Disposition"],
            "supports_credentials": True,
            "max_age": 600,
        }
    })

    # --- Security Headers via Talisman ---
    csp = {
        'default-src': "'self'",
        'script-src': "'self'",
        'style-src': "'self' 'unsafe-inline'",
        'img-src': "'self' data:",
        'font-src': "'self'",
        'connect-src': "'self'",
        'frame-ancestors': "'none'",
    }
    talisman = Talisman(
        app,
        force_https=os.environ.get('FORCE_HTTPS', 'false').lower() == 'true',
        strict_transport_security=False,
        strict_transport_security_max_age=31536000,
        content_security_policy=csp,
        session_cookie_secure=os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true',
        session_cookie_http_only=True,
        referrer_policy='strict-origin-when-cross-origin',
    )

    # --- Rate Limiting ---
    limiter.init_app(app)

    # --- Request Size Limit ---
    app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get('MAX_CONTENT_LENGTH_MB', 5)) * 1024 * 1024

    # --- Logging ---
    setup_logging(app)

    # --- JWT Error Handlers (no secrets logged) ---
    @jwt.invalid_token_loader
    def invalid_token_callback(error_string):
        app.logger.warning(f"Invalid token attempt from {request.remote_addr}")
        return jsonify({'error': 'Invalid token'}), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        app.logger.info(f"Expired token access from {request.remote_addr}")
        token_type = jwt_payload.get('type', 'access')
        if token_type == 'refresh':
            return jsonify({'error': 'Refresh token has expired', 'code': 'refresh_token_expired'}), 401
        return jsonify({'error': 'Token has expired', 'code': 'token_expired'}), 401

    @jwt.unauthorized_loader
    def unauthorized_callback(error_string):
        app.logger.warning(f"Missing/invalid token from {request.remote_addr}: {error_string}")
        return jsonify({'error': 'Missing authorization token'}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        app.logger.warning(f"Revoked token access from {request.remote_addr}")
        return jsonify({'error': 'Token has been revoked'}), 401

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload.get('jti')
        if not jti:
            return True
        token = db.session.query(RevokedToken).filter_by(jti=jti).first()
        return token is not None

    # --- Global Error Handlers ---
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({'error': 'Bad request'}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Resource not found'}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'error': 'Method not allowed'}), 405

    @app.errorhandler(413)
    def request_entity_too_large(e):
        return jsonify({'error': 'Request payload too large'}), 413

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429

    @app.errorhandler(500)
    def internal_error(e):
        app.logger.error(f"Internal server error: {e}")
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500

    # --- Security Headers Middleware ---
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
        # Prevent caching of authenticated responses
        if request.headers.get('Authorization'):
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
        return response

    # Disable CSRF for API routes since we use JWT tokens (not cookies)

    db.init_app(app)
    jwt.init_app(app)

    # --- Register Blueprints ---
    from routes.auth import auth_bp
    from routes.policies import policies_bp
    from routes.analytics import analytics_bp
    from routes.companies import companies_bp
    from routes.users import users_bp
    from routes.locations import locations_bp
    from routes.products import products_bp
    from routes.field_members import field_members_bp
    from routes.alerts import alerts_bp
    from routes.general_riders import general_riders_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(policies_bp, url_prefix='/api/policies')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(companies_bp, url_prefix='/api/companies')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(locations_bp, url_prefix='/api/locations')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(field_members_bp, url_prefix='/api/field-members')
    app.register_blueprint(alerts_bp, url_prefix='/api/alerts')
    app.register_blueprint(general_riders_bp, url_prefix='/api/general-riders')

    # --- DB Init & Migration ---
    with app.app_context():
        if app.config.get('_IS_SQLITE'):
            # Legacy local-dev bootstrap: create tables directly + in-place backfills.
            db.create_all()
            migrate_schema()
        else:
            # Production: versioned schema via Alembic migrations.
            run_migrations()
        cleanup_revoked_tokens()
        if os.environ.get('FLASK_ENV', 'production') != 'production':
            seed_data()

    # --- Health Check Endpoint ---
    @app.route('/api/health', methods=['GET'])
    def health_check():
        try:
            db.session.execute(sa.text('SELECT 1'))
            db_status = 'healthy'
        except Exception:
            db_status = 'unhealthy'
        return jsonify({
            'status': 'healthy' if db_status == 'healthy' else 'degraded',
            'database': db_status,
        }), 200 if db_status == 'healthy' else 503

    app.logger.info('InsureTrack application started successfully')
    return app


def run_migrations():
    """Apply Alembic migrations (production/PostgreSQL path).

    Called from inside an app context; the Alembic config is wired to the
    already-resolved DATABASE_URL so it targets the exact same database.
    """
    try:
        from alembic import command
        from alembic.config import Config as AlembicConfig
    except ImportError:
        raise RuntimeError(
            'Alembic is required for the PostgreSQL production path. '
            'Run: pip install -r requirements.txt'
        )

    cfg = AlembicConfig(os.path.join(basedir, 'alembic.ini'))
    cfg.set_main_option(
        'script_location', os.path.join(basedir, 'migrations').replace('\\', '/')
    )
    cfg.set_main_option(
        'sqlalchemy.url', current_app.config['SQLALCHEMY_DATABASE_URI']
    )
    command.upgrade(cfg, 'head')
    current_app.logger.info('Database migrations applied successfully')


def migrate_schema():
    import sqlalchemy as sa
    inspector = sa.inspect(db.engine)
    existing_tables = inspector.get_table_names()

    VALID_IDENTIFIER = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')

    new_columns = [
        ('users', 'location_id', 'INTEGER'),
        ('field_members', 'location_id', 'INTEGER'),
        ('vehicles', 'location_id', 'INTEGER'),
        ('policies', 'location_id', 'INTEGER'),
        ('policies', 'number_of_lives', 'INTEGER'),
        ('policies', 'health_rider', 'VARCHAR(500)'),
        ('field_members', 'approval_status', 'VARCHAR(20)'),
        ('field_members', 'requested_by', 'INTEGER'),
        ('field_members', 'requested_by_name', 'VARCHAR(255)'),
    ]

    for table, column, col_type in new_columns:
        if not VALID_IDENTIFIER.match(table) or not VALID_IDENTIFIER.match(column):
            logging.getLogger(__name__).warning(f"Skipping migration for invalid identifier: {table}.{column}")
            continue
        if table in existing_tables:
            existing_cols = [c['name'] for c in inspector.get_columns(table)]
            if column not in existing_cols:
                try:
                    with db.engine.connect() as conn:
                        conn.execute(sa.text(f'ALTER TABLE {table} ADD COLUMN {column} {col_type}'))
                        conn.commit()
                except Exception as e:
                    logging.getLogger(__name__).warning(f"Migration column {table}.{column}: {e}")

    # Post deployment fix: revoked_tokens is created by db.create_all() from the
    # RevokedToken model — portable across SQLite and PostgreSQL.

    # Existing migration logic for location_id, role fixes, etc.
    with db.engine.connect() as conn:
        try:
            from models import Location

            default_loc = db.session.query(Location).filter_by(name='Vijayawada').first()
            if not default_loc:
                default_loc = Location(name='Vijayawada')
                db.session.add(default_loc)
                db.session.commit()

            default_loc_id = default_loc.id

            users_without_loc = db.session.execute(
                sa.text("SELECT id FROM users WHERE location IS NULL OR location = ''")
            ).fetchall()
            for row in users_without_loc:
                db.session.execute(
                    sa.text("UPDATE users SET location = 'Vijayawada' WHERE id = :id"),
                    {'id': row[0]}
                )

            policies_without_loc = db.session.execute(
                sa.text("SELECT id FROM policies WHERE location IS NULL OR location = ''")
            ).fetchall()
            for row in policies_without_loc:
                db.session.execute(
                    sa.text("UPDATE policies SET location = 'Vijayawada' WHERE id = :id"),
                    {'id': row[0]}
                )

            users_migrated = db.session.execute(
                sa.text("SELECT id, location FROM users WHERE location IS NOT NULL AND location != '' AND location_id IS NULL")
            ).fetchall()
            for row in users_migrated:
                loc = db.session.query(Location).filter_by(name=row[1]).first()
                lid = loc.id if loc else default_loc_id
                db.session.execute(
                    sa.text("UPDATE users SET location_id = :lid WHERE id = :id"),
                    {'lid': lid, 'id': row[0]}
                )

            field_members_migrated = db.session.execute(
                sa.text("SELECT id, location FROM field_members WHERE location IS NOT NULL AND location != '' AND location_id IS NULL")
            ).fetchall()
            for row in field_members_migrated:
                loc = db.session.query(Location).filter_by(name=row[1]).first()
                lid = loc.id if loc else default_loc_id
                db.session.execute(
                    sa.text("UPDATE field_members SET location_id = :lid WHERE id = :id"),
                    {'lid': lid, 'id': row[0]}
                )

            policies_migrated = db.session.execute(
                sa.text("SELECT id, location FROM policies WHERE location IS NOT NULL AND location != '' AND location_id IS NULL")
            ).fetchall()
            for row in policies_migrated:
                loc = db.session.query(Location).filter_by(name=row[1]).first()
                lid = loc.id if loc else default_loc_id
                db.session.execute(
                    sa.text("UPDATE policies SET location_id = :lid WHERE id = :id"),
                    {'lid': lid, 'id': row[0]}
                )

            vehicles_without_loc = db.session.execute(
                sa.text("SELECT v.id FROM vehicles v LEFT JOIN policies p ON p.vehicle_id = v.id WHERE v.location_id IS NULL")
            ).fetchall()
            for row in vehicles_without_loc:
                policy = db.session.execute(
                    sa.text("SELECT location_id FROM policies WHERE vehicle_id = :vid LIMIT 1"),
                    {'vid': row[0]}
                ).fetchone()
                lid = policy[0] if policy else default_loc_id
                db.session.execute(
                    sa.text("UPDATE vehicles SET location_id = :lid WHERE id = :id"),
                    {'lid': lid, 'id': row[0]}
                )

            old_roles = db.session.execute(
                sa.text("SELECT id, role FROM users WHERE role NOT IN ('central_admin', 'branch_admin', 'agent')")
            ).fetchall()
            for row in old_roles:
                new_role = 'central_admin' if row[1] == 'admin' else 'agent'
                db.session.execute(
                    sa.text("UPDATE users SET role = :new_role WHERE id = :id"),
                    {'new_role': new_role, 'id': row[0]}
                )

            db.session.commit()
        except Exception as e:
            logging.getLogger(__name__).warning(f"Migration data: {e}")


def cleanup_revoked_tokens():
    from datetime import datetime, timedelta, timezone
    # Column stores naive UTC; compare across dialects consistently.
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
    try:
        deleted = RevokedToken.query.filter(RevokedToken.revoked_at < cutoff).delete()
        db.session.commit()
        if deleted:
            logging.getLogger(__name__).info(f"Cleaned up {deleted} revoked tokens older than 30 days")
    except Exception as e:
        logging.getLogger(__name__).warning(f"Token cleanup failed: {e}")
        db.session.rollback()


def seed_data():
    from models import User, Policy, Company, Location
    from datetime import date
    from werkzeug.security import generate_password_hash

    if Location.query.count() == 0:
        locations = [
            Location(name='Vijayawada'),
            Location(name='New York'),
            Location(name='Los Angeles'),
            Location(name='Chicago'),
            Location(name='Houston'),
            Location(name='Miami'),
        ]
        db.session.add_all(locations)
        db.session.commit()

    vjw = Location.query.filter_by(name='Vijayawada').first()
    ny = Location.query.filter_by(name='New York').first()
    vjw_id = vjw.id if vjw else None
    ny_id = ny.id if ny else None

    if User.query.count() == 0:
        admin = User(
            email='admin@insurance.com',
            password=generate_password_hash('admin123'),
            role='central_admin',
            name='Admin User',
            location='',
            location_id=None
        )
        agent = User(
            email='agent@insurance.com',
            password=generate_password_hash('agent123'),
            role='agent',
            name='John Agent',
            location='New York',
            location_id=ny_id
        )
        branch_admin = User(
            email='branch@insurance.com',
            password=generate_password_hash('branch123'),
            role='branch_admin',
            name='Branch Admin',
            location='Vijayawada',
            location_id=vjw_id
        )
        db.session.add(admin)
        db.session.add(agent)
        db.session.add(branch_admin)
        db.session.commit()

    if Company.query.count() == 0:
        companies = [
            Company(name='LIC', insurance_type='Life'),
            Company(name='HDFC Life', insurance_type='Life'),
            Company(name='Axis Max Life', insurance_type='Life'),
            Company(name='ICICI Prudential', insurance_type='Life'),
            Company(name='GoDigit', insurance_type='Life'),
            Company(name='Bajaj Life', insurance_type='Life'),
            Company(name='SBI Life', insurance_type='Life'),
            Company(name='Care', insurance_type='Health'),
            Company(name='Star Health', insurance_type='Health'),
            Company(name='ICICI Lombard', insurance_type='Health'),
            Company(name='New India Assurance', insurance_type='Health'),
            Company(name='United India Insurance', insurance_type='Health'),
            Company(name='Chola MS', insurance_type='Health'),
            Company(name='Reliance General', insurance_type='Health'),
            Company(name='Tata AIG', insurance_type='Health'),
            Company(name='National Insurance', insurance_type='Health'),
            Company(name='Royal Sundaram', insurance_type='Health'),
            Company(name='HDFC ERGO', insurance_type='Health'),
            Company(name='ICICI Lombard', insurance_type='General'),
            Company(name='New India Assurance', insurance_type='General'),
            Company(name='United India Insurance', insurance_type='General'),
            Company(name='Chola MS', insurance_type='General'),
            Company(name='Reliance General', insurance_type='General'),
            Company(name='Tata AIG', insurance_type='General'),
            Company(name='GoDigit', insurance_type='General'),
            Company(name='National Insurance', insurance_type='General'),
            Company(name='Oriental Insurance', insurance_type='General'),
            Company(name='Royal Sundaram', insurance_type='General'),
            Company(name='Magma HDI', insurance_type='General'),
            Company(name='Bajaj Allianz', insurance_type='General'),
        ]
        db.session.add_all(companies)
        db.session.commit()

        policies = [
            Policy(
                insurance_type='Life', company='LIC', category='Non Linked',
                product='Term Plan', customer_name='Rajesh Kumar',
                primary_phone='9876543210', policy_number='LIC/2024/001',
                policy_term=20, start_date=date(2024, 1, 15), end_date=date(2044, 1, 15),
                premium_mode='Annual', base_premium=25000, rider_premium=0,
                gst=0, total_premium=25000, policy_status='Fresh',
                agent_name='John Agent', location='New York', location_id=ny_id
            ),
            Policy(
                insurance_type='Health', company='Care', category='Personal Health',
                sub_category='Individual', product='Individual',
                customer_name='Priya Sharma', primary_phone='9876543211',
                policy_number='CARE/2024/002', policy_term=1,
                start_date=date(2024, 2, 1), end_date=date(2025, 2, 1),
                premium_mode='Annual', base_premium=15000, rider_premium=2000,
                gst=0, total_premium=17000, policy_status='Fresh',
                agent_name='John Agent', location='Vijayawada', location_id=vjw_id
            ),
            Policy(
                insurance_type='Health', company='ICICI Lombard', category='GMC',
                product='GMC', customer_name='Tech Corp Pvt Ltd',
                primary_phone='9876543212', policy_number='ICICI/2024/003',
                policy_term=1, start_date=date(2024, 3, 1), end_date=date(2025, 3, 1),
                premium_mode='Annual', base_premium=50000, rider_premium=0,
                gst=9000, total_premium=59000, policy_status='Fresh',
                agent_name='John Agent', location='New York', location_id=ny_id
            ),
            Policy(
                insurance_type='General', company='ICICI Lombard', category='Motor',
                product='Motor', customer_name='Anil Patel',
                primary_phone='9876543213', policy_number='ICICI/MOT/004',
                policy_term=1, start_date=date(2024, 4, 1), end_date=date(2025, 4, 1),
                premium_mode='Annual', base_premium=8000, rider_premium=0,
                gst=1440, total_premium=9440, policy_status='Renewal',
                agent_name='John Agent', location='New York', location_id=ny_id
            ),
            Policy(
                insurance_type='Life', company='HDFC Life', category='ULIP',
                product='ULIP', customer_name='Suresh Reddy',
                primary_phone='9876543214', policy_number='HDFC/2024/005',
                policy_term=15, start_date=date(2024, 5, 10), end_date=date(2039, 5, 10),
                premium_mode='Annual', base_premium=50000, rider_premium=5000,
                gst=0, total_premium=55000, policy_status='Fresh',
                agent_name='John Agent', location='New York', location_id=ny_id
            ),
            Policy(
                insurance_type='Health', company='Star Health', category='Topup',
                product='Topup', customer_name='Meena Devi',
                primary_phone='9876543215', policy_number='STAR/2024/006',
                policy_term=1, start_date=date(2024, 6, 1), end_date=date(2025, 6, 1),
                premium_mode='Quarterly', base_premium=8000, rider_premium=0,
                gst=0, total_premium=8000, policy_status='Fresh',
                agent_name='John Agent', location='Vijayawada', location_id=vjw_id
            ),
            Policy(
                insurance_type='General', company='New India', category='Fire',
                product='Fire', customer_name='Global Industries',
                primary_phone='9876543216', policy_number='NEWINDIA/2024/007',
                policy_term=1, start_date=date(2024, 7, 1), end_date=date(2025, 7, 1),
                premium_mode='Annual', base_premium=25000, rider_premium=0,
                gst=4500, total_premium=29500, policy_status='Fresh',
                agent_name='John Agent', location='New York', location_id=ny_id
            ),
            Policy(
                insurance_type='Life', company='SBI Life', category='Savings',
                product='Savings', customer_name='Vijay Singh',
                primary_phone='9876543217', policy_number='SBI/2024/008',
                policy_term=10, start_date=date(2024, 8, 15), end_date=date(2034, 8, 15),
                premium_mode='Monthly', base_premium=5000, rider_premium=0,
                gst=0, total_premium=5000, policy_status='Fresh',
                agent_name='John Agent', location='New York', location_id=ny_id
            ),
            Policy(
                insurance_type='General', company='Tata AIG', category='Travel',
                product='Travel', customer_name='Rahul Enterprises',
                primary_phone='9876543218', policy_number='TATAAIG/2024/009',
                policy_term=1, start_date=date(2024, 9, 1), end_date=date(2025, 9, 1),
                premium_mode='Annual', base_premium=12000, rider_premium=0,
                gst=2160, total_premium=14160, policy_status='Other Company Renewal',
                agent_name='John Agent', location='New York', location_id=ny_id
            ),
            Policy(
                insurance_type='Health', company='Reliance', category='Personal Accident',
                product='Personal Accident', customer_name='Kiran Kumar',
                primary_phone='9876543219', policy_number='RELIANCE/2024/010',
                policy_term=1, start_date=date(2024, 10, 1), end_date=date(2025, 10, 1),
                premium_mode='Annual', base_premium=3500, rider_premium=0,
                gst=0, total_premium=3500, policy_status='Fresh',
                agent_name='John Agent', location='Vijayawada', location_id=vjw_id
            ),
        ]

        db.session.add_all(policies)
        db.session.commit()


if __name__ == '__main__':
    app = create_app()
    app.run(debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true', port=5000)
