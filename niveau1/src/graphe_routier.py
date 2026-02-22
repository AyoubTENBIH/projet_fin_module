# -*- coding: utf-8 -*-
"""
Module GrapheRoutier - Niveau 1 VillePropre
Modélise le réseau routier comme un graphe et calcule les plus courts chemins (Dijkstra).
"""

import json
import heapq
from pathlib import Path
from typing import Optional

from point_collecte import PointCollecte
from dechetterie import Dechetterie


class GrapheRoutier:
    """
    Graphe non orienté pondéré : sommets = points de collecte, arêtes = routes.
    """

    def __init__(self):
        """Initialise un graphe vide."""
        self.sommets = {}   # Dict[int, PointCollecte] : id -> point
        self.aretes = {}    # Dict[(int,int), float] : (id1, id2) -> distance

    def ajouter_sommet(self, point: PointCollecte) -> None:
        """
        Ajoute un sommet au graphe.

        Args:
            point: Instance de PointCollecte à ajouter.
        """
        self.sommets[point.id] = point

    def ajouter_arete(self, id1: int, id2: int, distance: Optional[float] = None) -> None:
        """
        Ajoute une arête entre deux sommets (graphe non orienté).

        Si distance est None, la distance euclidienne entre les deux points est utilisée.

        Args:
            id1: Identifiant du premier sommet.
            id2: Identifiant du second sommet.
            distance: Distance explicite ou None pour calcul euclidien.

        Raises:
            ValueError: Si l'un des sommets n'existe pas.
        """
        if id1 not in self.sommets or id2 not in self.sommets:
            raise ValueError(f"Sommet(s) inexistant(s) : {id1} ou {id2}")
        if id1 == id2:
            return
        if distance is None:
            p1, p2 = self.sommets[id1], self.sommets[id2]
            distance = p1.distance_vers(p2)
        # Graphe non orienté : stocker dans les deux sens
        self.aretes[(id1, id2)] = distance
        self.aretes[(id2, id1)] = distance

    def _voisins(self, sommet_id: int):
        """Retourne les voisins d'un sommet (ids) avec le poids de l'arête."""
        for (a, b), d in self.aretes.items():
            if a == sommet_id:
                yield b, d

    def plus_court_chemin(self, depart: int, arrivee: int) -> tuple:
        """
        Retourne le plus court chemin entre deux sommets (algorithme de Dijkstra).

        Args:
            depart: Identifiant du sommet de départ.
            arrivee: Identifiant du sommet d'arrivée.

        Returns:
            Tuple (distance_totale, chemin) où chemin est une liste d'ids.
            Si pas de chemin : (float('inf'), []).

        Raises:
            ValueError: Si départ ou arrivée n'existe pas.
        """
        if depart not in self.sommets or arrivee not in self.sommets:
            raise ValueError(f"Sommet(s) inexistant(s) : départ={depart}, arrivée={arrivee}")

        # Dijkstra avec file de priorité (heapq)
        dist = {s: float("inf") for s in self.sommets}
        dist[depart] = 0.0
        pred = {s: None for s in self.sommets}
        # File : (distance, sommet_id)
        heap = [(0.0, depart)]

        while heap:
            d, u = heapq.heappop(heap)
            if d > dist[u]:
                continue
            if u == arrivee:
                break
            for v, w in self._voisins(u):
                alt = dist[u] + w
                if alt < dist[v]:
                    dist[v] = alt
                    pred[v] = u
                    heapq.heappush(heap, (alt, v))

        if dist[arrivee] == float("inf"):
            return (float("inf"), [])

        # Reconstruire le chemin
        chemin = []
        cur = arrivee
        while cur is not None:
            chemin.append(cur)
            cur = pred[cur]
        chemin.reverse()
        return (dist[arrivee], chemin)

    def matrice_distances(self) -> list:
        """
        Calcule la matrice des distances entre tous les sommets (Dijkstra pour chaque paire).

        Returns:
            Liste de listes de floats, matrice NxN symétrique, diagonale à 0.
            L'ordre des lignes/colonnes suit les ids triés des sommets.
        """
        ids_ordonnes = sorted(self.sommets.keys())
        n = len(ids_ordonnes)
        id_to_idx = {sid: i for i, sid in enumerate(ids_ordonnes)}
        matrice = [[0.0] * n for _ in range(n)]

        for i, id_i in enumerate(ids_ordonnes):
            for j, id_j in enumerate(ids_ordonnes):
                if i == j:
                    matrice[i][j] = 0.0
                else:
                    dist, _ = self.plus_court_chemin(id_i, id_j)
                    matrice[i][j] = dist
        return matrice

    def charger_depuis_json(self, fichier: str) -> None:
        """
        Charge le graphe depuis un fichier input_niveau1.json.

        Crée les sommets (dépôt + points_collecte) et les arêtes (connexions).

        Args:
            fichier: Chemin vers le fichier JSON.

        Raises:
            FileNotFoundError: Si le fichier n'existe pas.
            json.JSONDecodeError: Si le fichier n'est pas du JSON valide.
        """
        path = Path(fichier)
        if not path.exists():
            raise FileNotFoundError(f"Fichier introuvable : {fichier}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Réinitialiser pour rechargement propre
        self.sommets.clear()
        self.aretes.clear()

        # Dépôt
        depot = data["depot"]
        self.ajouter_sommet(
            PointCollecte(
                depot["id"],
                depot["x"],
                depot["y"],
                depot.get("nom", ""),
            )
        )

        # Points de collecte
        for p in data["points_collecte"]:
            self.ajouter_sommet(
                PointCollecte(
                    p["id"],
                    p["x"],
                    p["y"],
                    p.get("nom", ""),
                )
            )

        # Déchetteries (si présentes dans le JSON)
        if "dechetteries" in data:
            for d in data["dechetteries"]:
                dechetterie = Dechetterie(
                    id_point=d["id"],
                    x=d["x"],
                    y=d["y"],
                    nom=d.get("nom", ""),
                    capacite_max=d.get("capacite_max", 0.0),
                    types_dechets=d.get("types_dechets", []),
                    horaires=d.get("horaires", {}),
                )
                self.ajouter_sommet(dechetterie)

        # Connexions (arêtes)
        for c in data["connexions"]:
            try:
                self.ajouter_arete(
                    c["depart"],
                    c["arrivee"],
                    c.get("distance"),
                )
            except ValueError:
                # Ignorer les connexions vers des sommets non chargés
                pass

    def sauvegarder_resultats(self, fichier: str) -> None:
        """
        Calcule la matrice des distances et les chemins dépôt → tous les autres,
        puis sauvegarde dans output_niveau1.json.

        Args:
            fichier: Chemin vers le fichier de sortie JSON.
        """
        ids_ordonnes = sorted(self.sommets.keys())
        id_depot = ids_ordonnes[0]  # on suppose que le dépôt a le plus petit id (0)

        matrice = self.matrice_distances()
        id_to_idx = {sid: i for i, sid in enumerate(ids_ordonnes)}

        chemins_calcules = []
        for id_arrivee in ids_ordonnes:
            if id_arrivee == id_depot:
                continue
            dist, chemin = self.plus_court_chemin(id_depot, id_arrivee)
            if dist != float("inf"):
                chemins_calcules.append({
                    "depart": id_depot,
                    "arrivee": id_arrivee,
                    "distance": round(dist, 2),
                    "chemin": chemin,
                })

        # Statistiques (hors diagonale, exclure les distances infinies)
        n = len(matrice)
        inf = float("inf")
        distances_hors_diag = []
        for i in range(n):
            for j in range(n):
                d = matrice[i][j]
                if i != j and d < inf and d > 0:
                    distances_hors_diag.append(d)
        if distances_hors_diag:
            dist_min = min(distances_hors_diag)
            dist_max = max(distances_hors_diag)
            dist_moy = sum(distances_hors_diag) / len(distances_hors_diag)
        else:
            dist_min = dist_max = dist_moy = 0.0

        def _serialize_dist(val):
            if val == float("inf"):
                return None  # ou on pourrait mettre un très grand nombre
            return round(val, 2)

        resultat = {
            "matrice_distances": [[_serialize_dist(matrice[i][j]) for j in range(n)] for i in range(n)],
            "chemins_calcules": chemins_calcules,
            "statistiques": {
                "nombre_points": n,
                "distance_min": round(dist_min, 2),
                "distance_max": round(dist_max, 2),
                "distance_moyenne": round(dist_moy, 2),
            },
        }

        path = Path(fichier)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(resultat, f, indent=2, ensure_ascii=False)
