CREATE TABLE `apns_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`device_token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apns_tokens_device_token_unique` ON `apns_tokens` (`device_token`);--> statement-breakpoint
CREATE TABLE `geofence_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`road_id` integer NOT NULL,
	`license_plate` text NOT NULL,
	`triggered_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`road_id`) REFERENCES `restricted_roads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `restricted_road_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`road_id` integer NOT NULL,
	`order_index` integer NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	FOREIGN KEY (`road_id`) REFERENCES `restricted_roads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `restricted_roads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`station_id` integer NOT NULL,
	`name` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`station_id`) REFERENCES `weigh_stations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trucks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`license_plate` text NOT NULL,
	`vehicle_type` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trucks_uid_unique` ON `trucks` (`uid`);--> statement-breakpoint
CREATE UNIQUE INDEX `trucks_license_plate_unique` ON `trucks` (`license_plate`);--> statement-breakpoint
CREATE TABLE `weigh_stations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
