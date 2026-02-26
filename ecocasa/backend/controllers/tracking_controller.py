# -*- coding: utf-8 -*-
"""Contrôleur GPS Tracking - enregistrer position, lire positions."""
from datetime import datetime
from flask import Blueprint, request, jsonify
from backend.models import db, GpsPosition, GpsPointComplete, User, Planning

tracking_bp = Blueprint('tracking', __name__, url_prefix='/api/tracking')

def _auth():
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Non authentifié'}), 401
    parts = auth[7:].strip().split(':')
    user = User.query.get(parts[0]) if len(parts) == 2 else None
    if not user:
        return None, jsonify({'error': 'Token invalide'}), 401
    return user, None

@tracking_bp.route('/position', methods=['POST'])
def save_position():
    """Chauffeur envoie sa position GPS."""
    user, err = _auth()
    if err:
        return err
    data = request.get_json() or {}
    planning_id = data.get('planning_id')
    lat = data.get('lat')
    lng = data.get('lng')
    if not planning_id or lat is None or lng is None:
        return jsonify({'error': 'planning_id, lat, lng requis'}), 400
    pl = Planning.query.get(planning_id)
    if not pl or pl.chauffeur_id != user.id:
        return jsonify({'error': 'Mission introuvable ou non assignée'}), 403
    pos = GpsPosition(
        planning_id=planning_id, chauffeur_id=user.id,
        lat=float(lat), lng=float(lng), vitesse=data.get('vitesse'),
        timestamp=datetime.utcnow(),
    )
    db.session.add(pos)
    db.session.commit()
    return jsonify({'ok': True})

@tracking_bp.route('/positions/<planning_id>', methods=['GET'])
def get_positions(planning_id):
    """Récupérer l'historique des positions d'un planning (admin ou chauffeur concerné)."""
    user, err = _auth()
    if err:
        return err
    pl = Planning.query.get(planning_id)
    if not pl:
        return jsonify({'error': 'Planning introuvable'}), 404
    if user.role != 'admin' and pl.chauffeur_id != user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    positions = GpsPosition.query.filter_by(planning_id=planning_id).order_by(GpsPosition.timestamp).all()
    return jsonify([p.to_dict() for p in positions])

@tracking_bp.route('/live', methods=['GET'])
def live_positions():
    """Positions en temps réel de tous les plannings en_cours (admin)."""
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    from sqlalchemy import func
    # Dernière position par planning
    subq = db.session.query(
        GpsPosition.planning_id,
        func.max(GpsPosition.id).label('max_id')
    ).group_by(GpsPosition.planning_id).subquery()
    latest = db.session.query(GpsPosition).join(
        subq, (GpsPosition.planning_id == subq.c.planning_id) & (GpsPosition.id == subq.c.max_id)
    ).all()
    plannings_en_cours = Planning.query.filter_by(status='en_cours').all()
    result = []
    for pl in plannings_en_cours:
        pos = next((p for p in latest if p.planning_id == pl.id), None)
        result.append({
            'planning_id': pl.id, 'chauffeur_id': pl.chauffeur_id, 'camion_id': pl.camion_id,
            'last_position': pos.to_dict() if pos else None,
        })
    return jsonify(result)

@tracking_bp.route('/point-complete', methods=['POST'])
def mark_point_complete():
    """Marquer un point comme complété (côté tracking)."""
    user, err = _auth()
    if err:
        return err
    data = request.get_json() or {}
    planning_id = data.get('planning_id')
    point_id = data.get('point_id')
    if not planning_id or not point_id:
        return jsonify({'error': 'planning_id et point_id requis'}), 400
    pl = Planning.query.get(planning_id)
    if not pl or pl.chauffeur_id != user.id:
        return jsonify({'error': 'Mission introuvable'}), 403
    gc = GpsPointComplete(planning_id=planning_id, point_id=point_id)
    db.session.merge(gc)
    db.session.commit()
    return jsonify({'ok': True})
