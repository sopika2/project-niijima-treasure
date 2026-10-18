CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`opening_balance_minor` integer DEFAULT 0 NOT NULL,
	`opening_date` text NOT NULL,
	`include_in_total` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`month` text,
	`limit_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`rollover` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "budgets_limit_positive" CHECK("budgets"."limit_minor" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_category_month_idx` ON `budgets` (`category_id`,`month`) WHERE "budgets"."month" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_category_default_idx` ON `budgets` (`category_id`) WHERE "budgets"."month" is null;--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`parent_id` text,
	`color` text,
	`icon` text,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`fetched_at` text NOT NULL,
	`valid_from` text NOT NULL,
	`currency` text NOT NULL,
	`quote_currency` text NOT NULL,
	`rate_type` text NOT NULL,
	`rate` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rates_lookup_idx` ON `exchange_rates` (`currency`,`rate_type`,`valid_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `rates_unique_quote_idx` ON `exchange_rates` (`currency`,`quote_currency`,`rate_type`,`valid_from`,`source`);--> statement-breakpoint
CREATE TABLE `goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`date` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`transaction_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contributions_goal_idx` ON `goal_contributions` (`goal_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`deadline` text,
	`account_id` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`account_id` text NOT NULL,
	`to_account_id` text,
	`category_id` text,
	`rrule` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`auto_post` integer DEFAULT false NOT NULL,
	`amount_varies` integer DEFAULT false NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`next_due` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recurring_next_due_idx` ON `recurring_rules` (`next_due`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaction_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`account_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`category_id` text,
	`base_amount_minor` integer NOT NULL,
	`rate` text,
	`rate_id` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rate_id`) REFERENCES `exchange_rates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `legs_transaction_idx` ON `transaction_legs` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `legs_account_idx` ON `transaction_legs` (`account_id`);--> statement-breakpoint
CREATE INDEX `legs_category_idx` ON `transaction_legs` (`category_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`note` text,
	`recurring_id` text,
	`status` text DEFAULT 'posted' NOT NULL,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring_rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_recurring_idx` ON `transactions` (`recurring_id`);