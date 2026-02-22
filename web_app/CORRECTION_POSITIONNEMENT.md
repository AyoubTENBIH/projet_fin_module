# 🔧 Correction du Positionnement des Camions

## ❌ Problème Identifié

Les camions apparaissaient dans l'océan au lieu d'être positionnés au dépôt au début de la simulation.

## ✅ Solution Appliquée

### 1. **Utilisation Directe de `depotCoords`**
- Les camions utilisent maintenant **directement** `depotCoords` pour leur position initiale
- Plus de dépendance sur `coords[0]` qui pouvait être incorrect

### 2. **Construction Correcte du Trajet**
Le trajet est maintenant construit ainsi :
```javascript
finalCoords = [
    depotCoords,           // Index 0 : DÉPÔT (départ)
    zone1_coords,          // Index 1 : Première zone
    zone2_coords,          // Index 2 : Deuxième zone
    ...
    depotCoords            // Dernier index : DÉPÔT (retour)
]
```

### 3. **Vérifications Ajoutées**
- Vérification que `depotCoords` est défini avant de lancer la simulation
- Validation des coordonnées (non-null, non-NaN)
- Messages d'erreur clairs si le dépôt n'est pas défini

### 4. **Logs de Débogage**
- Console logs pour vérifier les coordonnées du dépôt
- Affichage du trajet complet de chaque camion
- Messages de confirmation lors de la création des camions

## 🎯 Code Modifié

### `simulation.js` - Fonction `startSimulation()`

**Avant :**
```javascript
const coords = zoneIds.map(id => {
    const p = allPoints.find(pp => pp.id === id);
    return p ? [p.lat, p.lng] : null;
});
const camionMarker = L.marker(coords[0], {...});
```

**Après :**
```javascript
const finalCoords = [depotCoords]; // Commence par le dépôt
aff.zones_affectees.forEach(zoneId => {
    const point = points.find(p => p.id === zoneId);
    if (point) {
        finalCoords.push([point.lat, point.lng]);
    }
});
finalCoords.push(depotCoords); // Retour au dépôt

const camionMarker = L.marker([depotCoords[0], depotCoords[1]], {...});
```

## 📋 Vérifications à Faire

1. ✅ Le dépôt est défini avant la simulation
2. ✅ Les camions démarrent au dépôt (coords[0])
3. ✅ Les coordonnées sont valides (non-NaN)
4. ✅ Le trajet inclut le retour au dépôt

## 🚀 Résultat

Maintenant, **tous les camions démarrent correctement au dépôt** (marqueur rouge 🏭) et suivent leur trajet vers les zones de collecte.

## 🔍 Pour Déboguer

Ouvrir la console du navigateur (F12) et vérifier :
- `Dépôt: [lat, lng]` - Coordonnées du dépôt
- `Camion X créé au dépôt [lat, lng]` - Confirmation du positionnement
- `Camion X - Trajet: [...]` - Liste complète des coordonnées

Si un camion apparaît encore dans l'océan :
1. Vérifier que le dépôt est bien choisi sur la carte
2. Vérifier les logs de la console
3. S'assurer que `depotCoords` contient des valeurs valides
