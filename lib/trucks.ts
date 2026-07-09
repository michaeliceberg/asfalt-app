// lib/trucks.ts
//
// Список отслеживаемых машин переехал из статичного массива в таблицу
// trucks в БД (см. lib/db/schema.ts) — чтобы добавлять/редактировать
// машины можно было через страницу /admin/trucks, а не правкой файла и
// редеплоем. getTrucks() — единственная точка входа, которой пользуются
// scripts/calc-distances.ts и app/api/trucks/route.ts.
import { db } from './db';
import { trucks as trucksTable } from './db/schema';
import { eq } from 'drizzle-orm';
import { normalizePlate } from './utils';

export type VehicleType = 'С' | 'Т' | 'М';

export interface TruckRecord {
  uid: string;
  name: string;
  vehicleType?: string;
}

export function isConcreteVehicle(vehicleType?: string): boolean {
  return vehicleType === 'М';
}

/**
 * Активные машины из БД, в том же формате { uid, name, vehicleType },
 * которым раньше был статичный массив TRUCKS — так вызывающий код
 * менять не пришлось, только сделать вызов асинхронным.
 */
export async function getTrucks(): Promise<TruckRecord[]> {
  const rows = await db
    .select()
    .from(trucksTable)
    .where(eq(trucksTable.isActive, true));

  return rows.map((r) => ({
    uid: r.uid,
    name: r.licensePlate,
    vehicleType: r.vehicleType || undefined,
  }));
}

/**
 * Экранированный поиск одной машины по нормализованному госномеру —
 * пригодится, если понадобится точечный лукап без загрузки всего списка.
 */
export async function findTruckByPlate(plate: string): Promise<TruckRecord | null> {
  const normalized = normalizePlate(plate);
  if (!normalized) return null;

  const rows = await db
    .select()
    .from(trucksTable)
    .where(eq(trucksTable.licensePlate, normalized))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return { uid: row.uid, name: row.licensePlate, vehicleType: row.vehicleType || undefined };
}
