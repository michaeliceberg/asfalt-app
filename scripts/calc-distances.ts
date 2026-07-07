import { db } from '../lib/db';
import { shipments } from '../lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { calculateDistance, calculateETA, parseDestinationPoint } from '../lib/utils';
import { TRUCKS } from '../lib/trucks';

const AUTH_TOKEN = 'XBNlAqRnZxU3Q%2BSLHe3qKZSIIYiSGWym3mN8%2BbXmbSZE74YqB3bYf4TLIWAzLPyg%2BR9qd2Mf9AxDn2K3f4j5lA%3D%3D';
const ARRIVAL_THRESHOLD_KM = 2;

async function getTruckPositions() {
  try {
    const response = await fetch('https://xptr.geoinformer.com/service/monitoring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        idList: TRUCKS.map(t => t.uid).map(String),
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
      TRUCKS.forEach((truck) => {
        const pos = data.positions[truck.uid];
        if (pos) {
          positions.set(truck.name, pos);
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
    
    const truckPos = truckPositions.get(shipment.licensePlate);
    if (!truckPos) continue;
    
    const distance = calculateDistance(truckPos.lat, truckPos.lng, destCoords.lat, destCoords.lng);
    const eta = calculateETA(distance);
    
    await db.update(shipments)
      .set({
        distance_to_dest: distance,
        eta_minutes: eta.totalMinutes,
        updated_at: now,
      })
      .where(eq(shipments.id, shipment.id));
    
    updatedCount++;
    
    if (distance < ARRIVAL_THRESHOLD_KM && !shipment.arrived) {
      await db.update(shipments)
        .set({
          arrived: true,
          arrived_at: now,
        })
        .where(eq(shipments.id, shipment.id));
      arrivedCount++;
      console.log(`✅ ${shipment.licensePlate} прибыла!`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Обновлено ${updatedCount}, прибыло ${arrivedCount} за ${duration}с`);
}

main().catch(console.error);
