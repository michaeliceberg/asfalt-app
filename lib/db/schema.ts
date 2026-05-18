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