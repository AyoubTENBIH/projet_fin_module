# Technologies Utilisées dans le Projet VillePropre

## 📋 Vue d'ensemble

Ce projet utilise une architecture **full-stack** avec un backend Python et un frontend JavaScript, organisé en trois modules principaux : Niveau 1, Niveau 2, et Web App.

---

## 🐍 Backend (Python)

### Langage de programmation
- **Python 3.x** (probablement Python 3.9+ basé sur les dépendances)

### Framework Web
- **Flask 2.3.0+**
  - Framework web léger et flexible
  - Utilisé pour créer l'API REST
  - Gestion des routes et des requêtes HTTP

### Bibliothèques Python principales

#### 1. **Flask-CORS 4.0.0+**
   - Permet les requêtes cross-origin (CORS)
   - Nécessaire pour que le frontend communique avec le backend
   - Configuration : `CORS(app)`

#### 2. **Bibliothèques standard Python**
   - `json` : Sérialisation/désérialisation JSON
   - `heapq` : File de priorité pour l'algorithme de Dijkstra
   - `statistics` : Calculs statistiques (moyenne, écart-type)
   - `pathlib` : Gestion des chemins de fichiers
   - `sys` : Accès aux paramètres système
   - `math` : Calculs mathématiques (distance euclidienne)

### Structure Backend
```
web_app/backend/
├── app.py                 # Serveur Flask principal
├── api/
│   ├── niveau1_api.py    # API pour le calcul des distances
│   └── niveau2_api.py     # API pour l'affectation optimale
└── requirements.txt       # Dépendances Python
```

---

## 🌐 Frontend (JavaScript/HTML/CSS)

### Langages de base
- **HTML5** : Structure de la page web
- **CSS3** : Styles et mise en page
- **JavaScript (ES6+)** : Logique côté client

### Bibliothèques JavaScript externes

#### 1. **Leaflet 1.9.4**
   - Bibliothèque open-source pour cartes interactives
   - Utilisée pour afficher la carte avec les points de collecte
   - Gestion des marqueurs, popups, et polylignes
   - Tuiles OpenStreetMap

#### 2. **Chart.js 4.4.0**
   - Bibliothèque de visualisation de données
   - Utilisée pour créer les graphiques de statistiques
   - Graphiques en barres pour les charges des camions

### Structure Frontend
```
web_app/frontend/
├── index.html            # Page principale
├── css/
│   └── style.css        # Styles personnalisés
└── js/
    ├── map.js           # Gestion de la carte et des points
    ├── simulation.js     # Simulation animée des trajets
    ├── dashboard.js     # Tableau de bord et statistiques
    └── presentation.js  # Présentation visuelle des résultats
```

### Technologies Frontend utilisées

#### **Fetch API**
   - Communication asynchrone avec le backend
   - Requêtes HTTP GET/POST vers les endpoints Flask

#### **DOM Manipulation**
   - Manipulation directe du DOM avec JavaScript vanilla
   - Gestion des événements (clics, formulaires)
   - Création dynamique d'éléments HTML

#### **CSS Features**
   - Flexbox et Grid pour la mise en page
   - Gradients CSS pour les arrière-plans
   - Animations et transitions
   - Media queries pour la responsivité

---

## 🔧 Modules Python personnalisés

### Niveau 1 - Calcul des Plus Courts Chemins

#### **graphe_routier.py**
   - Classe `GrapheRoutier`
   - Implémentation de l'algorithme de **Dijkstra**
   - Utilise `heapq` pour la file de priorité
   - Calcul de la matrice des distances

#### **point_collecte.py**
   - Classe `PointCollecte`
   - Représente un point dans le réseau routier
   - Calcul de distance euclidienne

#### **dechetterie.py**
   - Classe `Dechetterie` (hérite de `PointCollecte`)
   - Gestion des déchetteries avec capacité et types de déchets

### Niveau 2 - Affectation Optimale

#### **affectateur_biparti.py**
   - Classe `AffectateurBiparti`
   - Algorithme **glouton** pour l'affectation
   - Équilibrage des charges
   - Vérification des contraintes

#### **camion.py**
   - Classe `Camion`
   - Gestion de la capacité et des zones accessibles

#### **zone.py**
   - Classe `Zone`
   - Représente une zone de collecte avec volume et priorité

---

## 📊 Format de données

### **JSON**
   - Format de stockage des données d'entrée et de sortie
   - Structure pour :
     - Points de collecte
     - Connexions/routes
     - Camions
     - Zones
     - Déchetteries
     - Résultats d'optimisation

### Fichiers de données
```
niveau1/data/
├── input_niveau1.json   # Données d'entrée niveau 1
└── output_niveau1.json  # Résultats niveau 1

niveau2/data/
├── input_niveau2.json   # Données d'entrée niveau 2
└── output_niveau2.json  # Résultats niveau 2
```

---

