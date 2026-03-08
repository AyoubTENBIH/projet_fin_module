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

## 5. Tests prédéfinis (niveau 2)

Trois jeux de tests avec données prédéfinies sont fournis :

| Test | Camions | Points de collecte |
|------|---------|---------------------|
| 1    | 5       | 50                  |
| 2    | 10      | 100                 |
| 3    | 20      | 500                 |

Chaque point de collecte peut contenir **2 ou 3 bennes** ; le **poids total par point** est compris entre **150 kg et 600 kg** (selon le nombre de bennes). Les entrées sont générées avec une graine fixe (reproductibilité) et enregistrées dans `niveau2/data/tests_predefinis/`.

**Lancer les trois tests** (depuis la racine du projet, venv activé) :

```powershell
python niveau2/run_tests_predefinis.py
```

Pour n’exécuter que les tests 5/50 et 10/100 (le test 20/500 peut prendre plusieurs minutes) :

```powershell
python niveau2/run_tests_predefinis.py --quick
```

**Mesures de performance affichées** : distance totale, volume total collecté, nombre de camions utilisés, visites déchetteries, **tonnage transporté par kilomètre (t/km) par camion** et **moyenne sur l’ensemble des camions**.

---

## 6. Stratégie hybride et méta-heuristiques (sans blocage)

L’optimiseur adapte **automatiquement** les algorithmes au nombre de points (et à la taille des tournées) :

- **Small** (≤ 50 points) : 2-opt, 3-opt, Or-opt, recuit simulé (SA).
- **Medium** (≤ 150) : 2-opt, 3-opt limité, Or-opt, SA.
- **Large** (≤ 400) : 2-opt, Or-opt limité, **ILS** (Iterated Local Search) + SA.
- **Xlarge** (> 400) : 2-opt léger, **ILS** + SA, plafonds stricts ; le calcul de la borne MST est ignoré pour accélérer.

Une option **time_limit_seconds** (dans l’API : body `time_limit_seconds`) permet de limiter le temps de calcul pour garantir une réponse sans blocage, quel que soit le nombre de points.

---

## 7. Document explicatif des algorithmes

Un document détaillé décrit les algorithmes utilisés, leur fonctionnement, leur complexité et une discussion sur l’optimalité dans ce contexte :

- **`docs/DOCUMENTATION_ALGORITHMES.md`** : Dijkstra, Plus proche voisin, 2-opt, 3-opt, Or-opt, recuit simulé, **stratégie hybride**, **ILS**, borne MST, métriques (dont tonnage/km), et garantie de non-blocage.

---

## 8. Prochaine étape

Commencer par **le Niveau 1** : modéliser le réseau routier (graphe), implémenter Dijkstra et produire la matrice des distances + `output_niveau1.json` conforme au format du cahier des charges.
