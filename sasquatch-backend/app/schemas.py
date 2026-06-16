# la vérification Pydantic
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum

# ─── Enums ───────────────────────────────────────────────
class UserRole(str, Enum):
    student = "student"
    teacher = "teacher"
    admin   = "admin"

class SatisfactionStatus(str, Enum):
    satisfied   = "satisfied"
    unsatisfied = "unsatisfied"

# ─── Schémas User ────────────────────────────────────────

# Ce que l'admin envoie pour créer un compte
class UserCreate(BaseModel):
    institutional_id: str = Field(min_length=1)
    nom:              str = Field(min_length=1)
    prenom:           str = Field(min_length=1)
    email:            str = Field(min_length=1)
    role:             UserRole

# Ce que l'API renvoie quand on consulte un user
class UserOut(BaseModel):
    id:        UUID
    role:      UserRole
    is_active: bool

    model_config = {"from_attributes": True}

# ─── Schémas Session ─────────────────────────────────────

# Ce que l'enseignant envoie pour ouvrir une session
class SessionCreate(BaseModel):
    label: str = Field(min_length=1)

# Ce que l'API renvoie
class SessionOut(BaseModel):
    id:         UUID
    label:      str
    join_code:  str
    is_active:  bool
    started_at: datetime

    model_config = {"from_attributes": True}

# ─── Schémas Question ────────────────────────────────────

# Ce que React envoie quand un étudiant pose une question
class QuestionCreate(BaseModel):
    session_id: UUID
    content:    str = Field(min_length=1, max_length=1000)
    parent_id:  Optional[UUID] = None  # optionnel : clarification d'une question

# Ce que React envoie pour signaler satisfaction
class QuestionSatisfaction(BaseModel):
    satisfaction: SatisfactionStatus

# Ce que l'API renvoie
class QuestionOut(BaseModel):
    id:           UUID
    pseudonym:    str
    content:      str
    parent_id:    Optional[UUID]
    satisfaction: Optional[SatisfactionStatus]
    is_filtered:  bool
    submitted_at: datetime

    model_config = {"from_attributes": True}

# ─── Schémas Participant ─────────────────────────────────

# Ce que l'étudiant envoie pour rejoindre une session
class JoinSession(BaseModel):
    join_code: str = Field(min_length=6, max_length=6)

# ─── Schémas Modération ──────────────────────────────────

# Ce que l'enseignant envoie pour bannir un pseudonyme
class BanRequest(BaseModel):
    pseudonym: str = Field(min_length=1)

# ─── Schémas Désanonymisation ────────────────────────────

# Ce que l'admin envoie pour désanonymiser une contribution
class DeanonRequest(BaseModel):
    question_id: UUID
    reason:      str = Field(min_length=10)
"""Pourquoi ces schémas ? Chaque schéma correspond à une action du cahier des charges :

QuestionCreate → §soumettre une question
JoinSession → § rejoindre une session avec le code
BanRequest → §bannissement par l'enseignant
DeanonRequest → §désanonymisation par l'admin

""
React envoie des données
        ↓
schemas.py (Pydantic vérifie)
        ↓
    ❌ Données incorrectes → FastAPI renvoie erreur à React automatiquement
    ✅ Données correctes → on continue
        ↓
models.py (SQLAlchemy écrit en base PostgreSQL)
"""