CREATE TABLE IF NOT EXISTS `passwordResetCodes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `email` varchar(320) NOT NULL,
  `code` varchar(10) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `attempts` int NOT NULL DEFAULT 0,
  `verified` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_idx` (`email`)
);
