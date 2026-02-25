# -*- coding: utf-8 -*-
"""
Client OSRM - Récupération des distances routières réelles via l'API OSRM Table.

Utilisé pour optimiser les routes avec les vraies distances routières.
Même API que l'ancienne version web_app/frontend (route/v1 pour display côté client).

OSRM Table Service: 1 requête = matrice n×n complète
https://project-osrm.org/docs/v5.24.0/api/#table-service
"""

import math
import urllib.request
import urllib.error
import json
import time
from typing import List, Dict, Tuple, Optional

# Debug: activer pour tracer précisément les appels OSRM
OSRM_DEBUG = True
def _debug(msg: str, *args):
    if OSRM_DEBUG:
        print(f"[OSRM] {msg}", *args)


# Centre Casablanca pour conversion x,y <-> lat,lng (identique au frontend api.js)
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
    Format identique à l'ancienne version: lng,lat dans l'URL.
    """
    if not points:
        _debug("fetch_osrm_table: points vides")
        return None

    if len(points) > 100:
        _debug("fetch_osrm_table: trop de points (%d > 100)", len(points))
        return None

    # Format OSRM: lng1,lat1;lng2,lat2;... (identique à l'ancienne version map.js)
    coords_str = ";".join(f"{lng},{lat}" for lat, lng in points)
    url = f"{base_url}/table/v1/driving/{coords_str}?annotations=distance,duration"
    _debug("APPEL Table API: %d points, URL len=%d", len(points), len(url))

    timeout_sec = 30
    headers = {"User-Agent": "VillePropre/1.0 (https://github.com)"}

    for attempt in range(2):
        t0 = time.time()
        try:
            _debug("Tentative %d/2 - requête HTTP...", attempt + 1)
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                elapsed = time.time() - t0
                raw = resp.read().decode()
                _debug("Réponse HTTP 200 en %.2fs, body len=%d", elapsed, len(raw))
                data = json.loads(raw)
        except urllib.error.HTTPError as e:
            elapsed = time.time() - t0
            _debug("HTTPError %s après %.2fs: %s", e.code, elapsed, e.reason)
            try:
                body = e.read().decode()[:500] if e.fp else ""
                _debug("Body: %s", body)
            except Exception:
                pass
            return None
        except urllib.error.URLError as e:
            elapsed = time.time() - t0
            err_msg = str(e.reason) if e.reason else str(e)
            _debug("URLError après %.2fs: %s", elapsed, err_msg)
            if ("timed out" in err_msg.lower() or "timeout" in err_msg.lower()) and attempt == 0:
                _debug("Retry après timeout...")
                continue
            return None
        except (TimeoutError, OSError) as e:
            elapsed = time.time() - t0
            _debug("TimeoutError/OSError après %.2fs: %s", elapsed, e)
            if attempt == 0:
                _debug("Retry...")
                continue
            return None
        except json.JSONDecodeError as e:
            _debug("JSONDecodeError: %s", e)
            return None

        if data.get("code") != "Ok":
            _debug("OSRM code != Ok: %s", data.get("code"))
            return None

        dist = data.get("distances", [])
        dur = data.get("durations", [])
        _debug("Succès: distances=%s, durations=%s", type(dist).__name__, type(dur).__name__)
        return {"distances": dist, "durations": dur}

    _debug("Échec après 2 tentatives")
    return None


def build_distance_matrix_from_osrm(
    depot_data: Dict,
    points_data: List[Dict],
    dechetteries_data: List[Dict]
) -> Optional[Dict[Tuple[int, int], float]]:
    """
    Construit la matrice de distances routières à partir d'OSRM Table API.
    Même ordre que l'ancienne version: depot + points + dechetteries.
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
    _debug("build_distance_matrix: %d points (depot + %d collecte + %d dechetteries)",
           len(latlng_list), len(points_data), len(dechetteries_data))

    result = fetch_osrm_table(latlng_list)
    if result is None:
        _debug("build_distance_matrix: fetch_osrm_table retourne None")
        return None

    dist_raw = result.get("distances")  # OSRM: mètres (2D ou flat)
    durations_s = result.get("durations")  # OSRM: secondes (fallback)
    n = len(id_list)

    def _get_cell(data, i, j):
        """Lit data[i][j] (2D) ou data[i*n+j] (flat)."""
        if not data or not isinstance(data, (list, tuple)):
            return None
        try:
            row = data[i] if i < len(data) else None
            if row is not None and isinstance(row, (list, tuple)):
                return row[j] if j < len(row) else None
            idx = i * n + j
            return data[idx] if 0 <= idx < len(data) else None
        except (IndexError, TypeError, KeyError):
            return None

    matrice = {}
    for i in range(n):
        for j in range(n):
            if i == j:
                matrice[(id_list[i], id_list[j])] = 0.0
            else:
                val = _get_cell(dist_raw, i, j)
                if val is not None:
                    matrice[(id_list[i], id_list[j])] = float(val) / 1000.0
                else:
                    val_dur = _get_cell(durations_s, i, j)
                    if val_dur is not None:
                        matrice[(id_list[i], id_list[j])] = (float(val_dur) / 3600.0) * 30.0
                    else:
                        matrice[(id_list[i], id_list[j])] = 999999.0

    return matrice
