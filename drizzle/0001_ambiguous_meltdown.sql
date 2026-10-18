ALTER TABLE `users` ADD `qqId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `douyinId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_qqId_unique` UNIQUE(`qqId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_douyinId_unique` UNIQUE(`douyinId`);