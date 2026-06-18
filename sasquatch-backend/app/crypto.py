"""
Fonctions cryptographiques centrales du projet.

Trois mécanismes distincts, à ne pas confondre :

1. CHIFFREMENT (AES-256-GCM) : réversible. Pour stocker l'identité réelle
   (nom, prénom, email...) -- on doit pouvoir la retrouver un jour
   (désanonymisation administrative).

2. HACHAGE DE RECHERCHE (HMAC-SHA256) : déterministe et irréversible.
   Calculé EN PLUS du chiffrement, uniquement pour les champs qu'on doit
   pouvoir rechercher (ex: email). Même entrée -> toujours même sortie,
   ce qui permet `WHERE email_hash = hmac(email)` en BDD.
   Contrairement au chiffrement, on ne peut PAS retrouver l'email à partir
   du hash -- il sert seulement à la comparaison.

3. HACHAGE DE MOT DE PASSE (bcrypt) : irréversible, avec sel automatique
   intégré. Pour les mots de passe -- on ne doit jamais pouvoir retrouver
   le mot de passe d'origine, seulement vérifier une saisie.
"""

import os
import hmac
import hashlib
import secrets
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from passlib.context import CryptContext

# --- Hachage des mots de passe ---

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# --- Chiffrement AES-256-GCM ---

_ENC_KEY_B64 = os.getenv("ENCRYPTION_KEY")
if not _ENC_KEY_B64:
    raise RuntimeError(
        "ENCRYPTION_KEY manquante dans .env. "
        "Génère-la une fois avec : python3 -c \"import secrets,base64; "
        "print(base64.b64encode(secrets.token_bytes(32)).decode())\""
    )
_ENC_KEY = base64.b64decode(_ENC_KEY_B64)  # doit faire 32 octets (256 bits)
if len(_ENC_KEY) != 32:
    raise RuntimeError("ENCRYPTION_KEY doit décoder en exactement 32 octets pour AES-256")

_aesgcm = AESGCM(_ENC_KEY)


def encrypt_field(plain_text: str) -> str:
    """
    Chiffre une chaîne en AES-256-GCM.
    Le nonce (12 octets, aléatoire) est préfixé au texte chiffré et stocké
    avec lui -- ce n'est pas un secret, juste une donnée nécessaire au
    déchiffrement, comme un sel.
    Résultat encodé en base64 pour stockage facile en colonne TEXT.
    """
    nonce = secrets.token_bytes(12)
    cipher_bytes = _aesgcm.encrypt(nonce, plain_text.encode(), None)
    return base64.b64encode(nonce + cipher_bytes).decode()


def decrypt_field(stored_value: str) -> str:
    """Déchiffre une chaîne produite par encrypt_field. Réservé à la désanonymisation."""
    raw = base64.b64decode(stored_value)
    nonce, cipher_bytes = raw[:12], raw[12:]
    return _aesgcm.decrypt(nonce, cipher_bytes, None).decode()


# --- HMAC déterministe pour la recherche (ex: retrouver un user par email) ---

_HMAC_KEY_B64 = os.getenv("HMAC_SEARCH_KEY")
if not _HMAC_KEY_B64:
    raise RuntimeError(
        "HMAC_SEARCH_KEY manquante dans .env. "
        "Génère-la une fois avec : python3 -c \"import secrets,base64; "
        "print(base64.b64encode(secrets.token_bytes(32)).decode())\""
    )
_HMAC_KEY = base64.b64decode(_HMAC_KEY_B64)


def searchable_hash(plain_text: str) -> str:
    """
    Hash déterministe d'un champ pour permettre une recherche exacte en BDD
    sans jamais stocker la valeur en clair. Toujours utilisé EN PLUS du
    champ chiffré (ex: email_enc + email_hash), jamais à sa place.
    """
    normalized = plain_text.strip().lower()
    digest = hmac.new(_HMAC_KEY, normalized.encode(), hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


# --- Génération de tokens d'activation ---

def generate_activation_token() -> str:
    """Token à usage unique, envoyé par e-mail, imprévisible."""
    return secrets.token_urlsafe(32)


def generate_activation_code(length: int = 8) -> str:
    """
    Code court d'activation (alternative au lien pour les cas où celui-ci
    ne fonctionne pas : client mail qui coupe les URLs, téléphone qui
    ouvre le mauvais navigateur, etc.).
    Même alphabet sans ambiguïté visuelle que les join_code de session.
    """
    return "".join(secrets.choice(_JOIN_CODE_ALPHABET) for _ in range(length))


# --- Pseudonymes de session (HMAC-SHA256, secret par session) ---
#
# Contrairement à searchable_hash ci-dessus (qui utilise une clé globale
# fixe, valable pour toute la durée de vie de l'application), le secret
# utilisé ici est PROPRE À CHAQUE SESSION DE COURS (sessions.secret_key).
# C'est ce qui garantit qu'un même étudiant a un pseudonyme différent
# d'une séance à l'autre (cahier des charges §2.1.4 et §5.3).

PSEUDONYM_BYTE_LENGTH = 32  # secret S, 256 bits


def generate_session_secret() -> bytes:
    """
    Génère le secret cryptographique S d'une nouvelle session de cours.
    Stocké tel quel (bytes) dans sessions.secret_key (colonne BYTEA),
    jamais transmis au client, détruit à la clôture de la session.
    """
    return secrets.token_bytes(PSEUDONYM_BYTE_LENGTH)


def generate_pseudonym(session_secret: bytes, user_id: str) -> str:
    """
    Calcule le pseudonyme de session d'un étudiant :
        P = HMAC_SHA256(S, user.id)
    Déterministe pour un (S, user_id) donné -> stable pendant la session.
    Tronqué à 16 octets puis encodé en base32 (sans padding) pour rester
    lisible et copiable à l'écran par l'enseignant si besoin.
    """
    digest = hmac.new(session_secret, str(user_id).encode(), hashlib.sha256).digest()
    truncated = digest[:16]
    return base64.b32encode(truncated).decode().rstrip("=")


# --- Code de session court (6 caractères, peu ambigu visuellement) ---

# Alphabet volontairement réduit : pas de 0/O, 1/I/L, etc. pour limiter
# les erreurs de saisie en conditions réelles (cahier des charges §2.2.1).
_JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_join_code(length: int = 6) -> str:
    """Génère un code de session court, lisible, à faible ambiguïté visuelle."""
    return "".join(secrets.choice(_JOIN_CODE_ALPHABET) for _ in range(length))