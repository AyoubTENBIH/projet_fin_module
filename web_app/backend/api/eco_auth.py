# -*- coding: utf-8 -*-
"""API EcoAgadir - Authentification."""
from datetime import datetime
from flask import Blueprint, request, jsonify
from models_eco import db, User
from services_eco.auth_service import verify_password, ensure_demo_users

auth_bp = Blueprint('eco_auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    print("[EcoAgadir] POST /api/auth/login reçu (route réelle)")
    ensure_demo_users()
    data = request.get_json() or {}
    email = (data.get('email') or '').strip()
    password = data.get('password') or ''
    if not email or not password:
        return jsonify({'error': 'Email et mot de passe requis'}), 400
    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(user.password_hash, password):
        return jsonify({'error': 'Identifiants incorrects'}), 401
    user.derniere_connexion = datetime.utcnow()
    db.session.commit()
    token = f"{user.id}:{user.role}"
    return jsonify({
        'user': user.to_dict(),
        'token': token,
        'redirect': '/admin/dashboard' if user.role == 'admin' else '/chauffeur',
    })

@auth_bp.route('/me', methods=['GET'])
def me():
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return jsonify({'error': 'Non authentifié'}), 401
    parts = auth[7:].strip().split(':')
    if len(parts) != 2:
        return jsonify({'error': 'Token invalide'}), 401
    user = User.query.get(parts[0])
    if not user:
        return jsonify({'error': 'Utilisateur introuvable'}), 401
    return jsonify({'user': user.to_dict()})
