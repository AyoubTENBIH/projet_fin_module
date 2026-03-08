# Documentation des algorithmes – Projet VillePropre / EcoAgadir

Ce document décrit **tous les algorithmes** utilisés dans le projet, **le rôle de chacun**, **la stratégie selon la taille du problème (n)** et **le processus complet** des données d’entrée jusqu’aux résultats.

---

## 1. Vue d’ensemble du système

### 1.1 Objectif

Planifier les **tournées de collecte des déchets** : plusieurs camions partent d’un **dépôt**, visitent des **points de collecte** (volume à collecter), passent par des **déchetteries** lorsque la capacité est atteinte, puis reviennent au dépôt. On vise à **minimiser la distance totale** tout en **respectant les contraintes** (capacité, zones, créneaux).

### 1.2 Entrées typiques

| Paramètre | Description |
|-----------|-------------|
| **Points** | Liste de points de collecte (id, coordonnées x/y ou lat/lng, volume, optionnellement zone_id) |
| **Dépôt** | Un point de départ/retour (souvent id 0) |
| **Déchetteries** | Points de vidage des camions (id, coordonnées) |
| **Camions** | Nombre, capacité (kg), coût fixe, zones accessibles |
| **Zones** | (Optionnel) Regroupements de points, priorité, volume moyen – pour Niveau 2/3 |
| **Créneaux** | (Optionnel) Plages horaires par jour – pour le planning Niveau 3 |

### 1.3 Sorties

- **Routes optimisées** : pour chaque camion, une séquence de waypoints (dépôt → collectes → déchetteries → dépôt).
- **Statistiques** : distance totale, volume collecté, tonnage/km, nombre de visites en déchetterie, gap par rapport à une borne inférieure, stratégie utilisée (small / medium / large / xlarge).
- **Planning** (si Niveau 3) : affectation camion ↔ zone ↔ créneau sur un horizon (ex. 7 jours).

### 1.4 Architecture en trois niveaux

- **Niveau 1** : Graphe routier et **matrice des distances** (Dijkstra ou euclidien selon n).
- **Niveau 2** : **Affectation zones ↔ camions** (graphe biparti, glouton + équilibrage) puis **optimisation des tournées** (construction + amélioration locale + LNS pour grandes n).
- **Niveau 3** : **Planning temporel** (camion ↔ zone ↔ créneau) à partir de l’affectation Niveau 2.

Dans l’application web, l’**optimisation des routes** (Niveau 2 tournées) est celle qui consomme le plus de calcul ; elle adapte automatiquement les algorithmes au **nombre total de points de collecte n**.

---

## 2. Liste des algorithmes et rôle de chacun

### 2.1 Niveau 1 – Calcul des distances

#### 2.1.1 Graphe routier (Dijkstra)

**Rôle** : Modéliser le réseau (sommets = dépôt, points, déchetteries ; arêtes = connexions avec distance) et calculer les **plus courts chemins** entre paires de points.

**Fonctionnement** : Algorithme de **Dijkstra** avec file de priorité (tas min) : à partir d’un sommet, on relaxe les arêtes et on met à jour les distances jusqu’à atteindre la cible (ou tous les sommets pour construire la matrice).

**Utilisation** : Utilisé **uniquement pour les petites instances** (n ≤ 80 sommets). Au-delà, le système bascule sur la matrice euclidienne directe.

**Complexité** : Une exécution Dijkstra **O((V + E) log V)**. Matrice toutes paires : **O(V × (V + E) log V)**.

**Fichier** : `niveau1/src/graphe_routier.py`.

---

#### 2.1.2 Matrice euclidienne directe

**Rôle** : Pour les **grandes instances** (n > 80), éviter Dijkstra en calculant directement la **distance euclidienne** entre chaque paire de points. Plus rapide et évite les blocages.

**Fonctionnement** : Pour tous les points (dépôt + collectes + déchetteries), on remplit une matrice `dist[i][j] = sqrt((xi-xj)² + (yi-yj)²)`.

**Seuil** : `NIVEAU1_FAST_PATH_THRESHOLD = 80` (dans `web_app/backend/api/niveau1_api.py`).

