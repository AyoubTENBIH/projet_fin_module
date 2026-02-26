# -*- coding: utf-8 -*-
"""Modèles EcoCasa - SQLAlchemy."""
from .db import db
from .user import User
from .camion import Camion
from .depot import Depot
from .point_collecte import PointCollecte
from .dechetterie import Dechetterie
from .planning import Planning, PlanningPoint
from .gps import GpsPosition, GpsPointComplete
from .stats import StatsJournaliere, StatsChauffeur

__all__ = [
    'db', 'User', 'Camion', 'Depot', 'PointCollecte', 'Dechetterie',
    'Planning', 'PlanningPoint', 'GpsPosition', 'GpsPointComplete',
    'StatsJournaliere', 'StatsChauffeur',
]
