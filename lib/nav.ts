// lib/nav.ts
//
// Навигация машин по истории GPS (вместо проверки «где машина прямо сейчас»
// раз в 5 минут). Как работает:
//  1. lib/gps-recorder.ts раз в минуту пишет точки всех машин в gps_points.
//  2. processNavigation() разбирает историю:
//     - доставка: отгрузка взвешена на заводе → машина выехала из зоны завода →
//       приехала. «Приехала» = первая точка у известного места (координаты из 1С
//       или уже выученное место получателя), а если места ещё нет — первая
//       долгая остановка (≥ STOP_MIN_SEC) далеко от завода. Найденное место
//       запоминается в places (source='auto') с названием получателя.
//     - карьер: наша машина привезла приход на завод → в истории ищем последнюю
//       долгую остановку перед этим — там грузились. Место запоминается как карьер.
//     Каждый найденный рейс пишется в trips: длительность, путь, трек дороги.
//  3. Время в пути — медиана прошлых рейсов к тому же месту; если рейсов ещё
//     нет — по прямой × ROAD_FACTOR со скоростью FALLBACK_SPEED_KMH.
//  4. truckNavStatuses() — человеческий статус каждой машины для карты.
import { db } from './db';
import { gpsPoints, places, trips, shipments, incomingMaterials, trucks as trucksTable, type Place, type GpsPoint } from './db/schema';
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { normalizePlate, parseRussianDate, parseDestinationPoint, calculateDistance } from './utils';
import { FACTORIES } from './constants';
import { minDistanceToPolylineMeters } from './geofence';
import { loadWeighGeometry, routeRiskForPlace, weighRiskText, type WeighRisk } from './weighForecast';

export const STOP_MIN_SEC = 7 * 60;          // остановка дольше 7 минут — разгрузка/погрузка
const STOP_RADIUS_M = 250;                   // все точки остановки в пределах 250 м
const FACTORY_RADIUS_M = 600;
const MIN_TRIP_KM = 3;                       // остановки ближе 3 км к заводу — это не объект
const DEST_RADIUS_M = 1000;                  // координаты из 1С приблизительные
const SEGMENT_RADIUS_M = 700;                // для участков дорог «км X — км Y»
const LEARN_MATCH_M = 700;                   // точка ближе 700 м к месту — это то же место
const DELIVERY_WINDOW_SEC = 12 * 3600;       // доставку ищем 12 часов после отгрузки
const STOP_SEARCH_SEC = 5 * 3600;            // разгрузка по остановке — не позже 5 ч после выезда
const QUARRY_LOOKBACK_SEC = 8 * 3600;        // погрузку на карьере ищем за 8 часов до прихода
const ROAD_FACTOR = 1.35;                    // дорога длиннее прямой
const FALLBACK_SPEED_KMH = 42;
const TRACK_MAX_POINTS = 150;

type LatLng = { lat: number; lng: number };
const nowSec = () => Math.floor(Date.now() / 1000);
const distM = (a: LatLng, b: LatLng) => calculateDistance(a.lat, a.lng, b.lat, b.lng) * 1000;

// ---------- места ----------