**Complexité** : **O(n²)**.

**Fichier** : `web_app/backend/api/niveau1_api.py` (fonction `calculer_matrice_distances`).

---

### 2.2 Niveau 2 – Affectation zones ↔ camions

#### 2.2.1 Modèle graphe biparti

**Rôle** : Modéliser l’affectation **camions ↔ zones** comme un graphe biparti : une part = camions, l’autre = zones, arêtes = coût d’affectation (distance + manutention + coût fixe).

**Fichier** : `niveau2/src/affectateur_biparti.py`.

---

#### 2.2.2 Affectation gloutonne (zones → camions)

**Rôle** : Déterminer **quelle zone est affectée à quel camion** en minimisant le coût tout en respectant capacité, zones accessibles et zones incompatibles.

**Fonctionnement** :
1. Tri des zones par **priorité** (haute > normale > basse) puis par **volume décroissant**.
2. Pour chaque zone, calcul du **coût** d’affectation à chaque camion (trajet Dépôt → Zone → Déchetterie la plus proche → Dépôt, plus manutention et coût fixe).
3. Affectation de la zone au **camion de coût minimal** qui peut la prendre (capacité, zones accessibles, zones incompatibles).

**Complexité** : **O(Z × C)** où Z = nombre de zones, C = nombre de camions.

**Fichier** : `niveau2/src/affectateur_biparti.py`, méthode `affectation_gloutonne`.

---

#### 2.2.3 Équilibrage des charges

**Rôle** : Rééquilibrer les charges entre camions (éviter qu’un camion soit surchargé et un autre sous-chargé) après l’affectation gloutonne.

**Fonctionnement** : Détection des camions surchargés (> moyenne + 15 %) et sous-chargés (< moyenne − 15 %), puis déplacement de zones entre camions si les contraintes restent respectées. Répété jusqu’à un écart-type acceptable ou blocage.

**Fichier** : `niveau2/src/affectateur_biparti.py`, méthode `equilibrage_charges`.

---

### 2.3 Niveau 2 – Optimisation des tournées (cœur du système)

Cette partie construit les **routes réelles** (séquence de points par camion) à partir des points de collecte et des contraintes. Les algorithmes et leur enchaînement **dépendent du nombre total de points n** (voir section 4).

---

#### 2.3.1 Répartition gloutonne des points entre camions

**Rôle** : Avant de construire les tournées, **assigner chaque point de collecte à un camion** (sans ordre de visite encore).

**Fonctionnement** :
- Points triés par **volume décroissant** (et id en cas d’égalité).
- Pour chaque point, choix du camion qui minimise **coût = distance(dépôt, point) + coût_fixe**, à égalité le camion **le moins chargé** (pour équilibrer).
- Contraintes : **zones_accessibles** (si un point a un zone_id, seuls les camions ayant cette zone sont éligibles).

**Complexité** : **O(P × C)** avec P = points, C = camions.

**Fichier** : `niveau2/src/optimiseur_routes.py`, dans `optimiser_routes()`.

---

#### 2.3.2 Plus proche voisin (Nearest Neighbor) avec déchetteries

**Rôle** : Construire une **première tournée** pour chaque camion : ordre de visite des points et **insertion des passages en déchetterie** quand la charge atteint la capacité.

**Fonctionnement** :
1. Départ au dépôt.
2. Tant qu’il reste des points non visités : aller au **point non visité le plus proche** de la position actuelle ; si la charge actuelle + volume du point dépasse la capacité, insérer une visite à la **déchetterie la plus proche** avant d’ajouter le point ; ajouter le point et mettre à jour la charge.
3. En fin de tournée, si le camion est encore chargé, passage par une déchetterie avant le retour au dépôt.
4. Retour au dépôt.

**Complexité** : **O(n² + n×d)** (n = points du camion, d = déchetteries).

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthode `_nearest_neighbor_avec_dechetteries`.

---

#### 2.3.3 2-opt

**Rôle** : Réduire la **longueur de la tournée** et les **croisements** en inversant des segments de la séquence.

