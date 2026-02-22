# Projet VillePropre — Optimisation des tournées de collecte

Projet de fin de module (Génie Informatique, 2025-2026) : système d’optimisation progressif en 5 niveaux pour la collecte des déchets.

---

## 1. Configuration de l’environnement (à faire en premier)

### 1.1 Prérequis

- **Python 3.10 ou plus** (vérifier : `python --version` ou `py -3 --version`).

### 1.2 Créer et activer l’environnement virtuel

Dans le dossier du projet (`Projet_fin_de_module`), ouvrir un terminal (PowerShell ou CMD) et exécuter :

```powershell
# Créer l’environnement virtuel
python -m venv venv

# Activer (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# OU si tu es en CMD :
# venv\Scripts\activate.bat
```

Quand l’environnement est activé, le préfixe `(venv)` apparaît dans le terminal.

### 1.3 Installer les dépendances

Toujours avec le venv activé :

```powershell
pip install -r requirements.txt
```

Cela installe : `numpy`, `matplotlib`, `networkx`, `pandas` (comme indiqué dans le cahier des charges, section 8.1).

### 1.4 Vérifier l’installation

```powershell
python -c "import numpy, matplotlib, networkx, pandas; print('OK')"
```

Si tu vois `OK`, l’environnement est prêt.

---

## 2. Structure du projet

```
Projet_fin_de_module/
├── requirements.txt
├── README.md
├── commun/                 # Classes partagées (parseur JSON, constantes, etc.)
├── niveau1/
│   ├── src/                # point_collecte.py, graphe_routier.py, main_niveau1.py
│   ├── data/               # input_niveau1.json, output_niveau1.json
│   └── tests/              # test_niveau1.py
├── niveau2/                # idem : src, data, tests
├── niveau3/
├── niveau4/
│   └── visualisations/     # tournees_carte.png, gantt_tournees.png (générés)
├── niveau5/
│   └── dashboards/         # sorties dashboard (générées)
└── venv/                   # créé par python -m venv venv (ne pas versionner)
```

---

## 3. Comment travailler niveau par niveau

- **Entrée** : chaque niveau lit un fichier `data/input_niveauX.json`.
- **Sortie** : il produit `data/output_niveauX.json` (et éventuellement images en niveau 4/5).
- **Exécution** : depuis la racine du projet, avec venv activé :
  ```powershell
  python niveau1/src/main_niveau1.py
  ```
  (ou en se plaçant dans `niveau1/src` et en lançant `python main_niveau1.py` selon comment tu organises les chemins.)

Ne pas passer au niveau suivant sans avoir validé les 4 tests du niveau actuel (décrits dans le PDF).

---

## 4. Livrables à rendre (rappel)

- Fichiers `.py` dans chaque `niveauX/src/`
- Fichiers JSON d’entrée/sortie dans `niveauX/data/`
- Tests unitaires dans `niveauX/tests/`
- Ce README (documentation du projet)

Barème : Fonctionnalité 80 %, Qualité du code 10 %, Tests 5 %, Rapport 5 %.

---

## 5. Prochaine étape

Commencer par **le Niveau 1** : modéliser le réseau routier (graphe), implémenter Dijkstra et produire la matrice des distances + `output_niveau1.json` conforme au format du cahier des charges.
