# Guide de configuration — À exécuter sur ton PC

Suis ces étapes **dans l’ordre** dans un terminal (PowerShell) ouvert dans le dossier du projet.

---

## Étape 1 : Ouvrir le bon dossier

```powershell
cd "d:\documents\education\EST\module complexite\Projet_fin_de_module"
```

(Vérifier que tu vois les dossiers `niveau1`, `niveau2`, … et le fichier `requirements.txt`.)

---

## Étape 2 : Créer l’environnement virtuel

```powershell
python -m venv venv
```

Si `python` n’est pas reconnu, essaye : `py -3 -m venv venv`.

---

## Étape 3 : Activer l’environnement (Windows)

**PowerShell :**
```powershell
.\venv\Scripts\Activate.ps1
```

Si une erreur de politique d’exécution apparaît, exécute une fois (en admin si besoin) :
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Invite de commandes (CMD) :**
```cmd
venv\Scripts\activate.bat
```

Tu dois voir `(venv)` au début de la ligne dans le terminal.

---

## Étape 4 : Installer les dépendances

```powershell
pip install -r requirements.txt
```

---

## Étape 5 : Vérifier

```powershell
python -c "import numpy, matplotlib, networkx, pandas; print('Environnement OK')"
```

Tu dois voir : `Environnement OK`.

---

## Résumé

| Action              | Commande |
|---------------------|----------|
| Aller dans le projet| `cd "d:\documents\education\EST\module complexite\Projet_fin_de_module"` |
| Créer le venv       | `python -m venv venv` |
| Activer (PowerShell)| `.\venv\Scripts\Activate.ps1` |
| Installer les libs  | `pip install -r requirements.txt` |

À chaque nouvelle séance de travail, ouvre le terminal dans le dossier du projet, puis réactive le venv avec `.\venv\Scripts\Activate.ps1` avant de lancer tes scripts.
