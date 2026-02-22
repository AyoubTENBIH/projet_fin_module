# Système d'Import/Export de Templates

## 📋 Vue d'ensemble

Le système de templates permet d'exporter et d'importer tous les éléments de votre configuration (points, camions, déchetteries, dépôt) ainsi que les résultats des calculs (Niveau 1 et Niveau 2) et les routes OSRM calculées.

## 🎯 Fonctionnalités

### ✅ Export de Template
- Exporte tous les éléments : points de collecte, déchetteries, camions, dépôt
- Inclut les résultats des niveaux 1 et 2
- Inclut toutes les routes OSRM calculées (cache)
- Format JSON téléchargeable

### ✅ Import de Template
- Charge tous les éléments depuis un fichier JSON
- Restaure automatiquement les routes OSRM depuis le cache
- Applique les résultats des niveaux 1 et 2
- Affiche automatiquement les chemins sur la carte

### ✅ Cache OSRM (localStorage)
- Sauvegarde automatique des routes calculées
- Évite de recalculer les mêmes routes
- Persiste entre les sessions du navigateur
- Limite automatique à 1000 routes pour éviter le dépassement de quota

## 📤 Exporter un Template

### Étapes :
1. Configurez votre projet :
   - Ajoutez des points de collecte
   - Ajoutez des déchetteries
   - Ajoutez des camions
   - Sélectionnez un dépôt
   - Lancez les niveaux 1 et 2 (optionnel mais recommandé)

2. Cliquez sur **"📤 Exporter Template"**

3. Entrez un nom et une description (optionnel)

4. Le fichier JSON est téléchargé automatiquement

### Contenu du Template Exporté :
```json
{
  "version": "1.0",
  "timestamp": "2026-02-18T...",
  "metadata": {
    "nom": "Template",
    "description": "..."
  },
  "depot": { ... },
  "points": [ ... ],
  "dechetteries": [ ... ],
  "camions": [ ... ],
  "connexions": [ ... ],
  "niveau1_result": { ... },
  "niveau2_result": { ... },
  "osrm_cache": { ... }
}
```

## 📥 Importer un Template

### Étapes :
1. Cliquez sur **"📥 Importer Template"**

2. Sélectionnez le fichier JSON du template

3. Le système charge automatiquement :
   - Tous les points de collecte
   - Toutes les déchetteries
   - Tous les camions
   - Le dépôt sélectionné
   - Les résultats du niveau 1 (chemins affichés)
   - Les résultats du niveau 2 (simulation disponible)
   - Le cache OSRM (routes réelles restaurées)

4. La carte se recentre automatiquement sur les éléments

### Avantages :
- ✅ Pas besoin de recréer manuellement tous les éléments
- ✅ Les routes OSRM sont restaurées depuis le cache (pas de recalcul)
- ✅ Les résultats des calculs sont préservés
- ✅ Prêt à simuler immédiatement

## 💾 Cache OSRM (localStorage)

### Fonctionnement :
- **Sauvegarde automatique** : Après chaque calcul de route OSRM
- **Chargement automatique** : Au démarrage de l'application
- **Persistance** : Les routes restent en cache même après fermeture du navigateur
- **Optimisation** : Évite les appels API inutiles à OSRM

### Structure du Cache :
```javascript
{
  "version": "1.0",
  "timestamp": "2026-02-18T...",
  "routes": {
    "lat1,lng1→lat2,lng2": {
      "coordinates": [[lat, lng], ...],
      "distance": 5.2,  // km
      "duration": 120   // secondes
    },
    ...
  }
}
```

### Gestion du Cache :
- **Limite** : 1000 routes maximum (nettoyage automatique si dépassement)
- **Clé de cache** : Basée sur les coordonnées des points
- **Cache bidirectionnel** : Une route A→B peut être utilisée pour B→A (inversée)

## 🔄 Workflow Recommandé

### Scénario 1 : Créer et Sauvegarder
1. Configurez votre projet complet
2. Lancez le Niveau 1 (calcule les routes OSRM)
3. Lancez le Niveau 2 (affectation optimale)
4. Exportez le template
5. Le fichier contient tout : éléments + résultats + routes OSRM

### Scénario 2 : Charger un Template Existant
1. Importez le template
2. Tous les éléments sont restaurés
3. Les routes OSRM sont chargées depuis le cache
4. Les résultats sont appliqués automatiquement
5. Vous pouvez directement simuler ou modifier

