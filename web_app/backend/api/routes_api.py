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
                               use_osrm: bool = False) -> dict:
    """
    Optimise les routes de collecte avec gestion intelligente des déchetteries.
    
    Cette fonction utilise plusieurs algorithmes d'optimisation :
    1. Nearest Neighbor (Plus Proche Voisin) - O(n²)
    2. 2-opt Local Search - O(n³) dans le pire cas
    3. Or-opt - O(n²) par itération
    4. Insertion Intelligente des Déchetteries - O(n×d)
    
    Le processus complet :
    1. Répartit les points de collecte entre les camions
    2. Construit une route initiale pour chaque camion
    3. Insère les visites aux déchetteries quand nécessaire (capacité atteinte)
    4. Améliore les routes avec 2-opt et Or-opt
    5. Optimise le placement des déchetteries pour minimiser les détours
    
    Args:
        depot_data: Données du dépôt {id, x, y, nom}
        points_data: Liste des points de collecte [{id, x, y, nom, volume, priorite}, ...]
        dechetteries_data: Liste des déchetteries [{id, x, y, nom, capacite_max}, ...]
        camions_data: Liste des camions [{id, capacite, cout_fixe, zones_accessibles}, ...]
    
    Returns:
        Dictionnaire contenant :
        - routes: Liste des routes optimisées avec détails des étapes
        - statistiques: Statistiques globales (distance totale, volume, etc.)
        - depot: Informations du dépôt
        - dechetteries: Liste des déchetteries utilisées
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
    
    # Appeler l'optimiseur
    resultat = optimiser_collecte(
        depot_data=depot_data,
        points_data=points_data,
        dechetteries_data=dechetteries_data,
        camions_data=camions_data,
        use_osrm=use_osrm
    )
    
    return resultat
