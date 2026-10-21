DROP INDEX `budgets_category_month_idx`;--> statement-breakpoint
DROP INDEX `budgets_category_default_idx`;--> statement-breakpoint
ALTER TABLE `budgets` ADD `owner` text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_owner_category_month_idx` ON `budgets` (`owner`,`category_id`,`month`) WHERE "budgets"."month" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_owner_category_default_idx` ON `budgets` (`owner`,`category_id`) WHERE "budgets"."month" is null;--> statement-breakpoint
ALTER TABLE `accounts` ADD `owner` text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
ALTER TABLE `goals` ADD `owner` text DEFAULT 'shared' NOT NULL;