## 📊 Format du Template

### Structure Complète :
```json
{
  "version": "1.0",
  "timestamp": "ISO 8601",
  "metadata": {
    "nom": "string",
    "description": "string"
  },
  "depot": {
    "id": 0,
    "nom": "string",
    "x": 0.0,
    "y": 0.0,
    "lat": 33.5731,
    "lng": -7.5898
  },
  "points": [
    {
      "id": 1,
      "nom": "string",
      "x": 0.0,
      "y": 0.0,
      "lat": 33.5731,
      "lng": -7.5898,
      "volume": 1200.0,
      "priorite": "haute|normale|basse",
      "isDepot": false
    }
  ],
  "dechetteries": [
    {
      "id": 11,
      "nom": "string",
      "x": 0.0,
      "y": 0.0,
      "lat": 33.5731,
      "lng": -7.5898,
      "capacite_max": 10000.0,
      "types_dechets": ["verre", "papier"],
      "horaires": {}
    }
  ],
  "camions": [
    {
      "id": 1,
      "capacite": 5000.0,
      "cout_fixe": 200.0,
      "zones_accessibles": [1, 2, 3]
    }
  ],
  "connexions": [
    {
      "depart": 0,
      "arrivee": 1,
      "distance": 4.2
    }
  ],
  "niveau1_result": {
    "matrice_distances": [[...]],
    "chemins_calcules": [...],
    "ids_ordonnes": [...]
  },
  "niveau2_result": {
    "affectation": [...],
    "statistiques": {...},
    "graphe_biparti": {...}
  },
  "osrm_cache": {
    "lat1,lng1→lat2,lng2": {
      "coordinates": [[lat, lng], ...],
      "distance": 5.2,
      "duration": 120
    }
  }
}
```

## ⚙️ Avantages Techniques

### Performance
- ✅ Pas de recalcul des routes OSRM lors de l'import
- ✅ Chargement instantané des routes depuis le cache
- ✅ Réduction de la consommation de l'API OSRM

### Productivité
- ✅ Partage facile de configurations entre utilisateurs
- ✅ Sauvegarde de scénarios de test
- ✅ Restauration rapide d'un état précédent

### Fiabilité
- ✅ Les routes calculées sont préservées
- ✅ Pas de risque de perte de données
- ✅ Versioning possible (nom de fichier avec timestamp)

## 🎯 Cas d'Usage

### 1. Sauvegarde de Travail
Exportez régulièrement votre travail pour pouvoir le restaurer plus tard.

### 2. Partage de Configuration
Partagez un template avec un collègue pour qu'il puisse tester la même configuration.

### 3. Tests Comparatifs
Créez plusieurs templates avec différentes configurations pour comparer les résultats.

### 4. Démonstration
Préparez un template complet avec résultats pour une démonstration.

## 🔧 Détails Techniques

### Cache OSRM
- **Stockage** : localStorage du navigateur
- **Clé** : `villepropre_osrm_cache`
- **Version** : `1.0` (pour compatibilité future)
- **Taille max** : ~5-10 MB (selon le navigateur)
- **Nettoyage** : Automatique si dépassement (garde les 1000 plus récentes)

### Export
- **Format** : JSON avec indentation
- **Nom de fichier** : `template_{nom}_{timestamp}.json`
- **Taille** : Variable selon le nombre de routes OSRM

### Import
- **Validation** : Vérifie la version et la structure
- **Nettoyage** : Efface les éléments existants avant import
- **Application** : Applique tous les éléments dans l'ordre correct

## 📝 Notes Importantes

1. **Cache OSRM** : Le cache est partagé entre tous les templates importés
2. **Routes manquantes** : Si une route n'est pas dans le cache, elle sera recalculée
3. **Compatibilité** : Les templates sont compatibles entre différentes sessions
4. **Sécurité** : Les templates sont des fichiers JSON locaux (pas de serveur)

## 🚀 Utilisation Rapide

```javascript
// Exporter
exportTemplate();

// Importer
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json';
fileInput.onchange = (e) => importTemplate(e.target.files[0]);
fileInput.click();
```

Le système est maintenant complètement fonctionnel et prêt à l'emploi ! 🎉