**Fonctionnement** : Pour des paires (i, j) avec i < j, on teste l’**inversion du segment [i, j]**. Si la nouvelle longueur est plus courte, on garde le changement. Répété jusqu’à convergence ou nombre max d’itérations.

**Complexité** : **O(n²)** par itération.

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthodes `_deux_opt`, `_deux_opt_complet`.

---

#### 2.3.4 2-opt avec neighbor pruning

**Rôle** : Accélérer le 2-opt pour les **grandes tournées** en ne testant que les **K plus proches voisins** de chaque point (au lieu de toutes les paires).

**Fonctionnement** : Précalcul des K voisins les plus proches (K = 15 par défaut). Lors du 2-opt, on ne considère que les paires parmi ces voisins, ce qui réduit le coût à **O(n×K)** par itération.

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthodes `_precompute_neighbor_pruning`, `_deux_opt_neighbor_pruning`.

---

#### 2.3.5 3-opt

**Rôle** : Améliorations plus profondes en **coupant la route en trois segments** et en testant des réorganisations (inversions, réordonnancements).

**Fonctionnement** : Choix de trois coupures, test d’un sous-ensemble des réorganisations possibles ; on garde une amélioration dès qu’elle réduit la distance.

**Complexité** : **O(n³)** par itération. Utilisé **uniquement pour les profils small/medium** (voir section 4).

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthode `_trois_opt`.

---

#### 2.3.6 Or-opt

**Rôle** : Déplacer des **séquences de 1, 2 ou 3 points consécutifs** à une autre position pour raccourcir la route.

**Fonctionnement** : Pour des tailles de segment 1, 2 et 3, on extrait un segment et on teste son insertion à chaque autre position ; on accepte si la distance diminue.

**Complexité** : **O(n²)** par itération. Une variante avec neighbor pruning existe pour les grandes instances.

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthodes `_or_opt`, `_or_opt_simple`, `_or_opt_neighbor_pruning`.

---

#### 2.3.7 Recuit simulé (Simulated Annealing)

**Rôle** : **Échapper aux minima locaux** en acceptant parfois des solutions pires avec une probabilité **exp(−Δ/T)** qui décroît avec la température T.

**Fonctionnement** : À chaque itération, génération d’un voisin (ex. 2-opt aléatoire). Si le voisin est meilleur, on l’accepte ; sinon on l’accepte avec probabilité exp(−Δ/T). La température décroît (T = T × α) jusqu’à un minimum.

**Complexité** : **O(max_iter × coût_voisin)** (voisin en O(n) ou O(n²) selon le type de mouvement).

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthode `_simulated_annealing`.

---

#### 2.3.8 Iterated Local Search (ILS)

**Rôle** : Méta-heuristique pour **grandes tournées** : perturbation + recherche locale (2-opt) répétées, avec un **nombre d’itérations borné** pour ne pas bloquer.

**Fonctionnement** : Plusieurs restarts : (1) **perturbation** : un 2-opt aléatoire sur la meilleure solution ; (2) **recherche locale** : 2-opt avec un nombre limité d’itérations. On conserve la meilleure solution trouvée.

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthode `_iterated_local_search`.

---

#### 2.3.9 Large Neighborhood Search (LNS)

**Rôle** : Pour les **grandes instances** (n > 50), remplacer le 2-opt/3-opt/Or-opt coûteux par une recherche dans un **grand voisinage** : on retire 10–30 % des points des routes, puis on les **réinsère** au meilleur endroit (avec neighbor pruning). Permet d’améliorer la solution sans exploser le temps.

**Fonctionnement** :
- À chaque itération : **destroy** = retrait aléatoire de 10–30 % des points de chaque route ; **reconstruct** = réinsertion de chaque point à la position qui minimise le coût (voisins + fallback sur toutes les positions pour ne jamais perdre de points).
- On n’**accepte jamais** une solution qui couvre **moins de points** que la meilleure courante (préservation de la couverture 100 %).
- Recuit simulé pour accepter parfois des solutions pires.

**Complexité** : **O(max_iter × (n × K + n²))** par secteur si réinsertion en O(n) par point.

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthodes `_lns_optimize`, `_lns_destroy_reconstruct`.

---

