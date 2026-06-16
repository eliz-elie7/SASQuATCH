"""
Logique de modération automatique appliquée à chaque question avant
publication (§2.3.1) :
  - liste noire de termes interdits, configurable par l'admin sans
    redéploiement (table moderation_config)
  - rate limiting par pseudonyme de session

Les deux résultats possibles sont encodés dans FilterResult :
filtré ou pas, et pourquoi (pour remplir questions.filter_reason).
"""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models import ModerationConfig, Question

DEFAULT_BLACKLIST = []  # vide par défaut ; à peupler via /admin/moderation-config
DEFAULT_RATE_LIMIT_PER_MIN = 5


@dataclass
class FilterResult:
    is_filtered: bool
    reason: str | None = None


def _get_config_value(db: Session, key: str, default):
    row = db.query(ModerationConfig).filter(ModerationConfig.config_key == key).first()
    if row is None:
        return default
    try:
        return json.loads(row.config_value)
    except (json.JSONDecodeError, TypeError):
        return default


def get_blacklist(db: Session) -> list[str]:
    return _get_config_value(db, "blacklist", DEFAULT_BLACKLIST)


def get_rate_limit_per_min(db: Session) -> int:
    return _get_config_value(db, "rate_limit_per_min", DEFAULT_RATE_LIMIT_PER_MIN)


def check_blacklist(content: str, blacklist: list[str]) -> FilterResult:
    """Recherche simple, insensible à la casse, de termes interdits."""
    lowered = content.lower()
    for term in blacklist:
        if term.lower() in lowered:
            return FilterResult(is_filtered=True, reason="blacklist")
    return FilterResult(is_filtered=False)


def check_rate_limit(db: Session, session_id: str, pseudonym: str, limit_per_min: int) -> FilterResult:
    """
    Compte les questions soumises par ce pseudonyme dans la dernière minute,
    sur cette session. Au-delà de la limite, la question est filtrée (spam).
    """
    one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
    recent_count = (
        db.query(Question)
        .filter(
            Question.session_id == session_id,
            Question.pseudonym == pseudonym,
            Question.submitted_at >= one_minute_ago,
        )
        .count()
    )
    if recent_count >= limit_per_min:
        return FilterResult(is_filtered=True, reason="rate_limit")
    return FilterResult(is_filtered=False)


def apply_moderation(db: Session, session_id: str, pseudonym: str, content: str) -> FilterResult:
    """
    Point d'entrée unique : applique les filtres dans l'ordre, s'arrête
    au premier qui déclenche (pas besoin de tout vérifier si déjà filtré).
    """
    blacklist = get_blacklist(db)
    blacklist_result = check_blacklist(content, blacklist)
    if blacklist_result.is_filtered:
        return blacklist_result

    rate_limit = get_rate_limit_per_min(db)
    return check_rate_limit(db, session_id, pseudonym, rate_limit)