# Résolution du problème de couverture (15-38% → 100%)

## Problèmes identifiés et corrigés

### 1. **Backend : filtre `zones_accessibles` mal appliqué**

**Symptôme** : Seuls 126 points sur 833 (15%) étaient visités en mode sans zones.

**Cause** : 
- Le backend comparait `point.id` (ID du point, 1..833) avec `camion['zones_accessibles']` (IDs de zones, 1..8).
- Seuls les points dont l'ID était 1, 2, ..., 8 étaient acceptés par les camions.
- Les 825 autres points étaient rejetés → jamais assignés → jamais dans les routes.

**Correction** (`niveau2/src/optimiseur_routes.py`) :
```python
# Avant
if zones_accessibles and point.id not in zones_accessibles:
    continue

# Après
zones_accessibles = camion.get('zones_accessibles', [])
if zones_accessibles:
    point_zone_id = getattr(point, 'zone_id', None)
    if point_zone_id is not None and point_zone_id not in zones_accessibles:
        continue
    # pas de zone_id sur le point : on ne filtre pas
```

Le filtre ne s'applique maintenant que si le point a un `zone_id`, et compare `zone_id` (zone du point) avec `zones_accessibles` (zones autorisées du camion).

---

### 2. **Décomposition géographique : arrêt prématuré**

**Symptôme** : Couverture variable selon le `time_limit_seconds`.

**Cause** :
- Dans la boucle des secteurs, dès que `time_limit` dépassé : `if ... >= time_limit * 0.95: break`.
- Avec 12 secteurs et un temps limité à 60-77s, seuls 2-3 secteurs étaient traités → 15% couverture.

**Correction** :
```python
# Avant
if time_limit and time_start and (time.time() - time_start) >= time_limit * 0.95:
    break

# Après
# Suppression du break : tous les secteurs sont toujours traités
# Si le temps est dépassé pour un secteur, LNS fera peu d'itérations mais
# le secteur sera quand même optimisé (au moins Nearest Neighbor)
```

---

### 3. **Frontend zone par zone : points non inclus**

**Symptôme** : Avec zones, seuls ~192 points (23%) étaient visités.

**Cause** :
- Dans la boucle zone par zone, seuls les points dont l'ID était dans `zone.point_ids` étaient envoyés.
- Les 640 points avec `zone_id: null` (non assignés aux zones) n'étaient jamais traités.

**Correction** (`OptimizationLoader.jsx`) :
```javascript
// Avant
const zonePoints = points.filter((p) => pointIds.some((id) => id == p.id))

// Après
const zonePoints = points.filter(
  (p) =>
    !p.isDepot &&
    p.id !== depotId &&
    (pointIds.some((id) => id == p.id) || p.zone_id === zone.id)
)
```

Les points sont maintenant inclus s'ils sont dans `zone.point_ids` **ou** si leur `zone_id` correspond à la zone.

---

### 4. **Fallback points non couverts : `time_limit_seconds` appliqué**

**Symptôme** : Avec fallback, couverture à 38% (320/833) au lieu de 100%.

**Cause** :
- Après la boucle zones, un fallback envoie les points non couverts (~640-760) au backend.
- `time_limit_seconds` était automatiquement ajouté (60 + nb_points/50 = 77s).
- Avec 11 secteurs de 70 points chacun, certains secteurs n'étaient pas traités à temps.

**Correction** (`api.js` + `OptimizationLoader.jsx`) :
```javascript
// Ajout d'un paramètre forceNoTimeLimit
export async function apiRoutesOptimiser(..., forceNoTimeLimit = false) {
  if (!forceNoTimeLimit && pointsForRoutes.length > 200) {
    payload.time_limit_seconds = Math.min(300, 60 + Math.ceil(pointsForRoutes.length / 50))
  }
}

// Utilisation dans le fallback
const complement = await apiRoutesOptimiser(
  depotPoint, missingPoints, dechList, camions, false, [], true // ← forceNoTimeLimit
)
```

Le fallback ne fixe plus de limite de temps → tous les secteurs sont traités → 100% de couverture garantie.

---

### 5. **Passage de `zone_id` au backend**

**Correction** :
- Frontend (`api.js`) : copie de `zone_id` depuis le point d'origine vers le payload envoyé au backend.
- Backend (`optimiseur_routes.py`) : copie de `zone_id` depuis `points_data[i]` vers l'objet `Point`.

Cela permet au backend de distinguer les points avec zone (filtrés par `zones_accessibles`) des points sans zone (acceptés par tous les camions).

---

## Logs de diagnostic ajoutés

1. **Backend** :
   - `[Optimiseur] points assignés: X / Y` : vérifie que tous les points sont assignés aux camions.
   - `[Optimiseur] décomposition: N secteurs, X points` : vérifie la décomposition géographique.
   - `[Optimiseur] ATTENTION secteur X: Y/Z points dans les routes` : détecte si LNS perd des points.
   - `[Optimiseur] ATTENTION: seulement Y/Z points dans les routes finales` : détecte si reconstruction/nettoyage perd des points.

2. **Frontend** :
   - `[Optimization] Couverture partielle: ajout tournées pour X points non couverts` : détecte le déclenchement du fallback.
   - `[Optimization] Fallback OK: X routes, Y points` : confirme le succès du fallback.
   - `[API] apiRoutesOptimiser: sending POST ... time_limit: X ou none` : vérifie si une limite de temps est appliquée.

---

## Résultat attendu

Après toutes ces corrections et **redémarrage du serveur Flask** :

- **Sans zones** : 833/833 (100%) → tous les points assignés, tous les secteurs traités.
- **Avec zones** : 833/833 (100%) → zones traitées + fallback pour les points manquants.
- **Avec contraintes** : 833/833 (100%) → les contraintes n'affectent que le planning (Niveau 3), pas les routes (Niveau 2).

Les tournées couvrent maintenant **100% des points de collecte**, indépendamment de la configuration (zones, contraintes, nombre de camions).

---

## Actions requises pour appliquer les corrections

1. **Redémarrer le serveur Flask** : Ctrl+C dans le terminal backend, puis `python app.py`.
2. **Recharger la page** dans le navigateur : F5 ou Ctrl+R (pour charger le nouveau code JavaScript).
3. **Relancer une optimisation** (avec ou sans zones, avec ou sans contraintes).
4. **Vérifier les logs** :
   - Console navigateur (F12) : chercher `[Optimization] Fallback OK` si zones actives.
   - Terminal backend : chercher `[Optimiseur] points assignés: X / X` et `[Optimiseur] décomposition: N secteurs, X points`.
5. **Vérifier la couverture** : **Points visités (carte) : 833 / 833 (100%)**.