#### 2.3.10 Décomposition géographique (secteurs)

**Rôle** : Pour les **très grandes instances** (n > 400), découper les points en **secteurs angulaires** autour du dépôt (type « pizza »), optimiser chaque secteur avec LNS, puis regrouper les routes. Évite de faire tourner LNS sur 600+ points d’un coup.

**Fonctionnement** :
- Tri des points par **angle** (atan2) depuis le dépôt.
- Découpe en secteurs de taille cible **N_DECOMPOSITION_SECTOR = 70** points.
- Répartition des **camions** entre secteurs (round-robin).
- Pour chaque secteur : répartition gloutonne des points du secteur entre les camions du secteur, construction NN + déchetteries, puis **LNS** avec délai de temps partagé entre secteurs.

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthodes `_decomposition_geographique`, `_optimize_large_instance`.

---

#### 2.3.11 Insertion des déchetteries et nettoyage des croisements

**Rôle** : Après les améliorations (2-opt, LNS, etc.), les routes sont en « collectes seules » (sans déchetteries). Il faut **réinsérer les déchetteries** aux bons endroits (quand la charge atteint la capacité) et **nettoyer les croisements** introduits par ces insertions.

**Fonctionnement** :
- Parcours de la séquence des points de collecte ; dès que la charge cumulée dépasserait la capacité, insertion d’une visite à la **déchetterie la plus proche** de la position actuelle, puis remise à zéro de la charge.
- Nettoyage par un **2-opt contraint** (qui respecte la capacité entre déchetteries).

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthodes `_reconstruire_route_avec_dechetteries`, `_nettoyer_croisements_avec_dechetteries`, `_nettoyer_croisements_final`.

---

#### 2.3.12 Borne inférieure : arbre couvrant minimal (MST)

**Rôle** : Donner une **borne inférieure** de la distance totale (Prim sur dépôt + points) pour calculer un **gap** (écart en % par rapport à l’optimal théorique). **Désactivée** en profil xlarge pour gagner du temps.

**Fichier** : `niveau2/src/optimiseur_routes.py`, méthode `_calculer_borne_inferieure_mst`.

---

### 2.4 Niveau 3 – Planning temporel

#### 2.4.1 Planificateur triparti (Camion ↔ Zone ↔ Créneau)

**Rôle** : Transformer l’**affectation Niveau 2** (camion ↔ zones) en **planning hebdomadaire** : pour chaque camion, assigner chaque zone à un **créneau horaire** (jour, début, fin) en respectant les contraintes (fenêtres, pauses, zones interdites la nuit).

**Fonctionnement** :
1. Pour chaque (camion, zones affectées), tri des zones par **priorité** puis **volume**.
2. Pour chaque zone, recherche du **meilleur créneau disponible** pour ce camion (sans chevauchement avec les créneaux déjà occupés).
3. Vérification des **contraintes temporelles** (fenêtres de collecte par zone, pauses, zones interdites la nuit).
4. Remplissage du planning jour par jour (lundi, mardi, …).

**Fichier** : `niveau3/src/planificateur_triparti.py`, méthode `generer_plan_optimal`.

---

### 2.5 Affichage carte – OSRM (tracé routier réel)

**Rôle** : Une fois les routes calculées (séquences de waypoints), l’application peut afficher le **tracé le long des routes réelles** via l’API OSRM (Open Source Routing Machine). Pour les longues routes, les waypoints sont **découpés en tronçons** (max 25 par requête) puis les géométries sont **concaténées**. Une **file d’attente** avec délai entre requêtes évite les erreurs 429 (trop de requêtes).

**Fichiers** : `web_app/frontend_react/src/utils/api.js` (`getOsrmRoute`, `getOsrmRouteSegmented`, file OSRM).

---

## 3. Paramètres et seuils selon la taille (n)

Les constantes qui pilotent la stratégie sont dans `niveau2/src/optimiseur_routes.py` :

