# 🧪 Test du Drag du Dépôt

## ✅ Vérifications à Faire

### 1. Dans la Console (F12)
Après avoir créé le marqueur, tu devrais voir :
- `🔧 Marqueur créé, draggable: true`
- `✅ Dragging activé sur le marqueur`
- `✅ Styles CSS appliqués sur l'icône`

### 2. Test du Drag
1. **Cliquer et maintenir** sur l'icône rouge 🏭
2. **Glisser** vers une nouvelle position
3. **Relâcher**
4. Tu devrais voir dans la console :
   - `🚚 Début du drag du dépôt`
   - `🚚 Drag en cours: [lat, lng]` (plusieurs fois)
   - `✅ Dépôt déplacé par drag à: [lat, lng]`

### 3. Si le Drag ne Fonctionne Pas

**Vérifier dans la console :**
- Y a-t-il des erreurs JavaScript ?
- Le message "Dragging activé" apparaît-il ?
- Le curseur change-t-il en "move" au survol ?

**Solutions possibles :**
1. **Vider le cache** : Ctrl+F5
2. **Vérifier que Leaflet est chargé** : Dans la console, taper `L` devrait retourner l'objet Leaflet
3. **Tester avec un marqueur simple** : Le problème pourrait venir du divIcon

## 🔧 Code de Test

Si le drag ne fonctionne toujours pas, essaie ceci dans la console :

```javascript
// Vérifier que le marqueur existe
console.log('Marqueur:', depotMarker);
console.log('Draggable:', depotMarker.options.draggable);
console.log('Dragging:', depotMarker.dragging);
console.log('Dragging enabled:', depotMarker.dragging ? depotMarker.dragging.enabled() : 'N/A');

// Forcer l'activation
if (depotMarker.dragging) {
    depotMarker.dragging.enable();
    console.log('Drag activé manuellement');
}

// Vérifier l'élément DOM
const iconEl = depotMarker._icon;
console.log('Élément icon:', iconEl);
console.log('Styles:', iconEl ? window.getComputedStyle(iconEl) : 'N/A');
```

## 💡 Solution Alternative

Si le divIcon pose problème, on peut utiliser un marqueur standard Leaflet avec une icône personnalisée, mais cela nécessiterait de créer une image SVG.
