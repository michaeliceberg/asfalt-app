// lib/gps-recorder.ts
//
// Раз в минуту забирает позиции всех машин у Геоинформера и пишет их в
// gps_points — своя история движения (у провайдера её нет). Сразу после
// записи разбирает рейсы (lib/nav.ts). Запускается из instrumentation.ts
// вместе с geofence-воркером. Старше 30 дней точки удаляются.
import { db } from './db';
import { gpsPoints } from './db/schema';
import { lt, sql } from 'drizzle-orm';
import { getTrucks } from './trucks';
import { normalizePlate, calculateDistance } from './utils';
import { ensureFactoryPlaces, processNavigation } from './nav';

const POLL_INTERVAL_MS = 60_000;
const KEEP_DAYS = 30;
// Стоящую машину пишем раз в 5 минут, едущую — каждую новую точку
const PARKED_EVERY_SEC = 300;
const MOVED_M = 30;

interface Pos { lat: number; lng: number; vel: number; time: number }

const lastSaved = new Map<string, { ts: number; lat: number; lng: number }>();
let lastPrune = 0;

async function fetchPositions(uids: string[]): Promise<Record<string, Pos>> {
  const token = process.env.GEOINFORMER_TOKEN;
  if (!token || uids.length === 0) return {};
  try {
    const res = await fetch('https://xptr.geoinformer.com/service/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ idList: uids.map(String), ud: token }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.positions || {};
  } catch (e) {
    console.error('❌ [gps] Ошибка запроса позиций:', e);
    return {};
  }
}

async function loadLastSaved() {
  const rows = await db.all<{ plate: string; ts: number; lat: number; lng: number }>(
    sql`SELECT plate, ts, lat, lng FROM gps_points WHERE id IN (SELECT MAX(id) FROM gps_points GROUP BY plate)`
  );
  for (const r of rows) lastSaved.set(r.plate, r);
}

async function tick() {
  try {
    const trucks = await getTrucks();
    const positions = await fetchPositions(trucks.map(t => t.uid));
    const rows: (typeof gpsPoints.$inferInsert)[] = [];
    for (const t of trucks) {
      const p = positions[t.uid];
      if (!p || !p.time || !p.lat || !p.lng) continue;
      const plate = normalizePlate(t.name);
      const prev = lastSaved.get(plate);
      if (prev && p.time <= prev.ts) continue; // трекер ничего нового не прислал
      const moved = prev ? calculateDistance(prev.lat, prev.lng, p.lat, p.lng) * 1000 : Infinity;
      if (prev && moved < MOVED_M && p.time - prev.ts < PARKED_EVERY_SEC) continue;
      rows.push({ plate, ts: p.time, lat: p.lat, lng: p.lng, vel: p.vel ?? 0 });
      lastSaved.set(plate, { ts: p.time, lat: p.lat, lng: p.lng });
    }
    if (rows.length) await db.insert(gpsPoints).values(rows).onConflictDoNothing();

    if (Date.now() - lastPrune > 3600_000) {
      lastPrune = Date.now();
      await db.delete(gpsPoints).where(lt(gpsPoints.ts, Math.floor(Date.now() / 1000) - KEEP_DAYS * 86400));
    }

    await processNavigation();
  } catch (e) {
    console.error('❌ [gps] Ошибка цикла:', e);
  }
}

let started = false;
export function startGpsRecorder() {
  if (started) return;
  started = true;
  console.log('🟢 [gps] Запись истории GPS раз в минуту');
  (async () => {
    try {
      await ensureFactoryPlaces();
      await loadLastSaved();
    } catch (e) {
      console.error('❌ [gps] Старт:', e);
    }
    tick();
    setInterval(tick, POLL_INTERVAL_MS);
  })();
}
