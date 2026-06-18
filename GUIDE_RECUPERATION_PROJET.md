# Récupérer et lancer SASQuATCH en local

Ce guide explique comment cloner le projet et le faire tourner sur votre
machine, étape par étape. À suivre dans l'ordre.

## Prérequis à installer avant de commencer

- **Python 3.11+** avec `pip`
- **PostgreSQL** (serveur local, en cours d'exécution)
- **Node.js 18+** avec `npm` (vérifier avec `node --version`)
- **Git**

Toutes les dépendances Python sont listées dans `requirements.txt` --
inutile de les installer une par une.

## 1. Cloner le dépôt

```bash
git clone <URL_DU_REPO_GITHUB>
cd SASQuATCH
```

Le dépôt contient deux dossiers principaux : `sasquatch-backend/` et
`sasquatch-frontend/`.

## 2. Mettre en place la base de données PostgreSQL

Créez une base et un utilisateur dédiés (adaptez les noms si besoin) :

```bash
sudo -u postgres psql
```

Dans le prompt `psql` :
```sql
CREATE USER sasquatch_dev_user WITH PASSWORD 'votre_mot_de_passe';
CREATE DATABASE sasquatch_db OWNER sasquatch_dev_user;
\q
```

Appliquez le schéma SQL :

```bash
cd sasquatch-backend
psql -U sasquatch_dev_user -d sasquatch_db -f schema_actuel.sql
psql -U sasquatch_dev_user -d sasquatch_db -f migrations/001_add_email_hash.sql
```

(Demandez à Eliezer le fichier `schema_actuel.sql` à jour s'il n'est pas
dans le dépôt -- il contient la structure des 6 tables.)

## 3. Configurer et lancer le backend

```bash
cd sasquatch-backend
pip install -r requirements.txt --break-system-packages
```

Copiez `.env.example` en `.env` :

```bash
cp .env.example .env
```

Éditez `.env` et remplissez VOS PROPRES valeurs (ne réutilisez jamais
les clés de quelqu'un d'autre) :

- `DATABASE_URL` : avec les identifiants créés à l'étape 2
- `ENCRYPTION_KEY` et `HMAC_SEARCH_KEY` : générez-les avec
  ```bash
  python3 -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
  ```
  (lancez la commande deux fois, une valeur différente pour chaque clé)
- `JWT_SECRET` : n'importe quelle longue chaîne aléatoire
- `SMTP_*` : à demander à Eliezer si vous voulez tester l'envoi réel
  d'e-mail, sinon laissez vide (la création de compte fonctionnera
  quand même, juste sans envoi d'e-mail -- l'erreur sera silencieuse,
  voir note plus bas)

Créez le premier compte admin :

```bash
python3 -m scripts.create_first_admin
```

Lancez le serveur :

```bash
uvicorn app.main:app --reload
```

Vérifiez sur `http://localhost:8000/docs` que la documentation s'affiche.

## 4. Configurer et lancer le frontend

Dans un AUTRE terminal (le backend doit continuer à tourner) :

```bash
cd sasquatch-frontend
npm install
npm run dev
```

Ouvrez `http://localhost:5173`.

## Vérification que tout fonctionne

1. Connectez-vous avec le compte admin créé à l'étape 3
2. Créez un compte étudiant et un compte enseignant via l'interface admin
3. Si SMTP n'est pas configuré, récupérez le token d'activation directement en base :
   ```bash
   psql -U sasquatch_dev_user -d sasquatch_db -c "SELECT id, role, activation_token FROM users WHERE is_active = false;"
   ```
4. Activez les comptes via `http://localhost:5173/activate?token=LE_TOKEN`
5. Testez le parcours complet : ouverture de session (enseignant),
   jonction (étudiant), soumission de question, apparition en temps réel

## En cas de problème

- **`ModuleNotFoundError`** : vérifiez que vous êtes dans le bon dossier
  (`sasquatch-backend`) et que toutes les dépendances pip sont installées.
- **Erreur de connexion PostgreSQL** : vérifiez que le service tourne
  (`sudo systemctl status postgresql`) et que `DATABASE_URL` dans `.env`
  correspond exactement à vos identifiants créés à l'étape 2.
- **CORS / erreur réseau côté frontend** : vérifiez que le backend tourne
  bien sur le port 8000 et que vous accédez au frontend via
  `http://localhost:5173` (pas une autre adresse).
- **WebSocket qui ne se connecte pas** : vérifiez dans le terminal
  backend qu'il n'y a pas de warning "No supported WebSocket library" --
  si oui, lancez `pip install websockets --break-system-packages`.

Pour toute question, contactez Eliezer plutôt que de rester bloqué
longtemps -- certains détails de configuration (clés, structure exacte
de la BDD) peuvent avoir évolué depuis l'écriture de ce guide.
