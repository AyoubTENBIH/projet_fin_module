# -*- coding: utf-8 -*-
"""
API Niveau 1 - Calcul des distances optimales
Expose les fonctionnalités du niveau 1 via endpoints REST.
Pour les grandes instances (n > 80), matrice euclidienne directe O(n²) au lieu de Dijkstra O(n³).
"""

import json
import math
import sys
from pathlib import Path

# Ajouter les chemins pour importer les modules niveau1
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
NIVEAU1_SRC = PROJECT_ROOT / "niveau1" / "src"
sys.path.insert(0, str(NIVEAU1_SRC))

from graphe_routier import GrapheRoutier
from point_collecte import PointCollecte
from dechetterie import Dechetterie

# Au-delà de ce nombre de sommets, on utilise la matrice euclidienne directe (rapide)
NIVEAU1_FAST_PATH_THRESHOLD = 80


def creer_graphe_depuis_points(points_data: list, connexions: list, dechetteries_data: list = None) -> GrapheRoutier:
    """
    Crée un GrapheRoutier depuis les données JSON.

    Args:
        points_data: Liste de dicts avec id, x, y, nom
        connexions: Liste de dicts avec depart, arrivee, distance
        dechetteries_data: Liste de dicts avec id, x, y, nom, capacite_max, types_dechets, horaires

    Returns:
        GrapheRoutier configuré
    """
    graphe = GrapheRoutier()

    # Ajouter tous les points comme sommets
    for p in points_data:
        point = PointCollecte(
            id_point=p["id"],
            x=p["x"],
            y=p["y"],
            nom=p.get("nom", f"Point {p['id']}"),
        )
        graphe.ajouter_sommet(point)

    # Ajouter les déchetteries comme sommets
    if dechetteries_data:
        for d in dechetteries_data:
            dechetterie = Dechetterie(
                id_point=d["id"],
                x=d["x"],
                y=d["y"],
                nom=d.get("nom", f"Déchetterie {d['id']}"),
                capacite_max=d.get("capacite_max", 0.0),
                types_dechets=d.get("types_dechets", []),
                horaires=d.get("horaires", {}),
            )
            graphe.ajouter_sommet(dechetterie)

    # Ajouter les connexions comme arêtes
    for c in connexions:
        try:
            graphe.ajouter_arete(
                c["depart"],
                c["arrivee"],
                c.get("distance"),
            )
        except (ValueError, KeyError):
            continue

    return graphe


def _distance_euclidienne(p1: dict, p2: dict) -> float:
    """Distance euclidienne entre deux points {x, y}."""
    return math.sqrt((p1["x"] - p2["x"]) ** 2 + (p1["y"] - p2["y"]) ** 2)


def calculer_matrice_distances(points_data: list, connexions: list, dechetteries_data: list = None) -> dict:
    """
    Calcule la matrice des distances pour les points donnés.

    Pour n > NIVEAU1_FAST_PATH_THRESHOLD : matrice euclidienne directe O(n²), sans Dijkstra.
    Sinon : graphe + Dijkstra (comportement historique).

    Returns:
        Dict avec matrice_distances, chemins_calcules (vide si fast path), ids_ordonnes.
    """
    dechetteries_data = dechetteries_data or []
    n_sommets = len(points_data) + len(dechetteries_data)

    if n_sommets > NIVEAU1_FAST_PATH_THRESHOLD:
        # Chemin rapide : matrice euclidienne directe, pas de Dijkstra (évite lenteur 500 points)
        all_points = list(points_data) + [
            {"id": d["id"], "x": d["x"], "y": d["y"], "nom": d.get("nom", "")}
            for d in dechetteries_data
        ]
        ids_ordonnes = sorted(p["id"] for p in all_points)
        id_to_point = {p["id"]: p for p in all_points}
        n = len(ids_ordonnes)
        matrice = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    matrice[i][j] = 0.0
                else:
                    p1 = id_to_point[ids_ordonnes[i]]
                    p2 = id_to_point[ids_ordonnes[j]]
                    matrice[i][j] = round(_distance_euclidienne(p1, p2), 2)
        return {
            "matrice_distances": [[matrice[i][j] for j in range(n)] for i in range(n)],
            "chemins_calcules": [],
            "ids_ordonnes": ids_ordonnes,
        }
    # Comportement standard (petites instances)
    graphe = creer_graphe_depuis_points(points_data, connexions, dechetteries_data)
    matrice = graphe.matrice_distances()

    ids_ordonnes = sorted(graphe.sommets.keys())

    chemins_calcules = []
    for id_depart in ids_ordonnes:
        for id_arrivee in ids_ordonnes:
            if id_depart == id_arrivee:
                continue
            dist, chemin = graphe.plus_court_chemin(id_depart, id_arrivee)
            if dist != float("inf"):
                chemins_calcules.append({
                    "depart": id_depart,
                    "arrivee": id_arrivee,
                    "distance": round(dist, 2),
                    "chemin": chemin,
                })

    def serialize_dist(val):
        if val == float("inf"):
            return None
        return round(val, 2)

    return {
        "matrice_distances": [
            [serialize_dist(matrice[i][j]) for j in range(len(matrice))]
            for i in range(len(matrice))
        ],
        "chemins_calcules": chemins_calcules,
        "ids_ordonnes": ids_ordonnes,
    }
