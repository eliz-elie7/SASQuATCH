import bcrypt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Outil FastAPI pour intercepter les jetons de sécurité (Tokens) envoyés par React
security_helper = HTTPBearer()

# ------------------------------------------------------------
# 1. BRIQUE MOT DE PASSE (bcrypt)
# ------------------------------------------------------------

def hash_password(password: str) -> str:
    """
    Hache un mot de passe en clair avec un sel généré par bcrypt.
    Utilisé lors de la première connexion (Tunnel Célène §2.1.1).
    """
    password_bytes = password.encode('utf-8')
    # Génération du sel et hachage
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Vérifie si le mot de passe tapé correspond au hachage stocké en base.
    """
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


# ------------------------------------------------------------
# 2. BRIQUE MATRICE DES DROITS (§2.1.2)
# ------------------------------------------------------------
# Pour l'instant, on simule la lecture du Token JWT de l'utilisateur.
# On crée des "Dépendances" FastAPI qui vont servir de barrières de sécurité.

async def get_current_user_role(credentials: HTTPAuthorizationCredentials = Security(security_helper)) -> str:
    """
    Cette fonction intercepte la requête, lit le token et extrait le rôle.
    (Pour le test, on va imaginer ce que le Dev 2B va décoder du vrai JWT).
    """
    token = credentials.credentials
    
    # SIMULATION : En attendant que le Dev 2B finisse les vrais JWT,
    # tu peux tester en envoyant "token_student", "token_teacher" ou "token_admin" depuis le front.
    if token == "token_student":
        return "student"
    elif token == "token_teacher":
        return "teacher"
    elif token == "token_admin":
        return "admin"
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton d'authentification invalide ou expiré."
        )

# --- LES BARRIÈRES DE SÉCURITÉ ---

async def verify_teacher_role(role: str = Security(get_current_user_role)):
    """Bloque la route si l'utilisateur n'est pas un enseignant."""
    if role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé. Réservé au rôle Enseignant."
        )
    return role


async def verify_admin_role(role: str = Security(get_current_user_role)):
    """Bloque la route si l'utilisateur n'est pas l'administrateur."""
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé. Autorité administrative requise."
        )
    return role