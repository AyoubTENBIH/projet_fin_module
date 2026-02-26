-- EcoCasa - Schéma MySQL
-- Gestion multi-utilisateurs : Admin + Chauffeurs, planning, GPS, statistiques

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Utilisateurs (admin + chauffeurs)
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `role` enum('admin','chauffeur') NOT NULL DEFAULT 'chauffeur',
  `nom` varchar(120) NOT NULL,
  `email` varchar(180) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `avatar` varchar(10) DEFAULT NULL,
  `telephone` varchar(30) DEFAULT NULL,
  `permis` varchar(10) DEFAULT NULL,
  `status` enum('actif','inactif','en_mission') DEFAULT 'actif',
  `camion_id` varchar(36) DEFAULT NULL,
  `zone_affectee` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `derniere_connexion` datetime DEFAULT NULL,
  UNIQUE KEY `email` (`email`),
  PRIMARY KEY (`id`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_camion` (`camion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Camions
-- ----------------------------
DROP TABLE IF EXISTS `camions`;
CREATE TABLE `camions` (
  `id` varchar(36) NOT NULL,
  `immatriculation` varchar(20) NOT NULL,
  `capacite` int NOT NULL COMMENT 'kg',
  `type` enum('benne','compacteur','ampliroll') DEFAULT 'benne',
  `annee` int DEFAULT NULL,
  `etat` enum('operationnel','maintenance','hors_service') DEFAULT 'operationnel',
  `chauffeur_id` varchar(36) DEFAULT NULL,
  `kilometrage` int DEFAULT 0,
  `derniere_maintenance` date DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `immatriculation` (`immatriculation`),
  KEY `idx_camions_etat` (`etat`),
  KEY `idx_camions_chauffeur` (`chauffeur_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Dépôt principal
-- ----------------------------
DROP TABLE IF EXISTS `depot`;
CREATE TABLE `depot` (
  `id` varchar(36) NOT NULL,
  `nom` varchar(120) NOT NULL,
  `lat` decimal(10,6) NOT NULL,
  `lng` decimal(10,6) NOT NULL,
  `adresse` varchar(255) DEFAULT NULL,
  `horaires` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Points de collecte
-- ----------------------------
DROP TABLE IF EXISTS `points_collecte`;
CREATE TABLE `points_collecte` (
  `id` varchar(36) NOT NULL,
  `nom` varchar(120) NOT NULL,
  `type` enum('collecte','depot','dechetterie') DEFAULT 'collecte',
  `lat` decimal(10,6) NOT NULL,
  `lng` decimal(10,6) NOT NULL,
  `volume_moyen` int DEFAULT 0 COMMENT 'kg',
  `frequence` enum('quotidien','hebdomadaire') DEFAULT 'quotidien',
  `priorite` enum('haute','normale','basse') DEFAULT 'normale',
  `zone_id` int DEFAULT NULL,
  `horaire_collecte` varchar(20) DEFAULT NULL,
  `contact` varchar(120) DEFAULT NULL,
  `adresse` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_points_zone` (`zone_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Déchetteries
-- ----------------------------
DROP TABLE IF EXISTS `dechetteries`;
CREATE TABLE `dechetteries` (
  `id` varchar(36) NOT NULL,
  `nom` varchar(120) NOT NULL,
  `lat` decimal(10,6) NOT NULL,
  `lng` decimal(10,6) NOT NULL,
  `capacite_max` int DEFAULT NULL COMMENT 'kg/jour',
  `types_acceptes` varchar(255) DEFAULT NULL COMMENT 'JSON array',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Plannings (missions)
-- ----------------------------
DROP TABLE IF EXISTS `plannings`;
CREATE TABLE `plannings` (
  `id` varchar(36) NOT NULL,
  `date_planning` date NOT NULL,
  `shift` enum('matin','apres_midi') NOT NULL,
  `chauffeur_id` varchar(36) NOT NULL,
  `camion_id` varchar(36) NOT NULL,
  `depot_id` varchar(36) NOT NULL,
  `dechetterie_id` varchar(36) DEFAULT NULL,
  `trajet_calcule` json DEFAULT NULL COMMENT 'coordinates, distance_totale, duree_estimee, ordre_points',
  `status` enum('planifie','en_cours','termine','annule') DEFAULT 'planifie',
  `heure_debut_reel` datetime DEFAULT NULL,
  `heure_fin_reel` datetime DEFAULT NULL,
  `collecte_reelle` int DEFAULT 0 COMMENT 'kg',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_plannings_date` (`date_planning`),
  KEY `idx_plannings_chauffeur` (`chauffeur_id`),
  KEY `idx_plannings_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Points assignés à un planning (table de liaison N-N)
DROP TABLE IF EXISTS `planning_points`;
CREATE TABLE `planning_points` (
  `planning_id` varchar(36) NOT NULL,
  `point_id` varchar(36) NOT NULL,
  `ordre` int NOT NULL DEFAULT 0,
  `collecte_effectuee` tinyint(1) DEFAULT 0,
  `poids_collecte` int DEFAULT NULL,
  `heure_collecte` datetime DEFAULT NULL,
  PRIMARY KEY (`planning_id`,`point_id`),
  KEY `idx_pp_point` (`point_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Sessions GPS (positions en temps réel)
-- ----------------------------
DROP TABLE IF EXISTS `gps_positions`;
CREATE TABLE `gps_positions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `planning_id` varchar(36) NOT NULL,
  `chauffeur_id` varchar(36) NOT NULL,
  `lat` decimal(10,6) NOT NULL,
  `lng` decimal(10,6) NOT NULL,
  `vitesse` decimal(6,2) DEFAULT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gps_planning` (`planning_id`),
  KEY `idx_gps_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Points complétés par session GPS (pour suivi)
-- ----------------------------
DROP TABLE IF EXISTS `gps_points_completes`;
CREATE TABLE `gps_points_completes` (
  `planning_id` varchar(36) NOT NULL,
  `point_id` varchar(36) NOT NULL,
  `completed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`planning_id`,`point_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Statistiques journalières (calculées / agrégées)
-- ----------------------------
DROP TABLE IF EXISTS `stats_journalieres`;
CREATE TABLE `stats_journalieres` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `date_stat` date NOT NULL,
  `total_collecte` int DEFAULT 0 COMMENT 'kg',
  `nombre_tournees` int DEFAULT 0,
  `distance_totale` decimal(10,2) DEFAULT 0 COMMENT 'km',
  `taux_completion` decimal(5,2) DEFAULT 0 COMMENT '%',
  `incidents` int DEFAULT 0,
  `cout_estime` decimal(10,2) DEFAULT 0 COMMENT 'MAD',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `date_stat` (`date_stat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Stats chauffeur (agrégées pour classement)
-- ----------------------------
DROP TABLE IF EXISTS `stats_chauffeur`;
CREATE TABLE `stats_chauffeur` (
  `chauffeur_id` varchar(36) NOT NULL,
  `periode_debut` date NOT NULL,
  `periode_fin` date NOT NULL,
  `tournees_effectuees` int DEFAULT 0,
  `kg_collectes` int DEFAULT 0,
  `km_parcourus` decimal(10,2) DEFAULT 0,
  `efficacite_pct` decimal(5,2) DEFAULT 0,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`chauffeur_id`,`periode_debut`,`periode_fin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
