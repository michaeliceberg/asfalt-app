// lib/db/schema.ts (очищенная версия)
import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

// ============================================
// ОСНОВНЫЕ ТАБЛИЦЫ
// ============================================

// Поступления материалов (для всех заводов)
// lib/db/schema.ts
export const incomingMaterials = sqliteTable('incoming_materials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull().unique(), // ← добавляем unique
  date: text('date').notNull(),
  division: text('division'),  // ← эта строка должна быть
  supplier: text('supplier').notNull(),
  material: text('material').notNull(),
  gross: real('gross'),
  tara: real('tara'),
  quantity: real('quantity').notNull(),
  driver: text('driver'),
  licensePlate: text('license_plate'),
  createdAt: integer('created_at').notNull(),
});



// export const incomingMaterials = sqliteTable('incoming_materials', {
//   id: integer('id').primaryKey({ autoIncrement: true }),
//   number: text('number').notNull(),
//   date: text('date').notNull(),
//   division: text('division'),                    // ← добавить для СП/Щ
//   supplier: text('supplier').notNull(),
//   material: text('material').notNull(),
//   gross: real('gross'),
//   tara: real('tara'),
//   quantity: real('quantity').notNull(),
//   driver: text('driver'),
//   licensePlate: text('license_plate'),
//   createdAt: integer('created_at').notNull(),
// });

// Отгрузки (для всех заводов)
export const shipments = sqliteTable('shipments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull().unique(),
  date: text('date').notNull(),
  division: text('division').notNull(),          // ЛХ, ЛЮ, СП, Щ
  customer: text('customer').notNull(),
  consignee: text('consignee'),
  material: text('material').notNull(),
  gross: real('gross'),
  tara: real('tara'),
  quantity: real('quantity').notNull(),
  driver: text('driver'),
  licensePlate: text('license_plate'),
  clientRequestNumber: text('client_request_number'),
  clientRequestDate: text('client_request_date'),
  createdAt: integer('created_at').notNull(),
});

// Заявки на отгрузку (для всех заводов)
export const outgoingRequests = sqliteTable('outgoing_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  number: text('number').notNull().unique(),
  date: text('date').notNull(),
  division: text('division').notNull(),          // ЛХ, ЛЮ, СП, Щ
  customer: text('customer').notNull(),
  consignee: text('consignee'),
  material: text('material').notNull(),
  quantity: real('quantity').notNull(),
  clientRequestNumber: text('client_request_number'),
  clientRequestDate: text('client_request_date'),
  closed: integer('closed', { mode: 'boolean' }).default(false),
  delivery_date: text('delivery_date'),
  createdAt: integer('created_at').notNull(),
});

// Отслеживание уведомлений
export const sentNotifications = sqliteTable('sent_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestNumber: text('request_number').notNull().unique(),
  sentAt: integer('sent_at').notNull(),
});

// ============================================
// ТАБЛИЦЫ ДЛЯ АВТОРИЗАЦИИ
// ============================================

// Заводы
export const factories = sqliteTable('factories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  order_index: integer('order_index').default(0),
});

// Группы пользователей
export const userGroups = sqliteTable('user_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
});

// Пользователи
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  group_id: integer('group_id').references(() => userGroups.id),
  telegram_chat_id: text('telegram_chat_id'),
  last_login_at: integer('last_login_at'),
  login_count: integer('login_count').default(0),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: integer('created_at').default(Date.now()),
});

// Доступ групп к заводам
export const groupFactoryAccess = sqliteTable('group_factory_access', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  group_id: integer('group_id').references(() => userGroups.id),
  factory_id: text('factory_id').references(() => factories.id),
});

// Логи входов
export const userLoginLogs = sqliteTable('user_login_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id),
  login_time: integer('login_time').notNull(),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  session_duration: integer('session_duration'),
});

// Сессии
export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id),
  expires_at: integer('expires_at').notNull(),
  created_at: integer('created_at').default(Date.now()),
});

// ============================================
// ТИПЫ
// ============================================

export type IncomingMaterial = typeof incomingMaterials.$inferSelect;
export type Shipment = typeof shipments.$inferSelect;
export type OutgoingRequest = typeof outgoingRequests.$inferSelect;
export type SentNotification = typeof sentNotifications.$inferSelect;

export type Factory = typeof factories.$inferSelect;
export type UserGroup = typeof userGroups.$inferSelect;
export type User = typeof users.$inferSelect;
export type UserLoginLog = typeof userLoginLogs.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;





// lib/db/schema.ts
export type UserLog = {
  id: number;
  user_id: number;
  login_time: number;
  ip_address: string | null;
  user_agent: string | null;
  session_duration: number | null;
};



