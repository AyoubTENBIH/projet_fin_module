# -*- coding: utf-8 -*-
"""
Module AffectateurBiparti - Niveau 2 VillePropre
Affectation optimale zones <-> camions via graphe biparti et algorithme glouton.
"""

import statistics
from copy import deepcopy

from camion import Camion
from zone import Zone


# Coûts (formule cahier des charges)
COUT_KM = 0.5       # €/km (aller-retour déjà ×2 dans la formule)
COUT_MANUTENTION_KG = 0.1  # €/kg

# Ordre des priorités pour le tri (haute en premier)
ORDRE_PRIORITE = {"haute": 0, "normale": 1, "basse": 2}


class AffectateurBiparti:
    """
    Affectation camions <-> zones modélisée comme un graphe biparti :
    partie gauche = camions, partie droite = zones, arêtes = coût d'affectation.
    """

    def __init__(self, camions: list, zones: list, graphe, dechetteries: list = None):
        """
        Initialise l'affectateur.

        Args:
            camions: Liste d'objets Camion.
            zones: Liste d'objets Zone.
            graphe: GrapheRoutier du niveau 1 (pour distances).
            dechetteries: Liste d'objets Dechetterie (centres de traitement).
        """
        self.camions = camions
        self.zones = zones
        self.graphe = graphe
        self.dechetteries = dechetteries or []
        self.zones_incompatibles = []  # liste de paires [id1, id2]
        self.historique_affectations = []

    def _distance_depot_vers_centre(self, zone: Zone) -> float:
        """Distance du dépôt (0,0) au centre de la zone (euclidienne)."""
        return zone.distance_depuis(0.0, 0.0)
    
    def _trouver_dechetterie_plus_proche(self, zone: Zone) -> tuple:
        """
        Trouve la déchetterie la plus proche d'une zone.
        
        Returns:
            Tuple (dechetterie, distance) ou (None, float('inf')) si aucune déchetterie disponible.
        """
        if not self.dechetteries:
            return (None, float("inf"))
        
        min_distance = float("inf")
        dechetterie_proche = None
        
        for dech in self.dechetteries:
            # Calculer la distance depuis le centre de la zone vers la déchetterie
            distance = zone.distance_depuis(dech.x, dech.y)
            if distance < min_distance:
                min_distance = distance
                dechetterie_proche = dech
        
        return (dechetterie_proche, min_distance)

    def calculer_cout_affectation(self, camion_id: int, zone_id: int) -> float:
        """
        Calcule le coût d'affecter un camion à une zone.
        
        Le trajet complet est : Dépôt → Zone (collecte) → Déchetterie (dépôt) → Dépôt (retour)
        
        Formule mise à jour :
        - Distance Dépôt → Zone : distance_depot_zone × COUT_KM
        - Distance Zone → Déchetterie : distance_zone_dechetterie × COUT_KM
        - Distance Déchetterie → Dépôt : distance_dechetterie_depot × COUT_KM
        - Manutention : volume_zone × COUT_MANUTENTION_KG
        - Coût fixe du camion

        Returns:
            Coût en €, ou float('inf') si le camion ne peut pas accéder à la zone.
        """
        camion = next((c for c in self.camions if c.id == camion_id), None)
        zone = next((z for z in self.zones if z.id == zone_id), None)
        if not camion or not zone:
            return float("inf")
        if not camion.peut_acceder_zone(zone_id):
            return float("inf")

        # Distance Dépôt → Zone (collecte)
        distance_depot_zone = self._distance_depot_vers_centre(zone)
        
        # Trouver la déchetterie la plus proche
        dechetterie_proche, distance_zone_dech = self._trouver_dechetterie_plus_proche(zone)
        
        # Distance Déchetterie → Dépôt (retour)
        distance_dech_depot = 0.0
        if dechetterie_proche:
            distance_dech_depot = dechetterie_proche.distance_depuis(0.0, 0.0)
        else:
            # Si pas de déchetterie, retour direct au dépôt depuis la zone
            distance_dech_depot = distance_depot_zone
        
        # Coût total des distances
        distance_totale = distance_depot_zone + distance_zone_dech + distance_dech_depot
        cout_distance = distance_totale * COUT_KM
        
        # Coût de manutention
        cout_manutention = zone.volume_estime * COUT_MANUTENTION_KG
        
        # Coût total
        return cout_distance + cout_manutention + camion.cout_fixe

    def affectation_gloutonne(self) -> dict:
        """
        Algorithme glouton : tri des zones par priorité puis volume,
        puis affectation au camion de coût minimal pouvant prendre la zone.
        Respecte zones_incompatibles (aucune paire incompatible sur le même camion).

        Returns:
            Dict[int, list[int]] : { camion_id: [zone_ids] }
        """
        for c in self.camions:
            c.reinitialiser()
        for z in self.zones:
            z.camion_affecte = None

        # Tri : priorité (haute d'abord), puis volume décroissant
        zones_triees = sorted(
            self.zones,
            key=lambda z: (ORDRE_PRIORITE.get(z.priorite, 1), -z.volume_estime),
        )

        affectation = {c.id: [] for c in self.camions}

        def zone_incompatible_avec_camion(zone_id: int, camion_id: int) -> bool:
            zones_du_camion = affectation.get(camion_id, [])
            for zi in zones_du_camion:
                for paire in self.zones_incompatibles:
                    if set(paire) == {zone_id, zi}:
                        return True
            return False

        for zone in zones_triees:
            zone_id = zone.id
            volume = zone.volume_estime

            candidats = []
            for camion in self.camions:
                if not camion.peut_acceder_zone(zone_id):
                    continue
                if not camion.peut_prendre_volume(volume):
                    continue
                if zone_incompatible_avec_camion(zone_id, camion.id):
                    continue
                cout = self.calculer_cout_affectation(camion.id, zone_id)
                if cout != float("inf"):
                    candidats.append((cout, camion.id))

            if not candidats:
                continue

            candidats.sort(key=lambda x: x[0])
            meilleur_camion_id = candidats[0][1]
            camion = next(c for c in self.camions if c.id == meilleur_camion_id)
            camion.ajouter_charge(volume)
            affectation[meilleur_camion_id].append(zone_id)
            zone.camion_affecte = meilleur_camion_id

        self.historique_affectations.append(deepcopy(affectation))
        return affectation

    def verifier_contraintes(self, affectation: dict) -> bool:
        """
        Vérifie que l'affectation respecte capacité, accessibilité et zones incompatibles.
        Affiche un message pour chaque violation.
        Returns True si tout est valide, False sinon.
        """
        ok = True

        # 1. Capacité
        zones_par_id = {z.id: z for z in self.zones}
        for camion in self.camions:
            zone_ids = affectation.get(camion.id, [])
            charge = sum(zones_par_id[zid].volume_estime for zid in zone_ids)
            if charge > camion.capacite:
                print(f"  [ECHEC] Camion {camion.id} depasse sa capacite: {charge} > {camion.capacite}")
                ok = False

        # 2. Accessibilité
        for camion in self.camions:
            for zone_id in affectation.get(camion.id, []):
                if not camion.peut_acceder_zone(zone_id):
                    print(f"  [ECHEC] Camion {camion.id} ne peut pas acceder a la zone {zone_id}")
                    ok = False

        # 3. Zones incompatibles
        for paire in self.zones_incompatibles:
            a, b = paire[0], paire[1]
            for camion_id, zone_ids in affectation.items():
                if a in zone_ids and b in zone_ids:
                    print(f"  [ECHEC] Zones incompatibles {a} et {b} sur le meme camion {camion_id}")
                    ok = False
                    break

        return ok

    def equilibrage_charges(self, affectation: dict) -> dict:
        """
        Rééquilibre les charges : camions surchargés (> moyenne + 15%)
        et sous-chargés (< moyenne - 15%), déplacements de zones si valides.
        Répète jusqu'à écart-type < 20% de la moyenne ou blocage.
        """
        affectation = deepcopy(affectation)
        camions_par_id = {c.id: c for c in self.camions}
        zones_par_id = {z.id: z for z in self.zones}

        def charge_camion(cid: int) -> float:
            return sum(
                zones_par_id[zid].volume_estime
                for zid in affectation.get(cid, [])
            )

        def peut_deplacer(zone_id: int, from_camion_id: int, to_camion_id: int) -> bool:
            zone = zones_par_id[zone_id]
            to_camion = camions_par_id[to_camion_id]
            if not to_camion.peut_acceder_zone(zone_id):
                return False
            charge_to = charge_camion(to_camion_id)
            if charge_to + zone.volume_estime > to_camion.capacite:
                return False
            zones_to_apres = affectation.get(to_camion_id, []) + [zone_id]
            for paire in self.zones_incompatibles:
                if zone_id not in paire:
                    continue
                autre = paire[1] if paire[0] == zone_id else paire[0]
                if autre in zones_to_apres:
                    return False
            return True

        max_iter = 100
        for _ in range(max_iter):
            charges = [charge_camion(cid) for cid in affectation if affectation[cid]]
            if not charges:
                break
            moyenne = statistics.mean(charges)
            ecart_type = statistics.stdev(charges) if len(charges) > 1 else 0.0
            if moyenne > 0 and ecart_type < 0.20 * moyenne:
                break

            surcharges = [cid for cid in affectation if charge_camion(cid) > moyenne * 1.15]
            sous_charges = [cid for cid in affectation if charge_camion(cid) < moyenne * 0.85]

            deplacement_fait = False
            for cid_heavy in surcharges:
                zones_heavy = list(affectation.get(cid_heavy, []))
                for zid in zones_heavy:
                    for cid_light in sous_charges:
                        if cid_light == cid_heavy:
                            continue
                        if peut_deplacer(zid, cid_heavy, cid_light):
                            affectation[cid_heavy].remove(zid)
                            affectation[cid_light].append(zid)
                            deplacement_fait = True
                            break
                    if deplacement_fait:
                        break
                if deplacement_fait:
                    break
            if not deplacement_fait:
                break

        return affectation

    def calculer_statistiques(self, affectation: dict) -> dict:
        """
        Calcule nombre_camions_utilises, charge_moyenne, ecart_type_charge,
        zones_non_affectees, cout_total_estime, taux_utilisation_moyen.
        """
        zones_par_id = {z.id: z for z in self.zones}
        camions_par_id = {c.id: c for c in self.camions}

        zones_affectees = set()
        charges = []
        cout_total = 0.0
        taux_list = []

        for camion_id, zone_ids in affectation.items():
            if not zone_ids:
                continue
            charge = sum(zones_par_id[zid].volume_estime for zid in zone_ids)
            charges.append(charge)
            zones_affectees.update(zone_ids)
            for zid in zone_ids:
                cout_total += self.calculer_cout_affectation(camion_id, zid)
            camion = camions_par_id.get(camion_id)
            if camion and camion.capacite > 0:
                taux_list.append((charge / camion.capacite) * 100)

        zones_non_affectees = [z.id for z in self.zones if z.id not in zones_affectees]
        nombre_camions_utilises = sum(1 for zids in affectation.values() if zids)
        charge_moyenne = statistics.mean(charges) if charges else 0.0
        ecart_type_charge = statistics.stdev(charges) if len(charges) > 1 else (charges[0] if charges else 0.0)
        taux_utilisation_moyen = statistics.mean(taux_list) if taux_list else 0.0

        return {
            "nombre_camions_utilises": nombre_camions_utilises,
            "charge_moyenne": round(charge_moyenne, 2),
            "ecart_type_charge": round(ecart_type_charge, 2),
            "zones_non_affectees": zones_non_affectees,
            "cout_total_estime": round(cout_total, 2),
            "taux_utilisation_moyen": round(taux_utilisation_moyen, 2),
        }

    def generer_graphe_biparti(self) -> dict:
        """
        Génère la représentation du graphe biparti (noeuds camions, noeuds zones, arêtes avec coût).
        """
        noeuds_camions = [
            {"id": c.id, "capacite": c.capacite, "cout_fixe": c.cout_fixe}
            for c in self.camions
        ]
        noeuds_zones = [
            {"id": z.id, "volume": z.volume_estime, "centre": z.centre}
            for z in self.zones
        ]
        aretes = []
        for camion in self.camions:
            for zone in self.zones:
                if not camion.peut_acceder_zone(zone.id):
                    continue
                cout = self.calculer_cout_affectation(camion.id, zone.id)
                if cout != float("inf"):
                    aretes.append({
                        "camion": camion.id,
                        "zone": zone.id,
                        "cout": round(cout, 2),
                    })
        return {
            "noeuds_camions": noeuds_camions,
            "noeuds_zones": noeuds_zones,
            "aretes": aretes,
        }
