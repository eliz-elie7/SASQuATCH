"""
Script à exécuter UNE SEULE FOIS pour créer le premier compte admin,
avant que l'API ne tourne (ou indépendamment). Contourne le problème
de l'œuf et la poule : /admin/users exige déjà un admin pour créer un compte.

Usage :
    python3 -m scripts.create_first_admin
"""

import sys
import os
from datetime import datetime
from getpass import getpass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, RoleEnum
from app.crypto import encrypt_field, searchable_hash, hash_password


def main():
    db = SessionLocal()
    try:
        email = input("Email du premier admin : ").strip()
        nom = input("Nom : ").strip()
        prenom = input("Prénom : ").strip()
        institutional_id = input("Identifiant institutionnel : ").strip()
        password = getpass("Mot de passe (ne s'affiche pas) : ")

        email_hash = searchable_hash(email)
        if db.query(User).filter(User.email_hash == email_hash).first():
            print("Erreur : un compte existe déjà avec cet e-mail.")
            return

        admin = User(
            institutional_id_enc=encrypt_field(institutional_id),
            nom_enc=encrypt_field(nom),
            prenom_enc=encrypt_field(prenom),
            email_enc=encrypt_field(email),
            email_hash=email_hash,
            role=RoleEnum.admin,
            password_hash=hash_password(password),
            is_active=True,  # créé directement actif, pas besoin d'activation par e-mail
            created_by=None,  # le premier admin n'est créé par personne
        )
        db.add(admin)
        db.commit()
        print(f"Admin créé avec succès (id={admin.id}). Tu peux maintenant te connecter via /auth/login.")
    finally:
        db.close()


if __name__ == "__main__":
    main()