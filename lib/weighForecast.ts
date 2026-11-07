// lib/weighForecast.ts
//
// Прогноз весовых рамок (2026-11-08). Тревога lib/geofence-worker.ts срабатывает,
// когда машина УЖЕ на запретной дороге — поздно. Здесь два предупреждения раньше:
//  1. «Маршрут»: машина везёт груз на объект, а прошлые рейсы к этому объекту
//     (trips.track) проходили у рамки или по запретной дороге к ней —
//     push диспетчеру сразу, как машина в пути (один раз на отгрузку).
//  2. «Приближается»: машина ближе APPROACH_M к рамке и за минуту стала ближе
//     (едет к ней) — push один раз на машину и рамку за APPROACH_REPEAT_SEC.
// Рамки и дороги размечаются в /admin/weigh-stations — без них прогноза нет.
import { db } from './db';
import { weighStations, restrictedRoads, restrictedRoadPoints, trips, gpsPoints, weighWarnings } from './db/schema';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { minDistanceToPolylineMeters, type LatLng } from './geofence';
import { calculateDistance } from './utils';
import { sendToAdmins } from './push-notifications';
import type { NavStatus } from './nav';

const STATION_HIT_M = 120;      // прошлый трек прошёл ближе 120 м к рамке
const ROAD_HIT_M = 50;          // или ближе 50 м к запретной дороге
const TRACKS_PER_PLACE = 20;    // сколько последних рейсов к объекту смотреть
const APPROACH_M = 2500;        // «подъезжает»: ближе 2,5 км к рамке…
const APPROACH_CLOSER_M = 150;  // …и за последнюю минуту стал ближе на 150 м
const APPROACH_REPEAT_SEC = 3 * 3600;

export interface WeighGeometry {
  stations: { id: number; name: string; point: LatLng }[];
  roads: { stationId: number; points: LatLng[] }[];
}

export interface WeighRisk {
  stationName: string;
  hits: number;   // сколько прошлых рейсов к объекту прошли у рамки
  total: number;  // сколько прошлых рейсов к объекту всего
}

export async function loadWeighGeometry(): Promise<WeighGeometry> {
  const st = await db.select().from(weighStations).where(eq(weighStations.isActive, true));
  if (st.length === 0) return { stations: [], roads: [] };
  const rd = await db.select().from(restrictedRoads)
    .where(and(inArray(restrictedRoads.stationId, st.map(s => s.id)), eq(restrictedRoads.isActive, true)));
  const pts = rd.length
    ? await db.select().from(restrictedRoadPoints)
      .where(inArray(restrictedRoadPoints.roadId, rd.map(r => r.id)))
      .orderBy(restrictedRoadPoints.orderIndex)
    : [];
  return {
    stations: st.map(s => ({ id: s.id, name: s.name, point: { lat: s.lat, lng: s.lng } })),
    roads: rd.map(r => ({
      stationId: r.stationId,
      points: pts.filter(p => p.roadId === r.id).map(p => ({ lat: p.lat, lng: p.lng })),
    })).filter(r => r.points.length >= 2),
  };
}

/** Через какую рамку прошёл трек (или null). Трек прорежен, поэтому меряем и от точек рамки/дороги до ломаной трека. */
export function stationOnTrack(track: LatLng[], geo: WeighGeometry): number | null {
  if (track.length < 2) return null;
  for (const s of geo.stations) {
    const d = minDistanceToPolylineMeters(s.point, track);
    if (d !== null && d <= STATION_HIT_M) return s.id;
  }
  for (const r of geo.roads) {
    const hit = r.points.some(p => {
      const d = minDistanceToPolylineMeters(p, track);
      return d !== null && d <= ROAD_HIT_M;
    }) || track.some(p => {
      const d = minDistanceToPolylineMeters(p, r.points);
      return d !== null && d <= ROAD_HIT_M;
    });
    if (hit) return r.stationId;
  }
  return null;
}

