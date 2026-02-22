# Intégration Niveau 3 - VillePropre

## Comment tester le Niveau 3

### 1. Démarrer le serveur

```bash
cd web_app/backend
python app.py
```

Ouvrez http://localhost:5000

### 2. Configuration initiale

1. **Points de collecte** : Ajoutez plusieurs points sur la carte (cliquez sur la carte)
2. **Dépôt** : Cliquez sur "Choisir le Dépôt" puis sur un point existant
3. **Camions** : Ajoutez au moins 2 camions
4. **Déchetteries** (optionnel pour N3) : Ajoutez une déchetterie

### 3. Exécution en cascade

1. **Niveau 1** : Cliquez sur "Niveau 1 : Calculer Distances"
2. **Niveau 2** : Cliquez sur "Niveau 2 : Affecter Zones"
3. **Niveau 3** : Configurez les créneaux puis générez le planning

### 4. Configuration Niveau 3

#### Créneaux horaires

- Cliquez sur "Charger template" → "Semaine classique" pour charger des créneaux prédéfinis
- Ou cliquez sur "+ Ajouter un Créneau" pour créer des créneaux manuellement
- Cliquez sur un créneau existant dans la grille pour le modifier

#### Contraintes (onglet Contraintes)

- **Fenêtres Zones** : Heures d'ouverture par zone
- **Pauses Camions** : Pause déjeuner par camion
- **Interdictions** : Zones résidentielles interdites la nuit (22h-6h)

### 5. Génération du planning

Cliquez sur **"Niveau 3 : Générer Planning"**. Une modal s'ouvre avec :

- **Timeline** : Vue calendrier hebdomadaire des collectes
- **Carte Animée** : (à venir)
- **Statistiques** : KPIs et tableau détaillé par jour

## Structure des fichiers

```
web_app/
├── frontend/
│   ├── css/
│   │   ├── niveau3.css      # Styles Niveau 3
│   │   └── timeline.css     # Styles timeline + stats
│   └── js/
│       ├── niveau3.js       # Configuration + API
│       ├── timeline-view.js # Vue calendrier
│       └── stats-dashboard.js # Tableau de bord
└── backend/
    ├── api/
    │   └── niveau3_routes.py
    └── services/
        └── planning_service.py
```

## API Endpoints

- `POST /api/niveau3/configure_creneaux` : Enregistre les créneaux
- `POST /api/niveau3/configure_contraintes` : Enregistre les contraintes
- `POST /api/niveau3/generer_planning` : Génère le planning hebdomadaire
- `GET /api/niveau3/simulation_temps_reel` : Positions camions (animation)
