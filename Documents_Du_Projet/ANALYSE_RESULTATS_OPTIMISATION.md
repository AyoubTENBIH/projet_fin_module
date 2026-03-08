# Analyse des résultats d’optimisation (500 points, LNS)

## Résumé des indicateurs observés

| Indicateur | Valeur | Commentaire |
|------------|--------|-------------|
| Occupation des créneaux | 100 % | Tous les créneaux sont utilisés. |
| Utilisation du parc | 73,7 % | Environ 3/4 des camions sont utilisés. |
| **Couverture de collecte** | **11,9 %** | Voir explication ci‑dessous. |
| Respect des contraintes | 100 % | Contraintes horaires respectées. |
| Congestion moyenne | 1,11 | Faible. |
| Retard moyen | 0 min | Aucun retard. |
| **Distance totale** | **660 171,9 km** | **Bug d’unité : valeur en mètres affichée en km.** |
| Volume total collecté | 448 000 kg | Cohérent (500 points × ~900 kg en moyenne). |
| Technique | LNS + décomposition + neighbor_pruning | Adaptée aux grandes instances. |
| Itérations LNS | 42 714 | Beaucoup d’améliorations explorées. |

---

## 1. « Tous les points sont visités » vs « Couverture 11,9 % »

- **Sur la carte** : les **routes** (Niveau 2) visitent bien tous les points prévus. Ce que vous voyez est correct.
- **Couverture de collecte à 11,9 %** : cet indicateur vient du **planning** (Niveau 3), pas des routes. Il mesure la part des **zones / créneaux** qui ont reçu une collecte dans le plan hebdomadaire (affectation zones → créneaux), pas la part des points couverts par les tournées.

En résumé :

- **Carte** = « Est‑ce que chaque point est sur une tournée ? » → Oui.
- **Couverture** = « Quelle part du plan (zones/créneaux) est couverte ? » → 11,9 % dans ce cas (peu de zones/créneaux « remplis » dans le plan, alors que les tournées, elles, couvrent tout).

Donc pas d’erreur de calcul des routes : la différence vient du fait que deux choses différentes sont mesurées (planning vs géographie des tournées).

---

## 2. Distance totale « 660 171,9 km » (irréaliste)

- Les coordonnées envoyées au backend sont en **mètres** (conversion lat/lng → xy avec facteurs ~85 000 et ~111 000).
- L’optimiseur calcule des distances **euclidiennes en mètres** et renvoie une **distance totale en mètres**.
- L’interface affichait cette valeur telle quelle avec l’unité « km », ce qui donnait **660 171,9 km** au lieu de **≈ 660 km**.

**Correction appliquée** : affichage de la distance en km (conversion m → km côté affichage lorsque la valeur est en mètres), pour obtenir un ordre de grandeur réaliste (quelques centaines à quelques milliers de km selon la taille de l’instance).

---

## 3. Doublons / numéros bizarres dans « Contrôle capacité des camions »

- Avec **zones vides** au chargement, le frontend crée une **zone par point** (zones d’id 1, 2, …, 500). L’optimisation est alors lancée **zone par zone** (une tournée par zone, donc beaucoup de petites tournées).
- On obtient donc beaucoup de cartes « Camion X » avec le **même** numéro de camion (1…20) répété, et éventuellement des libellés qui mélangent **camion** et **zone** (ex. numéros 322, 223, 77, etc. qui peuvent correspondre à des **id de zone**).

**Corrections appliquées** :

- Affichage plus clair : quand une route est associée à une zone (ex. après optimisation zone par zone), on affiche aussi la **zone** (ex. « Camion X · Zone Y » ou « Tournée n°i · Zone Y ») pour éviter la confusion entre id de camion et id de zone.
- Cela permet de distinguer les tournées et de ne plus croire à des « camions 322, 223… » alors que ce sont des zones.

---

## 4. Synthèse

- **Optimisation** : la LNS + décomposition + neighbor pruning a bien tourné (42 714 itérations, contraintes respectées, capacité des camions respectée).
- **Carte** : tous les points sont bien visités ; la géographie des tournées est cohérente avec le modèle.
- **Indicateurs** :
  - **Distance** : corrigée à l’affichage (m → km) pour refléter une distance totale réaliste (≈ 660 km et non 660 171 km).
  - **Couverture** : à interpréter comme « couverture du planning (zones/créneaux) », pas comme « part des points visités ».
  - **Capacité** : libellés clarifiés (camion + zone / tournée) pour éviter les doublons et les numéros ambigus.

Si vous voulez, on peut ensuite ajouter un indicateur explicite « Part des points visités par les routes » (ex. 100 %) à côté de la « Couverture de collecte » pour lever toute ambiguïté côté interface.
