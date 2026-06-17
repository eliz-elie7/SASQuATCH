"""
Endpoint WebSocket : le dashboard enseignant s'y connecte pour recevoir
les questions en temps réel, sans rechargement de page (§2.2.4).
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError
from sqlalchemy.orm import Session as DBSession

from app.database import SessionLocal
from app.models import User, RoleEnum, CourseSession
from app.websocket_manager import manager
from app.routers.auth import JWT_SECRET, JWT_ALGORITHM

router = APIRouter(tags=["websocket"])


def _authenticate_ws_token(token: str, db: DBSession) -> User | None:
    """
    Authentification pour WebSocket : pas de header HTTP classique
    possible avec l'API JS native WebSocket, donc le token est passé en
    paramètre de requête (?token=...) au moment de la connexion.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        return None
    if user_id is None:
        return None
    return db.query(User).filter(User.id == user_id).first()


@router.websocket("/ws/sessions/{session_id}")
async def session_dashboard_ws(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
):
    """
    Connexion WebSocket du dashboard enseignant pour une session donnée.
    Usage côté client : ws://host/ws/sessions/{session_id}?token={jwt}
    """
    db = SessionLocal()
    try:
        user = _authenticate_ws_token(token, db)
        if user is None or user.role != RoleEnum.teacher:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        course_session = db.query(CourseSession).filter(CourseSession.id == session_id).first()
        if course_session is None or course_session.teacher_id != user.id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    finally:
        db.close()

    await manager.connect(session_id, websocket)
    try:
        while True:
            # On ne traite aucun message entrant pour l'instant -- ce
            # WebSocket sert uniquement à pousser des données du serveur
            # vers le client (questions, bannissements...). On garde
            # juste la connexion vivante en attendant une déconnexion.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)