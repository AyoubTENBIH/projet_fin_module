# -*- coding: utf-8 -*-
"""
Module OptimiseurRoutes - Niveau 2 VillePropre
Optimisation intelligente des routes de collecte avec insertion automatique des déchetteries.

Algorithmes implémentés :
1. Nearest Neighbor (Plus Proche Voisin) - Construction initiale des routes
2. 2-opt Local Search - Amélioration des routes
3. Insertion Intelligente des Déchetteries - Gestion de la capacité des camions
4. Clarke-Wright Savings - Pour le regroupement des points

Complexité :
- Nearest Neighbor : O(n²) où n = nombre de points
- 2-opt : O(n²) par itération, O(n³) au total dans le pire cas
- Insertion Déchetterie : O(d) où d = nombre de déchetteries
"""

import math
import os
import time
import random as _random
from copy import deepcopy
from typing import List, Tuple, Dict, Optional

# Debug couverture : COVERAGE_DEBUG=1 (env) ou activé via optimiser_collecte(..., debug_coverage=True)
_COVERAGE_DEBUG_ENV = os.environ.get("COVERAGE_DEBUG", "").strip().lower() in ("1", "true", "yes")
_DEBUG_COVERAGE_THIS_RUN = False  # mis à True par optimiser_collecte si debug_coverage=True


def _debug(msg: str, *args) -> None:
    if _COVERAGE_DEBUG_ENV or _DEBUG_COVERAGE_THIS_RUN:
        print("[COVERAGE_DEBUG]", msg, *args)

# Seuils pour la stratégie hybride (nombre total de points de collecte)
N_STRATEGY_SMALL = 50   # petit : algorithme complet (2-opt, 3-opt, Or-opt, SA)
N_STRATEGY_MEDIUM = 150 # moyen : 2-opt + Or-opt + SA, 3-opt limité
N_STRATEGY_LARGE = 400  # grand : LNS + neighbor pruning
# au-delà : xlarge = décomposition géo + LNS + neighbor pruning

# Grandes instances : neighbor pruning et LNS
K_NEIGHBORS = 15  # nombre de voisins les plus proches par point (O(n²) -> O(n×K))
LNS_DESTROY_MIN = 0.10  # retirer au moins 10% des points
LNS_DESTROY_MAX = 0.30  # au plus 30%
LNS_T_INITIAL = 50.0
LNS_ALPHA = 0.97
N_DECOMPOSITION_SECTOR = 70  # ~60-80 points par secteur (xlarge)


class Point:
    """Représente un point (collecte, déchetterie ou dépôt)."""
    
    def __init__(self, id: int, x: float, y: float, nom: str = "", 
                 volume: float = 0, type_point: str = "collecte"):
        self.id = id
        self.x = x
        self.y = y
        self.nom = nom
        self.volume = volume  # Volume à collecter (0 pour dépôt/déchetterie)
        self.type_point = type_point  # "depot", "collecte", "dechetterie"
    
    def distance_vers(self, autre: 'Point') -> float:
        """Calcule la distance euclidienne vers un autre point."""
        return math.sqrt((self.x - autre.x)**2 + (self.y - autre.y)**2)
    
    def __repr__(self):
        return f"Point({self.id}, {self.type_point}, vol={self.volume})"


class SegmentRoute:
    """Représente un segment de route entre deux points clés (collectes, déchetteries)."""
    
    def __init__(self, depart: Point, arrivee: Point, points_intermediaires: List[Point] = None):
        self.depart = depart
        self.arrivee = arrivee
        self.points_intermediaires = points_intermediaires or []
        self.distance = depart.distance_vers(arrivee)
        self.volume_collecte = sum(p.volume for p in self.points_intermediaires)


class RouteOptimisee:
    """Représente une route optimisée pour un camion avec visites aux déchetteries."""
    
    def __init__(self, camion_id: int, capacite: float):
        self.camion_id = camion_id
        self.capacite = capacite
        self.waypoints: List[Point] = []  # Séquence de tous les points à visiter
        self.segments: List[SegmentRoute] = []
        self.distance_totale = 0.0
        self.volume_total_collecte = 0.0
        self.nb_visites_dechetterie = 0
        self.details_etapes: List[Dict] = []  # Détails de chaque étape
        # Statistiques des croisements (pour validation 2-opt)
        self.croisements_avant = 0
        self.croisements_apres = 0
    
    def ajouter_waypoint(self, point: Point):
        """Ajoute un point au parcours."""
        self.waypoints.append(point)
        if point.type_point == "collecte":
            self.volume_total_collecte += point.volume
        elif point.type_point == "dechetterie":
            self.nb_visites_dechetterie += 1
    
    def calculer_distance_totale(self) -> float:
        """Calcule la distance totale de la route."""
        if len(self.waypoints) < 2:
            return 0.0
        
        distance = 0.0
        for i in range(len(self.waypoints) - 1):
            distance += self.waypoints[i].distance_vers(self.waypoints[i + 1])
        
        self.distance_totale = distance
        return distance
    
    def generer_details_etapes(self):
        """Génère les détails de chaque étape du parcours."""
        self.details_etapes = []
        charge_actuelle = 0.0
        
        for i, point in enumerate(self.waypoints):
            etape = {
                "ordre": i,
                "point_id": point.id,
                "point_nom": point.nom,
                "type": point.type_point,
                "x": point.x,
                "y": point.y,
                "action": "",
                "volume_action": 0,
                "charge_apres": 0
            }
            
            if point.type_point == "depot":
                if i == 0:
                    etape["action"] = "DEPART"
                else:
                    etape["action"] = "RETOUR"
                etape["charge_apres"] = charge_actuelle
            
            elif point.type_point == "collecte":
                etape["action"] = "COLLECTE"
                etape["volume_action"] = point.volume
                charge_actuelle += point.volume
                etape["charge_apres"] = charge_actuelle
            
            elif point.type_point == "dechetterie":
                etape["action"] = "DECHARGE"
                etape["volume_action"] = charge_actuelle
                charge_actuelle = 0
                etape["charge_apres"] = charge_actuelle
            
            self.details_etapes.append(etape)
    
    def to_dict(self) -> Dict:
        """Convertit la route en dictionnaire pour l'API."""
        self.calculer_distance_totale()
        self.generer_details_etapes()
        # Tonnage transporté par kilomètre (tonnes/km) : volume en kg -> tonnes, divisé par distance
        tonnage_par_km = (self.volume_total_collecte / 1000.0) / self.distance_totale if self.distance_totale > 0 else 0.0

        return {
            "camion_id": self.camion_id,
            "capacite": self.capacite,
            "waypoints": [
                {
                    "id": p.id,
                    "x": p.x,
                    "y": p.y,
                    "nom": p.nom,
                    "type": p.type_point,
                    "volume": p.volume
                }
                for p in self.waypoints
            ],
            "distance_totale": round(self.distance_totale, 2),
            "volume_total_collecte": round(self.volume_total_collecte, 2),
            "tonnage_par_km": round(tonnage_par_km, 4),
            "nb_visites_dechetterie": self.nb_visites_dechetterie,
            "details_etapes": self.details_etapes,
            "optimisation_2opt": {
                "croisements_avant": self.croisements_avant,
                "croisements_apres": self.croisements_apres,
                "croisements_elimines": self.croisements_avant - self.croisements_apres
            }
        }


