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


// Полностью таблица будет выглядеть так:
export const shipments = sqliteTable('shipments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull().unique(),
  date: text('date').notNull(),
  division: text('division').notNull(),
  customer: text('customer').notNull(),
  consignee: text('consignee'),  // ← НОВОЕ ПОЛЕ
  material: text('material').notNull(),
  gross: real('gross'),
  tara: real('tara'),
  quantity: real('quantity').notNull(),
  driver: text('driver'),
  licensePlate: text('license_plate'),
  createdAt: integer('created_at').notNull(),
});


export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;