function normName(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/[«»"'.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function placeAliases(p: Place): string[] {
  return p.aliases.split('\n').map(normName).filter(Boolean);
}

/** Заводы из lib/constants.ts заводим в places один раз, чтобы всё лежало в одной таблице. */
export async function ensureFactoryPlaces(): Promise<void> {
  const existing = await db.select().from(places).where(eq(places.kind, 'factory'));
  for (const [code, f] of Object.entries(FACTORIES)) {
    if (existing.some(p => p.factory === code)) continue;
    await db.insert(places).values({
      name: f.name, kind: 'factory', factory: code, lat: f.lat, lng: f.lng,
      radiusM: FACTORY_RADIUS_M, source: 'manual', createdAt: Date.now(),
    });
  }
}

export async function loadPlaces(): Promise<Place[]> {
  return db.select().from(places);
}

function placeAt(point: LatLng, all: Place[], kinds?: string[]): Place | null {
  let best: Place | null = null;
  let bestD = Infinity;
  for (const p of all) {
    if (kinds && !kinds.includes(p.kind)) continue;
    const d = distM(point, p);
    if (d <= p.radiusM && d < bestD) { best = p; bestD = d; }
  }
  return best;
}

function factoryPlace(code: string, all: Place[]): Place | null {
  return all.find(p => p.kind === 'factory' && p.factory === code) || null;
}

/** Места, известные для получателя/поставщика (по названию), самые посещаемые первыми. */
export function placesForName(name: string | null | undefined, all: Place[], kind: 'object' | 'quarry'): Place[] {
  const n = normName(name);
  if (!n) return [];
  return all
    .filter(p => p.kind === kind && (normName(p.name) === n || placeAliases(p).includes(n)))
    .sort((a, b) => (b.lastVisitAt || 0) - (a.lastVisitAt || 0));
}

/** Куда едет отгрузка: точка/участок из 1С, иначе последнее выученное место получателя. */
export function shipmentTarget(
  s: { destinationPoint: string | null; consignee: string | null; customer: string },
  all: Place[]
): { point: LatLng; segment?: [LatLng, LatLng]; place: Place | null; name: string } | null {
  const parsed = parseDestinationPoint(s.destinationPoint);
  if (parsed) {
    const point = { lat: parsed.lat, lng: parsed.lng };
    return {
      point,
      segment: parsed.segmentStart ? [parsed.segmentStart, point] : undefined,
      place: placeAt(point, all, ['object']),
      name: parsed.address || s.consignee || s.customer,
    };
  }
  const known = placesForName(s.consignee || s.customer, all, 'object');
  if (known.length) return { point: known[0], place: known[0], name: known[0].name };
  return null;
}

/** Запомнить место: подвинуть существующее рядом или создать новое. */
async function learnPlace(point: LatLng, name: string, kind: 'object' | 'quarry', at: number, all: Place[], alias?: string): Promise<Place> {
  const n = normName(name);
  const extra = alias && normName(alias) !== n ? alias.trim() : null;
  const near = all
    .filter(p => p.kind === kind)
    .map(p => ({ p, d: distM(point, p) }))
    .filter(x => x.d <= Math.max(LEARN_MATCH_M, x.p.radiusM))
    .sort((a, b) => a.d - b.d)[0]?.p;

  if (near) {
    const aliases = placeAliases(near);
    const raw = near.aliases.split('\n').filter(Boolean);
    if (n && normName(near.name) !== n && !aliases.includes(n)) raw.push(name.trim());
    if (extra && normName(near.name) !== normName(extra) && !aliases.includes(normName(extra))) raw.push(extra);
    // Автоматические места чуть сдвигаем к новой точке (среднее по визитам), ручные не трогаем
    const w = Math.min(near.visits, 9);
    const upd = {
      visits: near.visits + 1,
      lastVisitAt: at,
      aliases: raw.join('\n'),
      ...(near.source === 'auto' ? { lat: (near.lat * w + point.lat) / (w + 1), lng: (near.lng * w + point.lng) / (w + 1) } : {}),
    };
    await db.update(places).set(upd).where(eq(places.id, near.id));
    Object.assign(near, upd);
    return near;
  }

  const [created] = await db.insert(places).values({
    name: name.trim() || (kind === 'quarry' ? 'Карьер' : 'Объект'),
    kind, lat: point.lat, lng: point.lng,
    radiusM: kind === 'quarry' ? 500 : 400,
    aliases: extra || '', source: 'auto', visits: 1, lastVisitAt: at, createdAt: Date.now(),
  }).returning();
  all.push(created);
  return created;
}

// ---------- история GPS ----------

export async function pointsFor(plate: string, from: number, to: number): Promise<GpsPoint[]> {
  return db.select().from(gpsPoints)
    .where(and(eq(gpsPoints.plate, plate), gte(gpsPoints.ts, from), lte(gpsPoints.ts, to)))
    .orderBy(gpsPoints.ts);
}

export interface Stop { lat: number; lng: number; start: number; end: number; ongoing: boolean }

/** Долгие остановки: подряд идущие точки в радиусе STOP_RADIUS_M дольше STOP_MIN_SEC. */
export function findStops(points: GpsPoint[], minSec = STOP_MIN_SEC): Stop[] {
  const stops: Stop[] = [];
  let i = 0;
  while (i < points.length) {
    let j = i + 1;
    while (j < points.length && distM(points[i], points[j]) <= STOP_RADIUS_M) j++;
    const first = points[i];
    const last = points[j - 1];
    if (last.ts - first.ts >= minSec) {
      const slice = points.slice(i, j);
      stops.push({
        lat: slice.reduce((s, p) => s + p.lat, 0) / slice.length,
        lng: slice.reduce((s, p) => s + p.lng, 0) / slice.length,
        start: first.ts, end: last.ts, ongoing: j === points.length,
      });
    }
    i = j;
  }
  return stops;
}

function pathKm(points: GpsPoint[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += distM(points[i - 1], points[i]);
  return Math.round(m / 100) / 10;
}

function thinTrack(points: GpsPoint[]): [number, number][] {
  const step = Math.max(1, Math.ceil(points.length / TRACK_MAX_POINTS));
  const out = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  return out.map(p => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5]);
}

// ---------- время в пути ----------

/** Медиана длительности прошлых рейсов к месту (минуты), null если рейсов нет. */
export async function medianTripMinutes(placeId: number, factory?: string | null): Promise<number | null> {
  const rows = await db.select({ d: trips.durationMin, f: trips.factory }).from(trips)
    .where(and(eq(trips.placeId, placeId), eq(trips.kind, 'delivery')))
    .orderBy(desc(trips.endedAt)).limit(15);
  const ds = rows.filter(r => !factory || r.f === factory).map(r => r.d).sort((a, b) => a - b);
  if (ds.length === 0) return null;
  return ds[Math.floor(ds.length / 2)];
}

/** Оценка минут до точки: доля оставшегося пути × медиана прошлых рейсов, иначе по прямой. */
export function estimateMinutes(remainingKm: number, totalKm: number | null, medianMin: number | null): number {
  if (medianMin && totalKm && totalKm > 0.5) {
    return Math.max(0, Math.round(medianMin * Math.min(1, remainingKm / totalKm)));
  }
  return Math.round((remainingKm * ROAD_FACTOR / FALLBACK_SPEED_KMH) * 60);
}

// ---------- разбор рейсов ----------

/** Первая точка после выезда из зоны завода (или null, если ещё не выехал). */
function departure(points: GpsPoint[], factory: Place | null, after: number): GpsPoint | null {
  for (const p of points) {
    if (p.ts < after) continue;
    if (!factory || distM(p, factory) > factory.radiusM + 200) return p;
  }
  return null;
}

async function processDeliveries(all: Place[]): Promise<number> {
  const since = new Date((nowSec() - DELIVERY_WINDOW_SEC - 3600) * 1000);
  // Даты у ТАС в ISO, у Айсберга «ДД.ММ.ГГГГ» — фильтровать текстом в SQL нельзя.
  const candidates = (await db.select().from(shipments).where(eq(shipments.arrived, false)))
    .filter(s => s.licensePlate && parseRussianDate(s.date) >= since);
  if (candidates.length === 0) return 0;

  const done = new Set((await db.select({ r: trips.refNumber }).from(trips)
    .where(and(eq(trips.kind, 'delivery'), inArray(trips.refNumber, candidates.map(s => s.number))))).map(x => x.r));

  let found = 0;
  const now = nowSec();
  for (const s of candidates) {
    if (done.has(s.number)) continue;
    const plate = normalizePlate(s.licensePlate);
    const loadedAt = Math.floor(parseRussianDate(s.date).getTime() / 1000);
    const pts = await pointsFor(plate, loadedAt - 600, Math.min(now, loadedAt + DELIVERY_WINDOW_SEC));
    if (pts.length < 2) continue;

    const factory = factoryPlace(s.division, all);
    const dep = departure(pts, factory, loadedAt);
    const target = shipmentTarget(s, all);
    const last = pts[pts.length - 1];

    // Ход рейса для полоски прогресса в «Компактно» (distance_to_dest / eta_minutes)
    if (target && dep) {
      const remainingKm = target.segment
        ? (minDistanceToPolylineMeters(last, target.segment) ?? 0) / 1000
        : distM(last, target.point) / 1000;
      const totalKm = factory ? distM(factory, target.point) / 1000 : null;
      const median = target.place ? await medianTripMinutes(target.place.id, s.division) : null;
      const eta = estimateMinutes(remainingKm, totalKm, median);
      const minD = Math.min(s.min_distance_to_dest ?? Infinity, remainingKm);
      await db.update(shipments).set({
        distance_to_dest: Math.round(remainingKm * 10) / 10, eta_minutes: eta,
        min_distance_to_dest: minD, updated_at: new Date().toISOString(),
      }).where(eq(shipments.id, s.id));
    }
    if (!dep) continue;
    // История должна начинаться до выезда — иначе рейс начался до того, как мы
    // стали писать точки, и первая же стоянка (например, на ночь) будет ложной.
    if (pts[0].ts > loadedAt + 15 * 60) continue;

    // 1) приехал к известной точке
    let arrival: { ts: number; at: LatLng } | null = null;
    if (target) {
      for (const p of pts) {
        if (p.ts < dep.ts) continue;
        const d = target.segment ? (minDistanceToPolylineMeters(p, target.segment) ?? Infinity) : distM(p, target.point);
        if (d <= (target.segment ? SEGMENT_RADIUS_M : Math.max(DEST_RADIUS_M, target.place?.radiusM ?? 0))) {
          arrival = { ts: p.ts, at: target.point };
          break;
        }
      }
    }
    // 2) иначе — первая долгая остановка далеко от завода, не на другом заводе и не на карьере.
    //    Если точка из 1С известна, а машина к ней не подъехала, берём остановку
    //    только когда рейс точно закончился (машина вернулась на завод).
    if (!arrival) {
      const after = pts.filter(p => p.ts >= dep.ts);
      const back = factory ? after.find(p => distM(p, factory) <= factory.radiusM) : undefined;
      if (!target || back) {
        const stops = findStops(back ? after.filter(p => p.ts < back.ts) : after)
          .filter(st => (!factory || distM(st, factory) > MIN_TRIP_KM * 1000) && !placeAt(st, all, ['factory', 'quarry']));
        const st = target && back
          ? stops.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0]
          : stops[0];
        if (st && st.start - dep.ts <= STOP_SEARCH_SEC) arrival = { ts: st.start, at: { lat: st.lat, lng: st.lng } };
      }
    }
    if (!arrival) continue;

    const name = s.consignee || s.customer || 'Объект';
    // Место с координатами из 1С называем адресом из 1С, получателя добавляем в синонимы
    const place = target && !target.place && target.name !== name
      ? await learnPlace(arrival.at, target.name, 'object', arrival.ts, all, name)
      : await learnPlace(arrival.at, name, 'object', arrival.ts, all);
    const route = pts.filter(p => p.ts >= dep.ts && p.ts <= arrival!.ts);
    await db.insert(trips).values({
      kind: 'delivery', refNumber: s.number, plate, factory: s.division, placeId: place.id,
      counterparty: name, startedAt: dep.ts, endedAt: arrival.ts,
      durationMin: Math.max(1, Math.round((arrival.ts - dep.ts) / 60)),
      distanceKm: pathKm(route), track: JSON.stringify(thinTrack(route)), createdAt: Date.now(),
    }).onConflictDoNothing();
    await db.update(shipments).set({
      arrived: true, arrived_at: new Date(arrival.ts * 1000).toISOString(),
      distance_to_dest: 0, eta_minutes: 0, updated_at: new Date().toISOString(),
    }).where(eq(shipments.id, s.id));
    found++;
  }
  return found;
}

