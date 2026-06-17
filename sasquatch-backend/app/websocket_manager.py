"""
Gestion des connexions WebSocket actives.

Concept : on garde en mémoire (process Python) un dictionnaire
{ session_id: [liste de connexions WebSocket ouvertes] }.
Quand une question est créée, on "broadcast" (diffuse) le message à
toutes les connexions enregistrées pour cette session.

LIMITE IMPORTANTE À CONNAÎTRE : ce stockage est en mémoire locale au
process uvicorn. Si vous lancez plusieurs workers (uvicorn --workers 4)
ou plusieurs instances du serveur, chaque process aura SA PROPRE liste de
connexions, et les messages ne seront pas partagés entre eux. Pour ce
projet (un seul process, charge d'une salle de classe), c'est largement
suffisant. Pour scalabilité réelle, on utiliserait Redis pub/sub.
"""

from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self._connections.setdefault(session_id, []).append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        connections = self._connections.get(session_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections and session_id in self._connections:
            del self._connections[session_id]

    async def broadcast(self, session_id: str, message: dict):
        """
        Envoie `message` (sérialisé en JSON) à toutes les connexions
        ouvertes pour cette session. Retire silencieusement les
        connexions mortes rencontrées au passage (ex: navigateur fermé
        sans déconnexion propre).
        """
        connections = self._connections.get(session_id, [])
        dead_connections = []
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(session_id, dead)


# Instance unique partagée par toute l'application (singleton).
manager = ConnectionManager()