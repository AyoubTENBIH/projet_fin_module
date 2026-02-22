# -*- coding: utf-8 -*-
"""
API Niveau 2 - Affectation optimale zones ↔ camions
Expose les fonctionnalités du niveau 2 via endpoints REST.
"""

import sys
from pathlib import Path

# Ajouter les chemins pour importer les modules niveau2 et niveau1
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
NIVEAU2_SRC = PROJECT_ROOT / "niveau2" / "src"
NIVEAU1_SRC = PROJECT_ROOT / "niveau1" / "src"
sys.path.insert(0, str(NIVEAU2_SRC))
sys.path.insert(0, str(NIVEAU1_SRC))

from affectateur_biparti import AffectateurBiparti
from camion import Camion
from zone import Zone
from dechetterie import Dechetterie


def creer_camions_depuis_data(camions_data: list) -> list:
    """
    Crée une liste d'objets Camion depuis les données JSON.

    Args:
        camions_data: Liste de dicts avec id, capacite, cout_fixe, zones_accessibles

    Returns:
        Liste d'objets Camion
    """
    camions = []
    for c in camions_data:
        camion = Camion(
            id_camion=c["id"],
            capacite=c["capacite"],
            cout_fixe=c["cout_fixe"],
            zones_accessibles=c.get("zones_accessibles", []),
        )
        pos = c.get("position_initiale", {})
        camion.position_initiale = (pos.get("x", 0), pos.get("y", 0))
        camions.append(camion)
    return camions


def creer_zones_depuis_data(zones_data: list) -> list:
    """
    Crée une liste d'objets Zone depuis les données JSON.

    Args:
        zones_data: Liste de dicts avec id, points, volume_moyen, centre, priorite

    Returns:
        Liste d'objets Zone
    """
    zones = []
    for z in zones_data:
        centre = z["centre"]
        zone = Zone(
            id_zone=z["id"],
            points=z["points"],
            volume_estime=z["volume_moyen"],
            centre_x=centre["x"],
            centre_y=centre["y"],
        )
        zone.frequence_collecte = z.get("frequence_collecte", "quotidien")
        zone.priorite = z.get("priorite", "normale")
        zones.append(zone)
    return zones


def creer_dechetteries_depuis_graphe(graphe) -> list:
    """
    Extrait les déchetteries du graphe routier.

    Args:
        graphe: GrapheRoutier du niveau 1

    Returns:
        Liste d'objets Dechetterie
    """
    dechetteries = []
    for sommet_id, sommet in graphe.sommets.items():
        if isinstance(sommet, Dechetterie):
            dechetteries.append(sommet)
    return dechetteries


def optimiser_affectation(
    camions_data: list,
    zones_data: list,
    zones_incompatibles: list,
    graphe,
) -> dict:
    """
    Lance l'optimisation d'affectation niveau 2.
    
    Le système choisit automatiquement la déchetterie la plus proche pour chaque zone
    lors du calcul des coûts d'affectation.

    Args:
        camions_data: Liste des camions
        zones_data: Liste des zones
        zones_incompatibles: Liste de paires incompatibles
        graphe: GrapheRoutier du niveau 1 (contient les déchetteries)

    Returns:
        Dict avec affectation, statistiques et graphe_biparti
    """
    camions = creer_camions_depuis_data(camions_data)
    zones = creer_zones_depuis_data(zones_data)
    
    # Extraire les déchetteries du graphe
    dechetteries = creer_dechetteries_depuis_graphe(graphe)

    affectateur = AffectateurBiparti(camions, zones, graphe, dechetteries)
    affectateur.zones_incompatibles = zones_incompatibles

    affectation = affectateur.affectation_gloutonne()
    affectation_eq = affectateur.equilibrage_charges(affectation)

    zones_par_id = {z.id: z for z in zones}
    camions_par_id = {c.id: c for c in camions}

    liste_affectation = []
    for camion_id, zone_ids in affectation_eq.items():
        if not zone_ids:
            continue
        camion = camions_par_id[camion_id]
        charge = sum(zones_par_id[zid].volume_estime for zid in zone_ids)
        cout_estime = sum(
            affectateur.calculer_cout_affectation(camion_id, zid) for zid in zone_ids
        )
        pct = (charge / camion.capacite * 100) if camion.capacite else 0
        liste_affectation.append({
            "camion_id": camion_id,
            "zones_affectees": zone_ids,
            "charge_totale": round(charge, 2),
            "cout_estime": round(cout_estime, 2),
            "pourcentage_utilisation": round(pct, 2),
        })

    stats = affectateur.calculer_statistiques(affectation_eq)
    graphe_biparti = affectateur.generer_graphe_biparti()

    return {
        "affectation": liste_affectation,
        "statistiques": stats,
        "graphe_biparti": graphe_biparti,
    }