async function processQuarryTrips(all: Place[]): Promise<number> {
  const ourPlates = new Set((await db.select({ p: trucksTable.licensePlate }).from(trucksTable)).map(t => normalizePlate(t.p)));
  const since = new Date((nowSec() - 36 * 3600) * 1000);
  const recent = (await db.select().from(incomingMaterials))
    .filter(i => i.licensePlate && ourPlates.has(normalizePlate(i.licensePlate)) && parseRussianDate(i.date) >= since);
  if (recent.length === 0) return 0;

  const done = new Set((await db.select({ r: trips.refNumber }).from(trips)
    .where(and(eq(trips.kind, 'quarry'), inArray(trips.refNumber, recent.map(i => i.number))))).map(x => x.r));

  let found = 0;
  for (const inc of recent) {
    if (done.has(inc.number)) continue;
    const plate = normalizePlate(inc.licensePlate);
    const weighedAt = Math.floor(parseRussianDate(inc.date).getTime() / 1000);
    const pts = await pointsFor(plate, weighedAt - QUARRY_LOOKBACK_SEC, weighedAt);
    if (pts.length < 2) continue;
    const factory = inc.division ? factoryPlace(inc.division, all) : null;
    const stops = findStops(pts).filter(st =>
      !st.ongoing && (!factory || distM(st, factory) > MIN_TRIP_KM * 1000) && !placeAt(st, all, ['factory', 'object']));
    const load = stops[stops.length - 1];
    if (!load) continue;

    const place = await learnPlace({ lat: load.lat, lng: load.lng }, inc.supplier, 'quarry', load.end, all);
    const route = pts.filter(p => p.ts >= load.end);
    const arriveFactory = factory ? route.find(p => distM(p, factory) <= factory.radiusM)?.ts ?? weighedAt : weighedAt;
    await db.insert(trips).values({
      kind: 'quarry', refNumber: inc.number, plate, factory: inc.division, placeId: place.id,
      counterparty: inc.supplier, startedAt: load.end, endedAt: arriveFactory,
      durationMin: Math.max(1, Math.round((arriveFactory - load.end) / 60)),
      distanceKm: pathKm(route), track: JSON.stringify(thinTrack(route)), createdAt: Date.now(),
    }).onConflictDoNothing();
    found++;
  }
  return found;
}

