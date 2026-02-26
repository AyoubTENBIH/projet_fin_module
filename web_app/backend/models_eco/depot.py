# -*- coding: utf-8 -*-
from .db import db

class Depot(db.Model):
    __tablename__ = 'depot'
    id = db.Column(db.String(36), primary_key=True)
    nom = db.Column(db.String(120), nullable=False)
    lat = db.Column(db.Numeric(10, 6), nullable=False)
    lng = db.Column(db.Numeric(10, 6), nullable=False)
    adresse = db.Column(db.String(255))
    horaires = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id, 'nom': self.nom,
            'lat': float(self.lat), 'lng': float(self.lng),
            'adresse': self.adresse, 'horaires': self.horaires,
        }
