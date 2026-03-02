# Template « Multi-camions » – Utilisation

## Contenu du template

- **1 dépôt** (centre)
- **12 points de collecte** avec volumes 400–550 kg, répartis Nord / Sud / Est / centre
- **4 camions** de capacité 2000 kg chacun (plusieurs camions seront utilisés)
- **3 déchetteries** (Nord, Sud, Est) pour voir le choix de la **déchetterie la plus proche** quand un camion est plein
- **10 créneaux** (matin + après-midi sur 5 jours)

Les volumes sont choisis pour que les camions atteignent leur capacité et doivent aller en déchetterie ; les positions des points et des déchetteries permettent d’observer des trajets différents selon la zone.

## Occupation des créneaux

- **Pour avoir une occupation élevée** : il faut **plus d’assignations** (plus de tournées planifiées) par rapport au nombre de créneaux, pas plus de créneaux.
- Plus vous ajoutez de créneaux avec le même nombre de tournées, plus le taux baisse.
- Pour monter le taux : soit plus de points / tournées, soit moins de créneaux (ou les deux).

## Chargement

1. Page d’accueil Carte & Planification → **« Template démo (multi-camions) »**.
2. Ou importer ce fichier après avoir renommé en `.json` : `template_multi_camions.json`.

Ensuite : Points → Camions → Créneaux (déjà remplis) → Contraintes → Lancer l’optimisation. Sur la carte des résultats, vous verrez plusieurs trajets (un par camion), en couleurs différentes, et les détours vers la déchetterie la plus proche quand un camion est plein.
