# -*- coding: utf-8 -*-
"""Contrôleur Planning - CRUD, génération optimale."""
from datetime import date, datetime
from flask import Blueprint, request, jsonify
from backend.models import db, Planning, PlanningPoint, User, Camion, PointCollecte, Depot, Dechetterie

planning_bp = Blueprint('planning', __name__, url_prefix='/api/planning')

def _auth():
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Non authentifié'}), 401
    parts = auth[7:].strip().split(':')
    user = User.query.get(parts[0]) if len(parts) == 2 else None
    if not user:
        return None, jsonify({'error': 'Token invalide'}), 401
    return user, None

@planning_bp.route('', methods=['GET'])
def list_plannings():
    user, err = _auth()
    if err:
        return err
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    chauffeur_id = request.args.get('chauffeur_id')
    status = request.args.get('status')
    q = Planning.query
    if date_from:
        q = q.filter(Planning.date_planning >= date_from)
    if date_to:
        q = q.filter(Planning.date_planning <= date_to)
    if chauffeur_id:
        q = q.filter_by(chauffeur_id=chauffeur_id)
    if status:
        q = q.filter_by(status=status)
    q = q.order_by(Planning.date_planning.desc(), Planning.shift)
    return jsonify([p.to_dict() for p in q.all()])

@planning_bp.route('/<planning_id>', methods=['GET'])
def get_planning(planning_id):
    user, err = _auth()
    if err:
        return err
    p = Planning.query.get(planning_id)
    if not p:
        return jsonify({'error': 'Planning introuvable'}), 404
    if user.role != 'admin' and p.chauffeur_id != user.id:
        return jsonify({'error': 'Accès refusé'}), 403
    return jsonify(p.to_dict())

@planning_bp.route('', methods=['POST'])
def create_planning():
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    data = request.get_json() or {}
    date_planning = data.get('date_planning')
    if not date_planning:
        return jsonify({'error': 'date_planning requis'}), 400
    if isinstance(date_planning, str):
        date_planning = date.fromisoformat(date_planning)
    import uuid
    pl = Planning(
        id=data.get('id') or str(uuid.uuid4())[:8], date_planning=date_planning,
        shift=data.get('shift', 'matin'), chauffeur_id=data.get('chauffeur_id'),
        camion_id=data.get('camion_id'), depot_id=data.get('depot_id', 'd1'),
        dechetterie_id=data.get('dechetterie_id'), trajet_calcule=data.get('trajet_calcule'),
        status=data.get('status', 'planifie'),
    )
    db.session.add(pl)
    for i, point_id in enumerate(data.get('points_assignes', []) or []):
        pp = PlanningPoint(planning_id=pl.id, point_id=point_id, ordre=i)
        db.session.add(pp)
    db.session.commit()
    return jsonify(pl.to_dict()), 201

@planning_bp.route('/<planning_id>', methods=['PUT'])
def update_planning(planning_id):
    user, err = _auth()
    if err:
        return err
    pl = Planning.query.get(planning_id)
    if not pl:
        return jsonify({'error': 'Planning introuvable'}), 404
    data = request.get_json() or {}
    if user.role == 'chauffeur':
        # Chauffeur peut seulement démarrer/terminer / marquer collecte
        if 'status' in data and data['status'] in ('en_cours', 'termine'):
            pl.status = data['status']
            if data['status'] == 'en_cours' and not pl.heure_debut_reel:
                pl.heure_debut_reel = datetime.utcnow()
            if data['status'] == 'termine':
                pl.heure_fin_reel = datetime.utcnow()
        if 'collecte_reelle' in data:
            pl.collecte_reelle = data['collecte_reelle']
    else:
        for k in ('date_planning', 'shift', 'chauffeur_id', 'camion_id', 'depot_id', 'dechetterie_id', 'trajet_calcule', 'status', 'heure_debut_reel', 'heure_fin_reel', 'collecte_reelle'):
            if k in data:
                setattr(pl, k, data[k])
        if 'points_assignes' in data:
            PlanningPoint.query.filter_by(planning_id=planning_id).delete()
            for i, point_id in enumerate(data['points_assignes']):
                db.session.add(PlanningPoint(planning_id=planning_id, point_id=point_id, ordre=i))
    db.session.commit()
    return jsonify(pl.to_dict())

@planning_bp.route('/<planning_id>/marquer-collecte', methods=['POST'])
def marquer_collecte(planning_id):
    user, err = _auth()
    if err:
        return err
    pl = Planning.query.get(planning_id)
    if not pl:
        return jsonify({'error': 'Planning introuvable'}), 404
    if pl.chauffeur_id != user.id:
        return jsonify({'error': 'Ce n\'est pas votre mission'}), 403
    data = request.get_json() or {}
    point_id = data.get('point_id')
    poids = data.get('poids_collecte')
    if not point_id:
        return jsonify({'error': 'point_id requis'}), 400
    pp = PlanningPoint.query.filter_by(planning_id=planning_id, point_id=point_id).first()
    if not pp:
        return jsonify({'error': 'Point non assigné à cette mission'}), 400
    pp.collecte_effectuee = True
    pp.poids_collecte = poids
    pp.heure_collecte = datetime.utcnow()
    pl.collecte_reelle = (pl.collecte_reelle or 0) + (poids or 0)
    db.session.commit()
    return jsonify(pl.to_dict())

@planning_bp.route('/<planning_id>', methods=['DELETE'])
def delete_planning(planning_id):
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    pl = Planning.query.get(planning_id)
    if not pl:
        return jsonify({'error': 'Planning introuvable'}), 404
    db.session.delete(pl)
    db.session.commit()
    return '', 204
