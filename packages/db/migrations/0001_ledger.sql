PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transaction_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`account_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`category_id` text,
	`base_amount_minor` integer,
	`rate` text,
	`rate_id` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rate_id`) REFERENCES `exchange_rates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_transaction_legs`("id", "transaction_id", "account_id", "amount_minor", "currency", "category_id", "base_amount_minor", "rate", "rate_id") SELECT "id", "transaction_id", "account_id", "amount_minor", "currency", "category_id", "base_amount_minor", "rate", "rate_id" FROM `transaction_legs`;--> statement-breakpoint
DROP TABLE `transaction_legs`;--> statement-breakpoint
ALTER TABLE `__new_transaction_legs` RENAME TO `transaction_legs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `legs_transaction_idx` ON `transaction_legs` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `legs_account_idx` ON `transaction_legs` (`account_id`);--> statement-breakpoint
CREATE INDEX `legs_category_idx` ON `transaction_legs` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_deleted_idx` ON `transactions` (`deleted_at`);