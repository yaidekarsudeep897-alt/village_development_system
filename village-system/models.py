from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Index, MetaData, UniqueConstraint


orm_db = SQLAlchemy(metadata=MetaData(naming_convention={
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}))


class Panchayat(orm_db.Model):
    __tablename__ = "panchayats"

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    lgd_code = orm_db.Column(orm_db.String(20), unique=True, nullable=False)
    name = orm_db.Column(orm_db.String(150), nullable=False)
    district = orm_db.Column(orm_db.String(100), nullable=False)
    taluk = orm_db.Column(orm_db.String(100), nullable=False)


class User(orm_db.Model):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('citizen','officer','admin')", name="ck_users_role"),
        Index("ix_users_panchayat_role", "panchayat_id", "role"),
        UniqueConstraint("id", "panchayat_id", name="uq_users_id_panchayat"),
    )

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    name = orm_db.Column(orm_db.String(100), nullable=False)
    email = orm_db.Column(orm_db.String(254), unique=True, nullable=False)
    password_hash = orm_db.Column(orm_db.String(256), nullable=False)
    role = orm_db.Column(orm_db.String(20), nullable=False)
    panchayat_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("panchayats.id"))
    created_at = orm_db.Column(orm_db.String(40), nullable=False)


class Complaint(orm_db.Model):
    __tablename__ = "complaints"
    __table_args__ = (
        Index("ix_complaints_panchayat_created", "panchayat_id", "created_at"),
        Index("ix_complaints_panchayat_status", "panchayat_id", "status"),
        Index("ix_complaints_user_created", "user_id", "created_at"),
        UniqueConstraint("user_id", "id", name="uq_complaints_user_id"),
        ForeignKeyConstraint(
            ["user_id", "panchayat_id"],
            ["users.id", "users.panchayat_id"],
            name="fk_complaints_user_panchayat",
        ),
        ForeignKeyConstraint(
            ["assigned_officer_id", "panchayat_id"],
            ["users.id", "users.panchayat_id"],
            name="fk_complaints_assigned_officer_panchayat",
        ),
    )

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    user_id = orm_db.Column(orm_db.Integer, nullable=False)
    panchayat_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("panchayats.id"), nullable=False)
    category = orm_db.Column(orm_db.String(50), nullable=False)
    title = orm_db.Column(orm_db.String(150), nullable=False)
    description = orm_db.Column(orm_db.Text, nullable=False)
    location = orm_db.Column(orm_db.String(200), nullable=False)
    latitude = orm_db.Column(orm_db.Float)
    longitude = orm_db.Column(orm_db.Float)
    status = orm_db.Column(orm_db.String(30), nullable=False, server_default="Submitted")
    created_at = orm_db.Column(orm_db.String(40), nullable=False)
    updated_at = orm_db.Column(orm_db.String(40), nullable=False)
    image_filename = orm_db.Column(orm_db.String(255))
    assigned_officer_id = orm_db.Column(orm_db.Integer)


class ComplaintImageAnalysis(orm_db.Model):
    __tablename__ = "complaint_image_analyses"

    complaint_id = orm_db.Column(
        orm_db.Integer,
        orm_db.ForeignKey("complaints.id", ondelete="CASCADE"),
        primary_key=True,
    )
    analyzed_by = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("users.id"), nullable=False)
    category = orm_db.Column(orm_db.String(50), nullable=False)
    issue_type = orm_db.Column(orm_db.String(100), nullable=False)
    title = orm_db.Column(orm_db.String(120), nullable=False)
    description = orm_db.Column(orm_db.String(500), nullable=False)
    confidence = orm_db.Column(orm_db.String(10), nullable=False)
    analyzed_at = orm_db.Column(orm_db.String(40), nullable=False)


class ComplaintUpdate(orm_db.Model):
    __tablename__ = "complaint_updates"
    __table_args__ = (Index("ix_complaint_updates_complaint", "complaint_id", "id"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    complaint_id = orm_db.Column(
        orm_db.Integer,
        orm_db.ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("users.id"), nullable=False)
    status = orm_db.Column(orm_db.String(30), nullable=False)
    note = orm_db.Column(orm_db.String(1000), nullable=False)
    created_at = orm_db.Column(orm_db.String(40), nullable=False)


class ComplaintFeedback(orm_db.Model):
    __tablename__ = "complaint_feedback"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "complaint_id"],
            ["complaints.user_id", "complaints.id"],
            name="fk_complaint_feedback_reporter",
            ondelete="CASCADE",
        ),
    )

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    complaint_id = orm_db.Column(orm_db.Integer, nullable=False, unique=True)
    user_id = orm_db.Column(orm_db.Integer, nullable=False)
    rating = orm_db.Column(
        orm_db.Integer,
        CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),
        nullable=False,
    )
    note = orm_db.Column(orm_db.Text, nullable=False)
    created_at = orm_db.Column(orm_db.String(40), nullable=False)
    updated_at = orm_db.Column(orm_db.String(40), nullable=False)


