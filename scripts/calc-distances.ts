import { db } from '../lib/db';
import { shipments } from '../lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { calculateDistance, calculateETA, parseDestinationPoint, normalizePlate } from '../lib/utils';
import { getTrucks } from '../lib/trucks';
import { minDistanceToPolylineMeters } from '../lib/geofence';

const AUTH_TOKEN = 'XBNlAqRnZxU3Q%2BSLHe3qKZSIIYiSGWym3mN8%2BbXmbSZE74YqB3bYf4TLIWAzLPyg%2BR9qd2Mf9AxDn2K3f4j5lA%3D%3D';
const ARRIVAL_THRESHOLD_KM = 2;
// Запасной сигнал прибытия — на случай, если машина ни разу не попала в
// ARRIVAL_THRESHOLD_KM ровно в момент прогона крона (заехала и уехала
// между двумя пятиминутками, либо координата точки назначения неточная
// на несколько км). Если машина хоть раз подъезжала ближе, чем
// DEPARTURE_MIN_APPROACH_KM, а сейчас расстояние выросло минимум на
// DEPARTURE_MARGIN_KM относительно этого лучшего приближения — считаем,
// что она доставила и уехала.
const DEPARTURE_MIN_APPROACH_KM = 3;
const DEPARTURE_MARGIN_KM = 3;

async function getTruckPositions() {
  try {
    // Список машин теперь живёт в БД (таблица trucks, редактируется на
    // /admin/trucks) — читаем его на каждый запуск крона, а не из
    // статичного файла, чтобы новые машины подхватывались без деплоя.
    const allTrucks = await getTrucks();

    const response = await fetch('https://xptr.geoinformer.com/service/monitoring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        idList: allTrucks.map(t => t.uid).map(String),
        ud: AUTH_TOKEN
      }),
    });

    if (!response.ok) {
      console.error(`❌ GPS error: ${response.status}`);
      return new Map();
    }

    const data = await response.json();
    const positions = new Map();

    if (data.positions) {
      allTrucks.forEach((truck) => {
        const pos = data.positions[truck.uid];
        if (pos) {
          // Ключ — нормализованный госномер (без пробелов, кириллица
          // вместо латиницы-омографов), чтобы совпадать с тем, как
          // нормализуется shipment.licensePlate ниже — иначе "грязные"
          // значения из 1С (хвостовые пробелы и т.п.) молча не находят пару.
          positions.set(normalizePlate(truck.name), pos);
        }
      });
    }
    
    return positions;
  } catch (error) {
    console.error('❌ GPS fetch error:', error);
    return new Map();
  }
}

async function main() {
  console.log('🔄 Начинаем расчет расстояний...');
  
  const startTime = Date.now();
  
  const truckPositions = await getTruckPositions();
  console.log(`📡 Получено ${truckPositions.size} позиций машин`);
  
  if (truckPositions.size === 0) {
    console.log('❌ Нет GPS данных, выходим');
    return;
  }

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

  const activeShipments = await db
    .select()
    .from(shipments)
    .where(
      and(
        gte(shipments.date, threeDaysAgoStr),
        eq(shipments.arrived, false)
      )
    );

  console.log(`📋 Найдено ${activeShipments.length} активных отгрузок`);

  let updatedCount = 0;
  let arrivedCount = 0;
  const now = new Date().toISOString();

  for (const shipment of activeShipments) {
    if (!shipment.licensePlate || !shipment.destinationPoint) continue;
    
    const destCoords = parseDestinationPoint(shipment.destinationPoint);
    if (!destCoords) continue;
    
    const truckPos = truckPositions.get(normalizePlate(shipment.licensePlate));
    if (!truckPos) continue;

    // Для дорожных объектов ПунктНазначения описывает УЧАСТОК (км X - км Y),
    // а не одну точку — destCoords.segmentStart есть, только если в строке
    // было ДВЕ пары координат (см. parseDestinationPoint). Тогда считаем
    // расстояние до ВСЕГО отрезка [segmentStart, destCoords], а не только
    // до его дальнего конца — иначе, если машина фактически работала ближе
    // к началу участка, расстояние никогда не опускалось достаточно низко
    // и "прибыл" не выставлялся вообще (см. разбор Е113ВК250, ПК 26 Озерский).
    const distance = destCoords.segmentStart
      ? (minDistanceToPolylineMeters(
          { lat: truckPos.lat, lng: truckPos.lng },
          [destCoords.segmentStart, { lat: destCoords.lat, lng: destCoords.lng }]
        ) ?? 0) / 1000
      : calculateDistance(truckPos.lat, truckPos.lng, destCoords.lat, destCoords.lng);
    const eta = calculateETA(distance);

    // Лучшее (минимальное) приближение за весь рейс — используется ниже
    // как запасной сигнал прибытия, если прямое попадание в радиус
    // ARRIVAL_THRESHOLD_KM было пропущено между прогонами крона.
    const prevMinDistance = shipment.min_distance_to_dest;
    const minDistance = prevMinDistance === null || prevMinDistance === undefined
      ? distance
      : Math.min(prevMinDistance, distance);

    await db.update(shipments)
      .set({
        distance_to_dest: distance,
        eta_minutes: eta.totalMinutes,
        updated_at: now,
        min_distance_to_dest: minDistance,
      })
      .where(eq(shipments.id, shipment.id));

    updatedCount++;

    const arrivedByProximity = distance < ARRIVAL_THRESHOLD_KM;
    const arrivedByDeparture =
      minDistance < DEPARTURE_MIN_APPROACH_KM && distance > minDistance + DEPARTURE_MARGIN_KM;

    if ((arrivedByProximity || arrivedByDeparture) && !shipment.arrived) {
      await db.update(shipments)
        .set({
          arrived: true,
          arrived_at: now,
        })
        .where(eq(shipments.id, shipment.id));
      arrivedCount++;
      if (arrivedByProximity) {
        console.log(`✅ ${shipment.licensePlate} прибыла (в радиусе ${ARRIVAL_THRESHOLD_KM} км)!`);
      } else {
        console.log(`✅ ${shipment.licensePlate} прибыла (подъезжала на ${minDistance.toFixed(1)} км, сейчас ${distance.toFixed(1)} км — похоже, уехала)!`);
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Обновлено ${updatedCount}, прибыло ${arrivedCount} за ${duration}с`);
}

main().catch(console.error);
