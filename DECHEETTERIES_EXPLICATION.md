# Rôle des Déchetteries dans le Système VillePropre

## 🎯 Définition

Les **déchetteries** sont des **centres de traitement** où les camions déposent les déchets qu'ils ont collectés depuis les points de collecte (poubelles).

## 🔄 Processus de Collecte

Le trajet complet d'un camion suit cette logique :

```
1. Dépôt → Points de Collecte (collecte des déchets)
2. Points de Collecte → Déchetterie (dépôt des déchets collectés)
3. Déchetterie → Dépôt (retour au dépôt)
```

## 📍 Différence avec les Points de Collecte

| Élément | Rôle | Exemple |
|---------|------|---------|
| **Point de Collecte** | Où les camions **collectent** les déchets | Poubelles publiques, zones de collecte |
| **Déchetterie** | Où les camions **déposent** les déchets collectés | Centre de traitement, décharge |

## 🚛 Impact sur le Calcul des Coûts

Le calcul du coût d'affectation d'un camion à une zone inclut maintenant :

1. **Distance Dépôt → Zone** : Trajet pour aller collecter
2. **Distance Zone → Déchetterie** : Trajet vers le centre de traitement le plus proche
3. **Distance Déchetterie → Dépôt** : Retour au dépôt
4. **Coût de manutention** : Basé sur le volume collecté
5. **Coût fixe du camion**

### Formule de Coût

```
Coût = (distance_depot_zone + distance_zone_dechetterie + distance_dechetterie_depot) × 0.5€/km
     + volume_zone × 0.1€/kg
     + coût_fixe_camion
```

## 🗺️ Dans le Graphe Routier

- Les déchetteries sont des **sommets** dans le graphe routier
- Elles sont connectées au réseau routier comme les autres points
- Le système calcule automatiquement les chemins vers les déchetteries

## 💡 Avantages

1. **Réalisme** : Représente mieux le processus réel de collecte
2. **Optimisation** : Le système choisit la déchetterie la plus proche pour chaque zone
3. **Flexibilité** : Plusieurs déchetteries peuvent être disponibles
4. **Gestion de capacité** : Les déchetteries peuvent avoir une capacité maximale

## 🔧 Configuration

Les déchetteries sont définies dans `niveau1/data/input_niveau1.json` :

```json
{
  "dechetteries": [
    {
      "id": 11,
      "x": 3.5,
      "y": 4.0,
      "nom": "Déchetterie Nord",
      "capacite_max": 10000,
      "types_dechets": ["verre", "papier", "plastique", "métal"],
      "horaires": {
        "lundi": "8h-18h",
        "mardi": "8h-18h",
        ...
      }
    }
  ]
}
```

## 📊 Visualisation

Sur la carte interactive :
- Les déchetteries apparaissent avec des **marqueurs violets** 🏭
- Elles peuvent être sélectionnées comme dépôt (marqueur rouge)
- Le système calcule automatiquement les trajets vers les déchetteries

## ⚙️ Algorithme

Le système utilise une fonction `_trouver_dechetterie_plus_proche()` qui :
1. Parcourt toutes les déchetteries disponibles
2. Calcule la distance depuis le centre de la zone vers chaque déchetterie
3. Retourne la déchetterie la plus proche

Si aucune déchetterie n'est disponible, le camion retourne directement au dépôt après la collecte.

## 🎯 En Résumé

Les déchetteries sont des **destinations finales** dans le processus de collecte :
- Les camions y déposent les déchets collectés
- Le système optimise automatiquement le choix de la déchetterie
- Cela rend le modèle plus réaliste et complet
