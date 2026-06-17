"""
Routes liées aux questions posées par les étudiants pendant une session.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RoleEnum, CourseSession, SessionParticipant, Question
from app.schemas import QuestionCreate, QuestionResponse
from app.dependencies import require_role
from app.moderation import apply_moderation
from app.websocket_manager import manager

router = APIRouter(prefix="/questions", tags=["questions"])


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