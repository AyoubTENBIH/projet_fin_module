# -*- coding: utf-8 -*-
"""Contrôleur Utilisateurs / Chauffeurs - CRUD."""
from flask import Blueprint, request, jsonify
from backend.models import db, User, Camion
from backend.services.auth_service import hash_password

users_bp = Blueprint('users', __name__, url_prefix='/api/users')

def _require_auth(admin_only=False):
    """Extrait user depuis Authorization Bearer token. 401 si invalide."""
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Non authentifié'}), 401
    token = auth[7:].strip()
    parts = token.split(':')
    if len(parts) != 2:
        return None, jsonify({'error': 'Token invalide'}), 401
    user = User.query.get(parts[0])
    if not user:
        return None, jsonify({'error': 'Utilisateur introuvable'}), 401
    if admin_only and user.role != 'admin':
        return None, jsonify({'error': 'Accès réservé à l\'admin'}), 403
    return user, None

@users_bp.route('', methods=['GET'])
def list_users():
    user, err = _require_auth(admin_only=True)
    if err:
        return err
    role = request.args.get('role')
    q = User.query
    if role:
        q = q.filter_by(role=role)
    users = q.all()
    return jsonify([u.to_dict() for u in users])

@users_bp.route('/<user_id>', methods=['GET'])
def get_user(user_id):
    user, err = _require_auth()
    if err:
        return err
    if user.role != 'admin' and user.id != user_id:
        return jsonify({'error': 'Accès refusé'}), 403
    u = User.query.get(user_id)
    if not u:
        return jsonify({'error': 'Utilisateur introuvable'}), 404
    return jsonify(u.to_dict())

@users_bp.route('', methods=['POST'])
def create_user():
    user, err = _require_auth(admin_only=True)
    if err:
        return err
    data = request.get_json() or {}
    email = (data.get('email') or '').strip()
    if not email:
        return jsonify({'error': 'Email requis'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email déjà utilisé'}), 400
    import uuid
    uid = str(uuid.uuid4())[:8]
    pwd = data.get('password') or 'Chauffeur1!'
    u = User(
        id=uid, role=data.get('role', 'chauffeur'), nom=data.get('nom', ''), email=email,
        password_hash=hash_password(pwd), avatar=data.get('avatar', email[:2].upper()),
        telephone=data.get('telephone'), permis=data.get('permis'), status=data.get('status', 'actif'),
        camion_id=data.get('camion_id'), zone_affectee=data.get('zone_affectee'),
    )
    db.session.add(u)
    db.session.commit()
    return jsonify(u.to_dict()), 201

@users_bp.route('/<user_id>', methods=['PUT'])
def update_user(user_id):
    user, err = _require_auth(admin_only=True)
    if err:
        return err
    u = User.query.get(user_id)
    if not u:
        return jsonify({'error': 'Utilisateur introuvable'}), 404
    data = request.get_json() or {}
    for k in ('nom', 'email', 'telephone', 'permis', 'status', 'camion_id', 'zone_affectee', 'avatar'):
        if k in data:
            setattr(u, k, data[k])
    if data.get('password'):
        u.password_hash = hash_password(data['password'])
    db.session.commit()
    return jsonify(u.to_dict())

@users_bp.route('/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    user, err = _require_auth(admin_only=True)
    if err:
        return err
    u = User.query.get(user_id)
    if not u:
        return jsonify({'error': 'Utilisateur introuvable'}), 404
    db.session.delete(u)
    db.session.commit()
    return jsonify({'ok': True}), 204
