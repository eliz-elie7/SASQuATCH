from sqlalchemy import Column, String, Boolean, Text, Integer, Enum, ForeignKey, TIMESTAMP, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import enum
import uuid
from datetime import datetime

# ─── Enums ───────────────────────────────────────────────
class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    admin   = "admin"

class SatisfactionStatus(str, enum.Enum):
    satisfied   = "satisfied"
    unsatisfied = "unsatisfied"

# ─── Table users ─────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institutional_id_enc = Column(Text, nullable=False)
    nom_enc              = Column(Text, nullable=False)
    prenom_enc           = Column(Text, nullable=False)
    email_enc            = Column(Text, nullable=False, unique=True)
    role                 = Column(Enum(UserRole), nullable=False)
    password_hash        = Column(Text, nullable=False)
    is_active            = Column(Boolean, default=False)
    activation_token     = Column(Text, nullable=True)
    activation_token_exp = Column(TIMESTAMP, nullable=True)
    created_at           = Column(TIMESTAMP, default=datetime.now)
    created_by           = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

# ─── Table sessions ──────────────────────────────────────
class Session(Base):
    __tablename__ = "sessions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    label      = Column(Text, nullable=False)
    join_code  = Column(String(6), nullable=False)
    secret_key = Column(LargeBinary, nullable=False)
    started_at = Column(TIMESTAMP, default=datetime.now)
    ended_at   = Column(TIMESTAMP, nullable=True)
    closed_by  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active  = Column(Boolean, default=True)

# ─── Table session_participants ───────────────────────────
class SessionParticipant(Base):
    __tablename__ = "session_participants"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    pseudonym  = Column(Text, nullable=False)
    is_banned  = Column(Boolean, default=False)
    joined_at  = Column(TIMESTAMP, default=datetime.now)

# ─── Table questions ─────────────────────────────────────
class Question(Base):
    __tablename__ = "questions"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id    = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    pseudonym     = Column(Text, nullable=False)
    parent_id     = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=True)
    content       = Column(Text, nullable=False)
    is_filtered   = Column(Boolean, default=False)
    filter_reason = Column(Text, nullable=True)
    satisfaction  = Column(Enum(SatisfactionStatus), nullable=True)
    theme_cluster = Column(Integer, nullable=True)
    submitted_at  = Column(TIMESTAMP, default=datetime.now)

# ─── Table moderation_config ─────────────────────────────
class ModerationConfig(Base):
    __tablename__ = "moderation_config"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_key   = Column(Text, nullable=False, unique=True)
    config_value = Column(Text, nullable=False)
    updated_at   = Column(TIMESTAMP, default=datetime.now)
    updated_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

# ─── Table deanonymization_logs ──────────────────────────
class DeanonymizationLog(Base):
    __tablename__ = "deanonymization_logs"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requested_by      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    session_id        = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    question_id       = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False, unique=True)
    pseudonym         = Column(Text, nullable=False)
    resolved_user_enc = Column(Text, nullable=False)
    reason            = Column(Text, nullable=False)
    requested_at      = Column(TIMESTAMP, default=datetime.now)
"""Cette classe est connectée à ta table PostgreSQL. Quand tu fais db.add(question), 
SQLAlchemy envoie automatiquement les données dans la vraie base de données sur ton disque dur. Quand ton programme s'arrête, les données sont toujours là."""