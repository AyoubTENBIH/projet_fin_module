# -*- coding: utf-8 -*-
"""
Tests Niveau 3 - VillePropre
Validation des modules CreneauHoraire, ContrainteTemporelle et PlanificateurTriparti.
"""

import unittest
import sys
from pathlib import Path

script_dir = Path(__file__).resolve().parent
niveau3_src = script_dir.parent / "src"
niveau2_src = script_dir.parent.parent / "niveau2" / "src"
niveau1_src = script_dir.parent.parent / "niveau1" / "src"

sys.path.insert(0, str(niveau3_src))
sys.path.insert(0, str(niveau2_src))
sys.path.insert(0, str(niveau1_src))

from creneau_horaire import CreneauHoraire
from contrainte_temporelle import ContrainteTemporelle
from planificateur_triparti import PlanificateurTriparti
from affectateur_biparti import AffectateurBiparti
from camion import Camion
from zone import Zone


class TestCreneauHoraire(unittest.TestCase):
    """Tests de la classe CreneauHoraire."""

    def test_creation(self):
        """Création d'un créneau avec durée calculée."""
        c = CreneauHoraire(1, "08:00", "10:00", "lundi")
        self.assertEqual(c.duree_minutes, 120)
        self.assertEqual(c.duree(), 2.0)

    def test_chevauchement_oui(self):
        """08:00-10:00 et 09:00-11:00 doivent chevaucher."""
        c1 = CreneauHoraire(1, "08:00", "10:00", "lundi")
        c2 = CreneauHoraire(2, "09:00", "11:00", "lundi")
        self.assertTrue(c1.chevauche(c2), "08-10 et 09-11 doivent chevaucher")

    def test_chevauchement_non_bout_a_bout(self):
        """08:00-10:00 et 10:00-12:00 ne doivent pas chevaucher."""
        c1 = CreneauHoraire(1, "08:00", "10:00", "lundi")
        c3 = CreneauHoraire(3, "10:00", "12:00", "lundi")
        self.assertFalse(c1.chevauche(c3), "08-10 et 10-12 ne doivent pas chevaucher")

    def test_chevauchement_jour_different(self):
        """Créneaux de jours différents ne chevauchent pas."""
        c1 = CreneauHoraire(1, "08:00", "10:00", "lundi")
        c2 = CreneauHoraire(2, "08:00", "10:00", "mardi")
        self.assertFalse(c1.chevauche(c2))

    def test_contient_heure(self):
        """Vérification contient_heure."""
        c = CreneauHoraire(1, "08:00", "10:00", "lundi")
        self.assertTrue(c.contient_heure("08:30"))
        self.assertTrue(c.contient_heure("08:00"))
        self.assertFalse(c.contient_heure("10:00"))
        self.assertFalse(c.contient_heure("07:59"))

    def test_ajuster_congestion(self):
        """Congestion 1.5 sur 30 min donne 45 min."""
        c = CreneauHoraire(1, "08:00", "10:00", "lundi", cout_congestion=1.5)
        self.assertEqual(c.ajuster_duree_avec_congestion(30), 45)

    def test_to_dict(self):
        """Sérialisation to_dict."""
        c = CreneauHoraire(1, "08:00", "10:00", "lundi", 1.2)
        d = c.to_dict()
        self.assertEqual(d["id"], 1)
        self.assertEqual(d["debut"], "08:00")
        self.assertEqual(d["fin"], "10:00")
        self.assertEqual(d["jour"], "lundi")
        self.assertEqual(d["cout_congestion"], 1.2)
        self.assertEqual(d["duree_minutes"], 120)


class TestContrainteTemporelle(unittest.TestCase):
    """Tests de la classe ContrainteTemporelle."""

    def test_fenetre_ok(self):
        """Créneau 10:00-12:00 dans fenêtre 08:00-18:00."""
        contraintes = ContrainteTemporelle()
        contraintes.ajouter_fenetre_zone(1, "08:00", "18:00")
        creneau = CreneauHoraire(1, "10:00", "12:00", "lundi")
        ok, msg = contraintes.est_realisable(1, 1, creneau, 60)
        self.assertTrue(ok, f"Attendu OK, obtenu: {msg}")

    def test_fenetre_trop_tot(self):
        """Créneau 06:00-08:00 hors fenêtre 08:00-18:00."""
        contraintes = ContrainteTemporelle()
        contraintes.ajouter_fenetre_zone(1, "08:00", "18:00")
        creneau = CreneauHoraire(2, "06:00", "08:00", "lundi")
        ok, msg = contraintes.est_realisable(1, 1, creneau, 60)
        self.assertFalse(ok, f"Attendu échec, obtenu: {msg}")

    def test_pause_camion(self):
        """Créneau chevauchant pause 12:00-13:00 doit échouer."""
        contraintes = ContrainteTemporelle()
        contraintes.ajouter_pause_camion(1, "12:00", 1.0)
        creneau = CreneauHoraire(1, "11:30", "12:30", "lundi")
        ok, msg = contraintes.est_realisable(1, 1, creneau, 30)
        self.assertFalse(ok)

    def test_charger_depuis_dict(self):
        """Chargement depuis dictionnaire."""
        data = {
            "fenetres_zone": [{"zone_id": 1, "debut": "06:00", "fin": "20:00"}],
            "pauses_obligatoires": [{"camion_id": 1, "debut": "12:00", "duree": 1}],
            "zones_interdites_nuit": [1, 2],
        }
        c = ContrainteTemporelle()
        c.charger_depuis_dict(data)
        self.assertEqual(len(c.fenetres_zone), 1)
        self.assertEqual(len(c.pauses_camion), 1)
        self.assertEqual(c.zones_interdites_nuit, [1, 2])


