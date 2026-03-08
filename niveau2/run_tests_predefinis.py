# -*- coding: utf-8 -*-
"""
Tests prédéfinis : 5/50, 10/100, 20/500 (camions / points de collecte).
Chaque point a 2 ou 3 bennes, poids total 150–600 kg.
Génère les données, lance l'optimisation, affiche les mesures de performance
et le tonnage transporté par kilomètre (par camion et moyenne).
"""

import json
import os
import random
import sys
from pathlib import Path

# Ajouter src pour importer optimiseur_routes
NIVEAU2_SRC = Path(__file__).resolve().parent / "src"
sys.path.insert(0, str(NIVEAU2_SRC))

from optimiseur_routes import optimiser_collecte

# Dossier des jeux de tests prédéfinis
DATA_DIR = Path(__file__).resolve().parent / "data" / "tests_predefinis"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def generer_point(id_point: int, x_min: float, x_max: float, y_min: float, y_max: float, rng: random.Random) -> dict:
    """Génère un point de collecte avec 2 ou 3 bennes, poids total entre 150 et 600 kg."""
    nb_bennes = rng.choice([2, 3])
    # Poids total 150–600 kg selon le nombre de bennes (2 bennes plutôt 150–400, 3 bennes 300–600)
    if nb_bennes == 2:
        volume_kg = rng.uniform(150, 400)
    else:
        volume_kg = rng.uniform(300, 600)
    volume_kg = round(volume_kg, 2)
    return {
        "id": id_point,
        "x": round(rng.uniform(x_min, x_max), 4),
        "y": round(rng.uniform(y_min, y_max), 4),
        "nom": f"Point {id_point}",
        "volume": volume_kg,
        "nb_bennes": nb_bennes,
    }


def generer_jeu(nb_camions: int, nb_points: int, seed: int = 42) -> dict:
    """Génère un jeu de données prédéfini (dépôt, points, déchetteries, camions)."""
    rng = random.Random(seed)
    # Dépôt au centre
    depot = {"id": 0, "x": 50.0, "y": 50.0, "nom": "Dépôt"}
    # Points dans une zone [10, 90] x [10, 90]
    points = [
        generer_point(i, 10, 90, 10, 90, rng)
        for i in range(1, nb_points + 1)
    ]
    # Déchetteries fixes (3)
    dechetteries = [
        {"id": nb_points + 1, "x": 20.0, "y": 20.0, "nom": "Déchetterie Sud-Ouest", "capacite_max": 50000},
        {"id": nb_points + 2, "x": 80.0, "y": 20.0, "nom": "Déchetterie Sud-Est", "capacite_max": 50000},
        {"id": nb_points + 3, "x": 50.0, "y": 85.0, "nom": "Déchetterie Nord", "capacite_max": 50000},
    ]
    # Camions : capacité suffisante (ordre de grandeur 2–3 tonnes), tous accès (zones_accessibles vide = tous points)
    capacite_kg = 4000
    camions = [
        {
            "id": i,
            "capacite": capacite_kg,
            "cout_fixe": 100 + i * 10,
            "zones_accessibles": [],
            "position_initiale": {"x": depot["x"], "y": depot["y"]},
        }
        for i in range(1, nb_camions + 1)
    ]
    return {
        "depot": depot,
        "points_collecte": points,
        "dechetteries": dechetteries,
        "camions": camions,
        "meta": {"nb_camions": nb_camions, "nb_points": nb_points, "seed": seed},
    }


