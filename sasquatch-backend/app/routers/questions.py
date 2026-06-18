"""
Routes liées aux questions posées par les étudiants pendant une session.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RoleEnum, CourseSession, SessionParticipant, Question
from app.schemas import QuestionCreate, QuestionResponse, QuestionListResponse, SatisfactionUpdate
from app.dependencies import require_role
from app.moderation import apply_moderation
from app.websocket_manager import manager

router = APIRouter(prefix="/questions", tags=["questions"])


def _get_owned_session_or_error(db: Session, session_id: str, teacher: User) -> CourseSession:
    """
    Vérifie que la session existe et appartient bien à cet enseignant.
    Factorisé car réutilisé par plusieurs routes de lecture (liste
    complète, fil par pseudonyme).
    """
    course_session = db.query(CourseSession).filter(CourseSession.id == session_id).first()
    if course_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session introuvable")
    if course_session.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul l'enseignant créateur peut consulter les questions de cette session",
        )
    return course_session


@router.post("", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def submit_question(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.student)),
):
    """
    Soumission d'une question (ou d'une clarification si parent_id est
    fourni) par un étudiant inscrit à une session active (§2.2.3, §2.3.1).
    """
    course_session = (
        db.query(CourseSession)
        .filter(CourseSession.id == payload.session_id, CourseSession.is_active.is_(True))
        .first()
    )
    if course_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session introuvable ou clôturée",
        )

    participant = (
        db.query(SessionParticipant)
        .filter(
            SessionParticipant.session_id == course_session.id,
            SessionParticipant.user_id == current_user.id,
        )
        .first()
    )
    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous devez rejoindre cette session avant de poser une question",
        )
    if participant.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous avez été banni de cette session",
        )

    # Si c'est une clarification, vérifier que la question parente existe
    # bien et appartient au même pseudonyme (un étudiant ne peut clarifier
    # que ses propres questions, §2.2.3).
    if payload.parent_id is not None:
        parent = db.query(Question).filter(Question.id == payload.parent_id).first()
        if parent is None or parent.session_id != course_session.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question parente introuvable")
        if parent.pseudonym != participant.pseudonym:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous ne pouvez rattacher un message qu'à vos propres questions",
            )

    filter_result = apply_moderation(
        db, str(course_session.id), participant.pseudonym, payload.content
    )

    new_question = Question(
        session_id=course_session.id,
        pseudonym=participant.pseudonym,
        parent_id=payload.parent_id,
        content=payload.content,
        is_filtered=filter_result.is_filtered,
        filter_reason=filter_result.reason,
    )
    db.add(new_question)
    db.commit()
    db.refresh(new_question)

    if not new_question.is_filtered:
        # Push temps réel vers le dashboard enseignant connecté à cette
        # session (§2.2.4). Si aucun enseignant n'est connecté en ce
        # moment, broadcast() ne fait rien -- la question reste en BDD
        # et sera visible via une future route GET de récupération.
        await manager.broadcast(
            str(course_session.id),
            {
                "type": "new_question",
                "question": {
                    "id": str(new_question.id),
                    "pseudonym": new_question.pseudonym,
                    "parent_id": str(new_question.parent_id) if new_question.parent_id else None,
                    "content": new_question.content,
                    "submitted_at": new_question.submitted_at.isoformat(),
                },
            },
        )

    return new_question


@router.patch("/{question_id}/satisfaction", response_model=QuestionResponse)
def set_satisfaction(
    question_id: str,
    payload: SatisfactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.student)),
):
    """
    Signalement de satisfaction par l'étudiant sur sa propre question
    (§2.2.3). Seul l'auteur (même pseudonyme dans la même session) peut
    modifier ce champ -- vérifié via session_participants, jamais par
    user_id directement sur la question (qui ne contient que le pseudonyme).
    """
    if payload.satisfaction not in ("satisfied", "unsatisfied"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="satisfaction doit être 'satisfied' ou 'unsatisfied'",
        )

    question = db.query(Question).filter(Question.id == question_id).first()
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question introuvable")

    participant = (
        db.query(SessionParticipant)
        .filter(
            SessionParticipant.session_id == question.session_id,
            SessionParticipant.user_id == current_user.id,
        )
        .first()
    )
    if participant is None or participant.pseudonym != question.pseudonym:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez signaler la satisfaction que sur vos propres questions",
        )

    question.satisfaction = payload.satisfaction
    db.commit()
    db.refresh(question)

    return question


@router.get("/sessions/{session_id}", response_model=QuestionListResponse)
def list_session_questions(
    session_id: str,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_role(RoleEnum.teacher)),
    include_filtered: bool = Query(
        default=False,
        description="Inclure les questions filtrées par la modération automatique",
    ),
):
    """
    Liste les questions d'une session, pour affichage initial du dashboard
    enseignant (avant que de nouvelles questions n'arrivent par WebSocket).
    Par défaut, exclut les questions filtrées -- cohérent avec le
    comportement du push WebSocket, qui ne les diffuse jamais non plus.
    """
    course_session = _get_owned_session_or_error(db, session_id, current_teacher)

    query = db.query(Question).filter(Question.session_id == course_session.id)
    if not include_filtered:
        query = query.filter(Question.is_filtered.is_(False))

    results = query.order_by(Question.submitted_at.asc()).all()

    return QuestionListResponse(questions=results, total=len(results))


@router.get("/sessions/{session_id}/pseudonym/{pseudonym}", response_model=QuestionListResponse)
def list_questions_by_pseudonym(
    session_id: str,
    pseudonym: str,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_role(RoleEnum.teacher)),
):
    """
    Fil de toutes les questions (et leurs clarifications) d'un même
    pseudonyme au cours de la session (§2.4.1). Accessible en cliquant
    sur un pseudonyme dans le visualiseur enseignant.

    Toujours triées chronologiquement, parent et clarifications mélangés
    dans l'ordre d'arrivée -- c'est au frontend de les ré-indenter
    visuellement via parent_id si besoin d'un affichage en arborescence.
    """
    course_session = _get_owned_session_or_error(db, session_id, current_teacher)

    results = (
        db.query(Question)
        .filter(Question.session_id == course_session.id, Question.pseudonym == pseudonym)
        .order_by(Question.submitted_at.asc())
        .all()
    )

    return QuestionListResponse(questions=results, total=len(results))