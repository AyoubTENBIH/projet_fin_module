# -*- coding: utf-8 -*-
"""
Serveur Flask principal - Application Web VillePropre
Expose les API pour les niveaux 1 et 2, et sert les fichiers statiques du frontend.
"""

import sys
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Importer les modules API
from api.niveau1_api import calculer_matrice_distances, creer_graphe_depuis_points
from api.niveau2_api import optimiser_affectation
from api.routes_api import optimiser_routes_collecte
from api.niveau3_routes import (
    configure_creneaux,
    configure_contraintes,
    generer_planning_route,
    simulation_temps_reel,
)

# Configuration
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = PROJECT_ROOT / "web_app" / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR))
CORS(app)  # Autoriser les requêtes cross-origin


@app.route("/")
def index():
    """Page d'accueil : servir index.html"""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    """Servir les fichiers statiques (CSS, JS, assets)"""
    return send_from_directory(FRONTEND_DIR, path)


# ==================== API NIVEAU 1 ====================

@app.route("/api/niveau1/calculer-distances", methods=["POST"])
def api_calculer_distances():
    """
    Endpoint pour calculer la matrice des distances (Niveau 1).

    Body JSON attendu:
    {
        "points": [
            {"id": 0, "x": 0, "y": 0, "nom": "Depot"},
            {"id": 1, "x": 2.5, "y": 3.1, "nom": "Point 1"}
        ],
        "connexions": [
            {"depart": 0, "arrivee": 1, "distance": null}
        ],
        "dechetteries": [  # Optionnel
            {"id": 11, "x": 3.5, "y": 4.0, "nom": "Déchetterie Nord", "capacite_max": 10000, ...}
        ]
    }
    """
    try:
        data = request.json
        points = data.get("points", [])
        connexions = data.get("connexions", [])
        dechetteries = data.get("dechetteries", [])

        if not points:
            return jsonify({"error": "Aucun point fourni"}), 400

        resultat = calculer_matrice_distances(points, connexions, dechetteries)
        return jsonify(resultat), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== API NIVEAU 2 ====================

@app.route("/api/niveau2/optimiser", methods=["POST"])
def api_optimiser_affectation():
    """
    Endpoint pour optimiser l'affectation zones ↔ camions (Niveau 2).

    Body JSON attendu:
    {
        "camions": [
            {"id": 1, "capacite": 5000, "cout_fixe": 200, "zones_accessibles": [1,2]}
        ],
        "zones": [
            {"id": 1, "points": [1,2], "volume_moyen": 1200, "centre": {"x": 3.5, "y": 3.5}, "priorite": "haute"}
        ],
        "zones_incompatibles": [[1, 2]],
        "points": [...],  # Points du niveau 1 pour créer le graphe
        "connexions": [...]  # Connexions du niveau 1
    }
    """
    try:
        data = request.json
        camions_data = data.get("camions", [])
        zones_data = data.get("zones", [])
        zones_incompatibles = data.get("zones_incompatibles", [])
        points = data.get("points", [])
        connexions = data.get("connexions", [])
        dechetteries_data = data.get("dechetteries", [])

        if not camions_data or not zones_data:
            return jsonify({"error": "Camions et zones requis"}), 400

        # Créer le graphe du niveau 1 pour le niveau 2 (inclut les déchetteries)
        graphe = creer_graphe_depuis_points(points, connexions, dechetteries_data)

        resultat = optimiser_affectation(
            camions_data,
            zones_data,
            zones_incompatibles,
            graphe,
        )
        return jsonify(resultat), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== API ROUTES OPTIMISÉES ====================

@app.route("/api/routes/optimiser", methods=["POST"])
def api_optimiser_routes():
    """
    Endpoint pour optimiser les routes de collecte avec déchetteries.

    Algorithmes utilisés :
    - Nearest Neighbor (Plus Proche Voisin) : Construction initiale
    - 2-opt Local Search : Amélioration des routes
    - Or-opt : Optimisation complémentaire
    - Insertion Intelligente des Déchetteries : Gestion de capacité

    Body JSON attendu:
    {
        "depot": {"id": 0, "x": 0, "y": 0, "nom": "Dépôt"},
        "points": [
            {"id": 1, "x": 2.5, "y": 3.1, "nom": "Point 1", "volume": 150}
        ],
        "dechetteries": [
            {"id": 11, "x": 3.5, "y": 4.0, "nom": "Déchetterie Nord"}
        ],
        "camions": [
            {"id": 1, "capacite": 5000, "cout_fixe": 200, "zones_accessibles": []}
        ]
    }

    Retourne:
    {
        "routes": [
            {
                "camion_id": 1,
                "waypoints": [...],
                "distance_totale": 12.5,
                "volume_total_collecte": 1200,
                "nb_visites_dechetterie": 2,
                "details_etapes": [...]
            }
        ],
        "statistiques": {...},
        "depot": {...},
        "dechetteries": [...]
    }
    """
    try:
        data = request.json
        depot_data = data.get("depot", {})
        points_data = data.get("points", [])
        dechetteries_data = data.get("dechetteries", [])
        camions_data = data.get("camions", [])
        use_osrm = data.get("use_osrm", False)

        if not depot_data:
            return jsonify({"error": "Dépôt requis"}), 400
        if not points_data:
            return jsonify({"error": "Points de collecte requis"}), 400
        if not camions_data:
            return jsonify({"error": "Camions requis"}), 400

        resultat = optimiser_routes_collecte(
            depot_data,
            points_data,
            dechetteries_data,
            camions_data,
            use_osrm=use_osrm
        )
        return jsonify(resultat), 200

    except Exception as e:
        import traceback
        print(f"Erreur dans api_optimiser_routes: {e}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# ==================== API NIVEAU 3 ====================

@app.route("/api/niveau3/configure_creneaux", methods=["POST"])
def api_niveau3_configure_creneaux():
    """Enregistre les créneaux horaires."""
    return configure_creneaux()


@app.route("/api/niveau3/configure_contraintes", methods=["POST"])
def api_niveau3_configure_contraintes():
    """Enregistre les contraintes temporelles."""
    return configure_contraintes()


@app.route("/api/niveau3/generer_planning", methods=["POST"])
def api_niveau3_generer_planning():
    """Génère le planning hebdomadaire."""
    return generer_planning_route()


@app.route("/api/niveau3/simulation_temps_reel", methods=["GET"])
def api_niveau3_simulation():
    """Retourne les positions des camions pour l'animation."""
    return simulation_temps_reel()


# ==================== HEALTH CHECK ====================

@app.route("/api/health", methods=["GET"])
def health():
    """Vérification de l'état du serveur"""
    return jsonify({"status": "ok", "message": "API VillePropre opérationnelle"}), 200


if __name__ == "__main__":
    print("=" * 60)
    print("[CAMION] Application Web VillePropre")
    print("=" * 60)
    print(f"[FOLDER] Frontend: {FRONTEND_DIR}")
    print("[WEB] Serveur demarre sur http://localhost:5000")
    print("=" * 60)
    app.run(debug=True, host="0.0.0.0", port=5000)