| Constante | Valeur | Signification |
|-----------|--------|----------------|
| **N_STRATEGY_SMALL** | 50 | n ≤ 50 → profil **small** |
| **N_STRATEGY_MEDIUM** | 150 | n ≤ 150 → profil **medium** |
| **N_STRATEGY_LARGE** | 400 | n ≤ 400 → profil **large** |
| **Au-delà** | — | Profil **xlarge** |
| **K_NEIGHBORS** | 15 | Voisins pour neighbor pruning |
| **N_DECOMPOSITION_SECTOR** | 70 | Taille cible d’un secteur (xlarge) |
| **LNS_DESTROY_MIN / MAX** | 0.10 / 0.30 | Pourcentage de points retirés par LNS |

---

## 4. Stratégie selon le nombre de points (processus détaillé)

### 4.1 Choix du chemin (small / medium / large / xlarge)

- **n ≤ 50 (small)** : Chemin « classique » par camion : répartition gloutonne → Nearest Neighbor + déchetteries → 2-opt → 3-opt → Or-opt → recuit simulé → insertion déchetteries → nettoyage croisements. **Pas de LNS**, pas de décomposition.
- **50 < n ≤ 150 (medium)** : Comme small mais 3-opt limité (petites tournées), plafonds d’itérations réduits.
- **150 < n ≤ 400 (large)** : **LNS + neighbor pruning** (sans décomposition). Plus de 3-opt. Répartition gloutonne initiale puis LNS sur toutes les routes, puis 2-opt neighbor pruning final et insertion déchetteries.
- **n > 400 (xlarge)** : **Décomposition géographique** + LNS + neighbor pruning. Les points sont découpés en secteurs (~70 points par secteur), chaque secteur est optimisé par LNS (avec partage du temps limite entre secteurs), puis les routes sont fusionnées, 2-opt neighbor pruning final, insertion déchetteries.

### 4.2 Limite de temps (time_limit_seconds)

Si l’API reçoit un **time_limit_seconds** (ex. 50 s pour n > 200) :
- À l’approche de 95 % du budget, les plafonds d’itérations (2-opt, 3-opt, Or-opt, SA) sont **réduits** et les étapes les plus lourdes peuvent être **sautées** pour garantir une réponse à temps.

### 4.3 Tableau récapitulatif des profils (stratégie hybride)

| Profil | n total | 3-opt | Or-opt | ILS | LNS | Décomposition | MST |
|--------|---------|-------|--------|-----|-----|----------------|-----|
| **small** | ≤ 50 | Oui | Oui | Non | Non | Non | Oui |
| **medium** | ≤ 150 | Limité | Oui | Non | Non | Non | Oui |
| **large** | ≤ 400 | Non | Limité | Si tournée > 80 pts | Oui | Non | Oui |
| **xlarge** | > 400 | Non | Non | Oui | Oui | Oui (secteurs) | Non |

---

## 5. Exemple de processus complet : 612 points, 21 camions

### 5.1 Entrées

- **612 points** de collecte (coordonnées, volume 800 kg par point par exemple).
- **1 dépôt**, **quelques déchetteries**.
- **21 camions**, capacité 5000 kg chacun.
- **Pas de zones** (ou zones avec zone_id sur les points) ; **zones_accessibles** vides = tous les points assignables à tous les camions.

### 5.2 Étapes exécutées

1. **Niveau 1 (distances)** : n > 80 → **matrice euclidienne directe** O(n²), pas de Dijkstra.
2. **Répartition gloutonne** : les 612 points sont répartis entre les 21 camions (coût = distance + coût fixe, à égalité camion le moins chargé). Résultat : chaque camion a une liste de points (environ 29 points par camion).
3. **Profil** : n = 612 > 400 → **xlarge**.
4. **Décomposition** : les 612 points sont triés par angle autour du dépôt et découpés en **secteurs** (environ 9 secteurs de ~68 points). Les 21 camions sont répartis en round-robin sur les secteurs (2 ou 3 camions par secteur).
5. **Par secteur** :
   - Répartition gloutonne des points du secteur entre les camions du secteur.
   - Pour chaque camion du secteur : construction d’une route par **Nearest Neighbor** avec déchetteries (séquence « collectes seules » pour le LNS).
   - **LNS** : destroy 10–30 % des points, reconstruct (réinsertion avec neighbor pruning + fallback pour ne jamais perdre de points), acceptation uniquement si le nombre de points couverts ne diminue pas. Répété jusqu’à la limite de temps allouée au secteur.
   - Les routes du secteur sont ajoutées au lot global.
