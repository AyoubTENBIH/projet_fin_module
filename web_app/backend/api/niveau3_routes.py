# -*- coding: utf-8 -*-
"""
Routes API Niveau 3 - Planification temporelle hebdomadaire
"""

from flask import request, jsonify

from services.planning_service import generer_planning


def configure_creneaux():
    """
    POST /api/niveau3/configure_creneaux
    Enregistre les créneaux horaires (stockage session/côté client).
    Retourne un accusé de réception.
    """
    try:
        data = request.json or {}
        creneaux = data.get("creneaux", [])
        return jsonify({
            "status": "ok",
            "nb_creneaux": len(creneaux),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def configure_contraintes():
    """
    POST /api/niveau3/configure_contraintes
    Enregistre les contraintes temporelles (stockage session/côté client).
    """
    try:
        data = request.json or {}
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def generer_planning_route():
    """
    POST /api/niveau3/generer_planning
    Génère le planning hebdomadaire.

    Body:
    {
        "creneaux": [...],
        "contraintes": {...},
        "camions": [...],
        "zones": [...],
        "points": [...],
        "connexions": [...],
        "dechetteries": [...],
        "horizon_jours": 7,
        "use_osrm": false
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Corps de requête vide"}), 400

        creneaux = data.get("creneaux", [])
        if not creneaux:
            return jsonify({
                "error": "Veuillez d'abord configurer les créneaux horaires",
                "code": "NO_CRENEAUX",
            }), 400

        camions = data.get("camions", [])
        zones = data.get("zones", [])
        points = data.get("points", [])
        connexions = data.get("connexions", [])
        dechetteries = data.get("dechetteries", [])

        if not camions or not zones:
            return jsonify({
                "error": "Exécutez d'abord le Niveau 2 (Affecter Zones)",
                "code": "NO_NIVEAU2",
            }), 400

        if not points or not connexions:
            return jsonify({
                "error": "Exécutez d'abord le Niveau 1 (Calculer Distances)",
                "code": "NO_NIVEAU1",
            }), 400

        resultat = generer_planning(
            creneaux=creneaux,
            contraintes=data.get("contraintes", {}),
            camions_data=camions,
            zones_data=zones,
            points=points,
            connexions=connexions,
            dechetteries_data=dechetteries,
            zones_incompatibles=data.get("zones_incompatibles"),
            horizon_jours=data.get("horizon_jours", 7),
            use_osrm=data.get("use_osrm", False),
        )

        if "error" in resultat and resultat["error"]:
            return jsonify({
                "error": resultat["error"],
                "planification_hebdomadaire": resultat.get("planification_hebdomadaire", {}),
                "indicateurs": resultat.get("indicateurs", {}),
            }), 200

        return jsonify(resultat), 200

    except Exception as e:
        import traceback
        print(f"Erreur niveau3/generer_planning: {e}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


def simulation_temps_reel():
    """
    GET /api/niveau3/simulation_temps_reel?timestamp=...
    Retourne les positions des camions à un instant donné (pour l'animation).
    Pour l'instant, retourne des données factices basées sur le planning.
    """
    try:
        timestamp = request.args.get("timestamp", type=float)
        # TODO: Implémenter la logique de simulation à partir du planning
        return jsonify({
            "camions": [],
            "timestamp": timestamp,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
