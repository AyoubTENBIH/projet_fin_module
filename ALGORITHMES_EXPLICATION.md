# Explication des Algorithmes Principaux du Projet VillePropre

## Vue d'ensemble

Ce projet est organisé en trois modules principaux qui travaillent ensemble pour optimiser la collecte des déchets :
- **Niveau 1** : Calcul des plus courts chemins dans le réseau routier
- **Niveau 2** : Affectation optimale des zones aux camions
- **Web App** : Interface de visualisation et simulation

---

## 📍 NIVEAU 1 : Calcul des Plus Courts Chemins

### Algorithme Principal : **Dijkstra**

**Fichier** : `niveau1/src/graphe_routier.py`

#### Rôle dans le projet
Le niveau 1 modélise le réseau routier comme un **graphe non orienté pondéré** où :
- **Sommets** = Points de collecte (dépôt + zones)
- **Arêtes** = Routes/connexions entre les points
- **Poids** = Distance entre deux points

#### Fonctionnement de l'algorithme de Dijkstra

```python
def plus_court_chemin(self, depart: int, arrivee: int) -> tuple:
```

**Principe** :
1. Initialise les distances à l'infini sauf le départ (distance = 0)
2. Utilise une **file de priorité (heap)** pour explorer les sommets par distance croissante
3. Pour chaque sommet visité, met à jour les distances de ses voisins
4. S'arrête quand le sommet d'arrivée est atteint
5. Reconstruit le chemin optimal en remontant les prédécesseurs

**Complexité** : O((V + E) log V) où V = nombre de sommets, E = nombre d'arêtes

#### Calcul de la Matrice des Distances

```python
def matrice_distances(self) -> list:
```

**Rôle** : Calcule la distance entre **toutes les paires** de points en utilisant Dijkstra pour chaque paire.

**Utilisation** :
- Permet au niveau 2 de connaître rapidement la distance entre n'importe quels points
- Utilisé pour calculer les coûts d'affectation camion-zone

#### Distance Euclidienne

Quand une connexion n'a pas de distance explicite, le système calcule automatiquement la distance euclidienne :
```
distance = √((x₂ - x₁)² + (y₂ - y₁)²)
```

---

## 🚛 NIVEAU 2 : Affectation Optimale Zones ↔ Camions

### Algorithme Principal : **Algorithme Glouton (Greedy)**

**Fichier** : `niveau2/src/affectateur_biparti.py`

#### Rôle dans le projet
Le niveau 2 résout le problème d'**affectation optimale** : quelles zones doivent être assignées à quels camions pour minimiser les coûts tout en respectant les contraintes.

#### Modélisation par Graphe Biparti

Le problème est modélisé comme un **graphe biparti** :
- **Partie gauche** : Camions
- **Partie droite** : Zones
- **Arêtes** : Coût d'affectation d'un camion à une zone (si le camion peut accéder à la zone)

#### Fonctionnement de l'Algorithme Glouton

```python
def affectation_gloutonne(self) -> dict:
```

**Étapes** :

1. **Tri des zones par priorité** :
   - Zones à priorité "haute" en premier
   - Puis zones à priorité "normale"
   - Puis zones à priorité "basse"
   - À priorité égale, tri par volume décroissant

