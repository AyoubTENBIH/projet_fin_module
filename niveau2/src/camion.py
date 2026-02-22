# -*- coding: utf-8 -*-
"""
Module Camion - Niveau 2 VillePropre
Représente un camion de collecte avec capacité et zones accessibles.
"""


class Camion:
    """
    Camion de collecte caractérisé par une capacité, un coût fixe
    et la liste des zones qu'il peut desservir.
    """

    def __init__(
        self,
        id_camion: int,
        capacite: float,
        cout_fixe: float,
        zones_accessibles: list = None,
    ):
        """
        Initialise un camion.

        Args:
            id_camion: Identifiant unique du camion.
            capacite: Capacité maximale en kg.
            cout_fixe: Coût journalier fixe en €.
            zones_accessibles: Liste des ids de zones accessibles (vide = universel).
        """
        self.id = id_camion
        self.capacite = capacite
        self.cout_fixe = cout_fixe
        self.zones_accessibles = zones_accessibles or []
        self.charge_actuelle = 0.0
        self.position_initiale = (0, 0)

    def peut_acceder_zone(self, zone_id: int) -> bool:
        """
        Vérifie si ce camion peut accéder à la zone donnée.

        Retourne True si zone_id est dans zones_accessibles,
        ou si zones_accessibles est vide (camion universel).

        Args:
            zone_id: Identifiant de la zone.

        Returns:
            True si le camion peut servir cette zone.
        """
        if not self.zones_accessibles:
            return True
        return zone_id in self.zones_accessibles

    def peut_prendre_volume(self, volume: float) -> bool:
        """
        Vérifie si le camion peut prendre ce volume supplémentaire sans dépasser sa capacité.

        Args:
            volume: Volume à ajouter en kg.

        Returns:
            True si charge_actuelle + volume <= capacite.
        """
        return self.charge_actuelle + volume <= self.capacite

    def ajouter_charge(self, volume: float) -> bool:
        """
        Ajoute du volume à la charge actuelle si possible.

        Args:
            volume: Volume à ajouter en kg.

        Returns:
            True si ajout réussi, False si capacité dépassée.
        """
        if not self.peut_prendre_volume(volume):
            return False
        self.charge_actuelle += volume
        return True

    def pourcentage_utilisation(self) -> float:
        """
        Retourne le taux de remplissage en pourcentage.

        Returns:
            (charge_actuelle / capacite) * 100, ou 0 si capacité nulle.
        """
        if self.capacite <= 0:
            return 0.0
        return (self.charge_actuelle / self.capacite) * 100.0

    def reinitialiser(self) -> None:
        """Remet la charge à 0 pour recommencer une affectation."""
        self.charge_actuelle = 0.0

    def to_dict(self) -> dict:
        """
        Retourne le camion sous forme de dictionnaire.

        Returns:
            Dict avec id, capacite, cout_fixe, zones_accessibles, charge_actuelle.
        """
        return {
            "id": self.id,
            "capacite": self.capacite,
            "cout_fixe": self.cout_fixe,
            "zones_accessibles": self.zones_accessibles,
            "charge_actuelle": self.charge_actuelle,
            "position_initiale": self.position_initiale,
        }

    def __repr__(self) -> str:
        """Affichage lisible du camion."""
        return (
            f"Camion(id={self.id}, capacite={self.capacite}kg, "
            f"cout_fixe={self.cout_fixe}€, zones={self.zones_accessibles})"
        )
