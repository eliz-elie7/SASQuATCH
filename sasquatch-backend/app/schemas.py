"""
Schémas Pydantic : définissent la forme des données qui entrent et sortent
de l'API. FastAPI s'en sert pour valider automatiquement les requêtes
(ex : rejeter une requête si l'email n'est pas un email valide) et pour
générer la documentation interactive (/docs).
"""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models import RoleEnum


# --- Création d'un compte (par l'admin) ---

class UserCreate(BaseModel):
    institutional_id: str
    nom: str
    prenom: str
    email: EmailStr
    role: RoleEnum


class UserCreateResponse(BaseModel):
    id: uuid.UUID
    role: RoleEnum
    is_active: bool

    class Config:
        # Permet à Pydantic de lire directement un objet SQLAlchemy
        # (au lieu d'un dict) pour construire la réponse.
        from_attributes = True


# --- Activation du compte (1re connexion via lien e-mail) ---

class AccountActivation(BaseModel):
    activation_token: str
    new_password: str


# --- Connexion (login) ---

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: RoleEnum


# --- Sessions de cours ---

class SessionCreate(BaseModel):
    label: str


class SessionCreateResponse(BaseModel):
    id: uuid.UUID
    label: str
    join_code: str
    started_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class SessionJoinRequest(BaseModel):
    join_code: str


class SessionJoinResponse(BaseModel):
    session_id: uuid.UUID
    label: str
    pseudonym: str


class SessionCloseResponse(BaseModel):
    id: uuid.UUID
    label: str
    is_active: bool
    ended_at: datetime

    class Config:
        from_attributes = True


# --- Questions ---

class QuestionCreate(BaseModel):
    session_id: uuid.UUID
    content: str
    parent_id: Optional[uuid.UUID] = None


class QuestionResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    pseudonym: str
    parent_id: Optional[uuid.UUID]
    content: str
    is_filtered: bool
    filter_reason: Optional[str]
    satisfaction: Optional[str]
    submitted_at: datetime

    class Config:
        from_attributes = True


class QuestionListResponse(BaseModel):
    questions: list[QuestionResponse]
    total: int


class SatisfactionUpdate(BaseModel):
    satisfaction: str  # "satisfied" | "unsatisfied"


# --- Bannissement ---

class BanRequest(BaseModel):
    pseudonym: str


class BanResponse(BaseModel):
    pseudonym: str
    is_banned: bool


# --- Désanonymisation ---

class DeanonymizationRequest(BaseModel):
    question_id: uuid.UUID
    reason: str


class DeanonymizationResponse(BaseModel):
    pseudonym: str
    institutional_id: str
    nom: str
    prenom: str
    email: str
    log_id: uuid.UUID
    requested_at: datetime