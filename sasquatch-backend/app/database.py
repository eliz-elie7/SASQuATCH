from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

"""Pourquoi ce fichier ?

load_dotenv() lit ton fichier .env et récupère l'URL de connexion
create_engine() crée la connexion à PostgreSQL
SessionLocal c'est la "fabrique" de sessions — chaque requête HTTP ouvrira une session BDD et la fermera après
get_db() sera utilisé dans toutes tes routes FastAPI pour avoir accès à la BDD
"""