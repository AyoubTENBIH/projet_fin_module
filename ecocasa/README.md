# EcoCasa — dossier d’origine (référence)

**Tout a été intégré dans `web_app`.** Ce dossier n’est plus nécessaire au fonctionnement.

- **Backend** : `web_app/backend` (Flask + API optimisation + API EcoCasa + MySQL)
- **Frontend** : `web_app/frontend_react` (React, login, admin, chauffeur)
- **Base de données** : `web_app/database/schema.sql` et `seed.sql`

Vous pouvez supprimer le dossier `ecocasa` ou le garder comme référence. L’optimisation (niveau1, niveau2, niveau3, routes) est **réutilisée** dans `web_app/backend`, pas dupliquée.

## Prérequis

- Python 3.8+
- MySQL (base `ecocasa`)

## Installation

1. Créer la base et les tables :
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS ecocasa;"
   mysql -u root -p ecocasa < database/schema.sql
   mysql -u root -p ecocasa < database/seed.sql
   ```

2. Configurer les identifiants MySQL (optionnel) :
   - Variables d’environnement : `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
   - Ou modifier `backend/config.py`

3. Installer les dépendances et lancer l’API :
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```
   L’API tourne sur **http://localhost:5001**. Les comptes démo sont créés au premier login.

## Comptes démo

- **Admin** : `admin@ecocasa.ma` / `Admin2024!`
- **Chauffeur** : `y.benali@ecocasa.ma` / `Chauffeur1!`
- **Chauffeur** : `k.mansouri@ecocasa.ma` / `Chauffeur2!`

## Frontend React

Depuis la racine du projet :

```bash
cd web_app/frontend_react
npm install
npm run dev
```

Ouvrir **http://localhost:5173** et se connecter. En dev, le frontend appelle l’API EcoCasa sur le port **5001**.

Pour la **Carte & Planification** (optimisation des routes), le frontend appelle aussi le backend VillePropre sur **http://localhost:5000** (lancer `web_app/backend/app.py` si besoin).
