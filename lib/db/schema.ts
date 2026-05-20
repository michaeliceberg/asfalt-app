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



// // lib/db/schema.ts
// import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// export const incomingMaterials = sqliteTable('incoming_materials', {
//   id: integer('id').primaryKey({ autoIncrement: true }),
//   number: text('number').notNull(),        // Номер накладной
//   date: text('date').notNull(),             // Дата поставки
//   supplier: text('supplier').notNull(),     // Поставщик
//   material: text('material').notNull(),     // Номенклатура
//   gross: real('gross'),                     // Брутто
//   tara: real('tara'),                       // Тара
//   quantity: real('quantity').notNull(),     // Количество
//   driver: text('driver'),                   // Водитель
//   licensePlate: text('license_plate'),      // Госномер
//   createdAt: integer('created_at').notNull(), // timestamp создания записи
// });

// export type IncomingMaterial = typeof incomingMaterials.$inferSelect;
// export type NewIncomingMaterial = typeof incomingMaterials.$inferInsert;


// // Полностью таблица будет выглядеть так:
// export const shipments = sqliteTable('shipments', {
//   id: integer('id').primaryKey({ autoIncrement: true }),
//   number: text('number').notNull().unique(),
//   date: text('date').notNull(),
//   division: text('division').notNull(),
//   customer: text('customer').notNull(),
//   consignee: text('consignee'),  // ← НОВОЕ ПОЛЕ
//   material: text('material').notNull(),
//   gross: real('gross'),
//   tara: real('tara'),
//   quantity: real('quantity').notNull(),
//   driver: text('driver'),
//   licensePlate: text('license_plate'),
//   createdAt: integer('created_at').notNull(),
// });


// export type Shipment = typeof shipments.$inferSelect;
// export type NewShipment = typeof shipments.$inferInsert;




// // lib/db/schema.ts — добавить
// export const outgoingRequests = sqliteTable('outgoing_requests', {
//   id: integer('id').primaryKey({ autoIncrement: true }),
//   number: text('number').notNull().unique(),      // Номер заявки
//   date: text('date').notNull(),                   // Дата создания
//   division: text('division').notNull(),           // Подразделение
//   customer: text('customer').notNull(),           // Покупатель
//   consignee: text('consignee'),                   // Грузополучатель
//   material: text('material').notNull(),           // Номенклатура
//   quantity: real('quantity').notNull(),           // Плановое количество
//   clientRequestNumber: text('client_request_number'), // Номер заявки клиента
//   clientRequestDate: text('client_request_date'), // Дата заявки клиента
//   createdAt: integer('created_at').notNull(),
// });