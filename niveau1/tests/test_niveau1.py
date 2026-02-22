# -*- coding: utf-8 -*-
"""
Tests unitaires Niveau 1 - VillePropre
Valide le graphe routier, la matrice des distances et les propriétés attendues.
"""

import unittest
import sys
from pathlib import Path

# Ajouter le répertoire src au path pour importer les modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from point_collecte import PointCollecte
from graphe_routier import GrapheRoutier


class TestNiveau1(unittest.TestCase):
    """Tests de validation du Niveau 1."""

    @classmethod
    def setUpClass(cls):
        """Charge le graphe une fois pour tous les tests."""
        data_dir = Path(__file__).resolve().parent.parent / "data"
        cls.input_path = data_dir / "input_niveau1.json"
        cls.graphe = GrapheRoutier()
        if cls.input_path.exists():
            cls.graphe.charger_depuis_json(str(cls.input_path))

    def test_1_1_matrice_11x11(self):
        """Test 1.1 : Charger les 10 points et vérifier que la matrice est 11x11 (dépôt + 10 points)."""
        self.assertTrue(self.input_path.exists(), "Fichier input_niveau1.json requis")
        self.assertEqual(len(self.graphe.sommets), 11, "11 sommets attendus (dépôt + 10 points)")
        matrice = self.graphe.matrice_distances()
        self.assertEqual(len(matrice), 11, "Matrice doit avoir 11 lignes")
        for row in matrice:
            self.assertEqual(len(row), 11, "Chaque ligne doit avoir 11 colonnes")

    def test_1_2_chemin_depot_vers_5_distance_positive(self):
        """Test 1.2 : Calculer le chemin dépôt(0) → point(5) et vérifier que la distance > 0."""
        dist, chemin = self.graphe.plus_court_chemin(0, 5)
        self.assertGreater(dist, 0, "La distance dépôt → point 5 doit être strictement positive")
        self.assertIn(0, chemin, "Le chemin doit commencer par le dépôt (0)")
        self.assertEqual(chemin[-1], 5, "Le chemin doit se terminer au point 5")

    def test_1_3_symetrie_matrice(self):
        """Test 1.3 : Vérifier la symétrie : pour tous i,j → matrice[i][j] == matrice[j][i]."""
        matrice = self.graphe.matrice_distances()
        n = len(matrice)
        for i in range(n):
            for j in range(n):
                self.assertAlmostEqual(
                    matrice[i][j],
                    matrice[j][i],
                    places=10,
                    msg=f"Symétrie : matrice[{i}][{j}] != matrice[{j}][{i}]",
                )

    def test_1_4_inegalite_triangulaire(self):
        """Test 1.4 : Vérifier l'inégalité triangulaire : matrice[i][j] <= matrice[i][k] + matrice[k][j]."""
        matrice = self.graphe.matrice_distances()
        n = len(matrice)
        inf = float("inf")
        for i in range(n):
            for j in range(n):
                for k in range(n):
                    d_ij = matrice[i][j]
                    d_ik = matrice[i][k]
                    d_kj = matrice[k][j]
                    # Ignorer si l'une des distances est infinie (graphe non connexe)
                    if d_ij == inf or d_ik == inf or d_kj == inf:
                        continue
                    self.assertLessEqual(
                        d_ij,
                        d_ik + d_kj + 1e-9,  # tolérance numérique
                        f"Inégalité triangulaire : d({i},{j}) = {d_ij} > d({i},{k}) + d({k},{j}) = {d_ik + d_kj}",
                    )

    def test_1_5_diagonale_nulle(self):
        """Test 1.5 : Vérifier que la diagonale est toujours 0.0."""
        matrice = self.graphe.matrice_distances()
        n = len(matrice)
        for i in range(n):
            self.assertEqual(matrice[i][i], 0.0, f"Diagonale : matrice[{i}][{i}] doit être 0.0")


if __name__ == "__main__":
    unittest.main(verbosity=2)
