-- EcoCasa - Données de démonstration
-- Les utilisateurs démo sont créés par le backend au premier login (mot de passe hashés).
-- Comptes : admin@ecocasa.ma / Admin2024!  |  y.benali@ecocasa.ma / Chauffeur1!  |  k.mansouri@ecocasa.ma / Chauffeur2!

-- Camions (5: 3 opérationnels, 1 maintenance, 1 hors service)
INSERT INTO `camions` (`id`, `immatriculation`, `capacite`, `type`, `annee`, `etat`, `chauffeur_id`, `kilometrage`, `derniere_maintenance`) VALUES
('c1', '12345-A-6', 5000, 'benne', 2021, 'operationnel', 'u2', 45230, '2024-02-15'),
('c2', '23456-B-7', 6000, 'compacteur', 2022, 'operationnel', 'u3', 32100, '2024-03-01'),
('c3', '34567-C-8', 5000, 'benne', 2020, 'operationnel', NULL, 67800, '2024-01-20'),
('c4', '45678-D-9', 4000, 'ampliroll', 2019, 'maintenance', NULL, 89000, '2024-02-28'),
('c5', '56789-E-1', 5000, 'benne', 2018, 'hors_service', NULL, 120000, '2023-12-01');

-- Dépôt principal (Aïn Sebaâ)
INSERT INTO `depot` (`id`, `nom`, `lat`, `lng`, `adresse`, `horaires`) VALUES
('d1', 'Centre de Traitement Aïn Sebaâ', 33.595000, -7.520000, 'Zone industrielle Aïn Sebaâ', '06:00-22:00');

-- Points de collecte (Casablanca - coordonnées réelles)
INSERT INTO `points_collecte` (`id`, `nom`, `type`, `lat`, `lng`, `volume_moyen`, `frequence`, `priorite`, `zone_id`, `horaire_collecte`, `contact`, `adresse`) VALUES
('p1', 'Marché Derb Sultan', 'collecte', 33.573100, -7.589800, 800, 'quotidien', 'haute', 2, '07:00-09:00', 'Hassan Tazi', 'Rue des Palmiers, Casablanca'),
('p2', 'Hay Mohammadi', 'collecte', 33.564700, -7.574200, 750, 'quotidien', 'haute', 2, '07:00-09:00', NULL, 'Hay Mohammadi'),
('p3', 'Mers Sultan', 'collecte', 33.578900, -7.565400, 600, 'quotidien', 'normale', 2, '08:00-10:00', NULL, 'Mers Sultan'),
('p4', 'Bd Zerktouni', 'collecte', 33.589200, -7.623400, 650, 'quotidien', 'haute', 1, '07:30-09:30', NULL, 'Boulevard Zerktouni'),
('p5', 'Aïn Chock', 'collecte', 33.544500, -7.566700, 700, 'quotidien', 'normale', 3, '08:00-10:00', NULL, 'Aïn Chock'),
('p6', 'Sidi Bernoussi Nord', 'collecte', 33.592300, -7.487600, 550, 'hebdomadaire', 'normale', 3, '09:00-11:00', NULL, 'Sidi Bernoussi'),
('p7', 'Maarif', 'collecte', 33.581000, -7.635000, 900, 'quotidien', 'haute', 1, '07:00-09:00', NULL, 'Maarif'),
('p8', 'Oasis', 'collecte', 33.556000, -7.612000, 500, 'quotidien', 'normale', 1, '08:00-10:00', NULL, 'Oasis'),
('p9', 'Racine', 'collecte', 33.570000, -7.600000, 620, 'quotidien', 'normale', 2, '07:30-09:30', NULL, 'Racine'),
('p10', 'Derb Ghallef', 'collecte', 33.562000, -7.648000, 850, 'quotidien', 'haute', 1, '07:00-09:00', NULL, 'Derb Ghallef'),
('p11', 'Aïn Sebaâ Sud', 'collecte', 33.588000, -7.535000, 480, 'quotidien', 'basse', 3, '09:00-11:00', NULL, 'Aïn Sebaâ'),
('p12', 'California', 'collecte', 33.575000, -7.700000, 720, 'quotidien', 'normale', 1, '08:00-10:00', NULL, 'California'),
('p13', 'Sbata', 'collecte', 33.598000, -7.555000, 580, 'hebdomadaire', 'normale', 3, '09:00-11:00', NULL, 'Sbata'),
('p14', 'Roches Noires', 'collecte', 33.552000, -7.578000, 660, 'quotidien', 'normale', 2, '07:30-09:30', NULL, 'Roches Noires'),
('p15', 'Bourgogne', 'collecte', 33.586000, -7.618000, 540, 'quotidien', 'normale', 1, '08:00-10:00', NULL, 'Bourgogne');

