# 🔍 Guide de Débogage : Carte Ne S'Affiche Pas

## ✅ Corrections Appliquées

1. **Vérifications ajoutées** dans `initMap()` :
   - Vérification que Leaflet est chargé
   - Vérification que le conteneur `#map` existe
   - Gestion d'erreurs avec try/catch
   - Logs de débogage dans la console

2. **CSS amélioré** :
   - `min-height: 600px` pour le conteneur `#map`
   - Couleur de fond temporaire pour voir si le conteneur existe

3. **Message de chargement** :
   - Message "Chargement de la carte..." affiché dans le conteneur
   - Supprimé automatiquement lors de l'initialisation

## 🔍 Étapes de Débogage

### 1. Ouvrir la Console (F12)

Ouvre la console du navigateur (F12) et vérifie les messages :

**Messages attendus :**
```
🚀 Initialisation de l'application...
✅ Initialisation de la carte...
✅ Carte initialisée avec succès
📍 Centre: [33.5731, -7.5898]
🔍 Zoom: 13
```

**Si tu vois des erreurs :**
- `❌ Leaflet n'est pas chargé` → Problème de connexion internet ou CDN bloqué
- `❌ Le conteneur #map n'existe pas` → Problème avec le HTML
- `❌ Erreur lors de l'initialisation` → Voir le message d'erreur complet

### 2. Vérifier le HTML

Ouvre `index.html` et vérifie que :
- Le conteneur `<div id="map"></div>` existe
- Leaflet est chargé : `<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>`
- Les scripts sont chargés dans le bon ordre

### 3. Tester avec le Fichier de Test

J'ai créé `test_map.html` pour tester isolément la carte :

1. Ouvre `test_map.html` dans ton navigateur
2. Si la carte s'affiche dans ce fichier → Le problème vient du code principal
3. Si la carte ne s'affiche pas → Problème avec Leaflet ou la connexion

### 4. Vérifier la Connexion Internet

Leaflet est chargé depuis un CDN. Si tu n'as pas internet :
- Télécharge Leaflet localement
- Ou utilise une connexion internet

### 5. Vérifier les Erreurs JavaScript

Dans la console (F12), cherche les erreurs en rouge. Les erreurs courantes :

- **SyntaxError** : Erreur de syntaxe dans le code
- **ReferenceError** : Variable non définie
- **TypeError** : Tentative d'utiliser une propriété sur null/undefined

## 🛠️ Solutions Rapides

### Solution 1 : Vider le Cache

1. Appuie sur **Ctrl+F5** (ou **Ctrl+Shift+R**) pour forcer le rechargement
2. Ou vide le cache du navigateur manuellement

### Solution 2 : Vérifier la Console

1. Ouvre la console (F12)
2. Regarde les messages d'erreur
3. Partage-les avec moi pour que je puisse t'aider

### Solution 3 : Tester le Fichier de Test

1. Ouvre `test_map.html` dans ton navigateur
2. Si ça fonctionne → Le problème vient du code principal
3. Si ça ne fonctionne pas → Problème avec Leaflet ou la connexion

## 📝 Informations à Me Fournir

Si le problème persiste, partage-moi :

1. **Messages de la console** (F12 → Console)
2. **Erreurs JavaScript** (s'il y en a)
3. **Résultat du test** avec `test_map.html`
4. **Navigateur utilisé** (Chrome, Firefox, Edge, etc.)
5. **Version du navigateur**

## 🎯 Code Ajouté pour le Débogage

```javascript
// Dans initMap()
console.log('✅ Initialisation de la carte...');
// ... code d'initialisation ...
console.log('✅ Carte initialisée avec succès');
console.log('📍 Centre:', CASABLANCA_CENTER);
console.log('🔍 Zoom:', DEFAULT_ZOOM);
```

Ces messages apparaîtront dans la console si tout fonctionne correctement.
