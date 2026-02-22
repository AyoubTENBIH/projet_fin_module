# -*- coding: utf-8 -*-
"""
Service Planning Niveau 3 - VillePropre
Wrapper pour générer le planning hebdomadaire depuis les données web.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Chemins des modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
NIVEAU1_SRC = PROJECT_ROOT / "niveau1" / "src"
NIVEAU2_SRC = PROJECT_ROOT / "niveau2" / "src"
NIVEAU3_SRC = PROJECT_ROOT / "niveau3" / "src"

for p in [NIVEAU1_SRC, NIVEAU2_SRC, NIVEAU3_SRC]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from affectateur_biparti import AffectateurBiparti
from camion import Camion
from zone import Zone
from dechetterie import Dechetterie
from creneau_horaire import CreneauHoraire
from contrainte_temporelle import ContrainteTemporelle
from planificateur_triparti import PlanificateurTriparti

# Import API existantes pour réutiliser la création du graphe
from api.niveau1_api import creer_graphe_depuis_points


def _creer_affectateur_et_affectation(
    points: List[dict],
    connexions: List[dict],
    camions_data: List[dict],
    zones_data: List[dict],
    dechetteries_data: List[dict],
    zones_incompatibles: Optional[List] = None,
) -> tuple:
    """
    Crée le graphe N1 et l'affectateur N2 depuis les données web.

    Returns:
        (graphe, affectateur, affectation_n2_dict)
        affectation_n2_dict: {camion_id: [zone_ids]}
    """
    # Réutiliser la création du graphe N1
    graphe = creer_graphe_depuis_points(points, connexions, dechetteries_data)

    camions = []
    for c in camions_data:
        camion = Camion(
            id_camion=c["id"],
            capacite=c["capacite"],
            cout_fixe=c["cout_fixe"],
            zones_accessibles=c.get("zones_accessibles", []),
        )
        pos = c.get("position_initiale", {})
        camion.position_initiale = (
            float(pos.get("x", 0)),
            float(pos.get("y", 0)),
        )
        camions.append(camion)

    zones = []
    for z in zones_data:
        centre = z["centre"]
        zone = Zone(
            id_zone=z["id"],
            points=z["points"],
            volume_estime=z["volume_moyen"],
            centre_x=float(centre["x"]),
            centre_y=float(centre["y"]),
        )
        zone.frequence_collecte = z.get("frequence_collecte", "quotidien")
        zone.priorite = z.get("priorite", "normale")
        zones.append(zone)

    dechetteries = []
    for sommet in graphe.sommets.values():
        if isinstance(sommet, Dechetterie):
            dechetteries.append(sommet)

    affectateur = AffectateurBiparti(camions, zones, graphe, dechetteries)
    affectateur.zones_incompatibles = zones_incompatibles or []
    affectation_eq = affectateur.affectation_gloutonne()
    affectation_eq = affectateur.equilibrage_charges(affectation_eq)

    return graphe, affectateur, affectation_eq


def generer_planning(
    creneaux: List[dict],
    contraintes: dict,
    camions_data: List[dict],
    zones_data: List[dict],
    points: List[dict],
    connexions: List[dict],
    dechetteries_data: List[dict],
    zones_incompatibles: Optional[List] = None,
    horizon_jours: int = 7,
    use_osrm: bool = False,
) -> dict:
    """
    Génère le planning hebdomadaire.

    Args:
        creneaux: Liste des créneaux horaires
        contraintes: fenetres_zone, pauses_obligatoires, zones_interdites_nuit
        camions_data, zones_data, points, connexions, dechetteries_data
        horizon_jours: 7 par défaut
        use_osrm: non utilisé pour l'instant (réservé)

    Returns:
        {
            "planification_hebdomadaire": {...},
            "indicateurs": {...}
        }
    """
    graphe, affectateur, affectation_n2 = _creer_affectateur_et_affectation(
        points, connexions, camions_data, zones_data, dechetteries_data, zones_incompatibles
    )

    # Créer les créneaux
    creneaux_obj = []
    for i, c in enumerate(creneaux):
        creneau = CreneauHoraire(
            id_creneau=c.get("id", i + 1),
            debut=c["debut"],
            fin=c["fin"],
            jour=c["jour"],
            cout_congestion=c.get("congestion", c.get("niveau_congestion", 1.0)),
        )
        creneaux_obj.append(creneau)

    if not creneaux_obj:
        return {
            "error": "Aucun créneau défini",
            "planification_hebdomadaire": {},
            "indicateurs": {},
        }

    # Contraintes temporelles
    ct = ContrainteTemporelle()
    if contraintes:
        ct.charger_depuis_dict({
            "fenetres_zone": contraintes.get("fenetres_zone", []),
            "pauses_obligatoires": contraintes.get("pauses_obligatoires", contraintes.get("pauses_camion", [])),
            "zones_interdites_nuit": contraintes.get("zones_interdites_nuit", []),
        })

    planificateur = PlanificateurTriparti(affectateur, ct)
    planificateur.ajouter_creneaux(creneaux_obj)

    planning = planificateur.generer_plan_optimal(affectation_n2, horizon_jours)
    indicateurs = planificateur.evaluer_plan(planning)

    return {
        "planification_hebdomadaire": planning,
        "indicateurs": indicateurs,
    }
