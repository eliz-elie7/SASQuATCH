# connexion PostgreSQL

"""
Connexion à la base de données PostgreSQL.

Concept FastAPI/SQLAlchemy : on crée un "engine" (le moteur de connexion),
une SessionLocal (une fabrique de sessions de travail avec la BDD),
et une fonction get_db() qui sera injectée dans chaque route qui a besoin
de parler à la BDD (système d'injection de dépendances de FastAPI).
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Format attendu dans le .env :
# DATABASE_URL=postgresql://utilisateur:motdepasse@localhost:5432/sasquatch
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost/sasquatch")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base dont hériteront tous nos modèles (tables) dans models.py
Base = declarative_base()


def get_db():
    """
    Fonction de dépendance FastAPI.
    Ouvre une session BDD au début d'une requête, la ferme à la fin
    (même en cas d'erreur), grâce au yield + try/finally.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
