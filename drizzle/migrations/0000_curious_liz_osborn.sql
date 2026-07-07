CREATE TABLE `factories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true,
	`order_index` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `group_factory_access` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer,
	`factory_id` text,
	FOREIGN KEY (`group_id`) REFERENCES `user_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `incoming_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`division` text,
	`supplier` text NOT NULL,
	`material` text NOT NULL,
	`gross` real,
	`tara` real,
	`quantity` real NOT NULL,
	`unit` text,
	`driver` text,
	`license_plate` text,
	`client_request_number` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `incoming_materials_number_unique` ON `incoming_materials` (`number`);--> statement-breakpoint
CREATE TABLE `outgoing_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`division` text NOT NULL,
	`customer` text NOT NULL,
	`consignee` text,
	`material` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text,
	`client_request_number` text,
	`client_request_date` text,
	`closed` integer DEFAULT false,
	`destination_point` text,
	`delivery_date` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outgoing_requests_number_unique` ON `outgoing_requests` (`number`);--> statement-breakpoint
CREATE TABLE `sent_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_number` text NOT NULL,
	`sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sent_notifications_request_number_unique` ON `sent_notifications` (`request_number`);--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`division` text NOT NULL,
	`customer` text NOT NULL,
	`consignee` text,
	`material` text NOT NULL,
	`gross` real,
	`tara` real,
	`quantity` real NOT NULL,
	`unit` text,
	`driver` text,
	`license_plate` text,
	`client_request_number` text,
	`destination_point` text,
	`client_request_date` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipments_number_unique` ON `shipments` (`number`);--> statement-breakpoint
CREATE TABLE `user_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `user_login_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`login_time` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`session_duration` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`group_id` integer,
	`telegram_chat_id` text,
	`last_login_at` integer,
	`login_count` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `user_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);