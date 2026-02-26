# -*- coding: utf-8 -*-
"""Contrôleur Camions - CRUD."""
from flask import Blueprint, request, jsonify
from backend.models import db, Camion, User

camions_bp = Blueprint('camions', __name__, url_prefix='/api/camions')

def _auth():
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Non authentifié'}), 401
    parts = auth[7:].strip().split(':')
    if len(parts) != 2:
        return None, jsonify({'error': 'Token invalide'}), 401
    user = User.query.get(parts[0])
    if not user:
        return None, jsonify({'error': 'Utilisateur introuvable'}), 401
    return user, None

@camions_bp.route('', methods=['GET'])
def list_camions():
    user, err = _auth()
    if err:
        return err
    etat = request.args.get('etat')
    q = Camion.query
    if etat:
        q = q.filter_by(etat=etat)
    return jsonify([c.to_dict() for c in q.all()])

@camions_bp.route('/<camion_id>', methods=['GET'])
def get_camion(camion_id):
    user, err = _auth()
    if err:
        return err
    c = Camion.query.get(camion_id)
    if not c:
        return jsonify({'error': 'Camion introuvable'}), 404
    return jsonify(c.to_dict())

@camions_bp.route('', methods=['POST'])
def create_camion():
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    data = request.get_json() or {}
    immat = (data.get('immatriculation') or '').strip()
    if not immat:
        return jsonify({'error': 'Immatriculation requise'}), 400
    if Camion.query.filter_by(immatriculation=immat).first():
        return jsonify({'error': 'Immatriculation déjà utilisée'}), 400
    import uuid
    c = Camion(
        id=str(uuid.uuid4())[:8], immatriculation=immat,
        capacite=int(data.get('capacite', 5000)), type=data.get('type', 'benne'),
        annee=data.get('annee'), etat=data.get('etat', 'operationnel'),
        chauffeur_id=data.get('chauffeur_id'), kilometrage=int(data.get('kilometrage', 0)),
        derniere_maintenance=data.get('derniere_maintenance'),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201

@camions_bp.route('/<camion_id>', methods=['PUT'])
def update_camion(camion_id):
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    c = Camion.query.get(camion_id)
    if not c:
        return jsonify({'error': 'Camion introuvable'}), 404
    data = request.get_json() or {}
    for k in ('immatriculation', 'capacite', 'type', 'annee', 'etat', 'chauffeur_id', 'kilometrage', 'derniere_maintenance'):
        if k in data:
            setattr(c, k, data[k])
    db.session.commit()
    return jsonify(c.to_dict())

@camions_bp.route('/<camion_id>', methods=['DELETE'])
def delete_camion(camion_id):
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    c = Camion.query.get(camion_id)
    if not c:
        return jsonify({'error': 'Camion introuvable'}), 404
    db.session.delete(c)
    db.session.commit()
    return '', 204
