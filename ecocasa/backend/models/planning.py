# -*- coding: utf-8 -*-
"""Modèles Planning et PlanningPoint."""
from .db import db
import json

class Planning(db.Model):
    __tablename__ = 'plannings'
    id = db.Column(db.String(36), primary_key=True)
    date_planning = db.Column(db.Date, nullable=False)
    shift = db.Column(db.Enum('matin', 'apres_midi'), nullable=False)
    chauffeur_id = db.Column(db.String(36), nullable=False)
    camion_id = db.Column(db.String(36), nullable=False)
    depot_id = db.Column(db.String(36), nullable=False)
    dechetterie_id = db.Column(db.String(36))
    trajet_calcule = db.Column(db.JSON)
    status = db.Column(db.Enum('planifie', 'en_cours', 'termine', 'annule'), default='planifie')
    heure_debut_reel = db.Column(db.DateTime)
    heure_fin_reel = db.Column(db.DateTime)
    collecte_reelle = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    points_rel = db.relationship('PlanningPoint', backref='planning', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        trajet = self.trajet_calcule
        if isinstance(trajet, str) and trajet:
            try:
                trajet = json.loads(trajet)
            except Exception:
                trajet = None
        return {
            'id': self.id, 'date_planning': self.date_planning.isoformat() if self.date_planning else None,
            'shift': self.shift, 'chauffeur_id': self.chauffeur_id, 'camion_id': self.camion_id,
            'depot_id': self.depot_id, 'dechetterie_id': self.dechetterie_id,
            'trajet_calcule': trajet, 'status': self.status,
            'heure_debut_reel': self.heure_debut_reel.isoformat() if self.heure_debut_reel else None,
            'heure_fin_reel': self.heure_fin_reel.isoformat() if self.heure_fin_reel else None,
            'collecte_reelle': self.collecte_reelle,
            'points': [pp.to_dict() for pp in self.points_rel],
        }


class PlanningPoint(db.Model):
    __tablename__ = 'planning_points'
    planning_id = db.Column(db.String(36), db.ForeignKey('plannings.id'), primary_key=True)
    point_id = db.Column(db.String(36), primary_key=True)
    ordre = db.Column(db.Integer, default=0)
    collecte_effectuee = db.Column(db.Boolean, default=False)
    poids_collecte = db.Column(db.Integer)
    heure_collecte = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'planning_id': self.planning_id, 'point_id': self.point_id, 'ordre': self.ordre,
            'collecte_effectuee': self.collecte_effectuee, 'poids_collecte': self.poids_collecte,
            'heure_collecte': self.heure_collecte.isoformat() if self.heure_collecte else None,
        }
