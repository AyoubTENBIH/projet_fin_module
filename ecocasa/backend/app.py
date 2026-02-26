# -*- coding: utf-8 -*-
"""
EcoCasa - Application Flask (MVC)
Backend API + MySQL, sert le frontend statique.
"""
import sys
from pathlib import Path

# Racine du projet = parent de backend/
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from flask import Flask, send_from_directory
from flask_cors import CORS

from backend.config import config
from backend.models import db
from backend.controllers import (
    auth_bp, users_bp, camions_bp, depot_bp, points_bp,
    dechetteries_bp, planning_bp, tracking_bp, stats_bp,
)

# Dossier frontend (HTML, JS, CSS)
FRONTEND_DIR = PROJECT_ROOT / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR))
app.config['SECRET_KEY'] = config.SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = config.MYSQL_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, origins=["http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:3000"],
     allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

db.init_app(app)

# Enregistrer les blueprints (contrôleurs)
app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(camions_bp)
app.register_blueprint(depot_bp)
app.register_blueprint(points_bp)
app.register_blueprint(dechetteries_bp)
app.register_blueprint(planning_bp)
app.register_blueprint(tracking_bp)
app.register_blueprint(stats_bp)

# Page d'accueil = login
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

# Servir les fichiers statiques (admin/, chauffeur/, js/, css/)
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)

@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok", "message": "EcoCasa API"}

# Création des tables au premier run (si besoin)
with app.app_context():
    db.create_all()
    from backend.services.auth_service import ensure_demo_users
    ensure_demo_users()

if __name__ == "__main__":
    print("=" * 50)
    print("EcoCasa API - http://localhost:5001")
    print("=" * 50)
    app.run(debug=True, host="0.0.0.0", port=5001)