let busy = false;
/** Раз в минуту из gps-recorder: найти завершённые доставки и рейсы с карьера. */
export async function processNavigation(): Promise<{ deliveries: number; quarry: number }> {
  if (busy) return { deliveries: 0, quarry: 0 };
  busy = true;
  try {
    const all = await loadPlaces();
    const deliveries = await processDeliveries(all);
    const quarry = await processQuarryTrips(all);
    if (deliveries || quarry) console.log(`🧭 [nav] доставок: ${deliveries}, рейсов с карьера: ${quarry}`);
    return { deliveries, quarry };
  } finally {
    busy = false;
  }
}

// ---------- статусы для карты ----------

export interface NavStatus {
  kind: 'no_signal' | 'at_factory' | 'loaded' | 'to_object' | 'at_object' | 'returning' | 'at_quarry' | 'from_quarry' | 'moving' | 'parked';
  text: string;
  etaMinutes: number | null;
  placeName: string | null;
  shipmentNumber?: string;      // для to_object — какую отгрузку везёт
  weighRisk?: WeighRisk | null; // для to_object — прошлые рейсы к объекту шли через рамку
  weighRiskText?: string;
}

function fmtAgo(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.round(m / 6) / 10;
  return h < 24 ? `${h} ч` : `${Math.round(h / 24)} дн`;
}