2. **Pour chaque zone (dans l'ordre trié)** :
   - Trouve tous les camions candidats qui peuvent :
     - Accéder à la zone (`peut_acceder_zone`)
     - Prendre le volume sans dépasser leur capacité (`peut_prendre_volume`)
     - Ne pas violer les contraintes de zones incompatibles
   
   - Calcule le coût d'affectation pour chaque candidat
   - **Sélectionne le camion avec le coût minimal**
   - Affecte la zone à ce camion

**Formule de coût** :
```
coût = (distance_dépôt_centre × 2 × 0.5€/km) + (volume_zone × 0.1€/kg) + coût_fixe_camion
```

**Complexité** : O(Z × C × log C) où Z = nombre de zones, C = nombre de camions

#### Vérification des Contraintes

```python
def verifier_contraintes(self, affectation: dict) -> bool:
```

Vérifie trois types de contraintes :
1. **Capacité** : La charge totale d'un camion ne dépasse pas sa capacité
2. **Accessibilité** : Un camion ne peut être affecté qu'aux zones qu'il peut desservir
3. **Zones incompatibles** : Deux zones incompatibles ne peuvent pas être sur le même camion

#### Équilibrage des Charges

```python
def equilibrage_charges(self, affectation: dict) -> dict:
```

**Rôle** : Rééquilibre les charges entre camions pour éviter les surcharges et sous-charges.

**Algorithme itératif** :
1. Calcule la charge moyenne et l'écart-type
2. Identifie les camions :
   - **Surchargés** : charge > moyenne × 1.15
   - **Sous-chargés** : charge < moyenne × 0.85
3. Pour chaque camion surchargé :
   - Essaie de déplacer une zone vers un camion sous-chargé
   - Vérifie que le déplacement respecte toutes les contraintes
4. Répète jusqu'à :
   - Écart-type < 20% de la moyenne, OU
   - Aucun déplacement possible, OU
   - Maximum 100 itérations atteint

**Objectif** : Réduire la variance des charges pour une meilleure répartition du travail.

---

## 🚀 OPTIMISATION AVANCÉE : Routes avec Déchetteries

### Module : **OptimiseurRoutes**

**Fichier** : `niveau2/src/optimiseur_routes.py`

#### Rôle dans le projet
Ce module résout le **Problème de Tournées de Véhicules avec Installations Intermédiaires (VRPIF)** :
- Les camions collectent les déchets aux points de collecte
- Quand leur capacité est atteinte, ils se rendent à la **déchetterie la plus proche** pour décharger
- Ils continuent leur collecte jusqu'à avoir visité tous leurs points
- Finalement, ils retournent au dépôt

#### Flux complet d'un camion :
```
Dépôt → Collecte₁ → Collecte₂ → ... → Déchetterie → Collecte₃ → ... → Déchetterie → Dépôt
```

---

### Algorithme 1 : **Nearest Neighbor (Plus Proche Voisin)**

```python
def _nearest_neighbor_avec_dechetteries(self, points_a_visiter, capacite):
```

**Rôle** : Construire une route initiale en visitant toujours le point le plus proche.

**Fonctionnement** :
1. **Démarrer** au dépôt
2. **Répéter** jusqu'à ce que tous les points soient visités :
   - Trouver le point non visité le plus proche
   - Si `charge_actuelle + volume_point > capacité` :
     - Aller à la **déchetterie la plus proche** pour vider
     - Remettre la charge à zéro
   - Visiter le point et ajouter son volume à la charge
3. **Retourner** au dépôt (via une déchetterie si encore chargé)

**Complexité** : O(n²) où n = nombre de points

**Avantage** : Simple et rapide, donne une bonne solution initiale.

---

### Algorithme 2 : **2-opt Local Search**

```python
def _deux_opt(self, route, max_iterations=100):
```

**Rôle** : Améliorer une route en inversant des segments pour réduire la distance.

**Principe du 2-opt** :
Le 2-opt cherche à "décroiser" la route en échangeant des arêtes.

```
Avant 2-opt:          Après 2-opt:
    A---B                  A   B
     \ /                    \ /
      X     devient          |
     / \                    / \
    C---D                  C   D
```

**Fonctionnement** :
1. Pour chaque paire de positions (i, j) dans la route :
   - Calculer le **gain** d'inverser le segment [i, j]
   - Gain = `(d(i-1,i) + d(j,j+1)) - (d(i-1,j) + d(i,j+1))`
   - Si gain > 0 : inverser le segment
2. Répéter jusqu'à ce qu'aucune amélioration ne soit possible

**Complexité** : O(n²) par itération, O(n³) au total

**Contrainte importante** : L'inversion doit préserver la validité de la capacité (les déchetteries doivent rester après les collectes qu'elles déchargent).

---

### Algorithme 3 : **Or-opt**

```python
def _or_opt(self, route, max_iterations=50):
```

**Rôle** : Compléter le 2-opt en déplaçant des séquences de 1 à 3 points consécutifs.

**Fonctionnement** :
1. Pour chaque segment de 1, 2 ou 3 points consécutifs :
   - Essayer de le déplacer à une autre position dans la route
   - Si le coût total diminue : effectuer le déplacement
2. Répéter jusqu'à aucune amélioration

**Exemple** :
```
Avant: A → B → C → D → E
Si B-C est plus efficace après D:
Après: A → D → B → C → E
```

