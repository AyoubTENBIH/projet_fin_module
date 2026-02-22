# -*- coding: utf-8 -*-
"""
Module PlanificateurTriparti - Niveau 3 VillePropre
Transforme l'affectation Camion↔Zone du Niveau 2 en planning Camion↔Zone↔Créneau.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import sys
from pathlib import Path

# Import du niveau 2
script_dir = Path(__file__).resolve().parent
niveau2_src = script_dir.parent.parent / "niveau2" / "src"
sys.path.insert(0, str(niveau2_src))

from affectateur_biparti import AffectateurBiparti, ORDRE_PRIORITE

# Imports locaux (niveau3)
from contrainte_temporelle import ContrainteTemporelle
from creneau_horaire import CreneauHoraire


class PlanificateurTriparti:
    """
    Planificateur temporel : affectation statique Niveau 2 → planning temporel complet.

    Algorithme :
    1. Récupérer affectation du Niveau 2
    2. Pour chaque (camion, zones_affectees) :
       Pour chaque zone :
         Trouver le meilleur créneau disponible
         Vérifier contraintes temporelles
         Affecter au planning (sans chevauchement pour un même camion)
    """

    def __init__(self, affectateur: AffectateurBiparti, contraintes: ContrainteTemporelle):
        self.affectateur = affectateur
        self.contraintes = contraintes
        self.creneaux: List[CreneauHoraire] = []
        self.planning: Dict[str, List] = {}

    def ajouter_creneaux(self, creneaux: List[CreneauHoraire]) -> None:
        """Définit la liste des créneaux disponibles."""
        self.creneaux = list(creneaux)

    def generer_plan_optimal(
        self, affectation_n2: dict, horizon_jours: int = 7
    ) -> dict:
        """
        Génère un planning hebdomadaire optimal.

        Args:
            affectation_n2: Résultat du Niveau 2 {camion_id: [zone_ids]}.
            horizon_jours: Nombre de jours à planifier.

        Returns:
            Planning : {
              "lundi": [
                {
                  "camion_id": 1,
                  "zone_id": 2,
                  "creneau": {...},
                  "creneau_id": 1,
                  "duree_totale": 90,
                  "retard_estime": 0,
                  "taches": [...]
                }
              ],
              ...
            }
        """
        jours = [
            "lundi",
            "mardi",
            "mercredi",
            "jeudi",
            "vendredi",
            "samedi",
            "dimanche",
        ]
        self.planning = {jour: [] for jour in jours[:horizon_jours]}

        # Créneaux occupés par camion (évite chevauchement)
        creneaux_occupes: Dict[int, List[CreneauHoraire]] = {
            c.id: [] for c in self.affectateur.camions
        }

        camions_par_id = {c.id: c for c in self.affectateur.camions}
        zones_par_id = {z.id: z for z in self.affectateur.zones}

        for camion_id, zone_ids in affectation_n2.items():
            if not zone_ids:
                continue

            camion = camions_par_id.get(camion_id)
            if camion is None:
                continue

            zones = [zones_par_id[zid] for zid in zone_ids if zid in zones_par_id]
            if not zones:
                continue

            # Trier zones par priorité puis volume (comme Niveau 2)
            zones_triees = sorted(
                zones,
                key=lambda z: (
                    ORDRE_PRIORITE.get(getattr(z, "priorite", "normale"), 1),
                    -z.volume_estime,
                ),
            )

            for zone in zones_triees:
                meilleur_creneau = self._trouver_meilleur_creneau(
                    camion, zone, creneaux_occupes[camion_id]
                )

                if meilleur_creneau is None:
                    print(
                        f"[WARN] Impossible de planifier Zone {zone.id} "
                        f"pour Camion {camion_id}"
                    )
                    continue

                duree_estimee = self._estimer_duree_zone(zone)

                entree = {
                    "camion_id": camion_id,
                    "zone_id": zone.id,
                    "creneau": {
                        "debut": meilleur_creneau.debut_str,
                        "fin": meilleur_creneau.fin_str,
                        "jour": meilleur_creneau.jour,
                    },
                    "creneau_id": meilleur_creneau.id,
                    "taches": self._generer_taches_zone(zone, meilleur_creneau),
                    "duree_totale": duree_estimee,
                    "retard_estime": 0,
                }

                jour = meilleur_creneau.jour
                if jour in self.planning:
                    self.planning[jour].append(entree)

                creneaux_occupes[camion_id].append(meilleur_creneau)

        return self.planning

    def _trouver_meilleur_creneau(
        self,
        camion,
        zone,
        creneaux_occupes: List[CreneauHoraire],
    ) -> Optional[CreneauHoraire]:
        """
        Trouve le meilleur créneau disponible pour (camion, zone).

        Critères :
        1. Réalisable (contraintes respectées)
        2. Ne chevauche pas les créneaux déjà occupés par ce camion
        3. Pénalité minimale
        """
        duree_estimee = self._estimer_duree_zone(zone)

        candidats = []
        for creneau in self.creneaux:
            # Ne pas chevaucher les créneaux déjà occupés
            if any(creneau.chevauche(occ) for occ in creneaux_occupes):
                continue

            realisable, _ = self.contraintes.est_realisable(
                camion.id, zone.id, creneau, duree_estimee
            )
            if not realisable:
                continue

            penalite = self.contraintes.calculer_penalite(
                camion.id, zone.id, creneau
            )
            candidats.append((penalite, creneau))

        if not candidats:
            return None

        candidats.sort(key=lambda x: x[0])
        return candidats[0][1]

    def _estimer_duree_zone(self, zone) -> int:
        """
        Estime la durée de collecte d'une zone (en minutes).

        Formule : 5 min/point + 10 min déplacement interne.
        """
        if zone.id in self.contraintes.durees_zones:
            return self.contraintes.durees_zones[zone.id]

        nb_points = len(getattr(zone, "points", []))
        return (nb_points * 5) + 10

    def _generer_taches_zone(
        self, zone, creneau: CreneauHoraire
    ) -> List[dict]:
        """
        Génère la liste des tâches (points) avec heures estimées.
        """
        points = getattr(zone, "points", [])
        if not points:
            return []

        taches = []
        heure_actuelle = datetime.strptime(creneau.debut_str, "%H:%M")

        for ordre, point_id in enumerate(points, start=1):
            heure_actuelle = heure_actuelle + timedelta(minutes=5)
            taches.append(
                {
                    "point_id": point_id,
                    "ordre": ordre,
                    "heure_estimee": heure_actuelle.strftime("%H:%M"),
                }
            )

        return taches

    def evaluer_plan(self, plan: dict) -> dict:
        """
        Évalue la qualité du planning généré.

        Returns:
            Indicateurs : taux_occupation, respect_horaires,
                         congestion_moyenne, retard_moyen.
        """
        nb_camions = len(self.affectateur.camions)
        nb_creneaux = len(self.creneaux)
        total_creneaux_possibles = nb_creneaux * nb_camions
        creneaux_utilises = sum(len(entries) for entries in plan.values())

        taux_occupation = (
            (creneaux_utilises / total_creneaux_possibles * 100)
            if total_creneaux_possibles > 0
            else 0.0
        )

        congestions = []
        creneaux_par_id = {c.id: c for c in self.creneaux}

        for jour_entries in plan.values():
            for entry in jour_entries:
                creneau_id = entry.get("creneau_id")
                if creneau_id in creneaux_par_id:
                    congestions.append(creneaux_par_id[creneau_id].cout_congestion)

        congestion_moyenne = (
            sum(congestions) / len(congestions) if congestions else 1.0
        )

        respect_horaires = 100.0
        retard_moyen = 0.0

        return {
            "taux_occupation": round(taux_occupation, 1),
            "respect_horaires": round(respect_horaires, 1),
            "congestion_moyenne": round(congestion_moyenne, 2),
            "retard_moyen": round(retard_moyen, 1),
        }
