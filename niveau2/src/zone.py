# -*- coding: utf-8 -*-
"""
Module Zone - Niveau 2 VillePropre
Représente une zone de collecte avec points, volume et centre.
"""

import math


class Zone:
    """
    Zone de collecte regroupant plusieurs points, avec un volume estimé
    et un centre géographique.
    """

    def __init__(
        self,
        id_zone: int,
        points: list,
        volume_estime: float,
        centre_x: float,
        centre_y: float,
    ):
        """
        Initialise une zone.

        Args:
            id_zone: Identifiant unique de la zone.
            points: Liste des ids des points de collecte dans cette zone.
            volume_estime: Volume total estimé en kg.
            centre_x: Abscisse du centre de la zone.
            centre_y: Ordonnée du centre de la zone.
        """
        self.id = id_zone
        self.points = points
        self.volume_estime = volume_estime
        self.centre = (centre_x, centre_y)
        self.frequence_collecte = "quotidien"
        self.priorite = "normale"  # "haute", "normale", "basse"
        self.camion_affecte = None

    def distance_depuis(self, x: float, y: float) -> float:
        """
        Calcule la distance euclidienne depuis un point (x, y) jusqu'au centre de cette zone.

        Args:
            x: Abscisse du point.
            y: Ordonnée du point.

        Returns:
            Distance euclidienne.
        """
        dx = self.centre[0] - x
        dy = self.centre[1] - y
        return math.sqrt(dx * dx + dy * dy)

    def to_dict(self) -> dict:
        """
        Retourne la zone sous forme de dictionnaire.

        Returns:
            Dict avec id, points, volume_estime, centre, etc.
        """
        return {
            "id": self.id,
            "points": self.points,
            "volume_estime": self.volume_estime,
            "centre": self.centre,
            "frequence_collecte": self.frequence_collecte,
            "priorite": self.priorite,
            "camion_affecte": self.camion_affecte,
        }

    def __repr__(self) -> str:
        """Affichage lisible de la zone."""
        return (
            f"Zone(id={self.id}, points={self.points}, volume={self.volume_estime}kg, "
            f"centre={self.centre}, priorite={self.priorite})"
        )
