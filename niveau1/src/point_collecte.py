# -*- coding: utf-8 -*-
"""
Module PointCollecte - Niveau 1 VillePropre
Représente un point de collecte (dépôt ou zone) dans le réseau routier.
"""

import math


class PointCollecte:
    """
    Point de collecte caractérisé par des coordonnées (x, y) et un identifiant.
    """

    def __init__(self, id_point: int, x: float, y: float, nom: str = ""):
        """
        Initialise un point de collecte.

        Args:
            id_point: Identifiant unique du point.
            x: Coordonnée X (abscisse).
            y: Coordonnée Y (ordonnée).
            nom: Nom du point (optionnel).
        """
        self.id = id_point
        self.x = x
        self.y = y
        self.nom = nom

    def distance_vers(self, autre_point: "PointCollecte") -> float:
        """
        Calcule la distance euclidienne vers un autre point.

        Args:
            autre_point: Un autre PointCollecte.

        Returns:
            La distance euclidienne : sqrt((x2-x1)² + (y2-y1)²).
        """
        dx = autre_point.x - self.x
        dy = autre_point.y - self.y
        return math.sqrt(dx * dx + dy * dy)

    def distance_depuis(self, x: float, y: float) -> float:
        """
        Calcule la distance euclidienne depuis un point (x, y) jusqu'à ce point.

        Args:
            x: Coordonnée X du point de départ.
            y: Coordonnée Y du point de départ.

        Returns:
            La distance euclidienne : sqrt((self.x-x)² + (self.y-y)²).
        """
        dx = self.x - x
        dy = self.y - y
        return math.sqrt(dx * dx + dy * dy)

    def __repr__(self) -> str:
        """Retourne une représentation lisible du point."""
        return f"PointCollecte(id={self.id}, x={self.x}, y={self.y}, nom='{self.nom}')"

    def to_dict(self) -> dict:
        """
        Retourne le point sous forme de dictionnaire (sérialisation JSON).

        Returns:
            Dict avec clés id, x, y, nom.
        """
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "nom": self.nom,
        }
