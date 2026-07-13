// lib/geofence-worker.ts
//
// Серверный воркер: постоянно (пока жив PM2-процесс) проверяет живые
// GPS-координаты машин на предмет заезда на "запретную" дорогу к весовой
// рамке (см. /admin/weigh-stations) — штраф за проезд самосвала по такой
// дороге 200 тыс руб. Раньше опрос GPS шёл только из браузера (клиент
// открыл вкладку → сработал setInterval) — для алерта безопасности это
// неприемлемо: если ни у кого не открыто приложение, рамки вообще никто
// не проверяет. Этот воркер живёт на сервере независимо от клиентов,
// запускается один раз при старте процесса (см. instrumentation.ts).
import { db } from './db';
import { restrictedRoads, restrictedRoadPoints, weighStations, geofenceAlerts } from './db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { getTrucks } from './trucks';
import { minDistanceToPolylineMeters, type LatLng } from './geofence';
import { sendToAdmins } from './push-notifications';

const POLL_INTERVAL_MS = 60_000; // раз в минуту — тот же порядок, что и у GPS-провайдера
const ALERT_BUFFER_METERS = 40; // сработать, если машина ближе 40м к линии дороги
const EXIT_BUFFER_METERS = 60; // считаем что уехала, только выйдя за 60м (гистерезис — иначе на границе буфера тревога будет дребезжать открыта/закрыта каждый цикл)

const AUTH_TOKEN = 'XBNlAqRnZxU3Q%2BSLHe3qKZSIIYiSGWym3mN8%2BbXmbSZE74YqB3bYf4TLIWAzLPyg%2BR9qd2Mf9AxDn2K3f4j5lA%3D%3D';

interface TruckPosition {
  lat: number;
  lng: number;
  vel: number;
  time: number;
}

// Дублирует минимальный кусок app/api/trucks/route.ts::fetchTruckPositions
// намеренно — не рефакторил на общий модуль, чтобы не трогать рабочий
// прод-код GPS-вкладки лишний раз ради нового, ещё не проверенного в бою
// воркера.
async function fetchPositions(uids: string[]): Promise<Record<string, TruckPosition>> {
  if (uids.length === 0) return {};
  try {
    const response = await fetch('https://xptr.geoinformer.com/service/monitoring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({ idList: uids.map(String), ud: AUTH_TOKEN }),
    });
    if (!response.ok) return {};
    const data = await response.json();
    return data.positions || {};
  } catch (error) {
    console.error('❌ [geofence] Ошибка запроса позиций:', error);
    return {};
  }
}

interface RoadWithPoints {
  roadId: number;
  stationId: number;
  stationName: string;
  roadName: string | null;
  points: LatLng[];
}

async function loadActiveRoads(): Promise<RoadWithPoints[]> {
  const roads = await db
    .select({
      roadId: restrictedRoads.id,
      roadName: restrictedRoads.name,
      stationId: weighStations.id,
      stationName: weighStations.name,
    })
    .from(restrictedRoads)
    .innerJoin(weighStations, eq(weighStations.id, restrictedRoads.stationId))
    .where(and(eq(restrictedRoads.isActive, true), eq(weighStations.isActive, true)));

  const result: RoadWithPoints[] = [];
  for (const road of roads) {
    const points = await db
      .select({ lat: restrictedRoadPoints.lat, lng: restrictedRoadPoints.lng })
      .from(restrictedRoadPoints)
      .where(eq(restrictedRoadPoints.roadId, road.roadId))
      .orderBy(restrictedRoadPoints.orderIndex);

    if (points.length >= 2) {
      result.push({ ...road, points });
    }
  }
  return result;
}

async function checkOnce() {
  try {
    const roads = await loadActiveRoads();
    if (roads.length === 0) return; // нет размеченных дорог — нечего проверять

    const trucks = await getTrucks();
    if (trucks.length === 0) return;

    const positions = await fetchPositions(trucks.map((t) => t.uid));

    // Все открытые (незакрытые) тревоги разом — чтобы не дёргать БД на
    // каждую пару машина×дорога отдельным запросом.
    const openAlerts = await db
      .select()
      .from(geofenceAlerts)
      .where(isNull(geofenceAlerts.resolvedAt));

    const alertKey = (roadId: number, plate: string) => `${roadId}::${plate}`;
    const openAlertsMap = new Map(openAlerts.map((a) => [alertKey(a.roadId, a.licensePlate), a]));

    const now = Date.now();

    for (const truck of trucks) {
      const pos = positions[truck.uid];
      if (!pos) continue;
      const point: LatLng = { lat: pos.lat, lng: pos.lng };

      for (const road of roads) {
        const distance = minDistanceToPolylineMeters(point, road.points);
        if (distance === null) continue;

        const key = alertKey(road.roadId, truck.name);
        const existing = openAlertsMap.get(key);

        if (distance <= ALERT_BUFFER_METERS) {
          if (existing) {
            // Уже алармили — просто обновляем "видели последний раз"
            await db.update(geofenceAlerts).set({ lastSeenAt: now }).where(eq(geofenceAlerts.id, existing.id));
          } else {
            // Новый заезд — создаём тревогу и шлём push логисту
            await db.insert(geofenceAlerts).values({
              roadId: road.roadId,
              licensePlate: truck.name,
              triggeredAt: now,
              lastSeenAt: now,
            });
            console.log(`🚨 [geofence] ${truck.name} заехал на дорогу к рамке "${road.stationName}"`);
            await sendToAdmins({
              title: '🚨 ТРЕВОГА: дорога к весовой рамке',
              body: `Машина ${truck.name} заехала на дорогу к рамке «${road.stationName}»${road.roadName ? ` (${road.roadName})` : ''}. Свяжитесь с водителем — развернуться, ехать другой дорогой.`,
              tag: 'geofence-alert',
              url: '/trucks',
            });
          }
        } else if (existing && distance > EXIT_BUFFER_METERS) {
          // Уехала дальше буфера выхода — закрываем тревогу, следующий заезд создаст новую
          await db.update(geofenceAlerts).set({ resolvedAt: now }).where(eq(geofenceAlerts.id, existing.id));
        }
        // distance между ALERT_BUFFER_METERS и EXIT_BUFFER_METERS — "мёртвая
        // зона" гистерезиса, тревогу не трогаем ни в какую сторону.
      }
    }
  } catch (error) {
    console.error('❌ [geofence] Ошибка проверки:', error);
  }
}

let started = false;

// Запускается один раз за жизнь серверного процесса (см. instrumentation.ts).
// started защищает от повторного запуска, если модуль будет импортирован
// более одного раза за время жизни процесса.
export function startGeofenceWorker() {
  if (started) return;
  started = true;
  console.log(`🟢 [geofence] Воркер запущен, опрос каждые ${POLL_INTERVAL_MS / 1000} сек`);
  checkOnce();
  setInterval(checkOnce, POLL_INTERVAL_MS);
}
