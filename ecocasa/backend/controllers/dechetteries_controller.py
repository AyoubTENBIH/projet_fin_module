# -*- coding: utf-8 -*-
"""Contrôleur Déchetteries - CRUD."""
from flask import Blueprint, request, jsonify
import json
from backend.models import db, Dechetterie, User

dechetteries_bp = Blueprint('dechetteries', __name__, url_prefix='/api/dechetteries')

def _auth():
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Non authentifié'}), 401
    parts = auth[7:].strip().split(':')
    user = User.query.get(parts[0]) if len(parts) == 2 else None
    if not user:
        return None, jsonify({'error': 'Token invalide'}), 401
    return user, None

@dechetteries_bp.route('', methods=['GET'])
def list_dechetteries():
    user, err = _auth()
    if err:
        return err
    return jsonify([d.to_dict() for d in Dechetterie.query.all()])

@dechetteries_bp.route('/<dec_id>', methods=['GET'])
def get_dechetterie(dec_id):
    user, err = _auth()
    if err:
        return err
    d = Dechetterie.query.get(dec_id)
    if not d:
        return jsonify({'error': 'Déchetterie introuvable'}), 404
    return jsonify(d.to_dict())

@dechetteries_bp.route('', methods=['POST'])
def create_dechetterie():
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    data = request.get_json() or {}
    nom = (data.get('nom') or '').strip()
    if not nom:
        return jsonify({'error': 'Nom requis'}), 400
    import uuid
    types_acceptes = data.get('types_acceptes', ['ordures', 'recyclable'])
    if isinstance(types_acceptes, list):
        types_acceptes = json.dumps(types_acceptes)
    d = Dechetterie(
        id=data.get('id') or str(uuid.uuid4())[:8], nom=nom,
        lat=float(data.get('lat', 33.58)), lng=float(data.get('lng', -7.49)),
        capacite_max=data.get('capacite_max'), types_acceptes=types_acceptes,
    )
    db.session.add(d)
    db.session.commit()
    return jsonify(d.to_dict()), 201

@dechetteries_bp.route('/<dec_id>', methods=['PUT'])
def update_dechetterie(dec_id):
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    d = Dechetterie.query.get(dec_id)
    if not d:
        return jsonify({'error': 'Déchetterie introuvable'}), 404
    data = request.get_json() or {}
    for k in ('nom', 'lat', 'lng', 'capacite_max'):
        if k in data:
            setattr(d, k, data[k])
    if 'types_acceptes' in data:
        d.types_acceptes = json.dumps(data['types_acceptes']) if isinstance(data['types_acceptes'], list) else data['types_acceptes']
    db.session.commit()
    return jsonify(d.to_dict())

@dechetteries_bp.route('/<dec_id>', methods=['DELETE'])
def delete_dechetterie(dec_id):
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    d = Dechetterie.query.get(dec_id)
    if not d:
        return jsonify({'error': 'Déchetterie introuvable'}), 404
    db.session.delete(d)
    db.session.commit()
    return '', 204