class OptimiseurRoutes:
    """
    Optimiseur de routes de collecte avec gestion intelligente des déchetteries.
    
    Stratégie d'optimisation :
    1. Construction initiale par Nearest Neighbor avec insertion des déchetteries
    2. Amélioration par 2-opt local search
    3. Rééquilibrage des routes si nécessaire
    """
    
    def __init__(self, depot: Point, points_collecte: List[Point], 
                 dechetteries: List[Point], camions: List[Dict],
                 matrice_osrm: Optional[Dict[Tuple[int, int], float]] = None,
                 time_limit_seconds: Optional[float] = None):
        """
        Initialise l'optimiseur.
        
        Args:
            depot: Point de départ/retour des camions
            points_collecte: Liste des points de collecte à desservir
            dechetteries: Liste des déchetteries disponibles
            camions: Liste des camions [{id, capacite, cout_fixe, zones_accessibles}]
            matrice_osrm: Matrice {(id1, id2): distance_km} OSRM (optionnel)
            time_limit_seconds: Limite de temps globale (optionnel). Au-delà, les
                améliorations restantes sont raccourcies pour éviter tout blocage.
        """
        self.depot = depot
        self.points_collecte = points_collecte
        self.dechetteries = dechetteries
        self.camions = camions
        self.use_osrm = matrice_osrm is not None
        self.time_limit_seconds = time_limit_seconds
        
        # Matrice de distances: OSRM si fourni, sinon euclidienne
        self.tous_points = [depot] + points_collecte + dechetteries
        self.matrice_distances = matrice_osrm if matrice_osrm else self._calculer_matrice_distances()
        
        # Résultats
        self.routes_optimisees: List[RouteOptimisee] = []
    
    def _calculer_matrice_distances(self) -> Dict[Tuple[int, int], float]:
        """Précalcule toutes les distances entre les points."""
        matrice = {}
        for i, p1 in enumerate(self.tous_points):
            for j, p2 in enumerate(self.tous_points):
                matrice[(p1.id, p2.id)] = p1.distance_vers(p2)
        return matrice
    
    def _distance(self, p1: Point, p2: Point) -> float:
        """Retourne la distance entre deux points (utilise le cache si disponible)."""
        key = (p1.id, p2.id)
        if key in self.matrice_distances:
            return self.matrice_distances[key]
        return p1.distance_vers(p2)
    
    def _precompute_neighbor_pruning(self, points: List[Point], k: int = K_NEIGHBORS) -> Dict[int, List[int]]:
        """
        Précalcule les K plus proches voisins de chaque point (par id).
        Complexité O(n²) une fois ; les recherches locales deviennent O(n×K).
        """
        ids = [p.id for p in points]
        result = {}
        for p in points:
            dists = [(self._distance(p, q), q.id) for q in points if q.id != p.id]
            dists.sort(key=lambda x: x[0])
            result[p.id] = [pid for _, pid in dists[:k]]
        return result
    
    def _trouver_dechetterie_plus_proche(self, point: Point) -> Tuple[Optional[Point], float]:
        """
        Trouve la déchetterie la plus proche d'un point donné.
        
        Complexité : O(d) où d = nombre de déchetteries
        
        Returns:
            (déchetterie, distance) ou (None, inf) si aucune déchetterie
        """
        if not self.dechetteries:
            return (None, float('inf'))
        
        min_dist = float('inf')
        meilleure = None
        
        for dech in self.dechetteries:
            dist = self._distance(point, dech)
            if dist < min_dist:
                min_dist = dist
                meilleure = dech
        
        return (meilleure, min_dist)
    
    def _nearest_neighbor_avec_dechetteries(self, points_a_visiter: List[Point], 
                                             capacite: float) -> List[Point]:
        """
        Algorithme Nearest Neighbor avec insertion intelligente des déchetteries.
        
        Complexité : O(n²) pour la construction + O(n×d) pour les insertions
        
        Stratégie :
        1. Partir du dépôt
        2. Aller au point le plus proche non visité
        3. Si capacité atteinte → aller à la déchetterie la plus proche
        4. Répéter jusqu'à avoir visité tous les points
        5. Retourner au dépôt (via déchetterie si chargé)
        
        Args:
            points_a_visiter: Liste des points de collecte à desservir
            capacite: Capacité maximale du camion
        
        Returns:
            Liste ordonnée des points à visiter (incluant déchetteries)
        """
        if not points_a_visiter:
            return [self.depot, self.depot]
        
        route = [self.depot]
        non_visites = set(p.id for p in points_a_visiter)
        points_par_id = {p.id: p for p in points_a_visiter}
        
        position_actuelle = self.depot
        charge_actuelle = 0.0
        
        while non_visites:
            # Trouver le point non visité le plus proche
            meilleur_point = None
            meilleure_distance = float('inf')
            
            for point_id in non_visites:
                point = points_par_id[point_id]
                dist = self._distance(position_actuelle, point)
                
                # Favoriser les points qui ne dépasseront pas la capacité
                # Score = distance + pénalité si dépassement
                if charge_actuelle + point.volume > capacite:
                    # Si on va dépasser, ajouter une pénalité (distance vers déchetterie la plus proche)
                    dech, dist_dech = self._trouver_dechetterie_plus_proche(position_actuelle)
                    if dech:
                        # Coût = aller à la déchetterie + aller au point depuis la déchetterie
                        dist = dist_dech + self._distance(dech, point)
                
                if dist < meilleure_distance:
                    meilleure_distance = dist
                    meilleur_point = points_par_id[point_id]
            
            if meilleur_point is None:
                break
            
            # Vérifier si on doit aller à la déchetterie d'abord
            if charge_actuelle + meilleur_point.volume > capacite and charge_actuelle > 0:
                # Aller à la déchetterie la plus proche pour vider
                dech, _ = self._trouver_dechetterie_plus_proche(position_actuelle)
                if dech:
                    route.append(dech)
                    position_actuelle = dech
                    charge_actuelle = 0.0
            
            # Ajouter le point de collecte
            route.append(meilleur_point)
            non_visites.remove(meilleur_point.id)
            position_actuelle = meilleur_point
            charge_actuelle += meilleur_point.volume
        
        # Retour au dépôt
        # Si encore chargé, passer par une déchetterie d'abord
        if charge_actuelle > 0 and self.dechetteries:
            dech, _ = self._trouver_dechetterie_plus_proche(position_actuelle)
            if dech:
                route.append(dech)
        
        route.append(self.depot)
        
        return route
    
    def _calculer_distance_route(self, route: List[Point]) -> float:
        """Calcule la distance totale d'une route."""
        if len(route) < 2:
            return 0.0
        
        distance = 0.0
        for i in range(len(route) - 1):
            distance += self._distance(route[i], route[i + 1])
        
        return distance
    
    def _calculer_borne_inferieure_mst(self, points: List[Point]) -> float:
        """
        Calcule une borne inférieure via l'arbre couvrant minimal (MST).
        
        Pour un TSP, la borne MST garantit: optimal >= MST_cost.
        Complexité: O(n²) avec l'algorithme de Prim.
        
        Returns:
            Borne inférieure en km (toujours <= solution optimale)
        """
        if len(points) < 2:
            return 0.0
        
        n = len(points)
        in_mst = [False] * n
        min_cost = [float('inf')] * n
        min_cost[0] = 0.0
        mst_cost = 0.0
        
        for _ in range(n):
            u = -1
            for i in range(n):
                if not in_mst[i] and (u == -1 or min_cost[i] < min_cost[u]):
                    u = i
            
            if u == -1 or min_cost[u] == float('inf'):
                break
            
            in_mst[u] = True
            mst_cost += min_cost[u]
            
            for v in range(n):
                if not in_mst[v]:
                    d = self._distance(points[u], points[v])
                    if d < min_cost[v]:
                        min_cost[v] = d
        
        return mst_cost
    
    def _trois_opt(self, route: List[Point], max_iterations: int = 15) -> List[Point]:
        """
        Algorithme 3-opt: échange de 3 arêtes pour améliorations plus profondes.
        
        Complexité: O(n³) par itération.
        """
        points = [p for p in route if p.type_point in ("depot", "collecte")]
        if len(points) < 6:
            return points
        
        route_opt = list(points)
        amelioration = True
        iterations = 0
        
        while amelioration and iterations < max_iterations:
            amelioration = False
            iterations += 1
            n = len(route_opt)
            
            for i in range(1, min(n - 4, 15)):  # Limiter pour performance
                for j in range(i + 2, min(n - 2, i + 12)):
                    for k in range(j + 2, min(n - 1, j + 12)):
                        a, b, c, d = (route_opt[:i+1], route_opt[i+1:j+1], 
                                       route_opt[j+1:k+1], route_opt[k+1:])
                        d_actuel = self._calculer_distance_route(route_opt)
                        
                        # Réorganisations 3-opt (sous-ensemble des 8 possibles)
                        for na, nb, nc in [
                            (b, c, d), (b[::-1], c, d), (b, c[::-1], d),
                            (b[::-1], c[::-1], d), (c, b, d),
                        ]:
                            nouvelle = a + na + nb + nc
                            if self._calculer_distance_route(nouvelle) < d_actuel - 0.0001:
                                route_opt = nouvelle
                                amelioration = True
                                break
                        if amelioration:
                            break
                    if amelioration:
                        break
                if amelioration:
                    break
        
        return route_opt
    
    def _simulated_annealing(self, route: List[Point], t_initial: float = 100.0,
                             t_min: float = 0.1, alpha: float = 0.995,
                             max_iter: int = 500) -> List[Point]:
        """
        Recuit simulé pour échapper aux optima locaux.
        
        Utilise des mouvements 2-opt aléatoires et accepte parfois des
        dégradations selon la température.
        
        Complexité: O(n² × max_iter)
        """
        points = [p for p in route if p.type_point in ("depot", "collecte")]
        # Retourner tôt si pas assez de points (évite boucle infinie sur i,j quand n=4)
        if len(points) < 5:
            return list(points)
        
        import random
        route_sa = list(points)
        cout_actuel = self._calculer_distance_route(route_sa)
        meilleure_route = list(route_sa)
        meilleur_cout = cout_actuel
        t = t_initial
        n = len(route_sa)
        
        for _ in range(max_iter):
            if t < t_min:
                break
            # i < j avec segment [i..j] de taille >= 2 (évite boucle infinie)
            i = random.randint(1, n - 2)
            j = random.randint(i + 1, n - 1) if i + 1 <= n - 1 else i + 1
            if j > n - 1:
                continue
            
            # Voisin 2-opt
            route_voisin = route_sa[:i] + route_sa[i:j+1][::-1] + route_sa[j+1:]
            cout_voisin = self._calculer_distance_route(route_voisin)
            delta = cout_voisin - cout_actuel
            
            if delta < 0 or (t > 0 and random.random() < math.exp(-delta / t)):
                route_sa = route_voisin
                cout_actuel = cout_voisin
                if cout_actuel < meilleur_cout:
                    meilleure_route = list(route_sa)
                    meilleur_cout = cout_actuel
            
            t *= alpha
        
        return meilleure_route
    
    def _deux_opt(self, route: List[Point], max_iterations: int = 100) -> List[Point]:
        """
        Algorithme 2-opt pour améliorer une route.
        
        Complexité : O(n²) par itération, O(n³) au total
        
        NOUVELLE APPROCHE EN 2 PHASES :
        1. Extraire uniquement les points de collecte
        2. Appliquer 2-opt agressif sur ces points (sans contrainte de déchetterie)
        3. Les déchetteries seront réinsérées après par _reconstruire_route_avec_dechetteries
        
        Args:
            route: Route initiale (liste de points)
            max_iterations: Nombre max d'itérations sans amélioration
        
        Returns:
            Route améliorée (seulement dépôt + collectes + dépôt)
        """
        # Extraire seulement les points de collecte (et le dépôt)
        points_collecte = [p for p in route if p.type_point in ("depot", "collecte")]
        
        if len(points_collecte) < 4:
            return points_collecte
        
        route_opt = list(points_collecte)
        amelioration = True
        iterations = 0
        
        while amelioration and iterations < max_iterations:
            amelioration = False
            iterations += 1
            
            # 2-opt classique : essayer toutes les paires (i, j)
            for i in range(1, len(route_opt) - 2):
                for j in range(i + 1, len(route_opt) - 1):
                    # Calculer le gain du swap 2-opt
                    # Avant: ... -> route[i-1] -> route[i] -> ... -> route[j] -> route[j+1] -> ...
                    # Après: ... -> route[i-1] -> route[j] -> ... -> route[i] -> route[j+1] -> ...
                    
                    d_avant = (
                        self._distance(route_opt[i-1], route_opt[i]) +
                        self._distance(route_opt[j], route_opt[j+1])
                    )
                    d_apres = (
                        self._distance(route_opt[i-1], route_opt[j]) +
                        self._distance(route_opt[i], route_opt[j+1])
                    )
                    
                    gain = d_avant - d_apres
                    
                    if gain > 0.0001:  # Amélioration trouvée
                        # Inverser le segment [i, j]
                        route_opt[i:j+1] = route_opt[i:j+1][::-1]
                        amelioration = True
        
        return route_opt
    
    def _deux_opt_complet(self, route: List[Point], max_iterations: int = 500) -> List[Point]:
        """
        Algorithme 2-opt COMPLET et AGRESSIF pour éliminer tous les croisements.
        
        Cette version :
        1. Travaille uniquement sur les points de collecte
        2. Exécute plusieurs passes jusqu'à convergence
        3. Utilise un seuil très bas pour capturer toutes les améliorations
        
        Returns:
            Route optimisée sans croisements
        """
        # Extraire seulement les points de collecte (pas les déchetteries)
        depot = None
        collectes = []
        
        for p in route:
            if p.type_point == "depot":
                depot = p
            elif p.type_point == "collecte":
                collectes.append(p)
        
        if not depot or len(collectes) < 2:
            return route
        
        # Construire la route : depot -> collectes -> depot
        route_opt = [depot] + collectes + [depot]
        
        # Appliquer 2-opt jusqu'à convergence
        improved = True
        total_iterations = 0
        
        while improved and total_iterations < max_iterations:
            improved = False
            total_iterations += 1
            
            best_gain = 0
            best_i, best_j = -1, -1
            
            # Trouver le meilleur swap possible
            for i in range(1, len(route_opt) - 2):
                for j in range(i + 2, len(route_opt) - 1):
                    # Distance actuelle des arêtes (i-1,i) et (j,j+1)
                    d1 = self._distance(route_opt[i-1], route_opt[i])
                    d2 = self._distance(route_opt[j], route_opt[j+1])
                    
                    # Distance après inversion : arêtes (i-1,j) et (i,j+1)
                    d3 = self._distance(route_opt[i-1], route_opt[j])
                    d4 = self._distance(route_opt[i], route_opt[j+1])
                    
                    gain = (d1 + d2) - (d3 + d4)
                    
                    if gain > best_gain:
                        best_gain = gain
                        best_i, best_j = i, j
            
            # Appliquer le meilleur swap trouvé
            if best_gain > 0.0001:
                route_opt[best_i:best_j+1] = route_opt[best_i:best_j+1][::-1]
                improved = True
        
        return route_opt
    
    def _deux_opt_neighbor_pruning(self, route: List[Point], neighbors: Dict[int, List[int]],
                                   max_iterations: int = 100) -> List[Point]:
        """
        2-opt en O(n×K) : n'évalue les échanges qu'entre points voisins (neighbor pruning).
        route = depot + collecte + depot.
        """
        collectes = [p for p in route if p.type_point == "collecte"]
        if len(collectes) < 2:
            return list(route)
        depot = next(p for p in route if p.type_point == "depot")
        route_opt = [depot] + collectes + [depot]
        id_to_idx = {route_opt[i].id: i for i in range(len(route_opt)) if route_opt[i].type_point == "collecte"}
        improved = True
        it = 0
        while improved and it < max_iterations:
            improved = False
            it += 1
            best_gain = 0.0
            best_i, best_j = -1, -1
            for i in range(1, len(route_opt) - 2):
                pid = route_opt[i].id
                neighbor_ids = neighbors.get(pid, [])
                for j in (id_to_idx.get(nid) for nid in neighbor_ids):
                    if j is None or j <= i + 1 or j >= len(route_opt) - 1:
                        continue
                    d1 = self._distance(route_opt[i-1], route_opt[i])
                    d2 = self._distance(route_opt[j], route_opt[j+1])
                    d3 = self._distance(route_opt[i-1], route_opt[j])
                    d4 = self._distance(route_opt[i], route_opt[j+1])
                    gain = (d1 + d2) - (d3 + d4)
                    if gain > best_gain:
                        best_gain = gain
                        best_i, best_j = i, j
            if best_gain > 0.0001 and best_i >= 0:
                route_opt[best_i:best_j+1] = route_opt[best_i:best_j+1][::-1]
                id_to_idx = {route_opt[i].id: i for i in range(len(route_opt)) if route_opt[i].type_point == "collecte"}
                improved = True
        return route_opt
    
    def _or_opt_neighbor_pruning(self, route: List[Point], neighbors: Dict[int, List[int]],
                                 max_iterations: int = 50) -> List[Point]:
        """
        Or-opt en O(n×K) : déplace des séquences de 1-2 points, insertions limitées aux voisins.
        """
        collectes = [p for p in route if p.type_point == "collecte"]
        if len(collectes) < 3:
            return list(route)
        depot = next(p for p in route if p.type_point == "depot")
        route_opt = [depot] + collectes + [depot]
        id_to_idx = {route_opt[i].id: i for i in range(len(route_opt)) if route_opt[i].type_point == "collecte"}
        amelioration = True
        it = 0
        while amelioration and it < max_iterations:
            amelioration = False
            it += 1
            for seg_size in [1, 2]:
                for i in range(1, len(route_opt) - seg_size - 1):
                    if route_opt[i].type_point != "collecte":
                        continue
                    segment = route_opt[i:i+seg_size]
                    seg_ids = {p.id for p in segment}
                    best_gain = 0.0
                    best_j = -1
                    d_remove = (self._distance(route_opt[i-1], route_opt[i]) +
                                self._distance(route_opt[i+seg_size-1], route_opt[i+seg_size]) -
                                self._distance(route_opt[i-1], route_opt[i+seg_size]))
                    for pid in seg_ids:
                        for nid in neighbors.get(pid, []):
                            j = id_to_idx.get(nid)
                            if j is None or j >= len(route_opt) - 1 or j == i or j in range(i, i+seg_size):
                                continue
                            if j < i:
                                j_ins = j
                            else:
                                j_ins = j - seg_size
                            if j_ins < 1 or j_ins >= len(route_opt) - seg_size:
                                continue
                            d_ins = (self._distance(route_opt[j_ins], segment[0]) +
                                     self._distance(segment[-1], route_opt[j_ins+1]) -
                                     self._distance(route_opt[j_ins], route_opt[j_ins+1]))
                            gain = d_remove - d_ins
                            if gain > best_gain:
                                best_gain = gain
                                best_j = j_ins
                    if best_gain > 0.001 and best_j >= 0:
                        new_route = route_opt[:i] + route_opt[i+seg_size:]
                        new_route = new_route[:best_j] + segment + new_route[best_j:]
                        route_opt = new_route
                        id_to_idx = {route_opt[idx].id: idx for idx in range(len(route_opt)) if route_opt[idx].type_point == "collecte"}
                        amelioration = True
                        break
                if amelioration:
                    break
        return route_opt
    
    def _cout_routes(self, routes_meta: List[Dict]) -> float:
        """Coût total = somme des distances des routes."""
        return sum(self._calculer_distance_route(r["route"]) for r in routes_meta)
    
    def _volume_route(self, route: List[Point]) -> float:
        return sum(p.volume for p in route if p.type_point == "collecte")
    
    def _lns_destroy_reconstruct(self, routes_meta: List[Dict], neighbors: Dict[int, List[int]],
                                 unassigned: List[Point]) -> List[Dict]:
        """Réinsère les points unassigned dans les routes (meilleure position avec neighbor pruning).
        Ne laisse jamais un point non réinséré si une route a de la capacité : fallback sur toutes
        les positions pour éviter de perdre des points (couverture 100 %)."""
        pts_avant = self._count_points_in_routes([{"route": r["route"], "capacite": r["capacite"], "camion_id": r["camion_id"]} for r in routes_meta])
        routes_meta = [{"route": list(r["route"]), "capacite": r["capacite"], "camion_id": r["camion_id"]} for r in routes_meta]
        nb_unassigned = len(unassigned)
        _debug("_lns_destroy_reconstruct: unassigned=", nb_unassigned, "points à réinsérer, pts_avant=", pts_avant)
        reinserted = 0
        for p in sorted(unassigned, key=lambda x: -x.volume):
            best_delta = float("inf")
            best_ri, best_pos = -1, -1
            for ri, rm in enumerate(routes_meta):
                route = rm["route"]
                # Routes LNS sont "collectes seulement" (sans déchetteries) : le volume total peut
                # dépasser la capacité car les déchetteries sont réinsérées plus tard. On n'exclut
                # pas une route pour capacité ici, pour ne jamais perdre de points.
                collecte_ids_in_route = [route[i].id for i in range(1, len(route) - 1)]
                positions_to_try = set()
                for nid in neighbors.get(p.id, []):
                    if nid not in collecte_ids_in_route:
                        continue
                    idx = next((i for i in range(1, len(route) - 1) if route[i].id == nid), -1)
                    if idx >= 0:
                        positions_to_try.add(idx + 1)
                positions_to_try.add(1)
                positions_to_try.add(len(route) - 1)
                for pos in positions_to_try:
                    if pos < 1 or pos > len(route):
                        continue
                    before = route[pos - 1]
                    after = route[pos] if pos < len(route) else self.depot
                    delta = (self._distance(before, p) + self._distance(p, after) -
                             self._distance(before, after))
                    if delta < best_delta:
                        best_delta = delta
                        best_ri, best_pos = ri, pos
            # Fallback : si aucune position via voisins, essayer toutes les routes et toutes les positions
            if best_ri < 0:
                for ri, rm in enumerate(routes_meta):
                    route = rm["route"]
                    for pos in range(1, len(route)):
                        before = route[pos - 1]
                        after = route[pos] if pos < len(route) else self.depot
                        delta = (self._distance(before, p) + self._distance(p, after) -
                                 self._distance(before, after))
                        if delta < best_delta:
                            best_delta = delta
                            best_ri, best_pos = ri, pos
            if best_ri >= 0:
                routes_meta[best_ri]["route"].insert(best_pos, p)
                reinserted += 1
            else:
                _debug("  POINT PERDU (non réinséré): id=", p.id, "vol=", p.volume)
        pts_apres = self._count_points_in_routes(routes_meta)
        _debug("_lns_destroy_reconstruct: réinsérés=", reinserted, "/", nb_unassigned, "pts_apres=", pts_apres)
        return routes_meta
    
    def _count_points_in_routes(self, routes_meta: List[Dict]) -> int:
        """Nombre total de points de collecte dans les routes (pour préserver la couverture)."""
        return sum(
            sum(1 for i in range(1, len(rm["route"]) - 1) if rm["route"][i].type_point == "collecte")
            for rm in routes_meta
        )

    def _lns_optimize(self, routes_meta: List[Dict], neighbors: Dict[int, List[int]],
                      time_start: float, time_limit: Optional[float]) -> Tuple[List[Dict], int, float]:
        """
        Large Neighborhood Search : destroy (10-30%) puis reconstruct avec neighbor pruning.
        N'accepte jamais une solution qui couvre moins de points que la meilleure courante
        (évite la chute de couverture type 21 % au lieu de 100 %).
        Retourne (routes_améliorées, nb_iterations, cout_final).
        """
        best = [{"route": list(r["route"]), "capacite": r["capacite"], "camion_id": r["camion_id"]} for r in routes_meta]
        best_cost = self._cout_routes(best)
        best_count = self._count_points_in_routes(best)
        _debug("_lns_optimize: initial best_count=", best_count, "nb_routes=", len(best))
        T = LNS_T_INITIAL
        nb_iter = 0
        max_iter = 500 if time_limit is None else 10000
        rejections_lost = 0
        while nb_iter < max_iter:
            if time_limit and (time.time() - time_start) >= time_limit * 0.98:
                break
            nb_iter += 1
            current = [{"route": list(r["route"]), "capacite": r["capacite"], "camion_id": r["camion_id"]} for r in best]
            unassigned = []
            for rm in current:
                route = rm["route"]
                collectes = [i for i in range(1, len(route) - 1) if route[i].type_point == "collecte"]
                if not collectes:
                    continue
                n_remove = max(1, int(len(collectes) * (LNS_DESTROY_MIN + _random.random() * (LNS_DESTROY_MAX - LNS_DESTROY_MIN))))
                to_remove = _random.sample(collectes, min(n_remove, len(collectes)))
                to_remove.sort(reverse=True)
                for idx in to_remove:
                    unassigned.append(route[idx])
                    del route[idx]
            current = self._lns_destroy_reconstruct(current, neighbors, unassigned)
            cost = self._cout_routes(current)
            current_count = self._count_points_in_routes(current)
            # Ne jamais accepter une solution qui couvre moins de points (préserve 100 % couverture)
            if current_count < best_count:
                rejections_lost += 1
                if (_COVERAGE_DEBUG_ENV or _DEBUG_COVERAGE_THIS_RUN) and rejections_lost <= 5:
                    _debug("_lns_optimize: rejet (perte points) iter=", nb_iter, "current_count=", current_count, "best_count=", best_count)
                continue
            delta = cost - best_cost
            if delta <= 0 or (T > 0.01 and _random.random() < math.exp(-delta / T)):
                best = current
                best_cost = cost
                best_count = current_count
            T *= LNS_ALPHA
        _debug("_lns_optimize: fin nb_iter=", nb_iter, "best_count=", best_count, "rejections_lost=", rejections_lost)
        return best, nb_iter, self._cout_routes(best)
    
    def _decomposition_geographique(self, points: List[Point]) -> List[List[Point]]:
        """
        Découpe les points en secteurs par angle depuis le dépôt (tranches type "pizza").
        Chaque secteur vise ~N_DECOMPOSITION_SECTOR points.
        """
        if len(points) <= N_DECOMPOSITION_SECTOR:
            return [list(points)]
        angles = []
        for p in points:
            ax, ay = p.x - self.depot.x, p.y - self.depot.y
            angles.append((math.atan2(ay, ax), p))
        angles.sort(key=lambda x: x[0])
        ordered = [p for _, p in angles]
        sectors = []
        n_sectors = max(1, (len(ordered) + N_DECOMPOSITION_SECTOR - 1) // N_DECOMPOSITION_SECTOR)
        size = len(ordered) // n_sectors
        for i in range(n_sectors):
            start = i * size
            end = (i + 1) * size if i < n_sectors - 1 else len(ordered)
            sectors.append(ordered[start:end])
        return sectors
    
    def _optimize_large_instance(self, points_par_camion: Dict[int, List[Point]],
                                 time_start: Optional[float],
                                 time_limit: Optional[float]) -> Tuple[List[RouteOptimisee], str, int]:
        """
        Orchestre LNS + neighbor pruning (et décomposition géo si xlarge).
        Retourne (routes_optimisees, technique_utilisee, nb_iterations_lns).
        """
        n_total = sum(len(pts) for pts in points_par_camion.values())
        use_decomposition = n_total > N_STRATEGY_LARGE  # xlarge
        _debug("_optimize_large_instance: n_total=", n_total, "use_decomposition=", use_decomposition)
        if use_decomposition:
            all_points = []
            for pts in points_par_camion.values():
                all_points.extend(pts)
            sectors = self._decomposition_geographique(all_points)
            _debug("décomposition: nb_secteurs=", len(sectors), "points_par_secteur=", [len(s) for s in sectors])
            print("[Optimiseur] décomposition:", len(sectors), "secteurs,", sum(len(s) for s in sectors), "points")
            camion_ids = [c["id"] for c in self.camions]
            sector_camions = [[] for _ in sectors]
            for i, cid in enumerate(camion_ids):
                sector_camions[i % len(sectors)].append(cid)
            _debug("sector_camions: camions par secteur=", [len(sc) for sc in sector_camions])
            all_routes_meta = []
            total_lns_iter = 0
            for si, sector_points in enumerate(sectors):
                if not sector_points:
                    _debug("secteur", si, ": vide, ignoré")
                    continue
                time_remaining = None
                if time_limit and time_start:
                    elapsed = time.time() - time_start
                    remaining = time_limit - elapsed
                    per_sector = max(2.0, (time_limit * 0.9) / len(sectors))
                    time_remaining = min(remaining, per_sector)
                    if time_remaining <= 0:
                        time_remaining = 0
                # Ne jamais sauter un secteur : on traite tous les secteurs pour garantir
                # 100 % de couverture ; si le temps est dépassé, LNS fera peu d'itérations.
                camions_s = [c for c in self.camions if c["id"] in sector_camions[si]]
                if not camions_s:
                    _debug("secteur", si, ": AUCUN CAMION assigné ->", len(sector_points), "points PERDUS")
                    continue
                points_par_c = {c["id"]: [] for c in camions_s}
                points_tries = sorted(sector_points, key=lambda p: (-p.volume, p.id))
                for point in points_tries:
                    meilleur = min(camions_s, key=lambda c: (
                        self._distance(self.depot, point) + c.get("cout_fixe", 0),
                        sum(p.volume for p in points_par_c[c["id"]])
                    ))
                    points_par_c[meilleur["id"]].append(point)
                routes_meta = []
                for c in camions_s:
                    pts = points_par_c[c["id"]]
                    if not pts:
                        continue
                    route_nn = self._nearest_neighbor_avec_dechetteries(pts, c["capacite"])
                    collectes_only = [self.depot] + [p for p in route_nn if p.type_point == "collecte"] + [self.depot]
                    routes_meta.append({"route": collectes_only, "capacite": c["capacite"], "camion_id": c["id"]})
                pts_avant_lns = sum(sum(1 for p in rm["route"] if p.type_point == "collecte") for rm in routes_meta)
                _debug("secteur", si, ": pts_avant_lns=", pts_avant_lns, "attendu=", len(sector_points), "routes=", len(routes_meta))
                if not routes_meta:
                    _debug("secteur", si, ": routes_meta vide ->", len(sector_points), "points PERDUS")
                    continue
                neighbors = self._precompute_neighbor_pruning(sector_points)
                ts = time_start if time_remaining else None
                routes_meta, n_iter, _ = self._lns_optimize(routes_meta, neighbors, ts, time_remaining)
                total_lns_iter += n_iter
                pts_dans_routes = sum(sum(1 for p in rm["route"] if p.type_point == "collecte") for rm in routes_meta)
                _debug("secteur", si, ": après LNS pts_dans_routes=", pts_dans_routes, "/", len(sector_points))
                if pts_dans_routes < len(sector_points):
                    print(f"[Optimiseur] ATTENTION secteur {si}: {pts_dans_routes}/{len(sector_points)} points dans les routes (LNS a perdu des points)")
                all_routes_meta.extend(routes_meta)
            technique = "LNS+decomposition+neighbor_pruning"
        else:
            routes_meta = []
            for camion in self.camions:
                pts = points_par_camion.get(camion["id"], [])
                if not pts:
                    continue
                route_nn = self._nearest_neighbor_avec_dechetteries(pts, camion["capacite"])
                collectes_only = [self.depot] + [p for p in route_nn if p.type_point == "collecte"] + [self.depot]
                routes_meta.append({"route": collectes_only, "capacite": camion["capacite"], "camion_id": camion["id"]})
            all_points = []
            for pts in points_par_camion.values():
                all_points.extend(pts)
            neighbors = self._precompute_neighbor_pruning(all_points)
            routes_meta, total_lns_iter, _ = self._lns_optimize(routes_meta, neighbors, time_start, time_limit)
            technique = "LNS+neighbor_pruning"
            all_routes_meta = routes_meta
        pts_avant_2opt = sum(sum(1 for p in rm["route"] if p.type_point == "collecte") for rm in all_routes_meta)
        _debug("avant 2-opt final: pts dans all_routes_meta=", pts_avant_2opt)
        for rm in all_routes_meta:
            collectes = [p for p in rm["route"] if p.type_point == "collecte"]
            if len(collectes) >= 2:
                nbr = self._precompute_neighbor_pruning(collectes)
                rm["route"] = self._deux_opt_neighbor_pruning(rm["route"], nbr, max_iterations=30)
        result_routes = []
        for rm in all_routes_meta:
            route_with_dech = self._reconstruire_route_avec_dechetteries(rm["route"], rm["capacite"])
            route_finale = self._nettoyer_croisements_final(route_with_dech, rm["capacite"], max_iterations=30)
            ro = RouteOptimisee(rm["camion_id"], rm["capacite"])
            for p in route_finale:
                ro.ajouter_waypoint(p)
            result_routes.append(ro)
        total_pts_result = sum(sum(1 for wp in r.waypoints if wp.type_point == "collecte") for r in result_routes)
        _debug("SORTIE _optimize_large_instance: total_pts_result=", total_pts_result, "/ n_total=", n_total)
        if total_pts_result < n_total:
            print(f"[Optimiseur] ATTENTION: seulement {total_pts_result}/{n_total} points dans les routes finales")
        return result_routes, technique, total_lns_iter
    
    def _valider_route_capacite(self, route: List[Point], capacite: float) -> bool:
        """
        Vérifie qu'une route respecte la contrainte de capacité.
        
        La charge ne doit jamais dépasser la capacité entre deux visites de déchetterie.
        """
        charge = 0.0
        for point in route:
            if point.type_point == "collecte":
                charge += point.volume
                if charge > capacite:
                    return False
            elif point.type_point == "dechetterie":
                charge = 0.0
        
        return True
    
    def _segments_se_croisent(self, p1: Point, p2: Point, p3: Point, p4: Point) -> bool:
        """
        Vérifie si le segment [p1,p2] croise le segment [p3,p4].
        
        Utilise le test d'intersection basé sur les produits vectoriels.
        """
        def ccw(A: Point, B: Point, C: Point) -> float:
            """Counter-clockwise: retourne > 0 si CCW, < 0 si CW, 0 si colinéaire."""
            return (C.y - A.y) * (B.x - A.x) - (B.y - A.y) * (C.x - A.x)
        
        d1 = ccw(p1, p2, p3)
        d2 = ccw(p1, p2, p4)
        d3 = ccw(p3, p4, p1)
        d4 = ccw(p3, p4, p2)
        
        if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
           ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
            return True
        
        return False
    
    def _compter_croisements(self, route: List[Point]) -> int:
        """
        Compte le nombre de croisements (intersections) dans une route.
        
        Un croisement indique que le 2-opt n'a pas été complètement appliqué.
        
        Complexité : O(n²) où n = nombre de segments
        
        Returns:
            Nombre de paires de segments qui se croisent
        """
        if len(route) < 4:
            return 0
        
        nb_croisements = 0
        n = len(route)
        
        for i in range(n - 1):
            for j in range(i + 2, n - 1):
                # Ne pas comparer les segments adjacents
                if j == i + 1 or (i == 0 and j == n - 2):
                    continue
                
                if self._segments_se_croisent(route[i], route[i+1], route[j], route[j+1]):
                    nb_croisements += 1
        
        return nb_croisements
    
    def _reconstruire_route_avec_dechetteries(self, route: List[Point], 
                                               capacite: float) -> List[Point]:
        """
        Reconstruit une route en insérant les déchetteries aux bons endroits.
        
        Après un 2-opt, les déchetteries peuvent être mal placées.
        Cette fonction repositionne les déchetteries de manière optimale.
        """
        # Extraire seulement les points de collecte (et dépôt)
        route_sans_dech = [p for p in route if p.type_point != "dechetterie"]
        
        # Reconstruire avec insertion intelligente des déchetteries
        nouvelle_route = [self.depot]
        charge = 0.0
        
        for i, point in enumerate(route_sans_dech[1:-1], 1):  # Ignorer premier et dernier dépôt
            if point.type_point == "collecte":
                # Vérifier si on a besoin d'aller à la déchetterie avant (camion plein)
                if charge + point.volume > capacite and charge > 0:
                    # Toujours aller vers la déchetterie LA PLUS PROCHE de la position actuelle
                    pos_actuelle = nouvelle_route[-1]
                    dech_plus_proche, _ = self._trouver_dechetterie_plus_proche(pos_actuelle)
                    if dech_plus_proche:
                        nouvelle_route.append(dech_plus_proche)
                        charge = 0.0
                
                nouvelle_route.append(point)
                charge += point.volume
        
        # Aller à la déchetterie avant de retourner au dépôt si chargé
        if charge > 0 and self.dechetteries:
            dech, _ = self._trouver_dechetterie_plus_proche(nouvelle_route[-1])
            if dech:
                nouvelle_route.append(dech)
        
        nouvelle_route.append(self.depot)
        
        # POST-TRAITEMENT: Éliminer les croisements créés par l'insertion des déchetteries
        nouvelle_route = self._nettoyer_croisements_avec_dechetteries(nouvelle_route, capacite)
        
        return nouvelle_route
    
    def _nettoyer_croisements_avec_dechetteries(self, route: List[Point], 
                                                  capacite: float, 
                                                  max_iterations: int = 50) -> List[Point]:
        """
        Nettoie les croisements créés par l'insertion des déchetteries.
        
        Utilise un 2-opt modifié qui maintient la validité des contraintes de capacité.
        
        La stratégie :
        1. Identifier les segments qui se croisent
        2. Tenter l'inversion 2-opt
        3. Vérifier que la capacité reste respectée après inversion
        4. Si invalide, annuler et passer au croisement suivant
        """
        if len(route) < 4:
            return route
        
        route = list(route)
        improved = True
        iterations = 0
        
        while improved and iterations < max_iterations:
            improved = False
            iterations += 1
            
            for i in range(1, len(route) - 2):
                for j in range(i + 2, len(route) - 1):
                    # Vérifier si les segments se croisent
                    if self._segments_se_croisent(route[i-1], route[i], route[j], route[j+1]):
                        # Calculer le gain de l'inversion
                        d_avant = (
                            self._distance(route[i-1], route[i]) +
                            self._distance(route[j], route[j+1])
                        )
                        d_apres = (
                            self._distance(route[i-1], route[j]) +
                            self._distance(route[i], route[j+1])
                        )
                        
                        if d_apres < d_avant:
                            # Tenter l'inversion
                            route_test = route[:i] + route[i:j+1][::-1] + route[j+1:]
                            
                            # Vérifier que la capacité est toujours respectée
                            if self._valider_route_capacite(route_test, capacite):
                                route = route_test
                                improved = True
                                break
                
                if improved:
                    break
        
        return route
    
    def _nettoyer_croisements_final(self, route: List[Point], capacite: float, 
                                     max_iterations: int = 200) -> List[Point]:
        """
        Nettoyage FINAL et AGRESSIF des croisements.
        
        Cette fonction est appelée après toutes les autres optimisations.
        Elle essaie plusieurs stratégies pour éliminer les croisements restants :
        
        1. 2-opt standard sur tous les segments
        2. Déplacement des déchetteries vers des positions optimales
        3. Re-optimisation locale autour des croisements
        
        Complexité : O(n³) dans le pire cas
        """
        if len(route) < 4:
            return route
        
        route = list(route)
        croisements_restants = self._compter_croisements(route)
        
        if croisements_restants == 0:
            return route
        
        # Stratégie 1: 2-opt agressif avec toutes les paires possibles
        improved = True
        iterations = 0
        
        while improved and iterations < max_iterations and croisements_restants > 0:
            improved = False
            iterations += 1
            
            # Trouver tous les croisements
            croisements = []
            n = len(route)
            for i in range(n - 1):
                for j in range(i + 2, n - 1):
                    if j == i + 1:
                        continue
                    if self._segments_se_croisent(route[i], route[i+1], route[j], route[j+1]):
                        croisements.append((i, j))
            
            if not croisements:
                break
            
            # Essayer de résoudre chaque croisement
            for (i, j) in croisements:
                # Essayer l'inversion 2-opt standard
                route_test = route[:i+1] + route[i+1:j+1][::-1] + route[j+1:]
                
                if self._valider_route_capacite(route_test, capacite):
                    nouveaux_croisements = self._compter_croisements(route_test)
                    if nouveaux_croisements < croisements_restants:
                        route = route_test
                        croisements_restants = nouveaux_croisements
                        improved = True
                        break
                
                # Essayer l'inversion alternative
                if j < len(route) - 1:
                    route_test2 = route[:i] + route[i:j+1][::-1] + route[j+1:]
                    if self._valider_route_capacite(route_test2, capacite):
                        nouveaux_croisements = self._compter_croisements(route_test2)
                        if nouveaux_croisements < croisements_restants:
                            route = route_test2
                            croisements_restants = nouveaux_croisements
                            improved = True
                            break
        
        # Stratégie 2: Si des croisements persistent, essayer de réorganiser localement
        if croisements_restants > 0:
            # Identifier les points impliqués dans les croisements
            points_impliques = set()
            n = len(route)
            for i in range(n - 1):
                for j in range(i + 2, n - 1):
                    if j == i + 1:
                        continue
                    if self._segments_se_croisent(route[i], route[i+1], route[j], route[j+1]):
                        points_impliques.add(i)
                        points_impliques.add(i+1)
                        points_impliques.add(j)
                        points_impliques.add(j+1)
            
            # Essayer de permuter les points impliqués
            if len(points_impliques) >= 2:
                points_list = sorted(points_impliques)
                for pi in range(len(points_list)):
                    for pj in range(pi + 1, len(points_list)):
                        idx_i, idx_j = points_list[pi], points_list[pj]
                        
                        # Ne pas permuter le dépôt
                        if route[idx_i].type_point == "depot" or route[idx_j].type_point == "depot":
                            continue
                        
                        # Tester la permutation
                        route_test = list(route)
                        route_test[idx_i], route_test[idx_j] = route_test[idx_j], route_test[idx_i]
                        
                        if self._valider_route_capacite(route_test, capacite):
                            nouveaux_croisements = self._compter_croisements(route_test)
                            if nouveaux_croisements < croisements_restants:
                                route = route_test
                                croisements_restants = nouveaux_croisements
                                if croisements_restants == 0:
                                    break
                    if croisements_restants == 0:
                        break
        
        return route
    
    def _or_opt_simple(self, route: List[Point], max_iterations: int = 100) -> List[Point]:
        """
        Algorithme Or-opt SIMPLIFIÉ pour les routes sans déchetteries.
        
        Déplace des séquences de 1-3 points pour améliorer la route.
        Travaille uniquement sur dépôt + points de collecte.
        
        IMPORTANT: Vérifie que le déplacement ne crée pas de nouveaux croisements.
        
        Complexité : O(n²) par itération
        """
        if len(route) < 5:
            return route
        
        route = list(route)
        croisements_initiaux = self._compter_croisements(route)
        amelioration = True
        iterations = 0
        
        while amelioration and iterations < max_iterations:
            amelioration = False
            iterations += 1
            
            for segment_size in [1, 2, 3]:
                for i in range(1, len(route) - segment_size - 1):
                    # Ne pas déplacer le dépôt (premier et dernier élément)
                    if route[i].type_point == "depot":
                        continue
                    
                    segment = route[i:i+segment_size]
                    
                    # Essayer d'insérer le segment à d'autres positions
                    for j in range(1, len(route) - 1):
                        if j >= i and j <= i + segment_size:
                            continue
                        
                        # Coût de suppression du segment
                        cout_suppression = (
                            self._distance(route[i-1], route[i]) +
                            self._distance(route[i+segment_size-1], route[i+segment_size]) -
                            self._distance(route[i-1], route[i+segment_size])
                        )
                        
                        # Coût d'insertion du segment à la position j
                        if j < i:
                            cout_insertion = (
                                self._distance(route[j-1], segment[0]) +
                                self._distance(segment[-1], route[j]) -
                                self._distance(route[j-1], route[j])
                            )
                        else:
                            j_adj = j - segment_size
                            if j_adj >= 0 and j_adj < len(route) - segment_size:
                                cout_insertion = (
                                    self._distance(route[j_adj], segment[0]) +
                                    self._distance(segment[-1], route[j_adj+1] if j_adj+1 < len(route) else route[0]) -
                                    self._distance(route[j_adj], route[j_adj+1] if j_adj+1 < len(route) else route[0])
                                )
                            else:
                                continue
                        
                        gain = cout_suppression - cout_insertion
                        
                        if gain > 0.001:
                            # Effectuer le déplacement
                            nouvelle_route = route[:i] + route[i+segment_size:]
                            insert_pos = j if j < i else j - segment_size
                            nouvelle_route = nouvelle_route[:insert_pos] + segment + nouvelle_route[insert_pos:]
                            
                            # NOUVEAU: Vérifier que le déplacement ne crée pas de croisements
                            nouveaux_croisements = self._compter_croisements(nouvelle_route)
                            if nouveaux_croisements <= croisements_initiaux:
                                route = nouvelle_route
                                croisements_initiaux = nouveaux_croisements
                                amelioration = True
                                break
                    
                    if amelioration:
                        break
                
                if amelioration:
                    break
        
        return route
    
    def _or_opt(self, route: List[Point], max_iterations: int = 50) -> List[Point]:
        """
        Algorithme Or-opt : déplace des séquences de 1-3 points consécutifs.
        
        Complexité : O(n²) par itération
        
        Complémentaire au 2-opt pour une meilleure optimisation.
        """
        if len(route) < 5:
            return route
        
        route = list(route)
        amelioration = True
        iterations = 0
        
        while amelioration and iterations < max_iterations:
            amelioration = False
            iterations += 1
            
            for segment_size in [1, 2, 3]:  # Taille du segment à déplacer
                for i in range(1, len(route) - segment_size - 1):
                    # Ne pas déplacer le dépôt
                    if any(route[i+k].type_point == "depot" for k in range(segment_size)):
                        continue
                    
                    segment = route[i:i+segment_size]
                    
                    for j in range(1, len(route) - 1):
                        if j >= i and j <= i + segment_size:
                            continue
                        
                        # Calculer le gain
                        # Coût actuel
                        cout_actuel = (
                            self._distance(route[i-1], route[i]) +
                            self._distance(route[i+segment_size-1], route[i+segment_size])
                        )
                        
                        # Coût après déplacement
                        cout_nouveau = (
                            self._distance(route[i-1], route[i+segment_size]) +  # Combler le trou
                            self._distance(route[j-1] if j > i else route[j], segment[0]) +
                            self._distance(segment[-1], route[j] if j > i else route[j+1])
                        )
                        
                        if cout_nouveau < cout_actuel - 0.001:
                            # Effectuer le déplacement
                            nouvelle_route = route[:i] + route[i+segment_size:]
                            insert_pos = j if j < i else j - segment_size
                            nouvelle_route = nouvelle_route[:insert_pos] + segment + nouvelle_route[insert_pos:]
                            
                            if self._valider_route_capacite(nouvelle_route, 
                                    self.camions[0]['capacite'] if self.camions else float('inf')):
                                route = nouvelle_route
                                amelioration = True
                                break
                    
                    if amelioration:
                        break
                
                if amelioration:
                    break
        
        return route
    
    def _get_optimisation_strategy(self, n_points_total: int, n_pts_route: int) -> Dict:
        """
        Stratégie hybride : choisit les algorithmes et les plafonds d'itérations
        selon la taille du problème (points de collecte, zones implicites, déchetteries)
        pour éviter lenteur et blocage.
        
        Returns:
            Dict avec profile, use_3opt, use_or_opt, max_iter_2opt, max_iter_3opt,
            max_iter_or_opt, max_iter_sa, max_iter_nettoyage, use_ils.
        """
        if n_points_total <= N_STRATEGY_SMALL:
            profile = "small"
            use_3opt = True
            use_or_opt = True
            use_ils = False
            max_iter_2opt = min(500, 50 + n_pts_route * 5)
            max_iter_3opt = 5 if n_pts_route > 15 else 10
            max_iter_or_opt = 30
            max_iter_sa = min(200, 50 + n_pts_route * 2)
            max_iter_nettoyage = 200
        elif n_points_total <= N_STRATEGY_MEDIUM:
            profile = "medium"
            use_3opt = n_pts_route <= 60
            use_or_opt = True
            use_ils = False
            max_iter_2opt = min(300, 30 + n_pts_route * 3)
            max_iter_3opt = 3 if use_3opt and n_pts_route > 20 else 0
            max_iter_or_opt = 20
            max_iter_sa = min(180, 40 + n_pts_route)
            max_iter_nettoyage = 100
        elif n_points_total <= N_STRATEGY_LARGE:
            profile = "large"
            use_3opt = False
            use_or_opt = n_pts_route <= 80
            use_ils = n_pts_route > 80
            max_iter_2opt = min(150, 20 + n_pts_route)
            max_iter_3opt = 0
            max_iter_or_opt = 10 if use_or_opt else 0
            max_iter_sa = min(250, 80 + n_pts_route // 2)
            max_iter_nettoyage = 50
        else:
            profile = "xlarge"
            use_3opt = False
            use_or_opt = False
            use_ils = True
            max_iter_2opt = min(80, 15 + n_pts_route // 3)
            max_iter_3opt = 0
            max_iter_or_opt = 0
            max_iter_sa = min(200, 50 + n_pts_route // 2)
            max_iter_nettoyage = 30
        return {
            "profile": profile,
            "use_3opt": use_3opt,
            "use_or_opt": use_or_opt,
            "use_ils": use_ils,
            "max_iter_2opt": max(5, max_iter_2opt),
            "max_iter_3opt": max_iter_3opt,
            "max_iter_or_opt": max_iter_or_opt,
            "max_iter_sa": max(20, max_iter_sa),
            "max_iter_nettoyage": max(10, max_iter_nettoyage),
        }
    
    def _iterated_local_search(self, route: List[Point], max_restarts: int = 5,
                               max_2opt_per_restart: int = 30) -> List[Point]:
        """
        Méta-heuristique ILS : perturbation + recherche locale (2-opt) répétées.
        Adaptée aux grandes instances pour éviter les blocages (itérations bornées).
        
        Complexité : O(max_restarts × (n² × max_2opt_per_restart + n))
        """
        points = [p for p in route if p.type_point in ("depot", "collecte")]
        if len(points) < 5:
            return list(points)
        n = len(points)
        best_route = list(points)
        best_cout = self._calculer_distance_route(best_route)
        for _ in range(max_restarts):
            # Perturbation : 2-opt aléatoire (un seul swap)
            i = _random.randint(1, n - 2)
            j = _random.randint(i + 1, n - 1) if i + 1 < n else i + 1
            if j >= n:
                j = n - 1
            current = best_route[:i] + best_route[i:j+1][::-1] + best_route[j+1:]
            current_cout = self._calculer_distance_route(current)
            # Recherche locale limitée (2-opt)
            current = self._deux_opt(current, max_iterations=max_2opt_per_restart)
            current_cout = self._calculer_distance_route(current)
            if current_cout < best_cout:
                best_route = list(current)
                best_cout = current_cout
        return best_route
    
    def optimiser_routes(self) -> List[RouteOptimisee]:
        """
        Optimise les routes pour tous les camions.

        Stratégie multi-étapes :
        1. Répartir les points entre les camions (algorithme glouton)
        2. Pour chaque camion, construire une route avec Nearest Neighbor
        3. Améliorer chaque route avec 2-opt et Or-opt
        4. Insérer les déchetteries de manière optimale

        Returns:
            Liste des routes optimisées
        """
        print("[Optimiseur] optimiser_routes() début, points=", len(self.points_collecte), "camions=", len(self.camions))
        self.routes_optimisees = []
        n_points_total = len(self.points_collecte)
        time_start = time.time() if self.time_limit_seconds else None

        # Trier les points par priorité et volume
        points_tries = sorted(
            self.points_collecte,
            key=lambda p: (-p.volume, p.id)  # Plus gros volumes d'abord
        )
        
        # Répartir les points entre les camions
        points_par_camion = {c['id']: [] for c in self.camions}
        points_restants = list(points_tries)
        
        # Algorithme glouton pour la répartition : répartir les points entre tous les camions.
        # Critère : (1) coût distance + cout_fixe, (2) à égalité, préférer le camion le moins chargé
        # pour éviter qu'un seul camion reçoive tous les points (même dépôt → même distance).
        for point in points_tries:
            meilleur_camion = None
            meilleur_cout = float('inf')
            meilleure_charge = float('inf')
            
            for camion in self.camions:
                # zones_accessibles = liste d'IDs de ZONES (pas d'IDs de points)
                zones_accessibles = camion.get('zones_accessibles', [])
                if zones_accessibles:
                    point_zone_id = getattr(point, 'zone_id', None)
                    if point_zone_id is not None and point_zone_id not in zones_accessibles:
                        continue
                    # pas de zone_id sur le point : on ne filtre pas (tous les points assignables)
                
                charge_actuelle = sum(p.volume for p in points_par_camion[camion['id']])
                # Capacité : on autorise les déchetteries donc pas de rejet ici
                
                cout = self._distance(self.depot, point) + camion.get('cout_fixe', 0)
                # À coût égal, préférer le camion avec la charge la plus faible (répartition)
                if (cout, charge_actuelle) < (meilleur_cout, meilleure_charge):
                    meilleur_cout = cout
                    meilleure_charge = charge_actuelle
                    meilleur_camion = camion
            
            if meilleur_camion:
                points_par_camion[meilleur_camion['id']].append(point)

        n_assignes = sum(len(pts) for pts in points_par_camion.values())
        _debug("Répartition gloutonne: n_assignes=", n_assignes, "/ n_points_total=", n_points_total)
        if n_assignes < n_points_total:
            print("[Optimiseur] ATTENTION: seulement", n_assignes, "/", n_points_total, "points assignés aux camions (vérifier zones_accessibles)")
            for cid, pts in points_par_camion.items():
                _debug("  camion", cid, "->", len(pts), "points")
        else:
            print("[Optimiseur] points assignés:", n_assignes, "/", n_points_total)
        
        # Borne inférieure (MST) pour évaluation de la qualité (sautée en xlarge pour éviter lenteur)
        strat_global = self._get_optimisation_strategy(n_points_total, n_points_total)
        if strat_global["profile"] == "xlarge":
            self._borne_inferieure = 0.0
            print("[Optimiseur] MST skippé (profil xlarge)")
        else:
            points_pour_mst = [self.depot] + self.points_collecte
            self._borne_inferieure = self._calculer_borne_inferieure_mst(points_pour_mst)
            print("[Optimiseur] après MST")
        
        # Statistiques des croisements
        total_croisements_avant = 0
        total_croisements_apres = 0
        
        # LNS dès medium (n > 50) : évite le goulot 3-opt O(n³), courbe de temps croissante avec n
        use_large_instance_path = n_points_total > N_STRATEGY_SMALL
        if use_large_instance_path:
            if n_points_total > N_STRATEGY_LARGE:
                self._strategie_profile = "xlarge"
            elif n_points_total > N_STRATEGY_MEDIUM:
                self._strategie_profile = "large"
            else:
                self._strategie_profile = "medium"
            print("[Optimiseur] LNS (n>50) :", self._strategie_profile, "-> LNS + neighbor pruning")
            routes_large, technique, nb_lns = self._optimize_large_instance(
                points_par_camion, time_start, self.time_limit_seconds
            )
            self.routes_optimisees = routes_large
            self._technique_grande_instance = technique
            self._nb_iterations_lns = nb_lns
            for r in self.routes_optimisees:
                total_croisements_apres += self._compter_croisements(r.waypoints)
            self._croisements_stats = {
                "total_avant": total_croisements_avant,
                "total_apres": total_croisements_apres,
                "elimination_pct": 100.0 if total_croisements_avant == 0 else round(
                    (1 - total_croisements_apres / total_croisements_avant) * 100, 1
                )
            }
            return self.routes_optimisees
        
        # Construire et optimiser la route pour chaque camion (small / medium)
        for camion in self.camions:
            points_camion = points_par_camion[camion['id']]
            
            if not points_camion:
                continue
            
            # 1. Construction initiale avec Nearest Neighbor (inclut déchetteries)
            route_initiale = self._nearest_neighbor_avec_dechetteries(
                points_camion, camion['capacite']
            )
            print("[Optimiseur] après nearest_neighbor")
            
            # Compter les croisements AVANT optimisation
            croisements_avant = self._compter_croisements(route_initiale)
            total_croisements_avant += croisements_avant
            
            n_pts = len(points_camion)
            strategy = self._get_optimisation_strategy(n_points_total, n_pts)
            if not hasattr(self, "_strategie_profile"):
                self._strategie_profile = strategy["profile"]
            if time_start and self.time_limit_seconds:
                elapsed = time.time() - time_start
                if elapsed >= self.time_limit_seconds * 0.95:
                    strategy["max_iter_2opt"] = min(strategy["max_iter_2opt"], 10)
                    strategy["max_iter_3opt"] = 0
                    strategy["max_iter_or_opt"] = 0
                    strategy["max_iter_sa"] = min(strategy["max_iter_sa"], 30)
                    strategy["use_3opt"] = False
                    strategy["use_or_opt"] = False
                    strategy["use_ils"] = False
            print("[Optimiseur] stratégie:", strategy["profile"], "n_pts=", n_pts)

            # 2. 2-opt pour éliminer les croisements (plafonné par la stratégie)
            route_sans_croisement = self._deux_opt_complet(route_initiale, max_iterations=strategy["max_iter_2opt"])
            if time_start and self.time_limit_seconds and time.time() - time_start >= self.time_limit_seconds:
                route_amelioree = route_sans_croisement
            else:
                # 3. 3-opt si stratégie small/medium
                if strategy["use_3opt"] and strategy["max_iter_3opt"] > 0:
                    route_3opt = self._trois_opt(route_sans_croisement, max_iterations=strategy["max_iter_3opt"])
                    route_3opt = self._deux_opt_complet(route_3opt, max_iterations=min(50, strategy["max_iter_2opt"] // 2))
                else:
                    route_3opt = self._deux_opt_complet(route_sans_croisement, max_iterations=min(10, strategy["max_iter_2opt"] // 5))

                # 4. Or-opt si activé par la stratégie
                if strategy["use_or_opt"] and strategy["max_iter_or_opt"] > 0:
                    route_amelioree = self._or_opt_simple(route_3opt, max_iterations=strategy["max_iter_or_opt"])
                else:
                    route_amelioree = route_3opt

                # 5. Méta-heuristique : SA ou ILS selon la stratégie
                if strategy["use_ils"]:
                    route_ils = self._iterated_local_search(
                        route_amelioree,
                        max_restarts=min(5, 2 + n_pts // 50),
                        max_2opt_per_restart=min(25, strategy["max_iter_2opt"] // 3)
                    )
                    route_sa = self._simulated_annealing(
                        route_ils, t_initial=20, alpha=0.98, max_iter=strategy["max_iter_sa"]
                    )
                else:
                    route_sa = self._simulated_annealing(
                        route_amelioree, t_initial=30, max_iter=strategy["max_iter_sa"]
                    )
                route_amelioree = self._deux_opt_complet(
                    route_sa, max_iterations=min(50, strategy["max_iter_nettoyage"] // 2)
                )

            # 6. Reconstruire avec déchetteries optimales
            route_avec_dech = self._reconstruire_route_avec_dechetteries(
                route_amelioree, camion['capacite']
            )

            # 7. Nettoyage final des croisements (plafonné)
            route_finale = self._nettoyer_croisements_final(
                route_avec_dech, camion['capacite'],
                max_iterations=strategy["max_iter_nettoyage"]
            )
            
            # Compter les croisements APRÈS optimisation
            croisements_apres = self._compter_croisements(route_finale)
            total_croisements_apres += croisements_apres
            
            # Créer l'objet RouteOptimisee
            route_obj = RouteOptimisee(camion['id'], camion['capacite'])
            route_obj.croisements_avant = croisements_avant
            route_obj.croisements_apres = croisements_apres
            for point in route_finale:
                route_obj.ajouter_waypoint(point)
            
            self.routes_optimisees.append(route_obj)
        
        # Stocker les statistiques de croisements globales
        self._croisements_stats = {
            "total_avant": total_croisements_avant,
            "total_apres": total_croisements_apres,
            "elimination_pct": round(
                (1 - total_croisements_apres / max(total_croisements_avant, 1)) * 100, 1
            ) if total_croisements_avant > 0 else 100.0
        }
        
        return self.routes_optimisees
    
    def calculer_statistiques_globales(self) -> Dict:
        """Calcule les statistiques globales de l'optimisation."""
        if not self.routes_optimisees:
            return {}
        
        distance_totale = sum(r.calculer_distance_totale() for r in self.routes_optimisees)
        volume_total = sum(r.volume_total_collecte for r in self.routes_optimisees)
        nb_dechetteries_visites = sum(r.nb_visites_dechetterie for r in self.routes_optimisees)
        
        # Calculer la distance moyenne par camion
        distances = [r.distance_totale for r in self.routes_optimisees]
        distance_moyenne = sum(distances) / len(distances) if distances else 0
        
        # Écart-type des distances
        if len(distances) > 1:
            variance = sum((d - distance_moyenne)**2 for d in distances) / len(distances)
            ecart_type = math.sqrt(variance)
        else:
            ecart_type = 0

        # Tonnage transporté par kilomètre (tonnes/km) par camion et moyenne
        tonnage_par_km_list = []
        for r in self.routes_optimisees:
            r.calculer_distance_totale()
            if r.distance_totale > 0:
                tonnage_par_km_list.append((r.volume_total_collecte / 1000.0) / r.distance_totale)
            else:
                tonnage_par_km_list.append(0.0)
        moyenne_tonnage_par_km = sum(tonnage_par_km_list) / len(tonnage_par_km_list) if tonnage_par_km_list else 0.0

        # Statistiques des croisements (validation 2-opt)
        croisements_stats = getattr(self, '_croisements_stats', {
            "total_avant": 0,
            "total_apres": 0,
            "elimination_pct": 100.0
        })
        
        # Gap avec borne inférieure (qualité de la solution)
        borne = getattr(self, '_borne_inferieure', 0)
        gap_pct = round((distance_totale - borne) / max(borne, 0.001) * 100, 1) if borne > 0 else 0
        
        return {
            "distance_totale": round(distance_totale, 2),
            "volume_total_collecte": round(volume_total, 2),
            "nb_camions_utilises": len(self.routes_optimisees),
            "nb_total_visites_dechetteries": nb_dechetteries_visites,
            "distance_moyenne_par_camion": round(distance_moyenne, 2),
            "ecart_type_distance": round(ecart_type, 2),
            "tonnage_par_km_par_camion": [round(t, 4) for t in tonnage_par_km_list],
            "moyenne_tonnage_par_km": round(moyenne_tonnage_par_km, 4),
            "nb_points_collecte": len(self.points_collecte),
            "nb_dechetteries_disponibles": len(self.dechetteries),
            "borne_inferieure_km": round(borne, 2),
            "gap_pourcent": gap_pct,
            "use_osrm": getattr(self, 'use_osrm', False),
            "strategie_optimisation": getattr(self, "_strategie_profile", "hybride"),
            "technique_grande_instance": getattr(self, "_technique_grande_instance", None),
            "nb_iterations_lns": getattr(self, "_nb_iterations_lns", None),
            "optimisation_2opt": {
                "croisements_avant": croisements_stats.get("total_avant", 0),
                "croisements_apres": croisements_stats.get("total_apres", 0),
                "pourcentage_elimination": croisements_stats.get("elimination_pct", 100.0),
                "message": (
                    f"2-opt a elimine {croisements_stats.get('total_avant', 0) - croisements_stats.get('total_apres', 0)} "
                    f"croisements ({croisements_stats.get('elimination_pct', 100.0)}%)"
                )
            }
        }
    
    def to_dict(self) -> Dict:
        """Convertit les résultats en dictionnaire pour l'API."""
        return {
            "routes": [r.to_dict() for r in self.routes_optimisees],
            "statistiques": self.calculer_statistiques_globales(),
            "depot": {
                "id": self.depot.id,
                "x": self.depot.x,
                "y": self.depot.y,
                "nom": self.depot.nom
            },
            "dechetteries": [
                {
                    "id": d.id,
                    "x": d.x,
                    "y": d.y,
                    "nom": d.nom
                }
                for d in self.dechetteries
            ]
        }


def optimiser_collecte(depot_data: Dict, points_data: List[Dict],
                       dechetteries_data: List[Dict], camions_data: List[Dict],
                       use_osrm: bool = False, time_limit_seconds: Optional[float] = None,
                       debug_coverage: bool = False) -> Dict:
    """
    Fonction principale d'optimisation de la collecte.

    Stratégie hybride : le choix des algorithmes (2-opt, 3-opt, Or-opt, SA, ILS)
    et des plafonds d'itérations est automatique selon le nombre de points,
    pour éviter lenteur et blocage. Optionnellement, time_limit_seconds
    arrête les améliorations avant la fin du budget pour garantir une réponse à temps.

    Args:
        depot_data: {id, x, y, nom}
        points_data: [{id, x, y, nom, volume, priorite}, ...]
        dechetteries_data: [{id, x, y, nom, capacite_max}, ...]
        camions_data: [{id, capacite, cout_fixe, zones_accessibles}, ...]
        use_osrm: Si True, récupère les distances routières via OSRM Table API
        time_limit_seconds: Limite de temps (secondes). Au-delà, optimisation raccourcie.
        debug_coverage: Si True, affiche des logs [COVERAGE_DEBUG] pour tracer les pertes de points.

    Returns:
        Dictionnaire avec les routes optimisées et statistiques
    """
    global _DEBUG_COVERAGE_THIS_RUN
    _DEBUG_COVERAGE_THIS_RUN = bool(debug_coverage)
    print("[Optimiseur] optimiser_collecte() début, use_osrm=", use_osrm, "points=", len(points_data))
    _debug("ENTRÉE optimiser_collecte: points_data=", len(points_data), "camions=", len(camions_data))
    # Créer les objets Point
    depot = Point(
        id=depot_data.get('id', 0),
        x=depot_data.get('x', 0),
        y=depot_data.get('y', 0),
        nom=depot_data.get('nom', 'Dépôt'),
        type_point="depot"
    )
    
    points_collecte = [
        Point(
            id=p['id'],
            x=p['x'],
            y=p['y'],
            nom=p.get('nom', f"Point {p['id']}"),
            volume=p.get('volume', 0),
            type_point="collecte"
        )
        for p in points_data
    ]
    for i, p_data in enumerate(points_data):
        if 'zone_id' in p_data and p_data['zone_id'] is not None:
            points_collecte[i].zone_id = p_data['zone_id']
    
    dechetteries = [
        Point(
            id=d['id'],
            x=d['x'],
            y=d['y'],
            nom=d.get('nom', f"Déchetterie {d['id']}"),
            type_point="dechetterie"
        )
        for d in dechetteries_data
    ]
    
    # Matrice OSRM (optionnel) - même approche que web_app/frontend
    matrice_osrm = None
    if use_osrm and len(points_collecte) + len(dechetteries_data) + 1 <= 100:
        try:
            print("[Optimiseur] Appel OSRM Table API (matrice distances)...")
            from osrm_client import build_distance_matrix_from_osrm
            matrice_osrm = build_distance_matrix_from_osrm(
                depot_data, points_data, dechetteries_data if dechetteries_data else []
            )
            if matrice_osrm:
                print(f"[Optimiseur] OSRM OK: matrice {len(matrice_osrm)} entrées")
            else:
                print("[Optimiseur] OSRM retourne None, utilisation distances euclidiennes")
        except Exception as e:
            import traceback
            print(f"[Optimiseur] OSRM indisponible: {e}")
            if True:  # DEBUG
                traceback.print_exc()
    
    # Créer l'optimiseur et lancer l'optimisation (stratégie hybride + optionnel time_limit)
    optimiseur = OptimiseurRoutes(
        depot, points_collecte, dechetteries, camions_data,
        matrice_osrm=matrice_osrm,
        time_limit_seconds=time_limit_seconds
    )
    optimiseur.optimiser_routes()
    
    return optimiseur.to_dict()
