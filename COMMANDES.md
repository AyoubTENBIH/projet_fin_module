# Commandes à exécuter

## Niveau 1 (terminal)

Depuis la racine du projet :

```powershell
python niveau1\src\main_niveau1.py
```

## Niveau 2 (terminal)

Depuis la racine du projet :

```powershell
python niveau2\src\main_niveau2.py
```

## Web App (serveur)

Depuis la racine du projet :

```powershell
# Activer l'environnement virtuel
venv\Scripts\Activate.ps1

# Installer les dépendances (si pas déjà fait)
pip install -r requirements.txt

# Aller dans le dossier backend
cd web_app\backend

# Installer les dépendances Flask (si pas déjà fait)
pip install -r requirements.txt

# Lancer le serveur
python app.py
```

Puis ouvrir **http://localhost:5000** dans le navigateur.

> **Note :** Si tu es déjà dans `web_app\backend`, tu peux directement faire :
> ```powershell
> python app.py
> ```
> (après avoir activé le venv et installé les dépendances)
