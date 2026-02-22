# -*- coding: utf-8 -*-
"""
Module ContrainteTemporelle - Niveau 3 VillePropre
Gestion des règles temporelles : fenêtres, pauses, zones interdites, congestion.
"""

from datetime import datetime, time, timedelta
from typing import Dict, List, Tuple, Optional


class ContrainteTemporelle:
    """
    Gère toutes les contraintes temporelles du système :
    - Fenêtres horaires des zones
    - Pauses obligatoires des camions
    - Zones interdites la nuit
    - Niveau de congestion par zone/créneau
    """

    def __init__(self):
        # Fenêtres horaires par zone : {zone_id: (debut, fin)}
        self.fenetres_zone: Dict[int, Tuple[str, str]] = {}

        # Pauses par camion : {camion_id: [(debut, fin), ...]}
        self.pauses_camion: Dict[int, List[Tuple[str, str]]] = {}

        # Congestion : {(zone_id, creneau_id): niveau}
        self.congestion: Dict[Tuple[int, int], float] = {}

        # Zones interdites la nuit (22h-6h)
        self.zones_interdites_nuit: List[int] = []

        # Durées estimées : {zone_id: duree_minutes}
        self.durees_zones: Dict[int, int] = {}

    def ajouter_fenetre_zone(self, zone_id: int, debut: str, fin: str) -> None:
        """
        Définit la fenêtre horaire d'une zone.

        Args:
            zone_id: ID de la zone.
            debut: Heure début "HH:MM".
            fin: Heure fin "HH:MM".
        """
        self.fenetres_zone[int(zone_id)] = (str(debut), str(fin))

    def ajouter_pause_camion(
        self, camion_id: int, debut: str, duree_heures: float
    ) -> None:
        """
        Ajoute une pause obligatoire pour un camion.

        Args:
            camion_id: ID du camion.
            debut: Heure début pause "HH:MM".
            duree_heures: Durée en heures (ex: 1.0 = 1h).
        """
        debut_dt = datetime.strptime(debut, "%H:%M")
        fin_dt = debut_dt + timedelta(hours=float(duree_heures))
        fin_str = fin_dt.strftime("%H:%M")

        camion_id = int(camion_id)
        if camion_id not in self.pauses_camion:
            self.pauses_camion[camion_id] = []
        self.pauses_camion[camion_id].append((debut, fin_str))

    def est_realisable(
        self,
        camion_id: int,
        zone_id: int,
        creneau,
        duree_estimee_minutes: int,
    ) -> Tuple[bool, str]:
        """
        Vérifie si une affectation (camion, zone, créneau) est réalisable.

        Vérifie dans l'ordre :
        1. Fenêtre horaire de la zone
        2. Pause du camion
        3. Interdiction nocturne
        4. Durée suffisante dans le créneau

        Returns:
            (realisable: bool, raison: str)
            Si realisable=False, raison contient l'explication.
        """
        camion_id = int(camion_id)
        zone_id = int(zone_id)
        duree_estimee_minutes = max(0, int(duree_estimee_minutes))

        # 1. Vérifier fenêtre zone
        if zone_id in self.fenetres_zone:
            debut_zone, fin_zone = self.fenetres_zone[zone_id]
            debut_zone_time = datetime.strptime(debut_zone, "%H:%M").time()
            fin_zone_time = datetime.strptime(fin_zone, "%H:%M").time()

            if creneau.debut_datetime < debut_zone_time:
                return (
                    False,
                    f"Zone {zone_id} pas encore ouverte à {creneau.debut_str}",
                )
            if creneau.fin_datetime > fin_zone_time:
                return (
                    False,
                    f"Zone {zone_id} fermée à {creneau.fin_str}",
                )

        # 2. Vérifier pauses camion
        if camion_id in self.pauses_camion:
            for pause_debut, pause_fin in self.pauses_camion[camion_id]:
                pause_debut_time = datetime.strptime(
                    pause_debut, "%H:%M"
                ).time()
                pause_fin_time = datetime.strptime(pause_fin, "%H:%M").time()

                # Chevauchement pause/créneau ?
                if creneau.debut_datetime < pause_fin_time and pause_debut_time < creneau.fin_datetime:
                    return (
                        False,
                        f"Camion {camion_id} en pause {pause_debut}-{pause_fin}",
                    )

        # 3. Vérifier interdiction nocturne
        if zone_id in self.zones_interdites_nuit:
            nuit_debut = time(22, 0)  # 22h00
            nuit_fin = time(6, 0)  # 06h00

            # Si créneau chevauche la nuit (22h-6h)
            def heure_dans_nuit(t: time) -> bool:
                if nuit_debut > nuit_fin:  # Nuit traverse minuit
                    return t >= nuit_debut or t < nuit_fin
                return nuit_debut <= t < nuit_fin

            if heure_dans_nuit(creneau.debut_datetime) or heure_dans_nuit(
                creneau.fin_datetime
            ):
                return False, f"Zone {zone_id} interdite la nuit"

        # 4. Vérifier durée suffisante
        duree_avec_congestion = creneau.ajuster_duree_avec_congestion(
            duree_estimee_minutes
        )
        if duree_avec_congestion > creneau.duree_minutes:
            return (
                False,
                (
                    f"Durée insuffisante : besoin {duree_avec_congestion}min, "
                    f"disponible {creneau.duree_minutes}min"
                ),
            )

        return True, "OK"

    def calculer_penalite(self, camion_id: int, zone_id: int, creneau) -> float:
        """
        Calcule une pénalité pour cette affectation.

        Facteurs de pénalité :
        - Congestion élevée : +coût
        - Créneau en limite de fenêtre : +coût
        - Créneau tôt le matin ou tard le soir : +coût

        Returns:
            Pénalité (0.0 = optimal, plus élevé = moins souhaitable).
        """
        penalite = 0.0

        # Pénalité congestion
        cle_congestion = (int(zone_id), creneau.id)
        if cle_congestion in self.congestion:
            niveau = self.congestion[cle_congestion]
            penalite += (niveau - 1.0) * 100
        else:
            penalite += (creneau.cout_congestion - 1.0) * 100

        # Pénalité horaire (préférer milieu de journée)
        heure_debut = creneau.debut_datetime.hour
        if heure_debut < 7:
            penalite += 50
        elif heure_debut < 8:
            penalite += 20
        elif heure_debut >= 18:
            penalite += 30

        return penalite

    def charger_depuis_dict(self, data: dict) -> None:
        """
        Charge les contraintes depuis un dictionnaire.

        Format attendu :
        {
          "fenetres_zone": [
            {"zone_id": 1, "debut": "06:00", "fin": "20:00"}
          ],
          "pauses_obligatoires": [
            {"camion_id": 1, "debut": "12:00", "duree": 1}
          ],
          "zones_interdites_nuit": [1, 2, 3]
        }
        """
        # Fenêtres zones
        for f in data.get("fenetres_zone", []):
            self.ajouter_fenetre_zone(
                f["zone_id"], f["debut"], f["fin"]
            )

        # Pauses camions
        for p in data.get("pauses_obligatoires", []):
            self.ajouter_pause_camion(
                p["camion_id"], p["debut"], p["duree"]
            )

        # Zones nuit
        self.zones_interdites_nuit = [
            int(z) for z in data.get("zones_interdites_nuit", [])
        ]
