# SASQuATCH

**S**ystème **A**nonymisé et **S**écurisé de **Qu**estions en **A**mphi via **T**echnologie **C**ollaborative et **H**onnête

Outil de participation en classe en temps réel, anonymisé, modéré et intelligent. Les étudiants posent des questions en direct pendant un cours ; l'enseignant les voit s'agréger sur un tableau de bord en temps réel, sans jamais connaître l'identité réelle de l'auteur.

Projet réalisé dans le cadre du Projet d'Application 3A STI — INSA Centre Val de Loire, encadré par Adrien Boiret.

## Les trois piliers

| Pilier | Ce que ça signifie concrètement |
|---|---|
| **Anonymisé** | L'identité réelle n'est jamais stockée en clair (chiffrement AES-256-GCM). Chaque étudiant a un pseudonyme stable pendant la session, généré par HMAC-SHA256, jamais réutilisé d'une session à l'autre. |
| **Modérable** | Filtrage automatique (liste noire, rate limiting), bannissement temporaire par l'enseignant sans connaître l'identité, désanonymisation administrative possible en cas d'abus, systématiquement journalisée. |
| **Intelligent** | Fil de questions d'un même auteur regroupé par pseudonyme. Signalement de satisfaction sur les réponses apportées. |

## Stack technique

- **Backend** : Python, FastAPI, WebSockets, SQLAlchemy
- **Base de données** : PostgreSQL
- **Frontend** : React (Vite), Tailwind CSS
- **Cryptographie** : AES-256-GCM (identités), HMAC-SHA256 (pseudonymes et recherche déterministe), bcrypt (mots de passe)

## Démarrage rapide

Pour cloner et lancer le projet en local, suivre le guide détaillé :
[`sasquatch-backend/GUIDE_RECUPERATION_PROJET.md`](./sasquatch-backend/GUIDE_RECUPERATION_PROJET.md)

En résumé :
```bash
# Backend
cd sasquatch-backend
pip install -r requirements.txt   # ou la liste de paquets du guide
cp .env.example .env              # puis remplir avec vos propres secrets
python3 -m scripts.create_first_admin
uvicorn app.main:app --reload

# Frontend (autre terminal)
cd sasquatch-frontend
npm install
npm run dev
```

Backend sur `http://localhost:8000` (documentation interactive sur `/docs`), frontend sur `http://localhost:5173`.

## Structure du projet

```
SASQuATCH/
├── sasquatch-backend/
│   ├── app/
│   │   ├── main.py              # point d'entrée FastAPI
│   │   ├── database.py          # connexion PostgreSQL
│   │   ├── models.py            # modèles SQLAlchemy (6 tables)
│   │   ├── schemas.py           # schémas Pydantic (validation API)
│   │   ├── crypto.py            # AES-256-GCM, HMAC, bcrypt
│   │   ├── moderation.py        # filtrage automatique
│   │   ├── email_service.py     # envoi d'e-mails d'activation
│   │   ├── websocket_manager.py # gestion des connexions temps réel
│   │   ├── dependencies.py      # authentification et autorisation par rôle
│   │   └── routers/             # routes API par domaine
│   ├── migrations/               # scripts SQL d'évolution du schéma
│   ├── scripts/                  # utilitaires (création du premier admin)
│   ├── schema_actuel.sql         # export du schéma PostgreSQL
│   ├── CONTRAT_API_FRONTEND.md   # référence complète des routes pour le frontend
│   └── GUIDE_RECUPERATION_PROJET.md
└── sasquatch-frontend/
    └── src/
        ├── api/                  # appels HTTP vers le backend
        ├── context/              # état d'authentification global
        ├── hooks/                # hook WebSocket réutilisable
        ├── components/           # composants partagés (routes protégées)
        └── pages/                # une page par rôle (admin, enseignant, étudiant)
```

## Documentation complémentaire

- [`CONTRAT_API_FRONTEND.md`](./CONTRAT_API_FRONTEND.md) — détail de toutes les routes API et du protocole WebSocket
- `http://localhost:8000/docs` — documentation interactive générée automatiquement (Swagger), une fois le backend lancé

## Équipe

Projet réalisé par Imen Mezrigui, Abdoulaye Diallo, Chahd Ben Aïssa et Eliezer Djihinto.

## Limites connues

- Le gestionnaire de connexions WebSocket fonctionne en mémoire locale au process : ne supporte qu'un seul worker/processus serveur (suffisant pour l'usage visé, une salle de classe).
- L'accès depuis un appareil mobile nécessite que celui-ci soit sur le même réseau local que le serveur backend (pas de déploiement public à ce stade).
- Le regroupement thématique des questions par IA (plongement lexical) n'est pas implémenté — explicitement classé en dernière priorité par le cahier des charges.