# -*- coding: utf-8 -*-
from .db import db

class PointCollecte(db.Model):
    __tablename__ = 'points_collecte'
    id = db.Column(db.String(36), primary_key=True)
    nom = db.Column(db.String(120), nullable=False)
    type = db.Column(db.Enum('collecte', 'depot', 'dechetterie'), default='collecte')
    lat = db.Column(db.Numeric(10, 6), nullable=False)
    lng = db.Column(db.Numeric(10, 6), nullable=False)
    volume_moyen = db.Column(db.Integer, default=0)
    frequence = db.Column(db.Enum('quotidien', 'hebdomadaire'), default='quotidien')
    priorite = db.Column(db.Enum('haute', 'normale', 'basse'), default='normale')
    zone_id = db.Column(db.Integer)
    horaire_collecte = db.Column(db.String(20))
    contact = db.Column(db.String(120))
    adresse = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id, 'nom': self.nom, 'type': self.type,
            'lat': float(self.lat), 'lng': float(self.lng),
            'volume_moyen': self.volume_moyen, 'frequence': self.frequence,
            'priorite': self.priorite, 'zone_id': self.zone_id,
            'horaire_collecte': self.horaire_collecte, 'contact': self.contact,
            'adresse': self.adresse,
        }
