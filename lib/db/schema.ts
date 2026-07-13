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
  unit: text('unit'), // ← ДОБАВИТЬ
  driver: text('driver'),
  licensePlate: text('license_plate'),
  clientRequestNumber: text('client_request_number'),  // ← ДОБАВИТЬ
  createdAt: integer('created_at').notNull(),
});



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
  unit: text('unit'), // ← ДОБАВИТЬ
  driver: text('driver'),
  licensePlate: text('license_plate'),
  clientRequestNumber: text('client_request_number'),
  destinationPoint: text('destination_point'), // ПунктНазначения с координатами
  clientRequestDate: text('client_request_date'),
  createdAt: integer('created_at').notNull(),

    // ✅ НОВЫЕ ПОЛЯ ДЛЯ ОТСЛЕЖИВАНИЯ ПРИБЫТИЯ
  arrived: integer('arrived', { mode: 'boolean' }).default(false),
  arrived_at: text('arrived_at'),
  distance_to_dest: real('distance_to_dest'),
  eta_minutes: integer('eta_minutes'),
  updated_at: text('updated_at'), // ✅ ДОЛЖНО БЫТЬ

});


export type NewShipment = typeof shipments.$inferInsert;


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
  unit: text('unit'), // ← ДОБАВИТЬ
  clientRequestNumber: text('client_request_number'),
  clientRequestDate: text('client_request_date'),
  closed: integer('closed', { mode: 'boolean' }).default(false),
  destinationPoint: text('destination_point'), // ПунктНазначения с координатами
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
  // created_at: integer('created_at').default(Date.now()),
  created_at: integer('created_at').notNull(),
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
  created_at: integer('created_at').notNull(),
});

// Сессии
export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id),
  expires_at: integer('expires_at').notNull(),
  // created_at: integer('created_at').default(Date.now()),
  created_at: integer('created_at').notNull(),
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







export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at'),
});

// Нативные push-токены (APNs, iOS-приложение через Capacitor).
// Отдельная таблица от pushSubscriptions — у Web Push (VAPID) и APNs
// принципиально разный формат подписки (endpoint+ключи vs один device token),
// пытаться впихнуть их в одну таблицу было бы менее читаемо.
export const apnsTokens = sqliteTable('apns_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id),
  device_token: text('device_token').notNull().unique(),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at'),
});
export type ApnsToken = typeof apnsTokens.$inferSelect;





export const shipmentStartNotifications = sqliteTable('shipment_start_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  request_number: text('request_number').notNull().unique(),
  sent_at: integer('sent_at').notNull(),
  factory: text('factory').notNull(),
});

// Машины, отслеживаемые по GPS (замена статичного lib/trucks.ts).
// uid — id GPS-трекера на платформе geoinformer, license_plate — госномер
// в нормализованном виде (см. normalizePlate в lib/utils.ts).
export const trucks = sqliteTable('trucks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uid: text('uid').notNull().unique(),
  licensePlate: text('license_plate').notNull().unique(),
  vehicleType: text('vehicle_type'), // 'С' самосвал, 'Т' тонар, 'М' миксер, прочее — служебный транспорт
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at'),
});

export type Truck = typeof trucks.$inferSelect;
export type NewTruck = typeof trucks.$inferInsert;

// ============================================
// ВЕСОВЫЕ РАМКИ — geofencing (штраф 200 тыс за проезд самосвала
// по дороге с рамкой). Координаты самой рамки + отдельно "запретные
// дороги" (ломаные линии подъездов к ней, может быть несколько с разных
// сторон) — рисуются вручную в /admin/weigh-stations.
// ============================================

export const weighStations = sqliteTable('weigh_stations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

// Ломаная линия дороги, ведущей к рамке. У одной станции может быть
// несколько подъездов (с разных сторон) — каждый отдельной записью.
export const restrictedRoads = sqliteTable('restricted_roads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  stationId: integer('station_id').notNull().references(() => weighStations.id),
  name: text('name'), // необязательное название подъезда, напр. "с востока"
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

// Точки ломаной линии дороги, по порядку.
export const restrictedRoadPoints = sqliteTable('restricted_road_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roadId: integer('road_id').notNull().references(() => restrictedRoads.id),
  orderIndex: integer('order_index').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
});

// Активные тревоги — пока машина не покинула буфер дороги, повторный
// push не шлём (lastSeenAt обновляется на каждом цикле воркера, пока
// машина всё ещё рядом с дорогой). resolvedAt проставляется, когда
// машина отъехала — тогда следующий заезд создаст новую тревогу.
export const geofenceAlerts = sqliteTable('geofence_alerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roadId: integer('road_id').notNull().references(() => restrictedRoads.id),
  licensePlate: text('license_plate').notNull(),
  triggeredAt: integer('triggered_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  resolvedAt: integer('resolved_at'),
});

export type WeighStation = typeof weighStations.$inferSelect;
export type NewWeighStation = typeof weighStations.$inferInsert;
export type RestrictedRoad = typeof restrictedRoads.$inferSelect;
export type NewRestrictedRoad = typeof restrictedRoads.$inferInsert;
export type RestrictedRoadPoint = typeof restrictedRoadPoints.$inferSelect;
export type NewRestrictedRoadPoint = typeof restrictedRoadPoints.$inferInsert;
export type GeofenceAlert = typeof geofenceAlerts.$inferSelect;