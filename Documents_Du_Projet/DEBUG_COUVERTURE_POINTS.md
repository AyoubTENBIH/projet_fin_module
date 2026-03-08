# Debug couverture points (15 % / 21 % au lieu de 100 %)

Pour localiser **où** les points sont perdus lors de l’optimisation, un mode debug affiche des logs `[COVERAGE_DEBUG]` à chaque étape.

## Activer le debug

### Option 1 : depuis le frontend (recommandé)

1. Ouvrir la console du navigateur (F12 → Console).
2. Taper :  
   `localStorage.setItem('debug_coverage','1')`
3. Relancer une optimisation (bouton « Optimiser les routes »).
4. Regarder **la console du backend Flask** (terminal où tourne `python app.py` ou `flask run`) : les lignes `[COVERAGE_DEBUG]` indiquent :
   - combien de points entrent dans l’optimiseur ;
   - la répartition par camion (glouton) ;
   - par secteur (décomposition) : points avant LNS, après LNS ;
   - dans le LNS : rejets (solution avec moins de points), points non réinsérés ;
   - le total final de points dans les routes.

Pour désactiver :  
`localStorage.removeItem('debug_coverage')`

### Option 2 : variable d’environnement (backend)

Avant de lancer le serveur Flask :

- **Windows (PowerShell)** :  
  `$env:COVERAGE_DEBUG="1"; python app.py`  
  (depuis `web_app/backend`, ou adapter le chemin vers `app.py`)
- **Linux / macOS** :  
  `COVERAGE_DEBUG=1 python web_app/backend/app.py`

Toutes les optimisations exécutées avec ce serveur afficheront les logs `[COVERAGE_DEBUG]`.

### Option 3 : body de la requête API

Envoyer dans le JSON de `POST /api/routes/optimiser` :

```json
{ "debug_coverage": true, "depot": {...}, "points": [...], ... }
```

Les logs apparaissent dans la console du processus backend.

## Ce que regarder dans les logs

| Log | Signification |
|-----|----------------|
| `ENTRÉE optimiser_collecte: points_data= N` | Nombre de points reçus par l’API. Si N &lt; 612, le frontend n’envoie pas tous les points. |
| `Répartition gloutonne: n_assignes= X / n_points_total= Y` | Si X &lt; Y, des points n’ont été assignés à aucun camion (ex. `zones_accessibles`). |
| `secteur i : AUCUN CAMION assigné` | Tous les points de ce secteur sont perdus (problème de répartition camions/secteurs). |
| `secteur i : pts_avant_lns= A attendu= B` | Si A &lt; B dès l’entrée LNS, la construction des routes secteur a déjà perdu des points. |
| `_lns_destroy_reconstruct: réinsérés= R / U` | R points réinsérés sur U retirés. Si R &lt; U, des points sont « POINT PERDU (non réinséré) ». |
| `_lns_optimize: rejet (perte points) current_count= C best_count= B` | Le LNS a proposé une solution avec moins de points ; elle est rejetée (correct). |
| `SORTIE _optimize_large_instance: total_pts_result= T / n_total= N` | T points dans les routes finales. Si T &lt; N, la perte a lieu avant (secteurs/LNS) ou dans 2-opt/reconstruction. |

En suivant ces étapes, on voit à quel niveau la couverture chute (entrée, répartition, secteur sans camion, LNS, ou sortie).