/** Риск по прошлым рейсам к объекту: самая частая рамка на пути. */
export async function routeRiskForPlace(placeId: number, geo: WeighGeometry): Promise<WeighRisk | null> {
  if (geo.stations.length === 0) return null;
  const rows = await db.select({ track: trips.track }).from(trips)
    .where(and(eq(trips.placeId, placeId), eq(trips.kind, 'delivery')))
    .orderBy(desc(trips.endedAt)).limit(TRACKS_PER_PLACE);
  const counts = new Map<number, number>();
  let total = 0;
  for (const r of rows) {
    if (!r.track) continue;
    let track: LatLng[];
    try { track = (JSON.parse(r.track) as [number, number][]).map(([lat, lng]) => ({ lat, lng })); } catch { continue; }
    total++;
    const id = stationOnTrack(track, geo);
    if (id !== null) counts.set(id, (counts.get(id) || 0) + 1);
  }
  let best: [number, number] | null = null;
  for (const e of counts) if (!best || e[1] > best[1]) best = e;
  if (!best) return null;
  const name = geo.stations.find(s => s.id === best![0])?.name || 'рамка';
  return { stationName: name, hits: best[1], total };
}

export function weighRiskText(r: WeighRisk): string {
  return `${r.hits} из ${r.total} прошлых рейсов шли через рамку «${r.stationName}»`;
}

/** Записать предупреждение один раз: true — новое, надо слать push. */
async function claimWarning(key: string): Promise<boolean> {
  const res = await db.insert(weighWarnings).values({ key, createdAt: Date.now() }).onConflictDoNothing().run();
  return res.changes > 0;
}

/**
 * Один проход (вызывается из geofence-worker раз в минуту).
 * statuses — результат truckNavStatuses (ключ — номер машины в normalizePlate).
 */
export async function checkWeighForecasts(statuses: Record<string, NavStatus>, geo: WeighGeometry): Promise<void> {
  if (geo.stations.length === 0) return;
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Маршрут: машина везёт груз, прошлые рейсы к объекту шли через рамку
  for (const [plate, st] of Object.entries(statuses)) {
    if (st.kind !== 'to_object' || !st.weighRisk || !st.shipmentNumber) continue;
    if (!(await claimWarning(`route:${st.shipmentNumber}`))) continue;
    await sendToAdmins({
      title: '⚠️ Прогноз: на пути весовая рамка',
      body: `${plate} ${st.text}. ${weighRiskText(st.weighRisk)}. Предупредите водителя.`,
      tag: `weigh-route-${st.shipmentNumber}`,
      url: '/trucks',
    });
  }

  // 2. Приближается к рамке: две последние точки за 5 минут, вторая ближе
  const pts = await db.select().from(gpsPoints).where(gte(gpsPoints.ts, nowSec - 5 * 60)).orderBy(gpsPoints.ts);
  const byPlate = new Map<string, typeof pts>();
  for (const p of pts) { const a = byPlate.get(p.plate) || []; a.push(p); byPlate.set(p.plate, a); }
  for (const [plate, list] of byPlate) {
    if (list.length < 2) continue;
    const prev = list[list.length - 2];
    const cur = list[list.length - 1];
    for (const s of geo.stations) {
      const dNow = calculateDistance(cur.lat, cur.lng, s.point.lat, s.point.lng) * 1000;
      const dPrev = calculateDistance(prev.lat, prev.lng, s.point.lat, s.point.lng) * 1000;
      if (dNow > APPROACH_M || dPrev - dNow < APPROACH_CLOSER_M) continue;
      const bucket = Math.floor(nowSec / APPROACH_REPEAT_SEC);
      if (!(await claimWarning(`near:${plate}:${s.id}:${bucket}`))) continue;
      const loaded = statuses[plate]?.kind === 'to_object' ? ' с грузом' : '';
      await sendToAdmins({
        title: '🚧 Машина едет к весовой рамке',
        body: `${plate}${loaded} в ${(dNow / 1000).toFixed(1)} км от рамки «${s.name}» и приближается.`,
        tag: `weigh-near-${plate}-${s.id}`,
        url: '/trucks',
      });
    }
  }
}
