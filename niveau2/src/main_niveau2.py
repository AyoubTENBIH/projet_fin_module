# -*- coding: utf-8 -*-
"""
Script principal Niveau 2 - VillePropre
Charge le graphe N1, les camions et zones N2, lance l'affectation gloutonne,
vérifie les contraintes, équilibre les charges et sauvegarde les résultats.
"""

import json
import sys
from pathlib import Path

# Importer GrapheRoutier et Dechetterie du Niveau 1
script_dir = Path(__file__).resolve().parent
base_niveau2 = script_dir.parent
project_root = base_niveau2.parent
niveau1_src = project_root / "niveau1" / "src"
sys.path.insert(0, str(niveau1_src))

from graphe_routier import GrapheRoutier
from dechetterie import Dechetterie

from affectateur_biparti import AffectateurBiparti
from camion import Camion
from zone import Zone


def charger_camions_zones(data_dir: Path):
    """Charge camions et zones depuis input_niveau2.json."""
    with open(data_dir / "input_niveau2.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    camions = []
    for c in data["camions"]:
        camion = Camion(
            id_camion=c["id"],
            capacite=c["capacite"],
            cout_fixe=c["cout_fixe"],
            zones_accessibles=c.get("zones_accessibles", []),
        )
        pos = c.get("position_initiale", {})
        camion.position_initiale = (pos.get("x", 0), pos.get("y", 0))
        camions.append(camion)

    zones = []
    for z in data["zones"]:
        centre = z["centre"]
        zone = Zone(
            id_zone=z["id"],
            points=z["points"],
            volume_estime=z["volume_moyen"],
            centre_x=centre["x"],
            centre_y=centre["y"],
        )
        zone.frequence_collecte = z.get("frequence_collecte", "quotidien")
        zone.priorite = z.get("priorite", "normale")
        zones.append(zone)

    contraintes = data.get("contraintes", {})
    zones_incompatibles = contraintes.get("zones_incompatibles", [])

    return camions, zones, zones_incompatibles


def afficher_matrice_couts(affectateur: AffectateurBiparti):
    """Affiche la matrice des coûts camion x zone."""
    camions = affectateur.camions
    zones = affectateur.zones
    print("\nCOUTS D'AFFECTATION (matrice) :")
    header = "         " + "".join(f" Zone{z.id}  " for z in zones)
    print(header)
    for camion in camions:
        row = []
        for zone in zones:
            c = affectateur.calculer_cout_affectation(camion.id, zone.id)
            if c == float("inf"):
                row.append("  inf  ")
            else:
                row.append(f"{c:7.1f}")
        print(f"Camion{camion.id}  [{' '.join(row)}]")


def sauvegarder_output(affectation: dict, affectateur: AffectateurBiparti, data_dir: Path):
    """Génère output_niveau2.json avec affectation, graphe_biparti et statistiques."""
    camions_par_id = {c.id: c for c in affectateur.camions}
    zones_par_id = {z.id: z for z in affectateur.zones}

    liste_affectation = []
    for camion_id, zone_ids in affectation.items():
        if not zone_ids:
            continue
        camion = camions_par_id[camion_id]
        charge = sum(zones_par_id[zid].volume_estime for zid in zone_ids)
        cout_estime = sum(
            affectateur.calculer_cout_affectation(camion_id, zid) for zid in zone_ids
        )
        # Pour coût par camion : on peut partager le cout_fixe une seule fois
        # Ici on garde la somme des coûts d'affectation (comme dans le spec)
        pct = (charge / camion.capacite * 100) if camion.capacite else 0
        liste_affectation.append({
            "camion_id": camion_id,
            "zones_affectees": zone_ids,
            "charge_totale": round(charge, 2),
            "cout_estime": round(cout_estime, 2),
            "pourcentage_utilisation": round(pct, 2),
        })

    stats = affectateur.calculer_statistiques(affectation)
    graphe_biparti = affectateur.generer_graphe_biparti()

    resultat = {
        "affectation": liste_affectation,
        "graphe_biparti": graphe_biparti,
        "statistiques": {
            "nombre_camions_utilises": stats["nombre_camions_utilises"],
            "charge_moyenne": stats["charge_moyenne"],
            "ecart_type_charge": stats["ecart_type_charge"],
            "zones_non_affectees": stats["zones_non_affectees"],
            "cout_total_estime": stats["cout_total_estime"],
            "taux_utilisation_moyen": stats["taux_utilisation_moyen"],
        },
    }

    out_path = data_dir / "output_niveau2.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(resultat, f, indent=2, ensure_ascii=False)
    return out_path


def main():
    """Point d'entrée du programme Niveau 2."""
    data_dir = base_niveau2 / "data"
    input_n1 = project_root / "niveau1" / "data" / "input_niveau1.json"

    print("=== SYSTÈME D'OPTIMISATION - NIVEAU 2 ===\n")
    print("DONNÉES CHARGÉES :")

    try:
        graphe = GrapheRoutier()
        graphe.charger_depuis_json(str(input_n1))
    except FileNotFoundError:
        print("  [ECHEC] Fichier niveau1/data/input_niveau1.json introuvable.")
        sys.exit(1)

    if len(graphe.sommets) == 0:
        print("  [ECHEC] Graphe niveau 1 vide.")
        sys.exit(1)

    try:
        camions, zones, zones_incompatibles = charger_camions_zones(data_dir)
    except FileNotFoundError:
        print("  [ECHEC] Fichier input_niveau2.json introuvable.")
        sys.exit(1)

    print(f"  [OK] {len(camions)} camions chargés")
    print(f"  [OK] {len(zones)} zones chargées")
    print("  [OK] Graphe routier niveau 1 connecté")
    
    # Extraire les déchetteries du graphe (centres de traitement où les camions déposent les déchets)
    dechetteries = []
    for sommet_id, sommet in graphe.sommets.items():
        if isinstance(sommet, Dechetterie):
            dechetteries.append(sommet)
    
    if dechetteries:
        print(f"  [OK] {len(dechetteries)} déchetterie(s) trouvée(s) (centres de traitement)")
    else:
        print("  [INFO] Aucune déchetterie trouvée - les camions retourneront directement au dépôt")

    affectateur = AffectateurBiparti(camions, zones, graphe, dechetteries)
    affectateur.zones_incompatibles = zones_incompatibles

    print("\nGRAPHE BIPARTI :")
    print("Camions <-> Zones accessibles :")
    for c in camions:
        print(f"  Camion {c.id} ({c.capacite}kg) <-> Zones {c.zones_accessibles}")

    afficher_matrice_couts(affectateur)

    print("\nAFFECTATION GLOUTONNE :")
    affectation = affectateur.affectation_gloutonne()
    zones_par_id = {z.id: z for z in zones}
    camions_par_id = {c.id: c for c in camions}
    for camion_id, zone_ids in affectation.items():
        if not zone_ids:
            continue
        camion = camions_par_id[camion_id]
        charge = sum(zones_par_id[zid].volume_estime for zid in zone_ids)
        pct = (charge / camion.capacite * 100) if camion.capacite else 0
        print(f"  Camion {camion_id} -> Zones {zone_ids}  | Charge: {charge:.0f} kg ({pct:.0f}%)")

    print("\nVÉRIFICATION CONTRAINTES :", end=" ")
    if affectateur.verifier_contraintes(affectation):
        print("[OK] Toutes respectées")
    else:
        print("[ECHEC] Violations ci-dessus")

    print("\nAPRÈS ÉQUILIBRAGE :")
    affectation_eq = affectateur.equilibrage_charges(affectation)
    for camion_id, zone_ids in affectation_eq.items():
        if not zone_ids:
            continue
        camion = camions_par_id[camion_id]
        charge = sum(zones_par_id[zid].volume_estime for zid in zone_ids)
        pct = (charge / camion.capacite * 100) if camion.capacite else 0
        print(f"  Camion {camion_id} -> Zones {zone_ids}  | Charge: {charge:.0f} kg ({pct:.0f}%)")

    stats = affectateur.calculer_statistiques(affectation_eq)
    print("\nSTATISTIQUES FINALES :")
    print(f"  - Camions utilisés   : {stats['nombre_camions_utilises']}/{len(camions)}")
    print(f"  - Charge moyenne     : {stats['charge_moyenne']:.0f} kg")
    ecart = stats["ecart_type_charge"]
    moy = stats["charge_moyenne"]
    pct_ecart = (ecart / moy * 100) if moy else 0
    print(f"  - Écart-type         : {ecart:.0f} kg ({pct_ecart:.1f}%)")
    na = stats["zones_non_affectees"]
    print(f"  - Zones non affectées: {'aucune' if not na else na}")
    print(f"  - Coût total estimé  : {stats['cout_total_estime']:.0f} €")

    out_path = sauvegarder_output(affectation_eq, affectateur, data_dir)
    print(f"\n[OK] Résultats sauvegardés dans {out_path}")
    print("=== NIVEAU 2 TERMINÉ AVEC SUCCÈS ===")


if __name__ == "__main__":
    main()