class Budget(orm_db.Model):
    __tablename__ = "budgets"
    __table_args__ = (Index("ix_budgets_panchayat_updated", "panchayat_id", "updated_at"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    panchayat_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("panchayats.id"), nullable=False)
    financial_year = orm_db.Column(orm_db.String(20), nullable=False)
    title = orm_db.Column(orm_db.String(150), nullable=False)
    allocated = orm_db.Column(orm_db.Float, nullable=False)
    spent = orm_db.Column(orm_db.Float, nullable=False, server_default="0")
    progress = orm_db.Column(orm_db.Integer, nullable=False, server_default="0")
    updated_at = orm_db.Column(orm_db.String(40), nullable=False)
    user_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("users.id"))


class LocalScheme(orm_db.Model):
    __tablename__ = "local_schemes"
    __table_args__ = (Index("ix_local_schemes_panchayat_updated", "panchayat_id", "updated_at"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    panchayat_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("panchayats.id"), nullable=False)
    title = orm_db.Column(orm_db.String(150), nullable=False)
    category = orm_db.Column(orm_db.String(50), nullable=False)
    description = orm_db.Column(orm_db.Text, nullable=False)
    eligibility = orm_db.Column(orm_db.Text, nullable=False)
    benefits = orm_db.Column(orm_db.Text, nullable=False)
    documents = orm_db.Column(orm_db.Text, nullable=False)
    application_info = orm_db.Column(orm_db.Text, nullable=False)
    official_url = orm_db.Column(orm_db.String(1000), nullable=False, server_default="")
    min_age = orm_db.Column(orm_db.Integer)
    max_age = orm_db.Column(orm_db.Integer)
    max_annual_income = orm_db.Column(orm_db.Integer)
    verified_at = orm_db.Column(orm_db.String(40))
    verified_by = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("users.id"))
    user_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("users.id"), nullable=False)
    created_at = orm_db.Column(orm_db.String(40), nullable=False)
    updated_at = orm_db.Column(orm_db.String(40), nullable=False)


