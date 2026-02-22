# -*- coding: utf-8 -*-
"""
Client OSRM - Récupération des distances routières réelles via l'API OSRM Table.

Utilisé pour optimiser les routes avec les vraies distances routières
au lieu des distances euclidiennes.

OSRM Table Service: 1 requête = matrice n×n complète
https://project-osrm.org/docs/v5.24.0/api/#table-service
"""

import math
import urllib.request
import urllib.error
import json
from typing import List, Dict, Tuple, Optional


# Centre Casablanca pour conversion x,y <-> lat,lng (identique au frontend)
CASABLANCA_LAT = 33.5731
CASABLANCA_LNG = -7.5898
DEG_TO_KM = 111.0
COS_LAT = math.cos(CASABLANCA_LAT * math.pi / 180)


def xy_to_latlng(x: float, y: float) -> Tuple[float, float]:
    """Convertit coordonnées projetées (x,y) en (lat, lng) pour OSRM."""
    lat = CASABLANCA_LAT + (y / DEG_TO_KM)
    lng = CASABLANCA_LNG + (x / (DEG_TO_KM * COS_LAT))
    return (lat, lng)


def fetch_osrm_table(points: List[Tuple[float, float]], 
                     base_url: str = "https://router.project-osrm.org") -> Optional[Dict]:
    """
    Récupère la matrice de distances et durées via OSRM Table API.
    
    Args:
        points: Liste de (lat, lng) pour chaque point
        base_url: URL de base OSRM
    
    Returns:
        {"distances": [[...]], "durations": [[...]]} ou None si échec
    """
    if not points:
        return None
    
    # OSRM limite à 100 points par requête
    if len(points) > 100:
        return None
    
    # Format: lng1,lat1;lng2,lat2;...
    coords_str = ";".join(f"{lng},{lat}" for lat, lng in points)
    url = f"{base_url}/table/v1/driving/{coords_str}?annotations=distance,duration"
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "VillePropre/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        
        if data.get("code") != "Ok":
            return None
        
        return {
            "distances": data.get("distances", []),
            "durations": data.get("durations", [])
        }
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as e:
        print(f"[OSRM] Erreur: {e}")
        return None


def build_distance_matrix_from_osrm(
    depot_data: Dict,
    points_data: List[Dict],
    dechetteries_data: List[Dict]
) -> Optional[Dict[Tuple[int, int], float]]:
    """
    Construit la matrice de distances routières à partir d'OSRM.
    
    Args:
        depot_data: {id, x, y, nom}
        points_data: [{id, x, y, nom, volume}, ...]
        dechetteries_data: [{id, x, y, nom}, ...]
    
    Returns:
        Matrice {(id1, id2): distance_km} ou None si OSRM indisponible
    """
    depot_id = depot_data.get("id", 0)
    depot_x = float(depot_data.get("x", 0))
    depot_y = float(depot_data.get("y", 0))
    
    xy_list = [(depot_x, depot_y)]
    id_list = [depot_id]
    
    for p in points_data:
        xy_list.append((float(p.get("x", 0)), float(p.get("y", 0))))
        id_list.append(p["id"])
    
    for d in dechetteries_data:
        xy_list.append((float(d.get("x", 0)), float(d.get("y", 0))))
        id_list.append(d["id"])
    
    latlng_list = [xy_to_latlng(x, y) for x, y in xy_list]
    
    result = fetch_osrm_table(latlng_list)
    if result is None:
        return None
    
    dist_raw = result.get("distances")  # OSRM: mètres
    durations_s = result.get("durations")  # OSRM: secondes (fallback)
    
    matrice = {}
    n = len(id_list)
    
    for i in range(n):
        for j in range(n):
            if i == j:
                matrice[(id_list[i], id_list[j])] = 0.0
            elif dist_raw and i < len(dist_raw) and j < len(dist_raw[i]) and dist_raw[i][j] is not None:
                # Distances en mètres -> km
                matrice[(id_list[i], id_list[j])] = dist_raw[i][j] / 1000.0
            elif durations_s and i < len(durations_s) and j < len(durations_s[i]) and durations_s[i][j] is not None:
                # Fallback: estimer distance à partir du temps (vitesse moy 30 km/h)
                matrice[(id_list[i], id_list[j])] = (durations_s[i][j] / 3600.0) * 30.0
            else:
                # Pas de route trouvée - utiliser une grande valeur
                matrice[(id_list[i], id_list[j])] = 999999.0
    
    return matrice
