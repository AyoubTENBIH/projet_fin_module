# Application Web - VillePropre

Application web interactive pour visualiser et simuler l'optimisation des tournées de collecte de déchets.

## 🎯 Fonctionnalités

- **Carte interactive** : Sélection de points de collecte sur une carte réelle (Casablanca)
- **Gestion des camions** : Ajout et configuration des camions avec capacités et zones accessibles
- **Optimisation Niveau 1** : Calcul des distances optimales entre points (Dijkstra)
- **Optimisation Niveau 2** : Affectation optimale zones ↔ camions (algorithme glouton)
- **Visualisation animée** : Simulation des trajets des camions avec animations
- **Dashboard temps réel** : Statistiques, coûts, taux d'utilisation

## 🚀 Installation

### Backend

```bash
cd web_app/backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python app.py
```

Le serveur démarre sur `http://localhost:5000`

### Frontend

Ouvrir `web_app/frontend/index.html` dans un navigateur moderne, ou servir via un serveur HTTP local.

## 📁 Structure

```
web_app/
├── backend/          # API Flask
│   ├── app.py       # Serveur principal
│   ├── api/         # Endpoints API
│   └── requirements.txt
├── frontend/         # Interface web
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
└── README.md
```

## 🔧 Technologies

- **Backend** : Flask, Flask-CORS
- **Frontend** : Leaflet.js (cartes), Chart.js (graphiques), Vanilla JS
- **Intégration** : Réutilise les modules niveau1 et niveau2

## 📝 Utilisation

1. Ouvrir l'application dans le navigateur
2. Cliquer sur la carte pour ajouter des points de collecte
3. Configurer les camions (capacité, coût fixe, zones accessibles)
4. Lancer l'optimisation Niveau 1 (calcul distances)
5. Lancer l'optimisation Niveau 2 (affectation camions ↔ zones)
6. Visualiser les résultats et la simulation animée