## 🗺️ Cartographie

### **OpenStreetMap**
   - Service de cartes utilisé via Leaflet
   - Tuiles gratuites et open-source
   - Configuration : `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

### **Projection géographique**
   - Conversion lat/lng ↔ coordonnées x/y
   - Approximation : 1 degré ≈ 111 km
   - Centre de référence : Casablanca, Maroc (33.5731, -7.5898)

---

## 🚀 Architecture de l'application

### **Architecture Client-Serveur**
```
┌─────────────────┐         HTTP/REST         ┌─────────────────┐
│                 │ ◄─────────────────────────► │                 │
│   Frontend      │         JSON               │    Backend       │
│   (Browser)     │                            │    (Flask)       │
│                 │                            │                 │
│  - Leaflet      │                            │  - Niveau 1 API │
│  - Chart.js     │                            │  - Niveau 2 API │
│  - JavaScript   │                            │  - Python       │
└─────────────────┘                            └─────────────────┘
```

### **Communication**
- **Protocole** : HTTP/HTTPS
- **Format** : JSON (JavaScript Object Notation)
- **Méthodes** : GET, POST
- **CORS** : Activé pour permettre les requêtes cross-origin

---

## 🛠️ Outils et environnements

### **Environnement virtuel Python**
- **venv** : Environnement virtuel Python
- Localisation : `web_app/backend/venv/`
- Isolation des dépendances

### **Gestion des dépendances**
- **pip** : Gestionnaire de paquets Python
- **requirements.txt** : Liste des dépendances

### **Système d'exploitation**
- Compatible Windows, Linux, macOS
- Testé sur Windows 10 (PowerShell)

---

## 📦 Dépendances complètes

### Backend (requirements.txt)
```
Flask>=2.3.0
Flask-CORS>=4.0.0
```

### Frontend (CDN)
- Leaflet 1.9.4 (CSS + JS)
- Chart.js 4.4.0 (JS)

---

## 🔍 Algorithmes implémentés

### **Niveau 1**
- **Algorithme de Dijkstra**
  - Complexité : O((V + E) log V)
  - Utilise `heapq` pour la file de priorité
  - Calcul des plus courts chemins

### **Niveau 2**
- **Algorithme Glouton (Greedy)**
  - Complexité : O(Z × C × log C)
  - Tri et sélection optimale
  - Équilibrage itératif des charges

---

## 🎨 Technologies de design

### **CSS**
- Gradients linéaires
- Box shadows pour la profondeur
- Border-radius pour les coins arrondis
- Flexbox et Grid Layout
- Transitions et animations

### **Icônes**
- Emojis Unicode (🚛, 🗑️, 🏭, ✅, etc.)
- Utilisés directement dans le HTML/JS

---

## 📡 API Endpoints

### **Niveau 1**
- `POST /api/niveau1/calculer-distances`
  - Calcule la matrice des distances
  - Retourne les chemins optimaux

### **Niveau 2**
- `POST /api/niveau2/optimiser`
  - Optimise l'affectation zones ↔ camions
  - Retourne les statistiques et résultats

### **Health Check**
- `GET /api/health`
  - Vérification de l'état du serveur

---

## 🔐 Sécurité

- **CORS** : Configuré pour permettre les requêtes cross-origin
- **Validation** : Vérification des données d'entrée côté serveur
- **Pas d'authentification** : Application de démonstration (non sécurisée pour production)

---

## 📝 Résumé des technologies

| Catégorie | Technologies |
|-----------|-------------|
| **Backend** | Python 3.x, Flask, Flask-CORS |
| **Frontend** | HTML5, CSS3, JavaScript ES6+ |
| **Cartographie** | Leaflet, OpenStreetMap |
| **Visualisation** | Chart.js |
| **Données** | JSON |
| **Algorithmes** | Dijkstra, Algorithme Glouton |
| **Structure** | Architecture Client-Serveur (REST API) |
| **Outils** | pip, venv, Git (probablement) |

---

## 🎯 Points clés

1. **Stack moderne** : Technologies web standards et populaires
2. **Séparation des responsabilités** : Backend (logique) / Frontend (présentation)
3. **API REST** : Communication standardisée entre frontend et backend
4. **Open-source** : Toutes les bibliothèques utilisées sont open-source
5. **Pas de base de données** : Utilisation de fichiers JSON pour le stockage
6. **Algorithms classiques** : Dijkstra et algorithme glouton, bien documentés

---

## 📚 Ressources externes utilisées

- **Leaflet** : https://leafletjs.com/
- **Chart.js** : https://www.chartjs.org/
- **OpenStreetMap** : https://www.openstreetmap.org/
- **Flask** : https://flask.palletsprojects.com/
- **Flask-CORS** : https://flask-cors.readthedocs.io/

---

Ce projet démontre une bonne maîtrise des technologies web modernes et des algorithmes classiques d'optimisation combinatoire.
