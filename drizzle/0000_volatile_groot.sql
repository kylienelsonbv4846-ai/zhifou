ALTER TABLE `users` ADD `avatarUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `wechatId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_wechatId_unique` UNIQUE(`wechatId`);
