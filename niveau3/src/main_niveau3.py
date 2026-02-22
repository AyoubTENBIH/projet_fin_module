# -*- coding: utf-8 -*-
"""
Script principal Niveau 3 - VillePropre
Orchestration complète : Niveau 1 + 2 + 3 → Planning temporel hebdomadaire.
"""

import json
import sys
from pathlib import Path

# Chemins des modules
script_dir = Path(__file__).resolve().parent
base_niveau3 = script_dir.parent
project_root = base_niveau3.parent

niveau1_src = project_root / "niveau1" / "src"
niveau2_src = project_root / "niveau2" / "src"
sys.path.insert(0, str(niveau1_src))
sys.path.insert(0, str(niveau2_src))
sys.path.insert(0, str(script_dir))

from graphe_routier import GrapheRoutier
from dechetterie import Dechetterie
from affectateur_biparti import AffectateurBiparti
from camion import Camion
from zone import Zone

from creneau_horaire import CreneauHoraire
from contrainte_temporelle import ContrainteTemporelle
from planificateur_triparti import PlanificateurTriparti


def charger_donnees_niveau3(data_dir: Path) -> dict:
    """Charge input_niveau3.json."""
    input_path = data_dir / "input_niveau3.json"
    if not input_path.exists():
        raise FileNotFoundError(f"Fichier introuvable : {input_path}")
    with open(input_path, "r", encoding="utf-8") as f:
        return json.load(f)


def creer_creneaux(data: dict) -> list:
    """Crée les objets CreneauHoraire depuis le JSON."""
    creneaux = []
    for c in data.get("creneaux", []):
        creneau = CreneauHoraire(
            id_creneau=c["id"],
            debut=c["debut"],
            fin=c["fin"],
            jour=c["jour"],
            cout_congestion=c.get("niveau_congestion", 1.0),
        )
        creneaux.append(creneau)
    return creneaux


def charger_niveau2(project_root: Path) -> tuple:
    """Charge graphe N1, camions, zones et affectation N2."""
    input_n1 = project_root / "niveau1" / "data" / "input_niveau1.json"
    if not input_n1.exists():
        raise FileNotFoundError(f"Fichier introuvable : {input_n1}")

    graphe = GrapheRoutier()
    graphe.charger_depuis_json(str(input_n1))

    input_n2 = project_root / "niveau2" / "data" / "input_niveau2.json"
    if not input_n2.exists():
        raise FileNotFoundError(f"Fichier introuvable : {input_n2}")

    with open(input_n2, "r", encoding="utf-8") as f:
        data_n2 = json.load(f)

    camions = []
    for c in data_n2["camions"]:
        camion = Camion(
            id_camion=c["id"],
            capacite=c["capacite"],
            cout_fixe=c["cout_fixe"],
            zones_accessibles=c.get("zones_accessibles", []),
        )
        pos = c.get("position_initiale", {})
        if isinstance(pos, dict):
            camion.position_initiale = (pos.get("x", 0), pos.get("y", 0))
        camions.append(camion)

    zones = []
    for z in data_n2["zones"]:
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

    # Déchetteries du graphe N1
    dechetteries = []
    for sommet in graphe.sommets.values():
        if isinstance(sommet, Dechetterie):
            dechetteries.append(sommet)

    contraintes_n2 = data_n2.get("contraintes", {})
    zones_incompatibles = contraintes_n2.get("zones_incompatibles", [])

    affectateur = AffectateurBiparti(camions, zones, graphe, dechetteries)
    affectateur.zones_incompatibles = zones_incompatibles
    affectation_n2 = affectateur.affectation_gloutonne()

    return graphe, affectateur, affectation_n2


