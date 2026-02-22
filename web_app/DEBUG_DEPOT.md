# 🔍 Guide de Débogage - Dépôt qui ne se déplace pas

## Problème
L'icône rouge du dépôt reste fixe même après sélection d'un nouvel emplacement sur la carte.

## Solutions Appliquées

### 1. **Vérification et Déplacement du Marqueur Existant**
- Si le marqueur existe déjà, on utilise `setLatLng()` pour le déplacer au lieu de le recréer
- Vérification de la position après déplacement
- Correction automatique si la position est incorrecte

### 2. **Forçage du Redraw**
- `depotMarker.update()` - Met à jour le marqueur
- `map.invalidateSize()` - Force le redraw de la carte
- Vérifications multiples avec `setTimeout` pour s'assurer que le déplacement a fonctionné

### 3. **Amélioration du CSS**
- `cursor: move` sur l'icône pour indiquer qu'elle est glissable
- Animation au survol pour feedback visuel

## 🔧 Comment Tester

1. **Ouvrir la console** (F12)
2. **Cliquer sur "Choisir le Dépôt"**
3. **Cliquer sur la carte**
4. **Vérifier les logs** :
   - `📍 Nouveau dépôt sélectionné par clic: [lat, lng]`
   - `📍 Marqueur existant trouvé, déplacement à: [lat, lng]`
   - `📍 Nouvelle position vérifiée: [lat, lng]`
   - `✅ Marqueur déplacé avec succès`

## 🐛 Si le Problème Persiste

### Vérifications à faire :

1. **Les coordonnées sont-elles valides ?**
   - Vérifier dans la console que `depotCoords` contient `[lat, lng]` valides
   - Pas de `NaN` ou `undefined`

2. **Le marqueur est-il sur la carte ?**
   - Vérifier `map.hasLayer(depotMarker)` retourne `true`
   - Si `false`, le marqueur n'est pas ajouté correctement

3. **La position est-elle correcte ?**
   - Comparer `depotMarker.getLatLng()` avec `depotCoords`
   - Si différent, le problème vient du positionnement Leaflet

4. **Le CSS bloque-t-il le positionnement ?**
   - Vérifier qu'il n'y a pas de `position: fixed` ou `position: absolute` avec des coordonnées fixes
   - Vérifier que `.depot-icon` n'a pas de styles qui bloquent

## 💡 Solution Alternative

Si le problème persiste, essayer de **supprimer complètement** le marqueur avant de le recréer :

```javascript
if (depotMarker) {
    map.removeLayer(depotMarker);
    depotMarker = null;
}
// Puis recréer
```

## 📝 Logs à Surveiller

- ✅ `Marqueur existant trouvé, déplacement à:` - Le marqueur existe et va être déplacé
- ✅ `Nouvelle position vérifiée:` - Confirmation du déplacement
- ❌ `Position incorrecte après déplacement` - Le déplacement a échoué
- ❌ `ÉCHEC: Le marqueur ne se positionne pas` - Problème critique
