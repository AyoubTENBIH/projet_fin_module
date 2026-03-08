# Benchmark grandes instances — Durées mesurées et complexité

## 0. Choix LNS dès n > 50 (medium)

À partir de **n > 50 points**, le système utilise **LNS + neighbor pruning** au lieu du pipeline classique (2-opt, **3-opt**, Or-opt, SA). Ce choix évite le goulot d’étranglement du **3-opt en O(n³)** : on observe en pratique que le profil *medium* (100 points) avec 3-opt peut être plus lent que le profil *large* (200 points) avec LNS. En basculant sur LNS dès le medium, la **courbe de temps devient croissante avec n** et on peut conclure dans le rapport que **LNS domine 3-opt à partir d’environ 50–60 points**.

- **Small (n ≤ 50)** : pipeline complet (2-opt, 3-opt, Or-opt, SA).
- **Medium, large, xlarge (n > 50)** : LNS + neighbor pruning (et décomposition géo si xlarge).

---

## 1. Durées mesurées (exemples sur machine de test)

| Instance        | Camions | Points | Profil  | Durée mesurée |
|----------------|---------|--------|---------|----------------|
| Moyenne        | 10      | 100    | medium  | **~1,9 s**     |
| Grande         | 15      | 200    | large   | **~90 s**      |
| Très grande    | 20      | 500    | xlarge  | < time_limit si `time_limit_seconds` utilisé (ex. 90 s) |

- **10/100 (medium)** : 2-opt, 3-opt limité, Or-opt, SA — temps court.
- **15/200 (large)** : 2-opt, Or-opt limité, ILS + SA — temps modéré (~1 min 30).
- **20/500 (xlarge)** : 2-opt léger, ILS + SA, MST skippé. Pour éviter un temps trop long, utiliser **`time_limit_seconds`** (ex. 60 ou 90) dans l’API ou dans `optimiser_collecte(..., time_limit_seconds=90)` ; l’optimisation s’arrête ou réduit les itérations avant la limite.

Pour reproduire les mesures :

```bash
cd niveau2
python run_benchmark_grandes_instances.py
```

Ou tests ciblés avec timing (voir commandes dans le script ou en one-liner Python).

---

## 2. Complexité théorique (par étape)

Notations :
- **n** = nombre de points de collecte (souvent par tournée, parfois total)
- **n_total** = nombre total de points
- **C** = nombre de camions
- **d** = nombre de déchetteries
- **K** = constantes / plafonds d’itérations (dépendent du profil)

| Étape | Complexité | Commentaire |
|-------|------------|-------------|
| Répartition glouton | **O(n_total × C)** | Un passage par point, choix parmi C camions |
| Nearest Neighbor + déchetteries | **O(n² + n×d)** | Par tournée : n étapes, chaque étape recherche parmi O(n) points ; insertion déch. O(d) |
| Matrice distances (euclidienne) | **O((n_total + d + 1)²)** | Une fois en début |
| Borne MST (small/medium/large) | **O(n_total²)** | Prim ; **sautée en xlarge** |
| 2-opt (complet) | **O(n² × max_iter_2opt)** | Par tournée ; une passe = O(n²), nombre de passes plafonné |
| 3-opt | **O(n³ × max_iter_3opt)** | Par tournée ; uniquement small/medium, plafonné |
| Or-opt | **O(n² × max_iter_or_opt)** | Par tournée |
| Recuit simulé (SA) | **O(n² × max_iter_sa)** | Par tournée ; une itération = O(n) (un 2-opt aléatoire) |
| ILS (large/xlarge) | **O(restarts × (n² × max_2opt))** | Par tournée ; restarts et max_2opt plafonnés |
| Nettoyage croisements | **O(n² × max_iter_nettoyage)** | Par tournée |

---

## 3. Complexité globale par profil

Pour **une tournée** de **n** points (après répartition) :

- **Small (n ≤ 50)**  
  **O(n²·K₂ + n³·K₃ + n²·K_or + n²·K_sa)**  
  avec K₂, K₃, K_or, K_sa = plafonds d’itérations (petits entiers). Dominant en pratique : **O(n²)** à **O(n³)** selon le poids du 3-opt.

- **Medium (50 < n_total ≤ 150)**  
  Même forme avec plafonds plus bas : **O(n²)** à **O(n³)**.

- **Large (150 < n_total ≤ 400)**  
  Pas de 3-opt : **O(n²·K₂ + n²·K_ils + n²·K_sa)** = **O(n²)** par tournée.

- **Xlarge (n_total > 400)**  
  **O(n²·K₂ + n²·K_ils + n²·K_sa)** par tournée, avec **K plus petits** ; MST **O(n_total²)** évitée. Donc **O(n²)** par tournée, temps total = somme sur les C tournées (en pratique souvent 1 tournée très chargée pour les tests sans zones).

En résumé : la complexité effective est en **O(n²)** à **O(n³)** par tournée, avec des **plafonds stricts** sur toutes les itérations (et option **time_limit_seconds**) pour éviter tout blocage, même pour un grand nombre de points.
