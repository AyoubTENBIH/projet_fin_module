# -*- coding: utf-8 -*-
"""
API Niveau 1 - Calcul des distances optimales
Expose les fonctionnalités du niveau 1 via endpoints REST.
"""

import json
import sys
from pathlib import Path

# Ajouter les chemins pour importer les modules niveau1
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
NIVEAU1_SRC = PROJECT_ROOT / "niveau1" / "src"
sys.path.insert(0, str(NIVEAU1_SRC))

from graphe_routier import GrapheRoutier
from point_collecte import PointCollecte
from dechetterie import Dechetterie


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


def calculer_matrice_distances(points_data: list, connexions: list, dechetteries_data: list = None) -> dict:
    """
    Calcule la matrice des distances pour les points donnés.

    Args:
        points_data: Liste des points avec id, x, y
        connexions: Liste des connexions entre points
        dechetteries_data: Liste des déchetteries (optionnel)

    Returns:
        Dict avec matrice_distances et chemins_calcules
    """
    graphe = creer_graphe_depuis_points(points_data, connexions, dechetteries_data)
    matrice = graphe.matrice_distances()

    ids_ordonnes = sorted(graphe.sommets.keys())
    id_depot = ids_ordonnes[0] if ids_ordonnes else None

    chemins_calcules = []
    # Calculer TOUS les chemins possibles entre tous les points (pas seulement depuis le dépôt)
    # Cela permet aux camions d'aller directement d'un point à un autre
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