def main():
    """Point d'entrée Niveau 3."""
    data_dir = base_niveau3 / "data"

    print("=== SYSTÈME D'OPTIMISATION - NIVEAU 3 ===\n")
    print("Chargement des niveaux précédents...")

    try:
        graphe, affectateur, affectation_n2 = charger_niveau2(project_root)
    except FileNotFoundError as e:
        print(f"  [ECHEC] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"  [ECHEC] Erreur chargement N1/N2 : {e}")
        sys.exit(1)

    print(f"  [OK] Niveau 1 : {len(graphe.sommets)} points")
    print(f"  [OK] Niveau 2 : {len(affectateur.camions)} camions, {len(affectateur.zones)} zones")

    try:
        data_n3 = charger_donnees_niveau3(data_dir)
    except FileNotFoundError as e:
        print(f"  [ECHEC] {e}")
        sys.exit(1)

    creneaux = creer_creneaux(data_n3)
    print(f"  [OK] Niveau 3 : {len(creneaux)} créneaux chargés\n")

    # Contraintes temporelles
    contraintes = ContrainteTemporelle()
    ct_data = data_n3.get("contraintes_temporelles", {})
    if ct_data:
        contraintes.charger_depuis_dict(ct_data)

    print("CONTRAINTES TEMPORELLES :")
    print(f"  • Fenêtres zones      : {len(contraintes.fenetres_zone)}")
    print(f"  • Pauses camions      : {len(contraintes.pauses_camion)}")
    print(f"  • Zones interdites nuit : {contraintes.zones_interdites_nuit}\n")

    # Créneaux disponibles
    print("CRÉNEAUX DISPONIBLES :")
    for jour in ["lundi", "mardi", "mercredi", "jeudi", "vendredi"]:
        creneaux_jour = [c for c in creneaux if c.jour == jour]
        if creneaux_jour:
            print(f"  {jour.capitalize()} :")
            for c in creneaux_jour:
                print(
                    f"    • {c.debut_str}-{c.fin_str} "
                    f"(congestion {c.cout_congestion})"
                )
    print()

    # Planificateur
    planificateur = PlanificateurTriparti(affectateur, contraintes)
    planificateur.ajouter_creneaux(creneaux)

    hp = data_n3.get("horizon_planification", {})
    horizon_jours = 7
    if isinstance(hp, dict) and "date_debut" in hp and "date_fin" in hp:
        try:
            from datetime import datetime as dt
            d1 = dt.strptime(hp["date_debut"], "%Y-%m-%d")
            d2 = dt.strptime(hp["date_fin"], "%Y-%m-%d")
            horizon_jours = max(1, min(7, (d2 - d1).days + 1))
        except (ValueError, TypeError):
            horizon_jours = 7

    print("GÉNÉRATION DU PLANNING HEBDOMADAIRE...\n")
    planning = planificateur.generer_plan_optimal(affectation_n2, horizon_jours)

    # Affichage planning
    print("PLANNING GÉNÉRÉ :")
    for jour, entries in planning.items():
        if not entries:
            continue
        print(f"\n  >> {jour.upper()} :")
        for entry in entries:
            creneau = entry["creneau"]
            print(
                f"    - Camion {entry['camion_id']} -> "
                f"Zone {entry['zone_id']} | "
                f"{creneau['debut']}-{creneau['fin']} | "
                f"{entry['duree_totale']} min"
            )

    # Indicateurs
    indicateurs = planificateur.evaluer_plan(planning)
    print("\n\nINDICATEURS DE PERFORMANCE :")
    print(f"  • Taux occupation    : {indicateurs['taux_occupation']}%")
    print(f"  • Respect horaires   : {indicateurs['respect_horaires']}%")
    print(f"  • Congestion moyenne : {indicateurs['congestion_moyenne']}")
    print(f"  • Retard moyen       : {indicateurs['retard_moyen']} min")

    # Sauvegarde
    resultat = {
        "planification_hebdomadaire": planning,
        "indicateurs": indicateurs,
    }

    output_path = data_dir / "output_niveau3.json"
    data_dir.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(resultat, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] Résultats sauvegardés : {output_path}")
    print("=== NIVEAU 3 TERMINÉ AVEC SUCCÈS ===")


if __name__ == "__main__":
    main()
