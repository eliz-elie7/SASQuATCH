"""
Point d'entrée de l'application FastAPI.

Lancement : uvicorn app.main:app --reload
(le --reload relance le serveur automatiquement à chaque modif de code,
pratique en développement, à retirer en production)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, admin, sessions, questions, ws

app = FastAPI(
    title="SASQuATCH API",
    description="Outil sécurisé et modéré de participation en classe",
    version="0.1.0",
)

# CORS : autorise le frontend React (autre origine) à appeler cette API.
# En développement, on autorise localhost (PC) ET le sous-réseau local
# 192.168.x.x (téléphones/tablettes sur le même Wi-Fi que le PC qui héberge
# le backend). allow_origin_regex couvre n'importe quel port sur ce
# sous-réseau, pratique car l'IP du PC change selon le réseau utilisé.
# À resserrer en production avec l'URL réelle du frontend déployé.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"http://192\.168\.\d{1,3}\.\d{1,3}:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(sessions.router)
app.include_router(questions.router)
app.include_router(ws.router)


@app.get("/health")
def health_check():
    """Route de test simple, sans dépendance BDD, pour vérifier que le serveur tourne."""
    return {"status": "ok"}