# -*- coding: utf-8 -*-
"""Modèles Statistiques."""
from .db import db

class StatsJournaliere(db.Model):
    __tablename__ = 'stats_journalieres'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    date_stat = db.Column(db.Date, unique=True, nullable=False)
    total_collecte = db.Column(db.Integer, default=0)
    nombre_tournees = db.Column(db.Integer, default=0)
    distance_totale = db.Column(db.Numeric(10, 2), default=0)
    taux_completion = db.Column(db.Numeric(5, 2), default=0)
    incidents = db.Column(db.Integer, default=0)
    cout_estime = db.Column(db.Numeric(10, 2), default=0)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            'date_stat': self.date_stat.isoformat() if self.date_stat else None,
            'total_collecte': self.total_collecte, 'nombre_tournees': self.nombre_tournees,
            'distance_totale': float(self.distance_totale or 0),
            'taux_completion': float(self.taux_completion or 0),
            'incidents': self.incidents, 'cout_estime': float(self.cout_estime or 0),
        }


class StatsChauffeur(db.Model):
    __tablename__ = 'stats_chauffeur'
    chauffeur_id = db.Column(db.String(36), primary_key=True)
    periode_debut = db.Column(db.Date, primary_key=True)
    periode_fin = db.Column(db.Date, primary_key=True)
    tournees_effectuees = db.Column(db.Integer, default=0)
    kg_collectes = db.Column(db.Integer, default=0)
    km_parcourus = db.Column(db.Numeric(10, 2), default=0)
    efficacite_pct = db.Column(db.Numeric(5, 2), default=0)
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    def to_dict(self):
        return {
            'chauffeur_id': self.chauffeur_id,
            'periode_debut': self.periode_debut.isoformat() if self.periode_debut else None,
            'periode_fin': self.periode_fin.isoformat() if self.periode_fin else None,
            'tournees_effectuees': self.tournees_effectuees, 'kg_collectes': self.kg_collectes,
            'km_parcourus': float(self.km_parcourus or 0), 'efficacite_pct': float(self.efficacite_pct or 0),
        }
