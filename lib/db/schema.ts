// lib/db/schema.ts
import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

// Существующая таблица incoming_materials
export const incomingMaterials = sqliteTable('incoming_materials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull(),
  date: text('date').notNull(),
  supplier: text('supplier').notNull(),
  material: text('material').notNull(),
  gross: real('gross'),
  tara: real('tara'),
  quantity: real('quantity').notNull(),
  driver: text('driver'),
  licensePlate: text('license_plate'),
  createdAt: integer('created_at').notNull(),
});

// Обновлённая таблица shipments (с полями для связи с заявкой)
export const shipments = sqliteTable('shipments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull().unique(),
  date: text('date').notNull(),
  division: text('division').notNull(),
  customer: text('customer').notNull(),
  consignee: text('consignee'),
  material: text('material').notNull(),
  gross: real('gross'),
  tara: real('tara'),
  quantity: real('quantity').notNull(),
  driver: text('driver'),
  licensePlate: text('license_plate'),
  clientRequestNumber: text('client_request_number'), // Номер заявки клиента
  clientRequestDate: text('client_request_date'),     // Дата заявки клиента
  createdAt: integer('created_at').notNull(),
});

// Новая таблица: заявки на отгрузку
export const outgoingRequests = sqliteTable('outgoing_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull().unique(),           // Номер заявки
  date: text('date').notNull(),                       // Дата создания заявки
  division: text('division').notNull(),               // Подразделение (завод)
  customer: text('customer').notNull(),               // Покупатель
  consignee: text('consignee'),                       // Грузополучатель
  material: text('material').notNull(),               // Номенклатура
  quantity: real('quantity').notNull(),               // Плановое количество
  clientRequestNumber: text('client_request_number'), // Номер заявки клиента (для связи)
  clientRequestDate: text('client_request_date'),     // Дата заявки клиента
  createdAt: integer('created_at').notNull(),
});

// Типы
export type IncomingMaterial = typeof incomingMaterials.$inferSelect;
export type Shipment = typeof shipments.$inferSelect;
export type OutgoingRequest = typeof outgoingRequests.$inferSelect;
export type NewOutgoingRequest = typeof outgoingRequests.$inferInsert;







// Таблица для операций заводов Щ и П (из Google Sheets)
export const factoryOperations = sqliteTable('factory_operations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type'),                           // Асфальт/Бетон
  date: text('date').notNull(),
  material: text('material').notNull(),
  quantity: real('quantity').notNull(),
  customer: text('customer').notNull(),
  shipmentNumber: text('shipment_number'),
  licensePlate: text('license_plate'),
  clientRequestNumber: text('client_request_number'),
  clientRequestDate: text('client_request_date'),
  unit: text('unit'),                           // т, м3
  factory: text('factory').notNull(),           // Щ, П
  createdAt: integer('created_at').notNull(),
});

// Таблица для заявок (план) заводов Щ и П
export const factoryRequests = sqliteTable('factory_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientRequestNumber: text('client_request_number').notNull(),
  date: text('date').notNull(),
  material: text('material').notNull(),
  planQuantity: real('plan_quantity').notNull(),
  factQuantity: real('fact_quantity'),
  consignee: text('consignee'),
  customer: text('customer'),
  factory: text('factory').notNull(),           // Щ, П
  createdAt: integer('created_at').notNull(),
});