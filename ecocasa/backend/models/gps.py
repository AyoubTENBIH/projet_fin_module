# -*- coding: utf-8 -*-
"""Modèles GPS (positions et points complétés)."""
from .db import db

class GpsPosition(db.Model):
    __tablename__ = 'gps_positions'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    planning_id = db.Column(db.String(36), nullable=False)
    chauffeur_id = db.Column(db.String(36), nullable=False)
    lat = db.Column(db.Numeric(10, 6), nullable=False)
    lng = db.Column(db.Numeric(10, 6), nullable=False)
    vitesse = db.Column(db.Numeric(6, 2))
    timestamp = db.Column(db.DateTime, nullable=False)

    def to_dict(self):
        return {
            'lat': float(self.lat), 'lng': float(self.lng),
            'vitesse': float(self.vitesse) if self.vitesse else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
        }


class GpsPointComplete(db.Model):
    __tablename__ = 'gps_points_completes'
    planning_id = db.Column(db.String(36), primary_key=True)
    point_id = db.Column(db.String(36), primary_key=True)
    completed_at = db.Column(db.DateTime, server_default=db.func.now())
