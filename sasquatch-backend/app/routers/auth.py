"""
Routes liées à l'authentification.

Concept FastAPI : un "router" regroupe des routes par thème. On l'inclut
ensuite dans main.py avec app.include_router(...). Ça évite d'avoir
un seul fichier main.py de 2000 lignes.
"""

import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import jwt

from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, AccountActivation
from app.crypto import verify_password, hash_password

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 120


def create_access_token(user_id: str, role: str) -> str:
    """Construit un JWT contenant l'id et le rôle de l'utilisateur."""
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Connexion d'un utilisateur déjà activé.

    On recherche par email_hash (HMAC déterministe), jamais par email_enc
    (chiffrement AES-256-GCM non déterministe -- deux chiffrements du même
    email donnent des octets différents, donc une comparaison directe
    échouerait systématiquement).
    """
    from app.crypto import searchable_hash

    user = db.query(User).filter(User.email_hash == searchable_hash(credentials.email)).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants invalides ou compte non activé",
        )

    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants invalides",
        )

    token = create_access_token(str(user.id), user.role.value)
    return TokenResponse(access_token=token, role=user.role)


@router.post("/activate")
def activate_account(payload: AccountActivation, db: Session = Depends(get_db)):
    """
    Première connexion : l'utilisateur active son compte via le lien
    e-mail (activation_token) ou via le code court saisi manuellement
    (activation_code). L'un des deux doit être fourni.
    """
    if not payload.activation_token and not payload.activation_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fournissez un token d'activation ou un code court",
        )

    user = None

    if payload.activation_token:
        user = db.query(User).filter(User.activation_token == payload.activation_token).first()
        if not user:
            raise HTTPException(status_code=404, detail="Token d'activation invalide")
        if user.activation_token_exp and user.activation_token_exp < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Token d'activation expiré")

    elif payload.activation_code:
        user = db.query(User).filter(
            User.activation_code == payload.activation_code.upper().strip()
        ).first()
        if not user:
            raise HTTPException(status_code=404, detail="Code d'activation invalide")
        # Le code court partage la même date d'expiration que le token long.
        if user.activation_token_exp and user.activation_token_exp < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Code d'activation expiré")

    user.password_hash = hash_password(payload.new_password)
    user.is_active = True
    user.activation_token = None
    user.activation_token_exp = None
    user.activation_code = None  # supprimé après usage, comme le token

    db.commit()
    return {"message": "Compte activé avec succès"}