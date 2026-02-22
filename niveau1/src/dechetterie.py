# -*- coding: utf-8 -*-
"""
Module Déchetterie - Niveau 1 VillePropre
Représente une déchetterie (centre de traitement où les camions déposent les déchets collectés).
"""

import math
from point_collecte import PointCollecte


class Dechetterie(PointCollecte):
    """
    Déchetterie : centre de traitement où les camions déposent les déchets collectés
    depuis les points de collecte (poubelles).
    
    Les camions collectent les déchets aux points de collecte, puis se rendent
    aux déchetteries pour les déposer avant de retourner au dépôt ou de continuer
    leur tournée.
    
    Hérite de PointCollecte mais avec des caractéristiques spécifiques.
    """

    def __init__(
        self,
        id_point: int,
        x: float,
        y: float,
        nom: str = "",
        capacite_max: float = 0.0,
        types_dechets: list = None,
        horaires: dict = None,
    ):
        """
        Initialise une déchetterie.

        Args:
            id_point: Identifiant unique de la déchetterie.
            x: Coordonnée X (abscisse).
            y: Coordonnée Y (ordonnée).
            nom: Nom de la déchetterie (optionnel).
            capacite_max: Capacité maximale en kg (0 = illimitée).
            types_dechets: Liste des types de déchets acceptés (ex: ["verre", "papier", "plastique"]).
            horaires: Dict avec horaires d'ouverture (ex: {"lundi": "8h-18h", ...}).
        """
        super().__init__(id_point, x, y, nom)
        self.capacite_max = capacite_max
        self.types_dechets = types_dechets or []
        self.horaires = horaires or {}
        self.volume_actuel = 0.0  # Volume actuellement stocké dans la déchetterie
        self.type = "dechetterie"  # Pour différencier des points de collecte normaux
        self.est_destination = True  # Les déchetteries sont des destinations pour les camions

    def peut_accepter_volume(self, volume: float) -> bool:
        """
        Vérifie si la déchetterie peut accepter un volume supplémentaire.

        Args:
            volume: Volume à ajouter en kg.

        Returns:
            True si volume_actuel + volume <= capacite_max (ou si capacite_max = 0).
        """
        if self.capacite_max == 0:
            return True  # Capacité illimitée
        return self.volume_actuel + volume <= self.capacite_max

    def ajouter_volume(self, volume: float) -> bool:
        """
        Ajoute du volume à la déchetterie si possible.

        Args:
            volume: Volume à ajouter en kg.

        Returns:
            True si ajout réussi, False si capacité dépassée.
        """
        if not self.peut_accepter_volume(volume):
            return False
        self.volume_actuel += volume
        return True

    def pourcentage_remplissage(self) -> float:
        """
        Retourne le taux de remplissage en pourcentage.

        Returns:
            (volume_actuel / capacite_max) * 100, ou 0 si capacité nulle ou illimitée.
        """
        if self.capacite_max <= 0:
            return 0.0
        return (self.volume_actuel / self.capacite_max) * 100.0

    def to_dict(self) -> dict:
        """
        Retourne la déchetterie sous forme de dictionnaire (sérialisation JSON).

        Returns:
            Dict avec toutes les propriétés de la déchetterie.
        """
        base_dict = super().to_dict()
        base_dict.update({
            "type": "dechetterie",
            "capacite_max": self.capacite_max,
            "types_dechets": self.types_dechets,
            "horaires": self.horaires,
            "volume_actuel": self.volume_actuel,
        })
        return base_dict

    def __repr__(self) -> str:
        """Retourne une représentation lisible de la déchetterie."""
        return (
            f"Dechetterie(id={self.id}, x={self.x}, y={self.y}, nom='{self.nom}', "
            f"capacite={self.capacite_max}kg, volume_actuel={self.volume_actuel}kg)"
        )
