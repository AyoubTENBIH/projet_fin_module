# -*- coding: utf-8 -*-
"""
API Routes - Optimisation des routes de collecte avec déchetteries
Utilise l'optimiseur de routes du niveau 2 pour planifier les trajets optimaux.
"""

import sys
from pathlib import Path

# Ajouter le chemin vers les modules niveau 2
NIVEAU2_SRC = Path(__file__).resolve().parent.parent.parent.parent / "niveau2" / "src"
sys.path.insert(0, str(NIVEAU2_SRC))

from optimiseur_routes import optimiser_collecte


def optimiser_routes_collecte(depot_data: dict, points_data: list,
                               dechetteries_data: list, camions_data: list,
                               use_osrm: bool = False, time_limit_seconds: float = None,
                               debug_coverage: bool = False) -> dict:
    """
    Optimise les routes de collecte avec stratégie hybride (adaptation automatique
    au nombre de points) et méta-heuristiques pour les grandes instances.
    
    Stratégie : selon le nombre de points (small/medium/large/xlarge), les algorithmes
    (2-opt, 3-opt, Or-opt, recuit simulé, ILS) et les plafonds d'itérations sont
    choisis automatiquement pour éviter blocage et lenteur.
    
    Args:
        depot_data: Données du dépôt {id, x, y, nom}
        points_data: Liste des points de collecte [{id, x, y, nom, volume, priorite}, ...]
        dechetteries_data: Liste des déchetteries [{id, x, y, nom, capacite_max}, ...]
        camions_data: Liste des camions [{id, capacite, cout_fixe, zones_accessibles}, ...]
        use_osrm: Si True, utilise les distances routières OSRM
        time_limit_seconds: Limite de temps (s). Au-delà, améliorations raccourcies (évite blocage).
    
    Returns:
        Dictionnaire : routes, statistiques (dont strategie_optimisation), depot, dechetteries
    """
    # Valider les données d'entrée
    if not depot_data:
        raise ValueError("Dépôt requis")
    if not points_data:
        raise ValueError("Points de collecte requis")
    if not camions_data:
        raise ValueError("Camions requis")
    
    # Assurer que le dépôt a un ID
    if 'id' not in depot_data:
        depot_data['id'] = 0
    
    # Assurer que chaque point a un volume
    for point in points_data:
        if 'volume' not in point:
            point['volume'] = 0
    
    # Appeler l'optimiseur (stratégie hybride + optionnel time_limit + debug couverture)
    resultat = optimiser_collecte(
        depot_data=depot_data,
        points_data=points_data,
        dechetteries_data=dechetteries_data,
        camions_data=camions_data,
        use_osrm=use_osrm,
        time_limit_seconds=time_limit_seconds,
        debug_coverage=debug_coverage
    )
    return resultat