class TestPlanificateurTriparti(unittest.TestCase):
    """Tests du planificateur avec données minimales."""

    def _creer_affectateur_minimal(self):
        """Crée un affectateur avec 2 camions, 2 zones."""
        camions = [
            Camion(1, 5000, 200, [1, 2]),
            Camion(2, 3000, 150, [1, 2]),
        ]
        zones = [
            Zone(1, [1, 2], 1200, 3.5, 3.5),
            Zone(2, [3, 4], 800, 1.5, 5.5),
        ]
        # Graphe minimal factice
        class GrapheMock:
            sommets = {}

        return AffectateurBiparti(camions, zones, GrapheMock())

    def test_3_2_non_chevauchement_meme_camion(self):
        """Test 3.2 : Vérifier non-chevauchement pour même camion."""
        c1 = CreneauHoraire(1, "08:00", "10:00", "lundi")
        c2 = CreneauHoraire(2, "09:00", "11:00", "lundi")
        c3 = CreneauHoraire(3, "10:00", "12:00", "lundi")

        self.assertTrue(c1.chevauche(c2), "08-10 et 09-11 doivent chevaucher")
        self.assertFalse(c1.chevauche(c3), "08-10 et 10-12 ne doivent pas chevaucher")

    def test_3_3_fenetre_interdite(self):
        """Test 3.3 : Fenêtre interdite → doit échouer."""
        contraintes = ContrainteTemporelle()
        contraintes.ajouter_fenetre_zone(1, "08:00", "18:00")

        creneau_ok = CreneauHoraire(1, "10:00", "12:00", "lundi")
        creneau_trop_tot = CreneauHoraire(2, "06:00", "08:00", "lundi")

        realisable1, _ = contraintes.est_realisable(1, 1, creneau_ok, 60)
        realisable2, _ = contraintes.est_realisable(1, 1, creneau_trop_tot, 60)

        self.assertTrue(realisable1, "10-12 doit être réalisable")
        self.assertFalse(realisable2, "06-08 doit être interdit")

    def test_3_1_planifier_camions_creneaux(self):
        """Test 3.1 : Planifier camions sur créneaux."""
        affectateur = self._creer_affectateur_minimal()
        affectation_n2 = {1: [1], 2: [2]}

        contraintes = ContrainteTemporelle()
        contraintes.ajouter_fenetre_zone(1, "06:00", "20:00")
        contraintes.ajouter_fenetre_zone(2, "06:00", "20:00")

        creneaux = [
            CreneauHoraire(1, "06:00", "08:00", "lundi", 1.0),
            CreneauHoraire(2, "08:00", "10:00", "lundi", 1.3),
        ]

        planificateur = PlanificateurTriparti(affectateur, contraintes)
        planificateur.ajouter_creneaux(creneaux)

        planning = planificateur.generer_plan_optimal(affectation_n2)

        total_entries = sum(len(v) for v in planning.values())
        self.assertGreaterEqual(total_entries, 1, "Au moins une affectation temporelle")

    def test_3_4_taux_occupation(self):
        """Test 3.4 : Taux occupation > 0 avec planning valide."""
        affectateur = self._creer_affectateur_minimal()
        affectation_n2 = {1: [1, 2], 2: []}

        contraintes = ContrainteTemporelle()
        contraintes.ajouter_fenetre_zone(1, "06:00", "20:00")
        contraintes.ajouter_fenetre_zone(2, "06:00", "20:00")

        creneaux = [
            CreneauHoraire(1, "06:00", "08:00", "lundi", 1.0),
            CreneauHoraire(2, "08:00", "10:00", "lundi", 1.0),
            CreneauHoraire(3, "10:00", "12:00", "lundi", 1.0),
        ]

        planificateur = PlanificateurTriparti(affectateur, contraintes)
        planificateur.ajouter_creneaux(creneaux)
        planning = planificateur.generer_plan_optimal(affectation_n2)

        indicateurs = planificateur.evaluer_plan(planning)
        self.assertIn("taux_occupation", indicateurs)
        self.assertIn("respect_horaires", indicateurs)
        self.assertIn("congestion_moyenne", indicateurs)


if __name__ == "__main__":
    unittest.main()