**Complexité** : O(n²) par itération

---

### Algorithme 4 : **Insertion Intelligente des Déchetteries**

```python
def _trouver_dechetterie_plus_proche(self, point):
def _reconstruire_route_avec_dechetteries(self, route, capacite):
```

**Rôle** : Placer les visites aux déchetteries de manière optimale.

**Stratégie** :
1. **Sélection dynamique** : À chaque moment où le camion doit décharger, choisir la déchetterie qui minimise le détour total.

2. **Critère de choix** entre deux déchetteries :
   ```
   Coût déchetterie A = distance(position → A) + distance(A → prochain_point)
   Coût déchetterie B = distance(position → B) + distance(B → prochain_point)
   ```
   Choisir celle avec le coût le plus faible.

3. **Reconstruction post-optimisation** :
   Après le 2-opt, les déchetteries peuvent être mal placées.
   On les repositionne pour minimiser les détours.

**Complexité** : O(n × d) où d = nombre de déchetteries

---

### Pipeline d'Optimisation Complet

```python
def optimiser_routes(self):
```

**Étapes** :
1. **Répartition** : Distribuer les points entre les camions (glouton)
2. **Construction** : Nearest Neighbor pour chaque camion
3. **Amélioration 1** : 2-opt pour réduire les croisements
4. **Amélioration 2** : Or-opt pour optimiser les séquences
5. **Reconstruction** : Replacer les déchetteries optimalement

**Visualisation du processus** :
```
Points bruts    →    Route initiale    →    Après 2-opt
   •  •                   Dépôt              Dépôt
 • • •  •           ↙️ ↗️ ↘️ ↙️         ↓
  •   •               Route croisée        Route optimale
   •                                         ↓
                                           Déchetterie
                                             ↓
                                           Dépôt
```

---

### Complexité Totale de l'Optimisation

| Étape | Algorithme | Complexité |
|-------|-----------|------------|
| Répartition | Glouton | O(P × C) |
| Construction | Nearest Neighbor | O(P²) |
| Amélioration | 2-opt | O(P³) |
| Amélioration | Or-opt | O(P²) |
| Reconstruction | Insertion déchetteries | O(P × D) |

Où P = points, C = camions, D = déchetteries

**Complexité globale** : O(P³) dominée par le 2-opt

---

## 🌐 WEB APP : Visualisation et Simulation

### Algorithmes de Visualisation

**Fichiers** : `web_app/frontend/js/map.js`, `simulation.js`, `presentation.js`

#### Rôle dans le projet
L'application web permet de :
- Visualiser le réseau routier et les zones sur une carte interactive
- Simuler les trajets des camions en temps réel
- Présenter les résultats de manière graphique

#### Simulation des Trajets

**Algorithme de simulation** (`simulation.js`) :
1. Utilise les **chemins calculés par le niveau 1** pour déterminer les routes
2. Anime les camions le long des chemins optimaux
3. Met à jour les statuts des points (en attente → en cours → collecté)
4. Affiche la charge actuelle de chaque camion

**Fonctionnement** :
- Pour chaque camion, parcourt sa liste de zones affectées
- Utilise `trouverChemin()` pour obtenir le chemin optimal entre deux points
- Anime le marqueur du camion le long du chemin avec des points intermédiaires

#### Calcul des Statistiques

Le système calcule automatiquement :
- Nombre de camions utilisés
- Charge moyenne et écart-type
- Zones non affectées
- Coût total estimé
- Taux d'utilisation moyen des camions

---

## 🔄 Flux de Données et Interactions

### Séquence d'exécution

```
1. NIVEAU 1
   ├─ Charge le graphe routier (points + connexions)
   ├─ Calcule matrice des distances (Dijkstra pour toutes paires)
   └─ Sauvegarde chemins optimaux

2. NIVEAU 2
   ├─ Charge le graphe du niveau 1
   ├─ Charge camions et zones
   ├─ Calcule coûts d'affectation (utilise distances du niveau 1)
   ├─ Affectation gloutonne
   ├─ Vérification contraintes
   ├─ Équilibrage des charges
   └─ Génère statistiques et graphe biparti

3. WEB APP
   ├─ Charge résultats niveau 1 et niveau 2
   ├─ Affiche carte interactive
   ├─ Simule trajets des camions
   └─ Présente statistiques visuelles
```

