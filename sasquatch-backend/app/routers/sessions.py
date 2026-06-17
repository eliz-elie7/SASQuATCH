"""
Routes liées au cycle de vie d'une session de cours :
ouverture par l'enseignant, accès par l'étudiant via code, clôture.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import User, RoleEnum, CourseSession, SessionParticipant
from app.schemas import (
    SessionCreate, SessionCreateResponse,
    SessionJoinRequest, SessionJoinResponse,
    SessionCloseResponse,
    BanRequest, BanResponse,
)
from app.crypto import generate_join_code, generate_session_secret, generate_pseudonym
from app.dependencies import require_role
from app.websocket_manager import manager

router = APIRouter(prefix="/sessions", tags=["sessions"])

MAX_JOIN_CODE_ATTEMPTS = 5  # en cas de collision improbable sur join_code


@router.post(
    "",
    response_model=SessionCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def open_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_role(RoleEnum.teacher)),
):
    """
    Ouverture d'une session de cours par l'enseignant (§2.2.1).
    Génère un join_code court et un secret cryptographique S, jamais
    transmis au client, utilisé ensuite pour calculer les pseudonymes.
    """
    new_session = None
    for _ in range(MAX_JOIN_CODE_ATTEMPTS):
        try:
            new_session = CourseSession(
                teacher_id=current_teacher.id,
                label=payload.label,
                join_code=generate_join_code(),
                secret_key=generate_session_secret(),
            )
            db.add(new_session)
            db.commit()
            break
        except IntegrityError:
            # Collision sur join_code (très improbable, 30^6 combinaisons)
            db.rollback()
            new_session = None

    if new_session is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Impossible de générer un code de session unique, réessayez",
        )

    db.refresh(new_session)
    return new_session


@router.post("/join", response_model=SessionJoinResponse)
def join_session(
    payload: SessionJoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.student)),
):
    """
    Un étudiant rejoint une session active via son code (§2.2.2).
    Calcule et persiste son pseudonyme de session s'il n'existe pas déjà
    (un étudiant peut rejoindre plusieurs fois, ex: reconnexion après
    coupure réseau -- on ne recalcule pas un nouveau pseudonyme à chaque fois).
    """
    course_session = (
        db.query(CourseSession)
        .filter(
            CourseSession.join_code == payload.join_code.upper(),
            CourseSession.is_active.is_(True),
        )
        .first()
    )
    if course_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Code de session invalide ou session clôturée",
        )

    participant = (
        db.query(SessionParticipant)
        .filter(
            SessionParticipant.session_id == course_session.id,
            SessionParticipant.user_id == current_user.id,
        )
        .first()
    )

    if participant is not None:
        if participant.is_banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous avez été banni de cette session",
            )
        # Déjà inscrit : on renvoie le même pseudonyme, on n'en recrée pas.
        return SessionJoinResponse(
            session_id=course_session.id,
            label=course_session.label,
            pseudonym=participant.pseudonym,
        )

    pseudonym = generate_pseudonym(course_session.secret_key, str(current_user.id))
    participant = SessionParticipant(
        session_id=course_session.id,
        user_id=current_user.id,
        pseudonym=pseudonym,
    )
    db.add(participant)
    try:
        db.commit()
    except IntegrityError:
        # Course très rare : deux requêtes simultanées du même étudiant.
        db.rollback()
        participant = (
            db.query(SessionParticipant)
            .filter(
                SessionParticipant.session_id == course_session.id,
                SessionParticipant.user_id == current_user.id,
            )
            .first()
        )

    return SessionJoinResponse(
        session_id=course_session.id,
        label=course_session.label,
        pseudonym=participant.pseudonym,
    )


@router.post("/{session_id}/close", response_model=SessionCloseResponse)
async def close_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_role(RoleEnum.teacher)),
):
    """
    Clôture explicite et irréversible d'une session par son enseignant
    créateur (§2.2.5). Détruit secret_key : les pseudonymes deviennent
    non-recalculables sans accès aux journaux administratifs.
    """
    course_session = db.query(CourseSession).filter(CourseSession.id == session_id).first()

    if course_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session introuvable")

    if course_session.teacher_id != current_teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'enseignant créateur peut clôturer cette session",
        )

    if not course_session.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session déjà clôturée")

    course_session.is_active = False
    course_session.ended_at = datetime.utcnow()
    course_session.closed_by = current_teacher.id
    # Destruction du secret : irréversible, conforme à la note de sécurité
    # du cahier des charges (§3.2). Sans ce secret, impossible de
    # recalculer le lien pseudonyme <-> user_id en dehors des journaux admin.
    course_session.secret_key = b""

    db.commit()
    db.refresh(course_session)

    # Notifie en push tous les participants connectés (dashboard
    # enseignant, et plus tard interface étudiant) que la session est
    # close -- l'interface de soumission doit alors se désactiver (§2.2.5).
    await manager.broadcast(str(course_session.id), {"type": "session_closed"})

    return course_session


def _get_active_session_or_404(db: Session, session_id: str) -> CourseSession:
    course_session = (
        db.query(CourseSession)
        .filter(CourseSession.id == session_id, CourseSession.is_active.is_(True))
        .first()
    )
    if course_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session introuvable ou clôturée")
    return course_session


def _get_participant_by_pseudonym_or_404(db: Session, session_id: str, pseudonym: str) -> SessionParticipant:
    participant = (
        db.query(SessionParticipant)
        .filter(SessionParticipant.session_id == session_id, SessionParticipant.pseudonym == pseudonym)
        .first()
    )
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pseudonyme introuvable dans cette session")
    return participant


@router.post("/{session_id}/ban", response_model=BanResponse)
async def ban_participant(
    session_id: str,
    payload: BanRequest,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_role(RoleEnum.teacher)),
):
    """
    Bannissement temporaire d'un pseudonyme par l'enseignant (§2.3.2).
    Volontairement identifié par pseudonyme, jamais par user_id :
    l'enseignant n'a et ne doit avoir aucun moyen de cibler un étudiant
    par son identité réelle.
    """
    course_session = _get_active_session_or_404(db, session_id)
    if course_session.teacher_id != current_teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'enseignant créateur peut modérer cette session",
        )

    participant = _get_participant_by_pseudonym_or_404(db, course_session.id, payload.pseudonym)
    participant.is_banned = True
    db.commit()

    await manager.broadcast(
        str(course_session.id),
        {"type": "participant_banned", "pseudonym": participant.pseudonym},
    )

    return BanResponse(pseudonym=participant.pseudonym, is_banned=True)


@router.post("/{session_id}/unban", response_model=BanResponse)
async def unban_participant(
    session_id: str,
    payload: BanRequest,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_role(RoleEnum.teacher)),
):
    """Lève un bannissement avant la fin de la session (§2.3.2, réversible)."""
    course_session = _get_active_session_or_404(db, session_id)
    if course_session.teacher_id != current_teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'enseignant créateur peut modérer cette session",
        )

    participant = _get_participant_by_pseudonym_or_404(db, course_session.id, payload.pseudonym)
    participant.is_banned = False
    db.commit()

    await manager.broadcast(
        str(course_session.id),
        {"type": "participant_unbanned", "pseudonym": participant.pseudonym},
    )

    return BanResponse(pseudonym=participant.pseudonym, is_banned=False)