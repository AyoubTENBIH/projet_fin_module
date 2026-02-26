-- EcoAgadir - Schéma MySQL
-- Créer la base : CREATE DATABASE ecoagadir;
-- Puis : mysql -u root -p ecoagadir < web_app/database/schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `gps_points_completes`;
DROP TABLE IF EXISTS `gps_positions`;
DROP TABLE IF EXISTS `planning_points`;
DROP TABLE IF EXISTS `plannings`;
DROP TABLE IF EXISTS `stats_journalieres`;
DROP TABLE IF EXISTS `stats_chauffeur`;
DROP TABLE IF EXISTS `dechetteries`;
DROP TABLE IF EXISTS `points_collecte`;
DROP TABLE IF EXISTS `depot`;
DROP TABLE IF EXISTS `camions`;
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `camions` (
  `id` varchar(36) NOT NULL,
  `immatriculation` varchar(20) NOT NULL,
  `capacite` int NOT NULL,
  `type` enum('benne','compacteur','ampliroll') DEFAULT 'benne',
  `annee` int DEFAULT NULL,
  `etat` enum('operationnel','maintenance','hors_service') DEFAULT 'operationnel',
  `chauffeur_id` varchar(36) DEFAULT NULL,
  `kilometrage` int DEFAULT 0,
  `derniere_maintenance` date DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `immatriculation` (`immatriculation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `depot` (
  `id` varchar(36) NOT NULL,
  `nom` varchar(120) NOT NULL,
  `lat` decimal(10,6) NOT NULL,
  `lng` decimal(10,6) NOT NULL,
  `adresse` varchar(255) DEFAULT NULL,
  `horaires` varchar(50) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `points_collecte` (
  `id` varchar(36) NOT NULL,
  `nom` varchar(120) NOT NULL,
  `type` enum('collecte','depot','dechetterie') DEFAULT 'collecte',
  `lat` decimal(10,6) NOT NULL,
  `lng` decimal(10,6) NOT NULL,
  `volume_moyen` int DEFAULT 0,
  `frequence` enum('quotidien','hebdomadaire') DEFAULT 'quotidien',
  `priorite` enum('haute','normale','basse') DEFAULT 'normale',
  `zone_id` int DEFAULT NULL,
  `horaire_collecte` varchar(20) DEFAULT NULL,
  `contact` varchar(120) DEFAULT NULL,
  `adresse` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `dechetteries` (
  `id` varchar(36) NOT NULL,
  `nom` varchar(120) NOT NULL,
  `lat` decimal(10,6) NOT NULL,
  `lng` decimal(10,6) NOT NULL,
  `capacite_max` int DEFAULT NULL,
  `types_acceptes` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `plannings` (
  `id` varchar(36) NOT NULL,
  `date_planning` date NOT NULL,
  `shift` enum('matin','apres_midi') NOT NULL,
  `chauffeur_id` varchar(36) NOT NULL,
  `camion_id` varchar(36) NOT NULL,
  `depot_id` varchar(36) NOT NULL,
  `dechetterie_id` varchar(36) DEFAULT NULL,
  `trajet_calcule` json DEFAULT NULL,
  `status` enum('planifie','en_cours','termine','annule') DEFAULT 'planifie',
  `heure_debut_reel` datetime DEFAULT NULL,
  `heure_fin_reel` datetime DEFAULT NULL,
  `collecte_reelle` int DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `planning_points` (
  `planning_id` varchar(36) NOT NULL,
  `point_id` varchar(36) NOT NULL,
  `ordre` int NOT NULL DEFAULT 0,
  `collecte_effectuee` tinyint(1) DEFAULT 0,
  `poids_collecte` int DEFAULT NULL,
  `heure_collecte` datetime DEFAULT NULL,
  PRIMARY KEY (`planning_id`,`point_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gps_positions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `planning_id` varchar(36) NOT NULL,
  `chauffeur_id` varchar(36) NOT NULL,
  `lat` decimal(10,6) NOT NULL,
  `lng` decimal(10,6) NOT NULL,
  `vitesse` decimal(6,2) DEFAULT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `gps_points_completes` (
  `planning_id` varchar(36) NOT NULL,
  `point_id` varchar(36) NOT NULL,
  `completed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`planning_id`,`point_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `stats_journalieres` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `date_stat` date NOT NULL,
  `total_collecte` int DEFAULT 0,
  `nombre_tournees` int DEFAULT 0,
  `distance_totale` decimal(10,2) DEFAULT 0,
  `taux_completion` decimal(5,2) DEFAULT 0,
  `incidents` int DEFAULT 0,
  `cout_estime` decimal(10,2) DEFAULT 0,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `date_stat` (`date_stat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
