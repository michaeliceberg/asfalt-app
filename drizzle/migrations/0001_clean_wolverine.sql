ALTER TABLE `shipments` ADD `arrived` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `shipments` ADD `arrived_at` text;--> statement-breakpoint
ALTER TABLE `shipments` ADD `distance_to_dest` real;--> statement-breakpoint
ALTER TABLE `shipments` ADD `eta_minutes` integer;--> statement-breakpoint
ALTER TABLE `shipments` ADD `updated_at` text;