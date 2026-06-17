"""
Routes réservées à l'administrateur.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta
import json
import logging

from app.database import get_db
from app.models import User, RoleEnum, Question, SessionParticipant, DeanonymizationLog
from app.schemas import (
    UserCreate, UserCreateResponse,
    DeanonymizationRequest, DeanonymizationResponse,
)
from app.crypto import encrypt_field, decrypt_field, searchable_hash, generate_activation_token
from app.dependencies import require_role
from app.email_service import send_activation_email

router = APIRouter(prefix="/admin", tags=["admin"])

logger = logging.getLogger(__name__)

ACTIVATION_TOKEN_VALIDITY_HOURS = 48


@router.post(
    "/users",
    response_model=UserCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(RoleEnum.admin)),
):
    """
    Création d'un compte par l'administrateur (étudiant, enseignant ou
    autre admin). L'identité est chiffrée avant stockage. Un token
    d'activation est généré et envoyé par e-mail (voir app/email_service.py).
    Si l'envoi échoue (SMTP mal configuré, panne réseau...), le compte
    est tout de même créé -- l'admin peut récupérer le token en base.
    """
    email_hash = searchable_hash(payload.email)
    existing = db.query(User).filter(User.email_hash == email_hash).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet e-mail",
        )

    new_user = User(
        institutional_id_enc=encrypt_field(payload.institutional_id),
        nom_enc=encrypt_field(payload.nom),
        prenom_enc=encrypt_field(payload.prenom),
        email_enc=encrypt_field(payload.email),
        email_hash=email_hash,
        role=payload.role,
        password_hash="",  # vide tant que le compte n'est pas activé
        is_active=False,
        activation_token=generate_activation_token(),
        activation_token_exp=datetime.utcnow() + timedelta(hours=ACTIVATION_TOKEN_VALIDITY_HOURS),
        created_by=current_admin.id,
    )

    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet e-mail",
        )
    db.refresh(new_user)

    try:
        send_activation_email(
            to_email=payload.email,
            prenom=payload.prenom,
            activation_token=new_user.activation_token,
        )
    except Exception as exc:
        # On ne bloque jamais la création de compte pour un souci SMTP
        # (identifiants mal configurés, panne réseau...). L'admin peut
        # toujours retrouver le token en base et le transmettre
        # manuellement en attendant. On logue l'erreur pour diagnostic.
        logger.error("Échec de l'envoi de l'e-mail d'activation à %s : %s", payload.email, exc)

    return new_user


@router.post("/deanonymize", response_model=DeanonymizationResponse)
def deanonymize_contribution(
    payload: DeanonymizationRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(RoleEnum.admin)),
):
    """
    Désanonymisation administrative d'une contribution (§2.3.3).
    Opération exceptionnelle, jamais déclenchable par l'enseignant,
    systématiquement journalisée dans deanonymization_logs.
    """
    question = db.query(Question).filter(Question.id == payload.question_id).first()
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question introuvable")

    # On retrouve le participant via (session_id, pseudonym) -- la copie
    # du pseudonyme dans session_participants reste accessible même après
    # la destruction de secret_key à la clôture de session.
    participant = (
        db.query(SessionParticipant)
        .filter(
            SessionParticipant.session_id == question.session_id,
            SessionParticipant.pseudonym == question.pseudonym,
        )
        .first()
    )
    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Impossible de relier ce pseudonyme à un participant enregistré",
        )

    target_user = db.query(User).filter(User.id == participant.user_id).first()
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

    nom = decrypt_field(target_user.nom_enc)
    prenom = decrypt_field(target_user.prenom_enc)
    email = decrypt_field(target_user.email_enc)
    institutional_id = decrypt_field(target_user.institutional_id_enc)

    # Réarchivage chiffré de l'identité retrouvée pour le journal d'audit.
    # On ne stocke jamais cette identité en clair, même dans
    # deanonymization_logs -- seul resolved_user_enc, rechiffré, y figure.
    resolved_summary = json.dumps({
        "institutional_id": institutional_id,
        "nom": nom,
        "prenom": prenom,
        "email": email,
    })

    log_entry = DeanonymizationLog(
        requested_by=current_admin.id,
        session_id=question.session_id,
        question_id=question.id,
        pseudonym=question.pseudonym,
        resolved_user_enc=encrypt_field(resolved_summary),
        reason=payload.reason,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    return DeanonymizationResponse(
        pseudonym=question.pseudonym,
        institutional_id=institutional_id,
        nom=nom,
        prenom=prenom,
        email=email,
        log_id=log_entry.id,
        requested_at=log_entry.requested_at,
    )