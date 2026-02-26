# Base de données EcoAgadir (MySQL)

Tout est dans **web_app** : un seul backend (Flask) qui expose l’API d’optimisation VillePropre et l’API EcoAgadir (auth, users, camions, planning, etc.).

## Création de la base

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS ecoagadir;"
mysql -u root -p ecoagadir < database/schema.sql
mysql -u root -p ecoagadir < database/seed.sql
```

Les utilisateurs démo sont créés automatiquement au premier login (backend). Pour des données complètes (camions, points, dépôt, etc.), exécuter `seed.sql` après le schéma.

## Configuration

Dans `backend/config_eco.py` (ou variables d’environnement) : `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE=ecoagadir`.

## Lancement

- **Backend** (port 5000) : `cd web_app/backend && pip install -r requirements.txt && python app.py`
- **Frontend React** : `cd web_app/frontend_react && npm run dev` → http://localhost:5173

Connexion : **admin@ecoagadir.ma** / **Admin2024!**
