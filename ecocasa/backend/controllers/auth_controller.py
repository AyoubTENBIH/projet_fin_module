# -*- coding: utf-8 -*-
"""Contrôleur Authentification - login, session."""
from datetime import datetime
from flask import Blueprint, request, jsonify
from backend.models import db, User
from backend.services.auth_service import verify_password, ensure_demo_users

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    """POST { email, password } -> { user, token } ou 401."""
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
    token = f"{user.id}:{user.role}"  # simple token; en prod utiliser JWT
    return jsonify({
        'user': user.to_dict(),
        'token': token,
        'redirect': '/admin/dashboard.html' if user.role == 'admin' else '/chauffeur/interface.html',
    })

@auth_bp.route('/me', methods=['GET'])
def me():
    """Vérifier la session (header Authorization: Bearer <token>)."""
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return jsonify({'error': 'Non authentifié'}), 401
    token = auth[7:].strip()
    parts = token.split(':')
    if len(parts) != 2:
        return jsonify({'error': 'Token invalide'}), 401
    user_id, _ = parts[0], parts[1]
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Utilisateur introuvable'}), 401
    return jsonify({'user': user.to_dict()})
