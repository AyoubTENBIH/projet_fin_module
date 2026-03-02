# Guide d’installation — Projet VillePropre / EcoAgadir

Ce document décrit comment installer et lancer le projet sur une machine (Windows, avec PowerShell). Il suffit de suivre les étapes dans l’ordre.

---

## 1. Prérequis

À installer sur la machine avant de commencer :

| Logiciel        | Version minimale | Vérification                    |
|-----------------|------------------|----------------------------------|
| **Python**      | 3.10             | `python --version` ou `py -3 --version` |
| **Node.js**     | 18.x recommandé  | `node --version` et `npm --version`     |
| **MySQL**       | 5.7 ou 8.x       | Serveur MySQL en cours d’exécution      |

- **MySQL** : vous pouvez utiliser **XAMPP** (Apache + MySQL), **WAMP**, ou une installation MySQL seule. L’important est que le service MySQL soit démarré et qu’un utilisateur (par ex. `root`) puisse se connecter.

---

## 2. Récupération du projet

- Soit cloner le dépôt Git, soit décompresser l’archive du projet.
- Ouvrir un terminal (PowerShell) et se placer à la **racine du projet** (dossier qui contient `web_app`, `niveau1`, `README.md`, etc.) :

```powershell
cd Chemin\Vers\Projet_fin_de_module
```

---

## 3. Base de données MySQL

### 3.1 Démarrer MySQL

- Si vous utilisez **XAMPP** : ouvrir le panneau de contrôle XAMPP et cliquer sur **Start** pour **MySQL**.
- Sinon : démarrer le service MySQL de votre installation.

### 3.2 Créer la base de données

Se connecter à MySQL (ligne de commande, phpMyAdmin ou tout client MySQL) et exécuter :

```sql
CREATE DATABASE IF NOT EXISTS ecoagadir CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3.3 Initialiser les tables et les données

Depuis la racine du projet :

```powershell
cd web_app\backend
python init_db.py
```

- Par défaut, le script utilise l’utilisateur **root** **sans mot de passe** (configuration courante avec XAMPP).
- Si votre MySQL a un mot de passe pour `root`, exécuter avant la commande ci‑dessus (PowerShell) :

```powershell
$env:MYSQL_USER = "root"
$env:MYSQL_PASSWORD = ""
python init_db.py
```

- Vous devez voir des messages du type : `OK: schema.sql`, `OK: seed.sql`, puis **Base initialisée.**

En cas d’erreur de connexion, vérifier que MySQL est bien démarré et que l’utilisateur/mot de passe sont corrects (voir aussi la section **Dépannage**).

---

## 4. Backend (API Flask)

### 4.1 Environnement virtuel Python

Toujours dans `web_app\backend` :

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Le préfixe `(venv)` doit apparaître dans le terminal.

### 4.2 Dépendances Python

```powershell
pip install -r requirements.txt
```

### 4.3 Lancer le serveur backend

```powershell
python app.py
```

Le serveur démarre sur **http://127.0.0.1:5000**. Vous devez voir dans la console un message du type : `[EcoAgadir] Chargé (MySQL OK)`.

**Important :** laisser ce terminal ouvert pendant toute la durée de l’utilisation du site.

---

## 5. Frontend (React + Vite)

Ouvrir un **second terminal**, rester à la racine du projet puis :

```powershell
cd web_app\frontend_react
npm install
npm run dev
```

Le frontend sera accessible sur **http://localhost:5173**.

**Important :** laisser ce second terminal ouvert.

---

## 6. Accéder au site

1. Ouvrir un navigateur et aller sur : **http://localhost:5173**
2. La page de connexion s’affiche.
3. Les **comptes de démo** sont créés automatiquement au premier login. Vous pouvez utiliser :

| Rôle      | Email                  | Mot de passe  |
|-----------|------------------------|---------------|
| Admin     | `admin@ecoagadir.ma`   | `Admin2024!`  |
| Chauffeur | `y.benali@ecoagadir.ma`| `Chauffeur1!` |
| Chauffeur | `k.mansouri@ecoagadir.ma` | `Chauffeur2!` |

- **Admin** : accès au tableau de bord, à la carte, aux statistiques, à la gestion des chauffeurs, etc.
- **Chauffeur** : interface chauffeur (tournées, suivi).

---

## 7. Résumé des commandes (ordre d’exécution)

À faire **une seule fois** (après avoir créé la base `ecoagadir`) :

```powershell
# Terminal 1 — Backend
cd web_app\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Créer la base ecoagadir dans MySQL puis :
python init_db.py
python app.py
```

```powershell
# Terminal 2 — Frontend
cd web_app\frontend_react
npm install
npm run dev
```

Puis ouvrir **http://localhost:5173** dans le navigateur.

---

## 8. Variables d’environnement (optionnel)

Si votre MySQL n’utilise pas `root` sans mot de passe, vous pouvez définir :

| Variable        | Description          | Valeur par défaut |
|-----------------|----------------------|--------------------|
| `MYSQL_HOST`    | Hôte MySQL           | `localhost`        |
| `MYSQL_PORT`    | Port MySQL           | `3306`             |
| `MYSQL_USER`    | Utilisateur MySQL    | `root`             |
| `MYSQL_PASSWORD`| Mot de passe         | (vide si root sans mdp) |
| `MYSQL_DATABASE`| Nom de la base       | `ecoagadir`        |

Exemple (PowerShell, avant `python init_db.py` ou `python app.py`) :

```powershell
$env:MYSQL_USER = "root"
$env:MYSQL_PASSWORD = ""
```

---

## 9. Dépannage

### Le backend affiche « MySQL/API non chargé »

- Vérifier que MySQL est démarré.
- Vérifier que la base **ecoagadir** existe et que `init_db.py` a bien été exécuté sans erreur.
- Si vous avez un mot de passe MySQL : définir `MYSQL_USER` et `MYSQL_PASSWORD` comme ci‑dessus.

### Erreur de connexion à la base lors de `init_db.py`

- Vérifier identifiant et mot de passe MySQL.
- Vérifier que le port 3306 est bien celui utilisé par MySQL (`MYSQL_PORT` si différent).

### Le frontend ne charge pas les données / erreurs 503 ou CORS

- Vérifier que le **backend** tourne bien sur le port 5000 (`python app.py` dans `web_app\backend`).
- Accéder au site via **http://localhost:5173** (le proxy Vite redirige `/api` vers le backend).

### Port 5000 ou 5173 déjà utilisé

- Fermer l’autre application qui utilise le port, ou modifier le port dans `app.py` (backend) et dans `vite.config.js` (frontend) si vous connaissez la configuration.

---

## 10. Structure utile du projet

```
Projet_fin_de_module/
├── SETUP.md                 ← ce fichier
├── README.md
├── web_app/
│   ├── backend/             ← API Flask (Python)
│   │   ├── app.py           ← point d’entrée du serveur
│   │   ├── init_db.py       ← script d’init. base de données
│   │   ├── config_eco.py    ← configuration MySQL
│   │   └── requirements.txt
│   ├── database/
│   │   ├── schema.sql       ← structure des tables
│   │   └── seed.sql        ← données de démo
│   └── frontend_react/      ← interface React (Vite)
│       ├── package.json
│       └── ...
├── niveau1/                 ← modules d’optimisation
├── niveau2/
└── niveau3/
```

---

Pour toute question sur le projet ou les livrables, se référer au **README.md** et au cahier des charges du module.