def lancer_test(nb_camions: int, nb_points: int, seed: int = 42, use_osrm: bool = False) -> dict:
    """Génère les données, lance l'optimisation, retourne le résultat complet."""
    jeu = generer_jeu(nb_camions, nb_points, seed)
    # Sauvegarder les entrées pour reproductibilité
    fichier_entree = DATA_DIR / f"test_{nb_camions}_{nb_points}_input.json"
    with open(fichier_entree, "w", encoding="utf-8") as f:
        json.dump(jeu, f, ensure_ascii=False, indent=2)

    # Préparer les données pour optimiser_collecte (sans nb_bennes pour l'optimiseur)
    points_data = [{k: v for k, v in p.items() if k != "nb_bennes"} for p in jeu["points_collecte"]]
    dechetteries_data = [
        {"id": d["id"], "x": d["x"], "y": d["y"], "nom": d["nom"], "capacite_max": d.get("capacite_max", 10000)}
        for d in jeu["dechetteries"]
    ]
    camions_data = [
        {"id": c["id"], "capacite": c["capacite"], "cout_fixe": c["cout_fixe"], "zones_accessibles": c["zones_accessibles"]}
        for c in jeu["camions"]
    ]

    resultat = optimiser_collecte(
        depot_data=jeu["depot"],
        points_data=points_data,
        dechetteries_data=dechetteries_data,
        camions_data=camions_data,
        use_osrm=use_osrm,
    )

    # Sauvegarder les sorties
    fichier_sortie = DATA_DIR / f"test_{nb_camions}_{nb_points}_output.json"
    with open(fichier_sortie, "w", encoding="utf-8") as f:
        json.dump(resultat, f, ensure_ascii=False, indent=2)

    return resultat


def afficher_performances(resultat: dict, nb_camions: int, nb_points: int) -> None:
    """Affiche les mesures de performance et le tonnage par km (par camion et moyenne)."""
    stats = resultat.get("statistiques", {})
    routes = resultat.get("routes", [])

    print("\n" + "=" * 60)
    print(f"  TEST {nb_camions} camions / {nb_points} points de collecte")
    print("=" * 60)
    print(f"  Distance totale (km)        : {stats.get('distance_totale', 0)}")
    print(f"  Volume total collecté (kg)   : {stats.get('volume_total_collecte', 0)}")
    print(f"  Camions utilisés             : {stats.get('nb_camions_utilises', 0)}")
    print(f"  Visites déchetteries          : {stats.get('nb_total_visites_dechetteries', 0)}")
    print(f"  Distance moyenne par camion   : {stats.get('distance_moyenne_par_camion', 0)} km")
    print(f"  Écart-type distance           : {stats.get('ecart_type_distance', 0)}")
    print("-" * 60)
    print("  Tonnage transporté par kilomètre (tonnes/km) :")
    print(f"    Moyenne (tous camions)      : {stats.get('moyenne_tonnage_par_km', 0)} t/km")
    if routes:
        print("    Par camion :")
        for r in routes:
            cid = r.get("camion_id")
            tpk = r.get("tonnage_par_km", 0)
            dist = r.get("distance_totale", 0)
            vol = r.get("volume_total_collecte", 0)
            print(f"      Camion {cid} : {tpk} t/km  (distance {dist} km, volume {vol} kg)")
    print("=" * 60)


def main():
    """Exécute les trois tests prédéfinis et affiche les performances."""
    import argparse
    parser = argparse.ArgumentParser(description="Tests prédéfinis 5/50, 10/100, 20/500")
    parser.add_argument("--quick", action="store_true", help="Exécuter seulement 5/50 et 10/100 (le test 20/500 peut prendre plusieurs minutes)")
    args = parser.parse_args()

    print("Génération et exécution des tests prédéfinis (données dans data/tests_predefinis/)")
    scenarios = [(5, 50), (10, 100), (20, 500)]
    if args.quick:
        scenarios = [(5, 50), (10, 100)]
        print("Mode --quick : seulement 5/50 et 10/100.")
    for nb_camions, nb_points in scenarios:
        print(f"\n>>> Lancement test {nb_camions} camions / {nb_points} points...")
        resultat = lancer_test(nb_camions, nb_points, seed=42, use_osrm=False)
        afficher_performances(resultat, nb_camions, nb_points)
    print("\nTerminé. Fichiers d'entrée et de sortie dans :", DATA_DIR)


if __name__ == "__main__":
    main()
