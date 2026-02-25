# VillePropre - Nouveau Frontend React

Interface moderne style Airbnb pour l'optimisation des tournées de collecte de déchets.

## Phase 1 (Implémentée)

- ✅ Page d'accueil épurée
- ✅ Navigation step-by-step (Configuration → Optimisation → Planning)
- ✅ Configuration des points sur carte Leaflet (Casablanca)
- ✅ Configuration des camions
- ✅ Composants réutilisables : Button, Card, Stepper
- ✅ Import de projet depuis fichier JSON

## Démarrage

### Prérequis

- Node.js 18+
- Backend Flask VillePropre (port 5000)

### Lancer le frontend

```bash
cd web_app/frontend_react
npm install
npm run dev
```

Ouvrir http://localhost:5173

Le proxy Vite redirige automatiquement `/api/*` vers le backend Flask sur le port 5000.

### Utiliser via Flask (production)

```bash
cd web_app/frontend_react && npm run build
cd web_app/backend && python app.py
```

Puis ouvrir http://localhost:5000/v2/

### Lancer le backend

```bash
cd web_app/backend
python -m flask run
# ou
python app.py
```

## Structure

```
frontend_react/
├── src/
│   ├── components/
│   │   ├── common/       # Button, Card, Stepper
│   │   └── configuration/
│   ├── context/          # ProjectContext (état global)
│   ├── pages/            # Home
│   ├── App.jsx
│   └── main.jsx
├── index.html
└── vite.config.js
```

## Phases suivantes

- **Phase 2** : Configuration créneaux, contraintes, intégration API Niveau 3
- **Phase 3** : Timeline planning, simulation animée
- **Phase 4** : Polish, responsive, documentation
