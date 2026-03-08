# -*- coding: utf-8 -*-
"""
Benchmark grandes instances : mesure la durée d'optimisation et rappelle la complexité.
Lance les tests 10/100 (medium) et 20/500 (xlarge).
"""

import json
import sys
import time
from pathlib import Path

NIVEAU2_SRC = Path(__file__).resolve().parent / "src"
sys.path.insert(0, str(NIVEAU2_SRC))

from optimiseur_routes import optimiser_collecte
from run_tests_predefinis import generer_jeu

def preparer_donnees(jeu):
    points_data = [{k: v for k, v in p.items() if k != "nb_bennes"} for p in jeu["points_collecte"]]
    dechetteries_data = [
        {"id": d["id"], "x": d["x"], "y": d["y"], "nom": d["nom"], "capacite_max": d.get("capacite_max", 10000)}
        for d in jeu["dechetteries"]
    ]
    camions_data = [
        {"id": c["id"], "capacite": c["capacite"], "cout_fixe": c["cout_fixe"], "zones_accessibles": c["zones_accessibles"]}
        for c in jeu["camions"]
    ]
    return jeu["depot"], points_data, dechetteries_data, camions_data


def run_benchmark(nb_camions: int, nb_points: int, time_limit_seconds: float = None):
    jeu = generer_jeu(nb_camions, nb_points, seed=42)
    depot, points_data, dech, camions = preparer_donnees(jeu)
    t0 = time.perf_counter()
    resultat = optimiser_collecte(
        depot, points_data, dech, camions, use_osrm=False,
        time_limit_seconds=time_limit_seconds
    )
    duree_s = time.perf_counter() - t0
    stats = resultat.get("statistiques", {})
    strategie = stats.get("strategie_optimisation", "?")
    nb_routes = len(resultat.get("routes", []))
    dist_totale = stats.get("distance_totale", 0)
    technique = stats.get("technique_grande_instance")
    nb_lns = stats.get("nb_iterations_lns")
    return {
        "nb_camions": nb_camions,
        "nb_points": nb_points,
        "duree_s": duree_s,
        "strategie": strategie,
        "nb_routes": nb_routes,
        "distance_totale": dist_totale,
        "technique": technique,
        "nb_iterations_lns": nb_lns,
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Benchmark grandes instances (durée + complexité)")
    parser.add_argument("--time-limit", type=float, default=90, metavar="SEC", help="Limite temps (s) pour 20/500 (défaut: 90)")
    args = parser.parse_args()

    print("=" * 70)
    print("  BENCHMARK GRANDES INSTANCES — Mesure de durée et complexité")
    print("=" * 70)

    scenarios = [
        (10, 100, None),            # medium (ancien pipeline)
        (15, 200, 20),              # large : LNS + neighbor pruning, objectif < 15 s
        (20, 500, args.time_limit), # xlarge : décomposition + LNS, objectif < 30 s
    ]
    results = []
    for nc, np, tlim in scenarios:
        print(f"\n>>> Lancement {nc} camions / {np} points" + (f" (time_limit={tlim}s)" if tlim else "") + "...")
        try:
            r = run_benchmark(nc, np, time_limit_seconds=tlim)
            results.append(r)
            tech_lns = (f"  |  Technique: {r['technique']}" if r.get('technique') else "") + (f"  |  Itérations LNS: {r['nb_iterations_lns']}" if r.get('nb_iterations_lns') is not None else "")
            print(f"    Stratégie: {r['strategie']}  |  Durée: {r['duree_s']:.2f} s  |  Routes: {r['nb_routes']}  |  Distance: {r['distance_totale']:.1f} km{tech_lns}")
        except Exception as e:
            print(f"    ERREUR: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 70)
    print("  RÉSUMÉ DES DURÉES")
    print("=" * 70)
    for r in results:
        line = f"  {r['nb_camions']} camions / {r['nb_points']} points  |  {r['duree_s']:.2f} s  |  profil {r['strategie']}"
        if r.get("technique"):
            line += f"  |  {r['technique']}"
        if r.get("nb_iterations_lns") is not None:
            line += f"  |  {r['nb_iterations_lns']} iter. LNS"
        print(line)
    print()

    print("=" * 70)
    print("  COMPLEXITÉ (par profil)")
    print("=" * 70)
    print("""
  n = nombre de points de collecte (par tournée ou total selon l'étape)
  C = nombre de camions
  d = nombre de déchetteries

  • Répartition glouton        : O(n_total × C)
  • Nearest Neighbor + déch.    : O(n² + n×d)  par tournée
  • 2-opt (complet)            : O(n² × max_iter_2opt)  par tournée
  • 3-opt (si small/medium)     : O(n³ × max_iter_3opt)  par tournée
  • Or-opt                     : O(n² × max_iter_or_opt)  par tournée
  • Recuit simulé (SA)          : O(n² × max_iter_sa)  par tournée
  • ILS (large/xlarge)          : O(restarts × (n² × max_2opt))  par tournée
  • MST (borne inf., sauf xlarge): O(n_total²)
  • Nettoyage croisements       : O(n² × max_iter_nettoyage)  par tournée

  Total par tournée (ordre de grandeur) :
    - small  : O(n² × K2 + n³ × K3 + n² × Ksa)  avec K bornés
    - medium : idem avec plafonds plus bas
    - large  : O(n² × K2 + n² × Kils + n² × Ksa)  (pas de 3-opt)
    - xlarge : O(n² × K2 + n² × Kils + n² × Ksa)  (MST skippé, K plus petits)

  Pour C camions avec n_1, n_2, ... points par tournée :
    Temps total ~ somme sur chaque tournee des couts ci-dessus.
""")
    print("=" * 70)


if __name__ == "__main__":
    main()