-- Déchetteries
INSERT INTO `dechetteries` (`id`, `nom`, `lat`, `lng`, `capacite_max`, `types_acceptes`) VALUES
('dec1', 'Déchetterie Sidi Bernoussi', 33.580000, -7.490000, 50000, '["ordures","recyclable","encombrants"]'),
('dec2', 'Déchetterie Aïn Sebaâ', 33.598000, -7.518000, 40000, '["ordures","recyclable"]');

-- Plannings exemple (semaine en cours)
INSERT INTO `plannings` (`id`, `date_planning`, `shift`, `chauffeur_id`, `camion_id`, `depot_id`, `dechetterie_id`, `trajet_calcule`, `status`, `heure_debut_reel`, `heure_fin_reel`, `collecte_reelle`) VALUES
('pl1', CURDATE(), 'matin', 'u2', 'c1', 'd1', 'dec1', '{"distance_totale": 23.4, "duree_estimee": 185, "ordre_points": ["d1","p2","p1","p3","dec1"]}', 'en_cours', NOW(), NULL, 0),
('pl2', CURDATE(), 'matin', 'u3', 'c2', 'd1', 'dec1', '{"distance_totale": 19.2, "duree_estimee": 150, "ordre_points": ["d1","p4","p7","p8","dec1"]}', 'planifie', NULL, NULL, 0),
('pl3', DATE_ADD(CURDATE(), INTERVAL 1 DAY), 'matin', 'u2', 'c1', 'd1', 'dec1', NULL, 'planifie', NULL, NULL, 0);

-- Points assignés au planning pl1
INSERT INTO `planning_points` (`planning_id`, `point_id`, `ordre`, `collecte_effectuee`, `poids_collecte`, `heure_collecte`) VALUES
('pl1', 'p2', 1, 1, 720, NOW()),
('pl1', 'p1', 2, 1, 800, NOW()),
('pl1', 'p3', 3, 0, NULL, NULL);

-- Stats journalières (30 derniers jours simulées - quelques lignes)
INSERT INTO `stats_journalieres` (`date_stat`, `total_collecte`, `nombre_tournees`, `distance_totale`, `taux_completion`, `incidents`, `cout_estime`) VALUES
(DATE_SUB(CURDATE(), INTERVAL 1 DAY), 4200, 3, 85, 92.00, 0, 1180),
(DATE_SUB(CURDATE(), INTERVAL 2 DAY), 4500, 3, 89, 94.00, 0, 1250),
(DATE_SUB(CURDATE(), INTERVAL 3 DAY), 3800, 2, 72, 88.00, 1, 1050),
(DATE_SUB(CURDATE(), INTERVAL 4 DAY), 5100, 4, 98, 96.00, 0, 1420),
(DATE_SUB(CURDATE(), INTERVAL 5 DAY), 4400, 3, 91, 93.00, 0, 1220);

-- Note: Les hash de mot de passe ci-dessus sont des placeholders.
-- Au premier lancement, le backend doit les remplacer par de vrais hash (bcrypt)
-- ou utiliser un script d'init qui hash Admin2024!, Chauffeur1!, Chauffeur2!.
