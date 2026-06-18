"""
Modèles SQLAlchemy : chaque classe correspond à une table déjà existante
en PostgreSQL (créée via migrations/*.sql, voir schema_actuel.sql).

IMPORTANT : ces classes décrivent un schéma qui existe déjà. On n'appelle
JAMAIS Base.metadata.create_all() dans ce projet -- la BDD est la source
de vérité, gérée par scripts SQL versionnés dans migrations/.

Les valeurs par défaut (gen_random_uuid(), now()) sont gérées côté
PostgreSQL (server_default), pas en Python, pour rester fidèle au .sql.
"""

import enum
from sqlalchemy import (
    Column, String, Boolean, Integer, Text, CHAR, LargeBinary,
    TIMESTAMP, ForeignKey, Enum, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class RoleEnum(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class SatisfactionEnum(str, enum.Enum):
    satisfied = "satisfied"
    unsatisfied = "unsatisfied"


# Les ENUM Postgres existent déjà (CREATE TYPE dans le .sql) ; on dit à
# SQLAlchemy de ne pas tenter de les recréer avec create_type=False.
role_pg_enum = Enum(RoleEnum, name="user_role", create_type=False)
satisfaction_pg_enum = Enum(SatisfactionEnum, name="satisfaction_status", create_type=False)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))

    # Identité réelle : toujours stockée chiffrée (AES-256-GCM, voir crypto.py).
    institutional_id_enc = Column(Text, nullable=False)
    nom_enc = Column(Text, nullable=False)
    prenom_enc = Column(Text, nullable=False)
    email_enc = Column(Text, nullable=False)

    # Hash HMAC-SHA256 déterministe de l'email, utilisé pour la recherche
    # et l'unicité (email_enc seul ne peut pas être indexé/recherché).
    email_hash = Column(Text, nullable=False, unique=True)

    role = Column(role_pg_enum, nullable=False)
    password_hash = Column(Text, nullable=False)

    is_active = Column(Boolean, server_default=text("false"))
    activation_token = Column(Text, nullable=True)
    activation_token_exp = Column(TIMESTAMP, nullable=True)
    activation_code = Column(Text, nullable=True)  # code court alternatif au lien

    created_at = Column(TIMESTAMP, server_default=text("now()"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class CourseSession(Base):
    """Table 'sessions' -- renommée en Python pour éviter la confusion
    avec une session SQLAlchemy (objet db) ou une session HTTP."""
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    label = Column(Text, nullable=False)
    join_code = Column(CHAR(6), nullable=False, unique=True)
    secret_key = Column(LargeBinary, nullable=False)  # secret S pour HMAC pseudonymes
    started_at = Column(TIMESTAMP, server_default=text("now()"), nullable=False)
    ended_at = Column(TIMESTAMP, nullable=True)
    closed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, server_default=text("true"))


class SessionParticipant(Base):
    __tablename__ = "session_participants"
    __table_args__ = (UniqueConstraint("session_id", "user_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    pseudonym = Column(Text, nullable=False)  # HMAC(secret_key, user.id), voir crypto
    is_banned = Column(Boolean, server_default=text("false"))
    joined_at = Column(TIMESTAMP, server_default=text("now()"), nullable=False)


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    pseudonym = Column(Text, nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=True)
    content = Column(Text, nullable=False)
    is_filtered = Column(Boolean, server_default=text("false"))
    filter_reason = Column(Text, nullable=True)
    satisfaction = Column(satisfaction_pg_enum, nullable=True)
    theme_cluster = Column(Integer, nullable=True)
    submitted_at = Column(TIMESTAMP, server_default=text("now()"), nullable=False)


class ModerationConfig(Base):
    __tablename__ = "moderation_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    config_key = Column(Text, nullable=False, unique=True)
    config_value = Column(Text, nullable=False)
    updated_at = Column(TIMESTAMP, server_default=text("now()"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class DeanonymizationLog(Base):
    __tablename__ = "deanonymization_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    pseudonym = Column(Text, nullable=False)
    resolved_user_enc = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    requested_at = Column(TIMESTAMP, server_default=text("now()"), nullable=False)