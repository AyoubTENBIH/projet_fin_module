# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
from models_eco import db, Depot, User

depot_bp = Blueprint('eco_depot', __name__, url_prefix='/api/depot')

def _auth():
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Non authentifié'}), 401
    parts = auth[7:].strip().split(':')
    user = User.query.get(parts[0]) if len(parts) == 2 else None
    if not user:
        return None, jsonify({'error': 'Token invalide'}), 401
    return user, None

@depot_bp.route('', methods=['GET'])
def get_depot():
    user, err = _auth()
    if err:
        return err
    d = Depot.query.first()
    if not d:
        return jsonify(None)
    return jsonify(d.to_dict())

@depot_bp.route('', methods=['PUT'])
@depot_bp.route('/<depot_id>', methods=['PUT'])
def update_depot(depot_id=None):
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    data = request.get_json() or {}
    d = Depot.query.get(depot_id) if depot_id else Depot.query.first()
    if not d:
        import uuid
        d = Depot(id=str(uuid.uuid4())[:8], nom=data.get('nom', 'Dépôt'), lat=data.get('lat', 33.595), lng=data.get('lng', -7.52), adresse=data.get('adresse'), horaires=data.get('horaires'))
        db.session.add(d)
    else:
        for k in ('nom', 'lat', 'lng', 'adresse', 'horaires'):
            if k in data:
                setattr(d, k, data[k])
    db.session.commit()
    return jsonify(d.to_dict())
