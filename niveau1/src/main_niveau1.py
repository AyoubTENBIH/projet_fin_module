# -*- coding: utf-8 -*-
"""
Script principal Niveau 1 - VillePropre
Charge le graphe, affiche la matrice des distances et les chemins optimaux,
puis sauvegarde les résultats en JSON.
"""

import sys
from pathlib import Path

from graphe_routier import GrapheRoutier


def main():
    """Point d'entrée du programme Niveau 1."""
    # Chemins relatifs par rapport au répertoire du script
    script_dir = Path(__file__).resolve().parent
    base_dir = script_dir.parent
    data_dir = base_dir / "data"
    input_path = data_dir / "input_niveau1.json"
    output_path = data_dir / "output_niveau1.json"

    print("=== SYSTÈME D'OPTIMISATION - NIVEAU 1 ===")
    print("Chargement du graphe...")

    try:
        graphe = GrapheRoutier()
        graphe.charger_depuis_json(str(input_path))
    except FileNotFoundError as e:
        print(f"Erreur : {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Erreur lors du chargement : {e}")
        sys.exit(1)

    n_sommets = len(graphe.sommets)
    n_aretes = len(graphe.aretes) // 2  # non orienté : chaque arête comptée 2 fois
    print(f"[OK] {n_sommets} sommets charges")
    print(f"[OK] {n_aretes} aretes creees")

    print("\nCalcul de la matrice des distances...")
    matrice = graphe.matrice_distances()
    n = len(matrice)
    print(f"[OK] Matrice {n}x{n} calculee")

    # Affichage de la matrice (en-tête avec D = dépôt, P1..P10 = points, DC11..DC13 = déchetteries)
    ids_ordonnes = sorted(graphe.sommets.keys())
    print("\n=== MATRICE DES DISTANCES ===")
    from dechetterie import Dechetterie
    labels = []
    for sid in ids_ordonnes:
        if sid == 0:
            labels.append("D")
        elif isinstance(graphe.sommets[sid], Dechetterie):
            labels.append(f"DC{sid}")
        else:
            labels.append(f"P{sid}")
    col_width = 6
    header = "       " + "".join(f"{lb:>{col_width}}" for lb in labels)
    print(header)
    for i, id_i in enumerate(ids_ordonnes):
        if id_i == 0:
            label = "D    "
        elif isinstance(graphe.sommets[id_i], Dechetterie):
            label = f"DC{id_i:<2} "
        else:
            label = f"P{id_i:<2} "
        parts = []
        for j in range(n):
            val = matrice[i][j]
            if val == float("inf"):
                parts.append("  inf ")
            else:
                parts.append(f"{val:6.1f}")
        print(f"{label} [{' '.join(parts)}]")

    # Chemins optimaux depuis le dépôt (id=0)
    print("\n=== CHEMINS OPTIMAUX DEPUIS LE DÉPÔT ===")
    id_depot = 0
    for id_arrivee in ids_ordonnes:
        if id_arrivee == id_depot:
            continue
        dist, chemin = graphe.plus_court_chemin(id_depot, id_arrivee)
        if dist == float("inf"):
            print(f"Depot -> {graphe.sommets[id_arrivee].nom or id_arrivee} : pas de chemin")
            continue
        nom = graphe.sommets[id_arrivee].nom or f"Point {id_arrivee}"
        print(f"Depot -> {nom:20s} : {dist:5.1f}  | Chemin : {chemin}")

    # Sauvegarde
    try:
        graphe.sauvegarder_resultats(str(output_path))
        print(f"\n[OK] Resultats sauvegardes dans {output_path}")
    except Exception as e:
        print(f"\nErreur lors de la sauvegarde : {e}")
        sys.exit(1)

    print("=== NIVEAU 1 TERMINE AVEC SUCCES ===")


if __name__ == "__main__":
    main()