class SchemeCheckHistory(orm_db.Model):
    __tablename__ = "scheme_check_history"
    __table_args__ = (Index("ix_scheme_history_user_created", "user_id", "created_at"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    user_id = orm_db.Column(
        orm_db.Integer,
        orm_db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    category = orm_db.Column(orm_db.String(50), nullable=False)
    age_band = orm_db.Column(orm_db.String(40), nullable=False)
    income_band = orm_db.Column(orm_db.String(40), nullable=False)
    results_json = orm_db.Column(orm_db.Text, nullable=False)
    created_at = orm_db.Column(orm_db.String(40), nullable=False)


class School(orm_db.Model):
    __tablename__ = "schools"
    __table_args__ = (Index("ix_schools_panchayat_name", "panchayat_id", "name"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    panchayat_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("panchayats.id"), nullable=False)
    name = orm_db.Column(orm_db.String(150), nullable=False)
    village = orm_db.Column(orm_db.String(150), nullable=False)
    facilities = orm_db.Column(orm_db.Text, nullable=False, server_default="")
    meal_feedback = orm_db.Column(orm_db.Text, nullable=False, server_default="")
    updated_at = orm_db.Column(orm_db.String(40), nullable=False)


class Camp(orm_db.Model):
    __tablename__ = "camps"
    __table_args__ = (Index("ix_camps_panchayat_date", "panchayat_id", "camp_date"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    panchayat_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("panchayats.id"), nullable=False)
    title = orm_db.Column(orm_db.String(150), nullable=False)
    camp_date = orm_db.Column(orm_db.String(20), nullable=False)
    camp_time = orm_db.Column(orm_db.String(100), nullable=False)
    location = orm_db.Column(orm_db.String(200), nullable=False)
    doctors = orm_db.Column(orm_db.Text, nullable=False)
    services = orm_db.Column(orm_db.Text, nullable=False)
    capacity = orm_db.Column(orm_db.Integer, nullable=False)
    created_at = orm_db.Column(orm_db.String(40), nullable=False)
    start_time = orm_db.Column(orm_db.String(10))
    end_time = orm_db.Column(orm_db.String(10))
    slot_minutes = orm_db.Column(orm_db.Integer, nullable=False, server_default="30")
    slot_capacity = orm_db.Column(orm_db.Integer, nullable=False, server_default="10")


class CampSlot(orm_db.Model):
    __tablename__ = "camp_slots"
    __table_args__ = (UniqueConstraint("camp_id", "starts_at", name="uq_camp_slots_start"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    camp_id = orm_db.Column(
        orm_db.Integer,
        orm_db.ForeignKey("camps.id", ondelete="CASCADE"),
        nullable=False,
    )
    starts_at = orm_db.Column(orm_db.String(40), nullable=False)
    capacity = orm_db.Column(orm_db.Integer, nullable=False)


class CampRegistration(orm_db.Model):
    __tablename__ = "camp_registrations"
    __table_args__ = (
        UniqueConstraint("camp_id", "user_id", name="uq_camp_registration_user"),
        Index("ix_camp_registrations_slot", "slot_id"),
    )

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    camp_id = orm_db.Column(
        orm_db.Integer,
        orm_db.ForeignKey("camps.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("users.id"), nullable=False)
    created_at = orm_db.Column(orm_db.String(40), nullable=False)
    slot_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("camp_slots.id"))


class Project(orm_db.Model):
    __tablename__ = "projects"
    __table_args__ = (Index("ix_projects_panchayat_updated", "panchayat_id", "updated_at"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    panchayat_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("panchayats.id"), nullable=False)
    title = orm_db.Column(orm_db.String(150), nullable=False)
    description = orm_db.Column(orm_db.Text, nullable=False, server_default="")
    status = orm_db.Column(orm_db.String(30), nullable=False, server_default="Planned")
    progress = orm_db.Column(orm_db.Integer, nullable=False, server_default="0")
    updated_at = orm_db.Column(orm_db.String(40), nullable=False)


class CitizenFeedback(orm_db.Model):
    __tablename__ = "citizen_feedback"
    __table_args__ = (
        CheckConstraint("target_type IN ('project','service')", name="ck_citizen_feedback_target_type"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_citizen_feedback_rating"),
        CheckConstraint(
            "(target_type='project' AND project_id IS NOT NULL AND service_name IS NULL) OR "
            "(target_type='service' AND project_id IS NULL AND service_name IS NOT NULL)",
            name="ck_citizen_feedback_target",
        ),
        ForeignKeyConstraint(
            ["user_id", "panchayat_id"],
            ["users.id", "users.panchayat_id"],
            name="fk_citizen_feedback_user_panchayat",
        ),
        Index(
            "citizen_feedback_project_user",
            "project_id",
            "user_id",
            unique=True,
            sqlite_where=orm_db.text("target_type='project'"),
            postgresql_where=orm_db.text("target_type='project'"),
        ),
        Index(
            "citizen_feedback_service_user",
            "panchayat_id",
            "service_name",
            "user_id",
            unique=True,
            sqlite_where=orm_db.text("target_type='service'"),
            postgresql_where=orm_db.text("target_type='service'"),
        ),
    )

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    user_id = orm_db.Column(orm_db.Integer, nullable=False)
    panchayat_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("panchayats.id"), nullable=False)
    target_type = orm_db.Column(orm_db.String(20), nullable=False)
    project_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("projects.id"))
    service_name = orm_db.Column(orm_db.String(100))
    rating = orm_db.Column(orm_db.Integer, nullable=False)
    note = orm_db.Column(orm_db.Text, nullable=False, server_default="")
    created_at = orm_db.Column(orm_db.String(40), nullable=False)
    updated_at = orm_db.Column(orm_db.String(40), nullable=False)


class Inspection(orm_db.Model):
    __tablename__ = "inspections"
    __table_args__ = (Index("ix_inspections_project_created", "project_id", "created_at"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    project_id = orm_db.Column(
        orm_db.Integer,
        orm_db.ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("users.id"), nullable=False)
    notes = orm_db.Column(orm_db.String(1500), nullable=False)
    progress = orm_db.Column(orm_db.Integer, nullable=False)
    evidence_url = orm_db.Column(orm_db.String(1000), nullable=False, server_default="")
    citizen_feedback = orm_db.Column(orm_db.String(1000), nullable=False, server_default="")
    created_at = orm_db.Column(orm_db.String(40), nullable=False)


class Notification(orm_db.Model):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read_id", "user_id", "read", "id"),)

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    user_id = orm_db.Column(
        orm_db.Integer,
        orm_db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    message = orm_db.Column(orm_db.String(1200), nullable=False)
    created_at = orm_db.Column(orm_db.String(40), nullable=False)
    read = orm_db.Column(orm_db.Integer, nullable=False, server_default="0")


class NotificationAnnouncement(orm_db.Model):
    __tablename__ = "notification_announcements"
    __table_args__ = (
        Index("ix_notification_announcements_panchayat_created", "panchayat_id", "created_at"),
        ForeignKeyConstraint(
            ["officer_id", "panchayat_id"],
            ["users.id", "users.panchayat_id"],
            name="fk_notification_announcements_officer_panchayat",
        ),
    )

    id = orm_db.Column(orm_db.Integer, primary_key=True)
    panchayat_id = orm_db.Column(orm_db.Integer, orm_db.ForeignKey("panchayats.id"), nullable=False)
    officer_id = orm_db.Column(orm_db.Integer, nullable=False)
    message = orm_db.Column(orm_db.String(1000), nullable=False)
    recipient_count = orm_db.Column(orm_db.Integer, nullable=False)
    created_at = orm_db.Column(orm_db.String(40), nullable=False)
