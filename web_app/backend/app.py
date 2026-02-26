# -*- coding: utf-8 -*-
"""
Serveur Flask principal - VillePropre + EcoAgadir
- API optimisation (niveau1, niveau2, niveau3, routes)
- API EcoAgadir (auth, users, camions, planning, tracking, stats) + MySQL
"""

import sys
import threading
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Configuration
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = PROJECT_ROOT / "web_app" / "frontend"
FRONTEND_REACT_DIR = PROJECT_ROOT / "web_app" / "frontend_react" / "dist"

app = Flask(__name__, static_folder=str(FRONTEND_DIR))

# EcoAgadir - MySQL (optionnel: si config présente, on active l'API EcoAgadir)
ECOAGADIR_LOADED = False
try:
    from config_eco import config_eco
    app.config["SQLALCHEMY_DATABASE_URI"] = config_eco.MYSQL_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    from models_eco import db
    db.init_app(app)
    from api.eco_auth import auth_bp
    from api.eco_users import users_bp
    from api.eco_camions import camions_bp
    from api.eco_depot import depot_bp
    from api.eco_points import points_bp
    from api.eco_dechetteries import dechetteries_bp
    from api.eco_planning import planning_bp
    from api.eco_tracking import tracking_bp
    from api.eco_stats import stats_bp
    for bp in (auth_bp, users_bp, camions_bp, depot_bp, points_bp, dechetteries_bp, planning_bp, tracking_bp, stats_bp):
        app.register_blueprint(bp)
    ECOAGADIR_LOADED = True
    print("[EcoAgadir] Chargé (MySQL OK)")
except Exception as e:
    ECOAGADIR_LOADED = False
    import traceback
    print("[EcoAgadir] MySQL/API non chargé:", e)
    traceback.print_exc()


def _ecoagadir_fallback():
    """Réponse si quelqu'un appelle l'API auth alors qu'EcoAgadir n'est pas chargé."""
    print("[EcoAgadir] Fallback auth appelé (ce processus n'a pas chargé EcoAgadir)")
    return jsonify({
        "error": "Backend EcoAgadir non chargé. Vérifier les logs du terminal backend.",
    }), 503


if not ECOAGADIR_LOADED:
    app.add_url_rule("/api/auth/login", "eco_auth_fallback", _ecoagadir_fallback, methods=["POST", "OPTIONS"])
    app.add_url_rule("/api/auth/me", "eco_auth_me_fallback", _ecoagadir_fallback, methods=["GET"])

# CORS (inclut Authorization pour EcoAgadir)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5000", "http://127.0.0.1:5000"],
     allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Importer les modules API VillePropre (optimisation)
from api.niveau1_api import calculer_matrice_distances, creer_graphe_depuis_points
from api.niveau2_api import optimiser_affectation
from api.routes_api import optimiser_routes_collecte
from api.niveau3_routes import (
    configure_creneaux,
    configure_contraintes,
    generer_planning_route,
    simulation_temps_reel,
)


@app.route("/")
def index():
    """Page d'accueil : servir index.html (interface classique)"""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/v2")
@app.route("/v2/")
def index_react():
    """Nouvelle interface React (style Airbnb) - nécessite 'npm run build' dans frontend_react"""
    if FRONTEND_REACT_DIR.exists():
        return send_from_directory(FRONTEND_REACT_DIR, "index.html")
    return "Build React requis : cd web_app/frontend_react && npm run build", 404


@app.route("/v2/<path:path>")
def serve_react_static(path):
    """Fichiers statiques du frontend React"""
    if FRONTEND_REACT_DIR.exists():
        return send_from_directory(FRONTEND_REACT_DIR, path)
    return "Not found", 404


@app.route("/<path:path>", methods=["GET", "HEAD"])
def serve_static(path):
    """Servir les fichiers statiques (CSS, JS, assets). Ne pas capturer /api (évite 405 sur POST)."""
    if path.startswith("api/"):
        return jsonify({"error": "Route API non trouvée ou EcoAgadir non chargé (vérifier MySQL)."}), 404
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

@app.route("/api/routes/optimiser", methods=["GET", "POST"])
def api_optimiser_routes():
    """GET → 405 (il faut utiliser POST). POST → optimisation des routes."""
    if request.method == "GET":
        return jsonify({"error": "Méthode GET non supportée. Utilisez POST avec un body JSON."}), 405

    print("[Routes] POST /api/routes/optimiser reçu")
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

        # Lancer l'optimisation dans un thread avec timeout (évite blocage > 60s)
        result_container = {}
        exc_container = {}
        def run_optim():
            try:
                result_container["result"] = optimiser_routes_collecte(
                    depot_data,
                    points_data,
                    dechetteries_data,
                    camions_data,
                    use_osrm=use_osrm
                )
            except Exception as e:
                exc_container["exc"] = e

        thread = threading.Thread(target=run_optim, daemon=True)
        thread.start()
        thread.join(timeout=50)
        if thread.is_alive():
            print("[Routes] Optimisation timeout 50s - abandon")
            return jsonify({
                "error": "Optimisation trop longue (timeout 50s). Réduisez le nombre de points ou réessayez."
            }), 503
        if "exc" in exc_container:
            e = exc_container["exc"]
            if use_osrm:
                print(f"[Routes] Erreur avec OSRM, retry sans OSRM: {e}")
                try:
                    resultat = optimiser_routes_collecte(
                        depot_data,
                        points_data,
                        dechetteries_data,
                        camions_data,
                        use_osrm=False
                    )
                    return jsonify(resultat), 200
                except Exception as e2:
                    import traceback
                    print(f"Erreur dans api_optimiser_routes (sans OSRM): {e2}")
                    print(traceback.format_exc())
                    return jsonify({"error": str(e2)}), 500
            raise e
        resultat = result_container["result"]
        print("[Routes] Optimisation terminée,", len(resultat.get("routes", [])), "route(s)")
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
    if ECOAGADIR_LOADED:
        with app.app_context():
            from models_eco import db
            db.create_all()
            from services_eco.auth_service import ensure_demo_users
            ensure_demo_users()
    import os
    print("=" * 60)
    print("[WEB] VillePropre + EcoAgadir sur http://localhost:5000")
    print("[WEB] PID processus:", os.getpid(), "- C'est CE processus qui doit recevoir les requêtes.")
    if not ECOAGADIR_LOADED:
        print("[!] EcoAgadir (login, users, etc.) NON charge - definir MYSQL_USER=root puis relancer")
    print("=" * 60)
    # use_reloader=False évite un 2e processus où EcoAgadir peut échouer au chargement
    app.run(debug=True, host="0.0.0.0", port=5000, use_reloader=False)
