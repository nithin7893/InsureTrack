from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Index, event

db = SQLAlchemy()


class Location(db.Model):
    __tablename__ = 'locations'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class FieldMember(db.Model):
    __tablename__ = 'field_members'
    __table_args__ = (
        Index('ix_fm_location_status', 'location_id', 'approval_status'),
        Index('ix_fm_requested_by', 'requested_by'),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    location = db.Column(db.String(255), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='SET NULL'), nullable=True, index=True)
    is_active = db.Column(db.Boolean, default=True)
    approval_status = db.Column(db.String(20), default='approved')
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    requested_by_name = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    requested_by_user = db.relationship('User', backref='requested_field_members', lazy='joined', foreign_keys=[requested_by])

    def to_dict(self):
        loc_name = self.location
        if self.location_id:
            loc = db.session.get(Location, self.location_id)
            if loc:
                loc_name = loc.name
        return {
            'id': self.id,
            'name': self.name,
            'location': loc_name,
            'location_id': self.location_id,
            'is_active': self.is_active,
            'approval_status': self.approval_status,
            'requested_by': self.requested_by,
            'requested_by_name': self.requested_by_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ProductMaster(db.Model):
    __tablename__ = 'product_master'
    __table_args__ = (
        Index('ix_pm_type_company', 'insurance_type', 'company_name'),
        Index('ix_pm_category', 'category', 'sub_category'),
    )

    id = db.Column(db.Integer, primary_key=True)
    insurance_type = db.Column(db.String(50), nullable=False)
    company_name = db.Column(db.String(100))
    category = db.Column(db.String(100))
    sub_category = db.Column(db.String(100))
    product_category = db.Column(db.String(100))
    product_name = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def to_dict(self):
        return {
            'id': self.id,
            'insurance_type': self.insurance_type,
            'company_name': self.company_name,
            'category': self.category,
            'sub_category': self.sub_category,
            'product_category': self.product_category,
            'product_name': self.product_name,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = (
        Index('ix_user_role_active', 'role', 'is_active'),
    )

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='agent')
    name = db.Column(db.String(255))
    location = db.Column(db.String(255))
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='SET NULL'), nullable=True, index=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    VALID_ROLES = {'central_admin', 'branch_admin', 'agent'}

    def to_dict(self):
        loc_name = self.location
        if self.location_id:
            loc = db.session.get(Location, self.location_id)
            if loc:
                loc_name = loc.name
        return {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'name': self.name,
            'location': loc_name,
            'location_id': self.location_id,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Company(db.Model):
    __tablename__ = 'companies'
    __table_args__ = (
        Index('ix_company_type_active', 'insurance_type', 'is_active'),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    insurance_type = db.Column(db.String(50), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'insurance_type': self.insurance_type,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Vehicle(db.Model):
    __tablename__ = 'vehicles'

    id = db.Column(db.Integer, primary_key=True)
    vehicle_number = db.Column(db.String(20), nullable=False)
    vehicle_year = db.Column(db.Integer)
    vehicle_model = db.Column(db.String(100))
    owner_name = db.Column(db.String(255))
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def to_dict(self):
        return {
            'id': self.id,
            'vehicle_number': self.vehicle_number,
            'vehicle_year': self.vehicle_year,
            'vehicle_model': self.vehicle_model,
            'owner_name': self.owner_name,
            'location_id': self.location_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Policy(db.Model):
    __tablename__ = 'policies'
    __table_args__ = (
        Index('ix_policy_type_status', 'insurance_type', 'policy_status'),
        Index('ix_policy_company', 'company'),
        Index('ix_policy_agent', 'agent_name'),
        Index('ix_policy_dates', 'start_date', 'end_date'),
        Index('ix_policy_created', 'created_at'),
    )

    id = db.Column(db.Integer, primary_key=True)
    insurance_type = db.Column(db.String(50), nullable=False)
    company = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50))
    sub_category = db.Column(db.String(50))
    product = db.Column(db.String(100), nullable=False)
    customer_name = db.Column(db.String(255), nullable=False)
    primary_phone = db.Column(db.String(20), nullable=False)
    alternate_phone = db.Column(db.String(20))
    policy_number = db.Column(db.String(100), unique=True, nullable=False)
    policy_term = db.Column(db.Integer)
    premium_payment_mode = db.Column(db.String(10))
    ppt_term = db.Column(db.Integer)
    number_of_lives = db.Column(db.Integer)
    health_rider = db.Column(db.String(500))
    sum_assured = db.Column(db.Numeric(14, 2))
    sum_insured = db.Column(db.Numeric(14, 2))
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    premium_mode = db.Column(db.String(50), nullable=False)
    base_premium = db.Column(db.Numeric(12, 2), nullable=False)
    rider_premium = db.Column(db.Numeric(12, 2), default=0)
    rider_health_sickness = db.Column(db.Numeric(12, 2), default=0)
    rider_accident_disability = db.Column(db.Numeric(12, 2), default=0)
    rider_term_rider = db.Column(db.Numeric(12, 2), default=0)
    rider_other_pwb = db.Column(db.Numeric(12, 2), default=0)
    rider_adb = db.Column(db.Numeric(12, 2), default=0)
    rider_atpd = db.Column(db.Numeric(12, 2), default=0)
    rider_permanent_disability = db.Column(db.Numeric(12, 2), default=0)
    rider_critical_illness = db.Column(db.Numeric(12, 2), default=0)
    rider_waiver_of_premium = db.Column(db.Numeric(12, 2), default=0)
    rider_terminal_illness = db.Column(db.Numeric(12, 2), default=0)
    gst = db.Column(db.Numeric(12, 2), nullable=False)
    total_premium = db.Column(db.Numeric(12, 2), nullable=False)
    policy_status = db.Column(db.String(50), nullable=False, index=True)
    agent_name = db.Column(db.String(255))
    location = db.Column(db.String(255))
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id', ondelete='SET NULL'), nullable=True, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    vehicle = db.relationship('Vehicle', backref=db.backref('policies', lazy='dynamic'))
    covers = db.relationship(
        'PolicyCover',
        backref=db.backref('policy', lazy='select'),
        lazy='select',
        cascade='all, delete-orphan',
        order_by='PolicyCover.id'
    )
    riders = db.relationship(
        'PolicyRider',
        backref=db.backref('policy', lazy='select'),
        lazy='select',
        cascade='all, delete-orphan',
        order_by='PolicyRider.id'
    )

    def to_dict(self):
        loc_name = self.location
        if self.location_id:
            loc = db.session.get(Location, self.location_id)
            if loc:
                loc_name = loc.name
        return {
            'id': self.id,
            'insurance_type': self.insurance_type,
            'company': self.company,
            'category': self.category,
            'sub_category': self.sub_category,
            'product': self.product,
            'customer_name': self.customer_name,
            'primary_phone': self.primary_phone,
            'alternate_phone': self.alternate_phone,
            'policy_number': self.policy_number,
            'policy_term': self.policy_term,
            'premium_payment_mode': self.premium_payment_mode,
            'ppt_term': self.ppt_term,
            'number_of_lives': self.number_of_lives,
            'health_rider': self.health_rider,
            'sum_assured': float(self.sum_assured) if self.sum_assured else None,
            'sum_insured': float(self.sum_insured) if self.sum_insured else None,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'premium_mode': self.premium_mode,
            'base_premium': float(self.base_premium),
            'rider_premium': float(self.rider_premium),
            'rider_health_sickness': float(self.rider_health_sickness) if self.rider_health_sickness else 0,
            'rider_accident_disability': float(self.rider_accident_disability) if self.rider_accident_disability else 0,
            'rider_term_rider': float(self.rider_term_rider) if self.rider_term_rider else 0,
            'rider_other_pwb': float(self.rider_other_pwb) if self.rider_other_pwb else 0,
            'rider_adb': float(self.rider_adb) if self.rider_adb else 0,
            'rider_atpd': float(self.rider_atpd) if self.rider_atpd else 0,
            'rider_permanent_disability': float(self.rider_permanent_disability) if self.rider_permanent_disability else 0,
            'rider_critical_illness': float(self.rider_critical_illness) if self.rider_critical_illness else 0,
            'rider_waiver_of_premium': float(self.rider_waiver_of_premium) if self.rider_waiver_of_premium else 0,
            'rider_terminal_illness': float(self.rider_terminal_illness) if self.rider_terminal_illness else 0,
            'gst': float(self.gst),
            'total_premium': float(self.total_premium),
            'policy_status': self.policy_status,
            'agent_name': self.agent_name,
            'location': loc_name,
            'location_id': self.location_id,
            'vehicle': self.vehicle.to_dict() if self.vehicle else None,
            'covers': [c.to_dict() for c in self.covers],
            'riders': [r.to_dict() for r in self.riders],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PolicyCover(db.Model):
    """A single sub-category cover bundled inside a policy.

    A policy can hold multiple covers (e.g. Fire + Engineering + Liability),
    each with its own sum insured and premium.
    """
    __tablename__ = 'policy_covers'
    __table_args__ = (
        Index('ix_cover_policy', 'policy_id'),
    )

    id = db.Column(db.Integer, primary_key=True)
    policy_id = db.Column(db.Integer, db.ForeignKey('policies.id', ondelete='CASCADE'), nullable=False, index=True)
    category = db.Column(db.String(100), nullable=False)
    sub_category = db.Column(db.String(100), nullable=False)
    sum_insured = db.Column(db.Numeric(14, 2))
    premium = db.Column(db.Numeric(12, 2), default=0)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def to_dict(self):
        return {
            'id': self.id,
            'policy_id': self.policy_id,
            'category': self.category,
            'sub_category': self.sub_category,
            'sum_insured': float(self.sum_insured) if self.sum_insured else None,
            'premium': float(self.premium) if self.premium else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class GeneralRider(db.Model):
    """Riders available for General insurance policies."""
    __tablename__ = 'general_riders'
    __table_args__ = (
        Index('ix_gr_category', 'category'),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(500))
    category = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PolicyRider(db.Model):
    """Riders attached to a policy."""
    __tablename__ = 'policy_riders'
    __table_args__ = (
        Index('ix_pr_policy', 'policy_id'),
    )

    id = db.Column(db.Integer, primary_key=True)
    policy_id = db.Column(db.Integer, db.ForeignKey('policies.id', ondelete='CASCADE'), nullable=False, index=True)
    rider_id = db.Column(db.Integer, db.ForeignKey('general_riders.id', ondelete='CASCADE'), nullable=False)
    sum_insured = db.Column(db.Numeric(14, 2), default=0)
    premium = db.Column(db.Numeric(12, 2), default=0)
    excess_type = db.Column(db.String(20), default='percentage')  # 'percentage' or 'amount'
    excess_value = db.Column(db.Numeric(14, 2), default=0)
    excess_amount = db.Column(db.Numeric(14, 2), default=0)  # Calculated amount
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    rider = db.relationship('GeneralRider', backref=db.backref('policy_riders', lazy='select'))

    def to_dict(self):
        return {
            'id': self.id,
            'policy_id': self.policy_id,
            'rider_id': self.rider_id,
            'rider_name': self.rider.name if self.rider else None,
            'sum_insured': float(self.sum_insured) if self.sum_insured else 0,
            'premium': float(self.premium) if self.premium else 0,
            'excess_type': self.excess_type,
            'excess_value': float(self.excess_value) if self.excess_value else 0,
            'excess_amount': float(self.excess_amount) if self.excess_amount else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PolicyHistory(db.Model):
    """Snapshot of a policy's details stored when it is renewed (or marked not renewed)."""
    __tablename__ = 'policy_history'

    id = db.Column(db.Integer, primary_key=True)
    policy_id = db.Column(db.Integer, db.ForeignKey('policies.id', ondelete='CASCADE'), nullable=False, index=True)
    action = db.Column(db.String(20), nullable=False, default='renewed')
    details = db.Column(db.JSON)
    renewed_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    renewed_by_name = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    policy = db.relationship('Policy', backref=db.backref('history', lazy='dynamic', cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'policy_id': self.policy_id,
            'action': self.action,
            'details': self.details,
            'renewed_by': self.renewed_by,
            'renewed_by_name': self.renewed_by_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class RevokedToken(db.Model):
    """Track revoked JWT tokens for logout / token revocation."""
    __tablename__ = 'revoked_tokens'

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), unique=True, nullable=False, index=True)
    revoked_at = db.Column(db.DateTime, default=db.func.current_timestamp())
