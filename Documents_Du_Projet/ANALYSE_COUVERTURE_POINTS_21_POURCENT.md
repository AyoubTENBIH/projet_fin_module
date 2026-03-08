# Analyse : Points visités 21 % (126/612) au lieu de 100 %

## Contexte

- **Données** : 612 points de collecte (export `villepropre-export-2026-03-07-1772921048550.json`), 21 camions, capacité 5000 kg, technique « LNS+decomposition+neighbor_pruning », 90000 itérations LNS.
- **Constats** : Occupation créneaux 100 %, parc 100 %, respect contraintes 100 %, mais **seulement 126 points visités sur 612 (21 %)**.

## Cause identifiée : perte de points dans le LNS (grandes instances)

La cause **ne vient pas** des contraintes, du timeout seul, ni de la sélection des zones (tous les points ont `zone_id: null` et sont assignables).

Elle vient de **l’algorithme LNS (Large Neighborhood Search)** utilisé pour les grandes instances (n > 400) :

1. **Décomposition géographique**  
   Avec 612 points, le profil est « xlarge » : les points sont découpés en secteurs (≈ 9 secteurs × ~68 points), chaque secteur est optimisé par LNS avec un sous-ensemble de camions.

2. **Phase destroy/reconstruct du LNS**  
   À chaque itération, le LNS :
   - retire 10–30 % des points des routes (destroy),
   - réinsère ces points via `_lns_destroy_reconstruct` (reconstruct).

3. **Perte de points à la réinsertion**  
   Dans `_lns_destroy_reconstruct` :
   - seules certaines positions sont testées (voisins + début/fin de route),
   - la capacité est vérifiée de façon trop grossière (`volume total de la route + point > capacité`), alors qu’une route avec plusieurs passages en déchetterie peut avoir un volume total bien supérieur à la capacité.
   - Si aucune position trouvée n’est valide, **le point n’est pas réinséré** et est en pratique perdu.

4. **Acceptation de solutions dégradées**  
   Dans `_lns_optimize`, une solution `current` est acceptée si :
   - `delta <= 0` (meilleure ou égale en coût), ou
   - recuit simulé : `random() < exp(-delta / T)`  
   Une solution avec **moins de points** a un **coût plus faible** (moins de kilomètres). Le LNS peut donc accepter une solution qui a **perdu des points** parce qu’elle est « meilleure » en distance, sans aucune pénalité sur la couverture.

Résultat : après beaucoup d’itérations (ex. 90 000), la solution retenue peut ne contenir qu’une fraction des points (ex. 126/612), d’où **21 % de points visités**.

## Rôle du timeout

- Le timeout (ex. 50–72 s pour 612 points) limite le temps par secteur en décomposition.
- Ce n’est pas la cause première : même avec plus de temps, tant que le LNS peut accepter des solutions avec moins de points, la couverture peut rester partielle.
- Le vrai correctif est de **ne jamais accepter une solution qui couvre moins de points**.

## Rôle des zones / contraintes

- Dans l’export, tous les points ont `zone_id: null` → aucun filtrage par `zones_accessibles`.
- Les 612 points sont bien envoyés à l’optimiseur et répartis entre camions/secteurs.
- Donc le problème n’est pas la sélection des zones ni les contraintes métier, mais bien la **préservation de la couverture** dans le LNS.

## Corrections apportées (dans l’optimiseur)

1. **Préserver la couverture dans le LNS**  
   Dans `_lns_optimize` : n’accepter une nouvelle solution que si elle contient **au moins autant de points** que la meilleure solution courante. Ainsi, une solution qui a « perdu » des points n’est jamais retenue.

2. **Réinsertion plus robuste**  
   Dans `_lns_destroy_reconstruct` :
   - si la réinsertion par voisins échoue pour un point, **fallback** : essayer toutes les routes et toutes les positions (pas seulement les voisins), pour ne jamais laisser un point non réinséré tant qu’une position existe.
   - les routes en entrée du LNS sont en format « collectes seulement » (sans déchetteries) ; le volume total d’une route peut donc dépasser la capacité, les déchetteries étant réinsérées plus tard par `_reconstruire_route_avec_dechetteries`. On ne refuse plus une route pour cause de volume total dans la phase reconstruct, ce qui évite de perdre des points à tort.

Ainsi, on évite de perdre des points lors du destroy/reconstruct et on n’accepte plus de solutions sous-couvrantes, ce qui doit ramener **Points visités** à 100 % (ou au moins à la couverture maximale possible sous contraintes de capacité).
