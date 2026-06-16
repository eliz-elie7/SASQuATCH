# point d'entrée FastAPI
from fastapi import FastAPI
from database import engine, Base

app = FastAPI(title="SASQuATCH API")

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "SASQuATCH API is running 🚀"}

@app.get("/health")
def health():
    return {"status": "ok"}


