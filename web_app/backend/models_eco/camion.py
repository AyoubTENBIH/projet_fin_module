# -*- coding: utf-8 -*-
from .db import db

class Camion(db.Model):
    __tablename__ = 'camions'
    id = db.Column(db.String(36), primary_key=True)
    immatriculation = db.Column(db.String(20), unique=True, nullable=False)
    capacite = db.Column(db.Integer, nullable=False)
    type = db.Column(db.Enum('benne', 'compacteur', 'ampliroll'), default='benne')
    annee = db.Column(db.Integer)
    etat = db.Column(db.Enum('operationnel', 'maintenance', 'hors_service'), default='operationnel')
    chauffeur_id = db.Column(db.String(36))
    kilometrage = db.Column(db.Integer, default=0)
    derniere_maintenance = db.Column(db.Date)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id, 'immatriculation': self.immatriculation, 'capacite': self.capacite,
            'type': self.type, 'annee': self.annee, 'etat': self.etat,
            'chauffeur_id': self.chauffeur_id, 'kilometrage': self.kilometrage,
            'derniere_maintenance': self.derniere_maintenance.isoformat() if self.derniere_maintenance else None,
        }
