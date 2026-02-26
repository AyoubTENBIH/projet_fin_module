# -*- coding: utf-8 -*-
"""Modèle Dechetterie."""
from .db import db
import json

class Dechetterie(db.Model):
    __tablename__ = 'dechetteries'
    id = db.Column(db.String(36), primary_key=True)
    nom = db.Column(db.String(120), nullable=False)
    lat = db.Column(db.Numeric(10, 6), nullable=False)
    lng = db.Column(db.Numeric(10, 6), nullable=False)
    capacite_max = db.Column(db.Integer)
    types_acceptes = db.Column(db.String(255))  # JSON array
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        types = self.types_acceptes
        if isinstance(types, str) and types:
            try:
                types = json.loads(types)
            except Exception:
                types = []
        return {
            'id': self.id, 'nom': self.nom,
            'lat': float(self.lat), 'lng': float(self.lng),
            'capacite_max': self.capacite_max, 'types_acceptes': types or [],
        }
