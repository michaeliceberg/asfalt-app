CREATE TABLE `shipment_start_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_number` text NOT NULL,
	`sent_at` integer NOT NULL,
	`factory` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipment_start_notifications_request_number_unique` ON `shipment_start_notifications` (`request_number`);