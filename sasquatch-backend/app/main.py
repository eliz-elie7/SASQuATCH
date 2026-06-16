# point d'entrée FastAPI
from fastapi import FastAPI
from database import engine, Base

app = FastAPI(title="SASQuATCH API")

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "SASQuATCH API is running successfully!"}

@app.get("/health")
def health():
    return {"status": "ok"}

"""Pourquoi ce fichier ?

app = FastAPI(...) crée ton application
Base.metadata.create_all(...) vérifie que toutes les tables existent dans PostgreSQL au démarrage
Les deux routes / et /health servent juste à vérifier que le serveur tourne — c'est ce qu'on appelle un "health check"
"""