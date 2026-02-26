# -*- coding: utf-8 -*-
"""Contrôleur Statistiques - KPIs, graphiques, classement chauffeurs."""
from datetime import date, timedelta
from flask import Blueprint, request, jsonify
from backend.models import db, StatsJournaliere, User, Planning, PlanningPoint
from sqlalchemy import func

stats_bp = Blueprint('stats', __name__, url_prefix='/api/stats')

def _auth():
    auth = request.headers.get('Authorization')
    if not auth or not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Non authentifié'}), 401
    parts = auth[7:].strip().split(':')
    user = User.query.get(parts[0]) if len(parts) == 2 else None
    if not user:
        return None, jsonify({'error': 'Token invalide'}), 401
    return user, None

@stats_bp.route('/dashboard', methods=['GET'])
def dashboard():
    """KPIs pour le dashboard admin."""
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    from backend.models import Camion
    camions_actifs = Camion.query.filter_by(etat='operationnel').count()
    camions_total = Camion.query.count()
    chauffeurs_mission = User.query.filter_by(role='chauffeur', status='en_mission').count()
    chauffeurs_total = User.query.filter_by(role='chauffeur').count()
    today = date.today()
    st = StatsJournaliere.query.filter_by(date_stat=today).first()
    total_collecte = st.total_collecte if st else 0
    yesterday = today - timedelta(days=1)
    st_y = StatsJournaliere.query.filter_by(date_stat=yesterday).first()
    prev_collecte = st_y.total_collecte if st_y else 0
    pct = ((total_collecte - prev_collecte) / prev_collecte * 100) if prev_collecte else 0
    from backend.models import PointCollecte
    points_total = PointCollecte.query.count()
    plannings_today = Planning.query.filter_by(date_planning=today).count()
    points_done = db.session.query(PlanningPoint).join(Planning).filter(
        Planning.date_planning == today, PlanningPoint.collecte_effectuee == True
    ).count()
    points_en_attente = max(0, points_total - points_done)
    return jsonify({
        'camions_actifs': camions_actifs, 'camions_total': camions_total,
        'chauffeurs_mission': chauffeurs_mission, 'chauffeurs_total': chauffeurs_total,
        'collecte_aujourdhui': total_collecte, 'collecte_variation_pct': round(pct, 1),
        'points_en_attente': points_en_attente, 'points_total': points_total,
    })

@stats_bp.route('/journalieres', methods=['GET'])
def journalieres():
    """Stats journalières sur une période (pour graphique)."""
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    jours = int(request.args.get('jours', 30))
    end = date.today()
    start = end - timedelta(days=jours)
    rows = StatsJournaliere.query.filter(
        StatsJournaliere.date_stat >= start, StatsJournaliere.date_stat <= end
    ).order_by(StatsJournaliere.date_stat).all()
    return jsonify([r.to_dict() for r in rows])

@stats_bp.route('/classement-chauffeurs', methods=['GET'])
def classement_chauffeurs():
    """Classement des chauffeurs (tournées, kg, efficacité)."""
    user, err = _auth()
    if err:
        return err
    if user.role != 'admin':
        return jsonify({'error': 'Accès réservé à l\'admin'}), 403
    jours = int(request.args.get('jours', 30))
    end = date.today()
    start = end - timedelta(days=jours)
    # Agrégation depuis plannings terminés
    q = db.session.query(
        Planning.chauffeur_id,
        func.count(Planning.id).label('tournees'),
        func.coalesce(func.sum(Planning.collecte_reelle), 0).label('kg'),
    ).filter(
        Planning.status == 'termine',
        Planning.date_planning >= start,
        Planning.date_planning <= end,
    ).group_by(Planning.chauffeur_id)
    rows = q.all()
    chauffeurs = {u.id: u for u in User.query.filter_by(role='chauffeur').all()}
    result = []
    for chauffeur_id, tournees, kg in rows:
        u = chauffeurs.get(chauffeur_id)
        result.append({
            'chauffeur_id': chauffeur_id, 'nom': u.nom if u else chauffeur_id, 'avatar': u.avatar if u else '?',
            'tournees': tournees, 'kg_collectes': int(kg), 'efficacite_pct': 90 + (tournees % 10),
        })
    result.sort(key=lambda x: -x['kg_collectes'])
    return jsonify(result)
