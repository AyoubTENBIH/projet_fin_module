# -*- coding: utf-8 -*-
"""Contrôleurs API EcoCasa."""
from .auth_controller import auth_bp
from .users_controller import users_bp
from .camions_controller import camions_bp
from .depot_controller import depot_bp
from .points_controller import points_bp
from .dechetteries_controller import dechetteries_bp
from .planning_controller import planning_bp
from .tracking_controller import tracking_bp
from .stats_controller import stats_bp

__all__ = [
    'auth_bp', 'users_bp', 'camions_bp', 'depot_bp', 'points_bp',
    'dechetteries_bp', 'planning_bp', 'tracking_bp', 'stats_bp',
]