6. **Post-traitement global** : pour chaque route, **2-opt neighbor pruning** (nettoyage), puis **réinsertion des déchetteries** et **nettoyage des croisements**.
7. **Sortie** : 21 routes (une par camion), chacune avec une séquence complète dépôt → collectes → déchetteries → dépôt.

### 5.3 Résultats typiques

- **Distance totale** : ex. ~276 km.
- **Volume total collecté** : 612 × 800 = 489 600 kg (ou selon volumes réels).
- **Points visités** : 612/612 = **100 %** (grâce à la préservation de la couverture dans le LNS et au fallback de réinsertion).
- **Occupation des créneaux / parc** : selon le planning Niveau 3 si utilisé.
- **Statistiques** : `strategie_optimisation: "xlarge"`, `technique_grande_instance: "LNS+decomposition+neighbor_pruning"`, `nb_iterations_lns` (ex. 90 000), gap MST non calculé (xlarge).

---

## 6. Résultats et indicateurs fournis

Le système renvoie notamment :

| Indicateur | Description |
|------------|-------------|
| **distance_totale** | Somme des distances de toutes les routes (km) |
| **volume_total_collecte** | Somme des volumes collectés (kg) |
| **nb_camions_utilises** | Nombre de routes générées |
| **nb_total_visites_dechetteries** | Nombre de passages en déchetterie |
| **distance_moyenne_par_camion** | distance_totale / nb_camions |
| **tonnage_par_km_par_camion** | (volume/1000) / distance par route |
| **moyenne_tonnage_par_km** | Efficacité moyenne (tonnes/km) |
| **borne_inferieure_km** | Longueur MST (small/medium/large) |
| **gap_pourcent** | (distance_totale - borne) / borne × 100 |
| **strategie_optimisation** | small | medium | large | xlarge |
| **technique_grande_instance** | Ex. "LNS+decomposition+neighbor_pruning" |
| **nb_iterations_lns** | Nombre d’itérations LNS (si applicable) |
| **optimisation_2opt** | Croisements avant/après et % d’élimination |

---

## 7. Garanties et limites

- **Pas de blocage** : Toutes les boucles sont bornées (max_iter, time_limit). Aucune boucle infinie.
- **Couverture** : Le LNS n’accepte jamais une solution avec **moins de points** que la meilleure courante ; la réinsertion utilise un fallback sur toutes les positions pour ne pas perdre de points. On vise **100 % de points visités**.
- **Optimalité** : Le problème (CVRP avec déchetteries) est **NP-difficile**. Les algorithmes fournissent des **solutions approchées de bonne qualité** en temps raisonnable, pas une solution exacte garantie.
- **OSRM** : L’affichage « tracé réel » dépend du service OSRM public (rate limits, timeouts). En cas d’échec, la carte affiche des **lignes droites** entre waypoints.

---

## 8. Fichiers principaux par algorithme

| Algorithme / module | Fichier(s) |
|---------------------|------------|
| Graphe, Dijkstra | `niveau1/src/graphe_routier.py` |
| Matrice euclidienne, seuil 80 | `web_app/backend/api/niveau1_api.py` |
| Affectation zones ↔ camions | `niveau2/src/affectateur_biparti.py` |
| Répartition points, NN, 2/3-opt, Or-opt, SA, ILS, LNS, décomposition, déchetteries, MST | `niveau2/src/optimiseur_routes.py` |
| Stratégie (profils) | `niveau2/src/optimiseur_routes.py` (`_get_optimisation_strategy`) |
| Planning créneaux | `niveau3/src/planificateur_triparti.py` |
| Tracé OSRM (carte) | `web_app/frontend_react/src/utils/api.js` |

---

Ce document constitue le **rapport complet et clair** des algorithmes du projet : rôle de chacun, paramètres selon n, et processus de bout en bout (ex. 612 points → xlarge → LNS + décomposition → 100 % de couverture et statistiques).