### Dépendances

- **Niveau 2 dépend du Niveau 1** : Utilise le graphe routier pour calculer les distances
- **Web App dépend des deux niveaux** : Visualise les résultats des deux niveaux

---

## 📊 Complexité Globale

| Module | Algorithme | Complexité Temporelle | Complexité Spatiale |
|--------|-----------|---------------------|---------------------|
| Niveau 1 - Dijkstra | Dijkstra (une paire) | O((V + E) log V) | O(V + E) |
| Niveau 1 - Matrice | Dijkstra (toutes paires) | O(V × (V + E) log V) | O(V²) |
| Niveau 2 - Glouton | Algorithme glouton | O(Z × C × log C) | O(Z × C) |
| Niveau 2 - Équilibrage | Itératif | O(100 × Z × C) | O(Z × C) |
| Routes - Nearest Neighbor | Plus proche voisin | O(P²) | O(P) |
| Routes - 2-opt | Recherche locale | O(P³) | O(P) |
| Routes - Or-opt | Déplacement séquences | O(P²) | O(P) |
| Routes - Déchetteries | Insertion intelligente | O(P × D) | O(D) |

Où :
- **V** = Nombre de sommets (points de collecte)
- **E** = Nombre d'arêtes (connexions)
- **Z** = Nombre de zones
- **C** = Nombre de camions
- **P** = Nombre de points à visiter
- **D** = Nombre de déchetteries

---

## 🎯 Points Clés des Algorithmes

### Pourquoi Dijkstra ?
- **Optimal** : Garantit le plus court chemin dans un graphe avec poids positifs
- **Efficace** : Utilise une file de priorité pour explorer les sommets de manière optimale
- **Standard** : Algorithme classique et bien compris pour les problèmes de routage

### Pourquoi Algorithme Glouton ?
- **Rapide** : Complexité polynomiale, beaucoup plus rapide qu'une solution exhaustive
- **Pratique** : Donne de bons résultats pour des problèmes d'affectation avec contraintes
- **Heuristique** : Bien adapté aux problèmes d'optimisation combinatoire où une solution exacte serait trop coûteuse

### Pourquoi Équilibrage Itératif ?
- **Amélioration progressive** : Améliore la solution gloutonne initiale
- **Contraintes respectées** : Vérifie toutes les contraintes à chaque déplacement
- **Arrêt garanti** : Limite d'itérations empêche les boucles infinies

---

## 📝 Résumé

Le projet utilise une **approche en trois niveaux** :

1. **Niveau 1** résout le problème de **routage** (comment aller d'un point à un autre)
2. **Niveau 2** résout le problème d'**affectation** (qui fait quoi)
3. **Optimisation Avancée** résout le problème de **tournées avec déchetteries** (comment optimiser le circuit complet)

### Algorithmes utilisés :

| Problème | Algorithme | Type |
|----------|-----------|------|
| Plus courts chemins | **Dijkstra** | Exact |
| Affectation zones-camions | **Glouton** | Heuristique |
| Équilibrage des charges | **Itératif** | Amélioration |
| Construction de routes | **Nearest Neighbor** | Heuristique |
| Optimisation de routes | **2-opt** | Recherche locale |
| Optimisation de routes | **Or-opt** | Recherche locale |
| Placement des déchetteries | **Insertion intelligente** | Heuristique |

### Caractéristiques du système :

✅ **Gestion automatique de la capacité** : Les camions vont automatiquement à la déchetterie quand ils sont pleins

✅ **Choix intelligent des déchetteries** : Le système choisit toujours la déchetterie qui minimise le détour

✅ **Optimisation multi-étapes** : Construction → 2-opt → Or-opt → Reconstruction

✅ **Respect des contraintes** : Capacité, accessibilité, zones incompatibles

✅ **Routes réelles (OSRM)** : Utilisation des routes réelles via l'API OpenStreetMap

Cette combinaison d'algorithmes permet de résoudre efficacement le problème complexe de **Vehicle Routing Problem with Intermediate Facilities (VRPIF)**, un cas particulier du VRP où les véhicules doivent visiter des installations intermédiaires (déchetteries) pour décharger avant de continuer leur tournée.