/** Статус каждой машины по истории за последние часы (ключ — normalizePlate). */
export async function truckNavStatuses(plates: string[]): Promise<Record<string, NavStatus>> {
  const result: Record<string, NavStatus> = {};
  if (plates.length === 0) return result;
  const now = nowSec();
  const all = await loadPlaces();

  const lastByPlate = new Map<string, GpsPoint>();
  const recentPts = await db.select().from(gpsPoints)
    .where(and(inArray(gpsPoints.plate, plates), gte(gpsPoints.ts, now - 3 * 3600)))
    .orderBy(gpsPoints.ts);
  for (const p of recentPts) lastByPlate.set(p.plate, p);

  // Последние отгрузки и рейсы машин за сутки
  const since = new Date((now - 24 * 3600) * 1000);
  const recentShipments = (await db.select().from(shipments).orderBy(desc(shipments.id)).limit(3000))
    .filter(s => s.licensePlate && parseRussianDate(s.date) >= since);
  const lastShipment = new Map<string, typeof recentShipments[number]>();
  for (const s of recentShipments) {
    const k = normalizePlate(s.licensePlate);
    const prev = lastShipment.get(k);
    if (!prev || parseRussianDate(s.date) > parseRussianDate(prev.date)) lastShipment.set(k, s);
  }
  const recentTrips = await db.select().from(trips).where(gte(trips.endedAt, now - 12 * 3600)).orderBy(desc(trips.endedAt));
  const weighGeo = await loadWeighGeometry();
  const riskByPlace = new Map<number, WeighRisk | null>();
  const lastTrip = new Map<string, typeof recentTrips[number]>();
  for (const t of recentTrips) if (!lastTrip.has(t.plate)) lastTrip.set(t.plate, t);

  for (const plate of plates) {
    const cur = lastByPlate.get(plate);
    if (!cur) { result[plate] = { kind: 'no_signal', text: 'Нет связи', etaMinutes: null, placeName: null }; continue; }
    if (now - cur.ts > 30 * 60) {
      result[plate] = { kind: 'no_signal', text: `Нет связи ${fmtAgo(now - cur.ts)}`, etaMinutes: null, placeName: null };
      continue;
    }
    const zone = placeAt(cur, all);
    const ship = lastShipment.get(plate);
    const trip = lastTrip.get(plate);
    const shipLoadedAt = ship ? Math.floor(parseRussianDate(ship.date).getTime() / 1000) : 0;

    // Везёт груз: отгрузка не закрыта и ей меньше 12 часов
    if (ship && !ship.arrived && now - shipLoadedAt < DELIVERY_WINDOW_SEC) {
      const factory = factoryPlace(ship.division, all);
      if (zone && zone.kind === 'factory') {
        result[plate] = { kind: 'loaded', text: `Загружен, на заводе ${zone.name}`, etaMinutes: null, placeName: zone.name };
        continue;
      }
      const target = shipmentTarget(ship, all);
      let eta: number | null = null;
      if (target) {
        const remainingKm = distM(cur, target.point) / 1000;
        const totalKm = factory ? distM(factory, target.point) / 1000 : null;
        eta = estimateMinutes(remainingKm, totalKm, target.place ? await medianTripMinutes(target.place.id, ship.division) : null);
      }
      const to = target?.name || ship.consignee || ship.customer;
      let weighRisk: WeighRisk | null = null;
      if (target?.place && weighGeo.stations.length) {
        if (!riskByPlace.has(target.place.id)) riskByPlace.set(target.place.id, await routeRiskForPlace(target.place.id, weighGeo));
        weighRisk = riskByPlace.get(target.place.id) ?? null;
      }
      result[plate] = {
        kind: 'to_object', text: `Везёт → ${to}`, etaMinutes: eta, placeName: to,
        shipmentNumber: ship.number, weighRisk, weighRiskText: weighRisk ? weighRiskText(weighRisk) : undefined,
      };
      continue;
    }

    if (zone?.kind === 'factory') { result[plate] = { kind: 'at_factory', text: `На заводе ${zone.name}`, etaMinutes: null, placeName: zone.name }; continue; }
    if (zone?.kind === 'quarry') { result[plate] = { kind: 'at_quarry', text: `На карьере ${zone.name}`, etaMinutes: null, placeName: zone.name }; continue; }
    if (zone?.kind === 'object') { result[plate] = { kind: 'at_object', text: `На объекте ${zone.name}`, etaMinutes: null, placeName: zone.name }; continue; }

    // Возвращается после доставки
    if (trip && trip.kind === 'delivery' && trip.factory) {
      const factory = factoryPlace(trip.factory, all);
      const back = factory ? (await pointsFor(plate, trip.endedAt, now)).some(p => distM(p, factory) <= factory.radiusM) : true;
      if (factory && !back) {
        const km = distM(cur, factory) / 1000;
        result[plate] = { kind: 'returning', text: `Возвращается на ${factory.name}`, etaMinutes: estimateMinutes(km, null, null), placeName: factory.name };
        continue;
      }
    }

    // Уехал с карьера и ещё не на заводе — по последней долгой остановке за 3 часа
    const pts = recentPts.filter(p => p.plate === plate);
    const lastStop = findStops(pts).filter(st => !st.ongoing).pop();
    const quarry = lastStop ? placeAt(lastStop, all, ['quarry']) : null;
    if (quarry) {
      result[plate] = { kind: 'from_quarry', text: `Едет с карьера ${quarry.name}`, etaMinutes: null, placeName: quarry.name };
      continue;
    }

    result[plate] = cur.vel > 5
      ? { kind: 'moving', text: `В пути, ${Math.round(cur.vel)} км/ч`, etaMinutes: null, placeName: null }
      : { kind: 'parked', text: 'Стоит', etaMinutes: null, placeName: null };
  }
  return result;
}

/** Последний трек реальной дороги к месту (для линии маршрута на карте). */
export async function lastTrackToPlace(placeId: number): Promise<[number, number][] | null> {
  const [t] = await db.select({ track: trips.track }).from(trips)
    .where(and(eq(trips.placeId, placeId), eq(trips.kind, 'delivery')))
    .orderBy(desc(trips.endedAt)).limit(1);
  if (!t?.track) return null;
  try { return JSON.parse(t.track); } catch { return null; }
}
