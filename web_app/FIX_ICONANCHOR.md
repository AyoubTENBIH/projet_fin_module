# 🎯 Fix: iconAnchor pour Tous les divIcon

## Problème Identifié

**Symptôme** : Les marqueurs (points de collecte, camions) apparaissent décalés visuellement par rapport à leur position géographique réelle. Le décalage se corrige temporairement lors du pan de la carte.

**Cause Racine** : Absence d'`iconAnchor` dans les `L.divIcon`.

### Comportement de Leaflet

Sans `iconAnchor`, Leaflet place le **coin haut-gauche** du div sur les coordonnées géographiques, au lieu du centre. Cela crée un décalage visuel :

```
Sans iconAnchor:          Avec iconAnchor:
┌─────┐                      ┌─────┐
│ 🗑️  │                      │ 🗑️  │
└─────┘                      └──●──┘
●                               ↑
↑                            Centre
Coin haut-gauche          (position géo)
(position géo)
```

## Corrections Appliquées

### 1. Points de Collecte (map.js)

**Avant** :
```javascript
icon: L.divIcon({
    className: 'point-icon',
    html: `<div style="...width: 30px; height: 30px;...">🗑️</div>`,
    iconSize: [30, 30]
    // ❌ Pas d'iconAnchor
})
```

**Après** :
```javascript
icon: L.divIcon({
    className: 'point-icon',
    html: `<div style="...width: 30px; height: 30px;...">🗑️</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]  // ✅ Centre du div 30x30
})
```

### 2. Camions - Création Initiale (simulation.js)

**Avant** :
```javascript
icon: L.divIcon({
    className: 'camion-animated',
    html: createCamionIcon(color, id, 0, capacite),
    iconSize: [50, 50]
    // ❌ Pas d'iconAnchor
})
```

**Après** :
```javascript
icon: L.divIcon({
    className: 'camion-animated',
    html: createCamionIcon(color, id, 0, capacite),
    iconSize: [50, 50],
    iconAnchor: [25, 25]  // ✅ Centre du div 50x50
})
```

### 3. Camions - Mise à Jour Pendant Simulation (simulation.js)

**Avant** :
```javascript
sim.marker.setIcon(L.divIcon({
    className: 'camion-animated',
    html: createCamionIcon(sim.color, sim.camionId, chargePercent, sim.capacite),
    iconSize: [50, 50]
    // ❌ Pas d'iconAnchor
}));
```

**Après** :
```javascript
sim.marker.setIcon(L.divIcon({
    className: 'camion-animated',
    html: createCamionIcon(sim.color, sim.camionId, chargePercent, sim.capacite),
    iconSize: [50, 50],
    iconAnchor: [25, 25]  // ✅ Centre du div 50x50
}));
```

### 4. Dépôt (map.js) - ✅ Déjà Correct

```javascript
icon: L.divIcon({
    className: 'depot-icon',
    html: '<div style="...width: 40px; height: 40px;...">🏭</div>',
    iconSize: [40, 40],
    iconAnchor: [20, 20]  // ✅ Déjà centré (40/2 = 20)
})
```

## Règle Générale

Pour tous les `L.divIcon`, **toujours définir `iconAnchor`** :

```javascript
L.divIcon({
    html: '<div style="width: Wpx; height: Hpx;">...</div>',
    iconSize: [W, H],
    iconAnchor: [W/2, H/2]  // ✅ Centre exact
})
```

## Résultat

✅ **Points de collecte** : Centrés précisément sur leurs coordonnées
✅ **Camions** : Positionnés exactement sur leur emplacement
✅ **Dépôt** : Déjà correct
✅ **Pas de décalage** : Même sans pan de la carte

## Tests de Validation

1. ✅ Ajouter un point → Icône centrée sur le clic
2. ✅ Simuler → Camions au bon emplacement
3. ✅ Pan de la carte → Pas de correction visuelle nécessaire
4. ✅ Zoom → Marqueurs restent centrés

## Pourquoi le Pan "Corrigeait" le Problème ?

Le pan de la carte force Leaflet à recalculer le rendu de tous les marqueurs. Sans `iconAnchor` défini, ce recalcul appliquait parfois des heuristiques par défaut qui masquaient temporairement le bug. Mais le décalage revenait ensuite.

Avec `iconAnchor` explicite, le marqueur est **toujours** correctement centré, sans dépendre d'un recalcul.

## Date de Correction

2026-02-18

## Crédit

Fix suggéré par l'utilisateur qui a identifié la cause racine du problème.
