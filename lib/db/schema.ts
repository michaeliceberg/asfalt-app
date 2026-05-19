// lib/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const incomingMaterials = sqliteTable('incoming_materials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull(),        // Номер накладной
  date: text('date').notNull(),             // Дата поставки
  supplier: text('supplier').notNull(),     // Поставщик
  material: text('material').notNull(),     // Номенклатура
  gross: real('gross'),                     // Брутто
  tara: real('tara'),                       // Тара
  quantity: real('quantity').notNull(),     // Количество
  driver: text('driver'),                   // Водитель
  licensePlate: text('license_plate'),      // Госномер
  createdAt: integer('created_at').notNull(), // timestamp создания записи
});

export type IncomingMaterial = typeof incomingMaterials.$inferSelect;
export type NewIncomingMaterial = typeof incomingMaterials.$inferInsert;



// lib/db/schema.ts — добавьте это в конец файла

export const shipments = sqliteTable('shipments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull().unique(),     // Номер документа
  date: text('date').notNull(),                   // Дата отгрузки
  division: text('division').notNull(),           // Подразделение (Люберцы/Луховицы)
  customer: text('customer').notNull(),           // Покупатель
  material: text('material').notNull(),           // Номенклатура (асфальт)
  gross: real('gross'),                           // Брутто
  tara: real('tara'),                             // Тара
  quantity: real('quantity').notNull(),           // Количество (чистый вес)
  driver: text('driver'),                         // Водитель
  licensePlate: text('license_plate'),            // Госномер
  createdAt: integer('created_at').notNull(),
});

export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;