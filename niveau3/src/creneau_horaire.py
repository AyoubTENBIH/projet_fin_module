# -*- coding: utf-8 -*-
"""
Module CreneauHoraire - Niveau 3 VillePropre
Représentation robuste des créneaux horaires avec gestion de la congestion.
"""

from datetime import datetime, timedelta


class CreneauHoraire:
    """
    Créneau horaire avec début, fin, jour et facteur de congestion.
    
    Gère les comparaisons temporelles, chevauchements et ajustements
    de durée selon le trafic.
    """

    def __init__(
        self,
        id_creneau: int,
        debut: str,
        fin: str,
        jour: str,
        cout_congestion: float = 1.0,
    ):
        """
        Initialise un créneau horaire.

        Args:
            id_creneau: Identifiant unique.
            debut: Heure début format "HH:MM" (ex: "08:00").
            fin: Heure fin format "HH:MM" (ex: "10:00").
            jour: Jour de la semaine (lundi, mardi, ...).
            cout_congestion: Multiplicateur de durée (1.0 = normal,
                           1.5 = +50% temps, 2.0 = embouteillages).
        """
        self.id = id_creneau
        self.debut_str = debut
        self.fin_str = fin
        self.jour = jour
        self.cout_congestion = max(0.1, float(cout_congestion))

        # Parser les heures
        self.debut_datetime = datetime.strptime(debut, "%H:%M").time()
        self.fin_datetime = datetime.strptime(fin, "%H:%M").time()

        # Calculer durée
        self._calculer_duree()

    def _calculer_duree(self) -> None:
        """Calcule la durée en minutes entre debut et fin."""
        d1 = datetime.combine(datetime.today(), self.debut_datetime)
        d2 = datetime.combine(datetime.today(), self.fin_datetime)
        delta = d2 - d1
        self.duree_minutes = max(0, int(delta.total_seconds() / 60))

    def duree(self) -> float:
        """Retourne la durée en heures (float)."""
        return self.duree_minutes / 60.0

    def chevauche(self, autre_creneau: "CreneauHoraire") -> bool:
        """
        Vérifie si ce créneau chevauche un autre créneau.

        Deux créneaux se chevauchent si :
        - Même jour
        - Les intervalles de temps se croisent

        Exemples :
        - 08:00-10:00 et 09:00-11:00 → True (chevauchent)
        - 08:00-10:00 et 10:00-12:00 → False (bout à bout)
        - 08:00-10:00 et 14:00-16:00 → False (séparés)
        """
        if self.jour != autre_creneau.jour:
            return False

        # Chevauchement si : self.debut < autre.fin ET autre.debut < self.fin
        return (
            self.debut_datetime < autre_creneau.fin_datetime
            and autre_creneau.debut_datetime < self.fin_datetime
        )

    def contient_heure(self, heure_str: str) -> bool:
        """
        Vérifie si une heure donnée est dans ce créneau.

        Args:
            heure_str: Format "HH:MM".

        Returns:
            True si heure dans [debut, fin[.
        """
        try:
            heure = datetime.strptime(heure_str, "%H:%M").time()
            return self.debut_datetime <= heure < self.fin_datetime
        except (ValueError, TypeError):
            return False

    def ajuster_duree_avec_congestion(self, duree_base_minutes: int) -> int:
        """
        Applique le facteur de congestion à une durée.

        Args:
            duree_base_minutes: Durée normale sans trafic.

        Returns:
            Durée ajustée avec congestion (en minutes).

        Exemple:
            duree_base = 30 minutes
            congestion = 1.5
            → retourne 45 minutes
        """
        return int(max(0, duree_base_minutes * self.cout_congestion))

    def to_dict(self) -> dict:
        """Retourne le créneau sous forme de dictionnaire."""
        return {
            "id": self.id,
            "debut": self.debut_str,
            "fin": self.fin_str,
            "jour": self.jour,
            "cout_congestion": self.cout_congestion,
            "duree_minutes": self.duree_minutes,
        }

    def __repr__(self) -> str:
        return (
            f"Creneau(id={self.id}, {self.jour} {self.debut_str}-"
            f"{self.fin_str}, congestion={self.cout_congestion})"
        )
