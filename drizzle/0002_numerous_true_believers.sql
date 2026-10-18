CREATE TABLE `answerCardsMetadata` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardNumber` int NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`s3Url` varchar(512) NOT NULL,
	`generatedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `answerCardsMetadata_id` PRIMARY KEY(`id`),
	CONSTRAINT `answerCardsMetadata_cardNumber_unique` UNIQUE(`cardNumber`)
);
