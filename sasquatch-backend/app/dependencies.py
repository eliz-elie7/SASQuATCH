"""
Dépendances FastAPI réutilisables pour l'authentification et l'autorisation.

Concept clé : une dépendance FastAPI est une fonction qu'on injecte dans
une route via Depends(...). FastAPI l'exécute AVANT le corps de la route,
et si elle lève une HTTPException, la route ne s'exécute jamais.

On s'en sert ici pour vérifier le JWT et le rôle de l'utilisateur, sans
dupliquer cette logique dans chaque route protégée.
"""

import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RoleEnum

# Attention : Assure-toi que le nom de cette variable correspond bien à 
# celle de ton fichier .env (nous avions mis API_SECRET_KEY dans l'exemple)
JWT_SECRET = os.getenv("JWT_SECRET", "votre_cle_secrete_api_ici") 
JWT_ALGORITHM = "HS256"

# On remplace OAuth2PasswordBearer par HTTPBearer pour permettre
# la saisie manuelle du token dans Swagger UI
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Décode le JWT et retourne l'utilisateur correspondant, ou lève 401."""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Avec HTTPBearer, le token se trouve dans l'attribut credentials
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_error
    return user


def require_role(*allowed_roles: RoleEnum):
    """
    Fabrique de dépendance : require_role(RoleEnum.admin) retourne une
    dépendance qui n'autorise que les admins. Permet de réutiliser la même
    logique pour différents rôles sans dupliquer de code.

    Usage dans une route : current_user: User = Depends(require_role(RoleEnum.admin))
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action réservée au(x) rôle(s) : {', '.join(r.value for r in allowed_roles)}",
            )
        return current_user
    return role_checker