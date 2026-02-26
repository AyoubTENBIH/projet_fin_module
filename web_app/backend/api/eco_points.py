# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
from models_eco import db, PointCollecte, User

points_bp = Blueprint('eco_points', __name__, url_prefix='/api/points')

def _auth():
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Non authentifié'}), 401
    parts = auth[7:].strip().split(':')
    user = User.query.get(parts[0]) if len(parts) == 2 else None
    if not user:
        return None, jsonify({'error': 'Token invalide'}), 401
    return user, None

@points_bp.route('', methods=['GET'])
def list_points():
    user, err = _auth()
    if err:
        return err
    zone = request.args.get('zone_id')
    q = PointCollecte.query
    if zone is not None:
        q = q.filter_by(zone_id=int(zone))
    return jsonify([p.to_dict() for p in q.all()])

@points_bp.route('/<point_id>', methods=['GET'])
def get_point(point_id):
    user, err = _auth()
    if err:
        return err
    p = PointCollecte.query.get(point_id)
    if not p:
        return jsonify({'error': 'Point introuvable'}), 404
    return jsonify(p.to_dict())

@points_bp.route('', methods=['POST'])
def create_point():
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
    p = PointCollecte(id=data.get('id') or str(uuid.uuid4())[:8], nom=nom, type=data.get('type', 'collecte'), lat=float(data.get('lat', 33.57)), lng=float(data.get('lng', -7.59)), volume_moyen=int(data.get('volume_moyen', 0)), frequence=data.get('frequence', 'quotidien'), priorite=data.get('priorite', 'normale'), zone_id=data.get('zone_id'), horaire_collecte=data.get('horaire_collecte'), contact=data.get('contact'), adresse=data.get('adresse'))
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201

@points_bp.route('/<point_id>', methods=['PUT'])
def update_point(point_id):
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    p = PointCollecte.query.get(point_id)
    if not p:
        return jsonify({'error': 'Point introuvable'}), 404
    data = request.get_json() or {}
    for k in ('nom', 'type', 'lat', 'lng', 'volume_moyen', 'frequence', 'priorite', 'zone_id', 'horaire_collecte', 'contact', 'adresse'):
        if k in data:
            setattr(p, k, data[k])
    db.session.commit()
    return jsonify(p.to_dict())

@points_bp.route('/<point_id>', methods=['DELETE'])
def delete_point(point_id):
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    p = PointCollecte.query.get(point_id)
    if not p:
        return jsonify({'error': 'Point introuvable'}), 404
    db.session.delete(p)
    db.session.commit()
    return '', 204
