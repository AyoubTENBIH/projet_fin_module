# -*- coding: utf-8 -*-
"""Modèle User (admin / chauffeur)."""
from .db import db

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String(36), primary_key=True)
    role = db.Column(db.Enum('admin', 'chauffeur'), nullable=False, default='chauffeur')
    nom = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    avatar = db.Column(db.String(10))
    telephone = db.Column(db.String(30))
    permis = db.Column(db.String(10))
    status = db.Column(db.Enum('actif', 'inactif', 'en_mission'), default='actif')
    camion_id = db.Column(db.String(36))
    zone_affectee = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    derniere_connexion = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id': self.id, 'role': self.role, 'nom': self.nom, 'email': self.email,
            'avatar': self.avatar, 'telephone': self.telephone, 'permis': self.permis,
            'status': self.status, 'camion_id': self.camion_id, 'zone_affectee': self.zone_affectee,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'derniere_connexion': self.derniere_connexion.isoformat() if self.derniere_connexion else None,
        }
