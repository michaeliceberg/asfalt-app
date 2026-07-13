// app/api/weigh-stations/route.ts
// Публичный (без requireAdmin) read-only список ДЕЙСТВУЮЩИХ весовых рамок
// и их запретных дорог — для отрисовки на живой карте GPS (TruckMap.tsx).
// В отличие от /api/admin/weigh-stations (полный CRUD-список для страницы
// редактирования), сюда отдаём только isActive=true станции/дороги и
// дороги минимум с 2 точками — карте нечего рисовать по одной точке.
// Без auth-проверки — по тому же принципу, что и /api/trucks: доступ
// к самой карте уже гейтится на уровне страницы.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { weighStations, restrictedRoads, restrictedRoadPoints } from '@/lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';

export async function GET() {
  try {
    const stations = await db
      .select()
      .from(weighStations)
      .where(eq(weighStations.isActive, true));

    if (stations.length === 0) {
      return NextResponse.json({ stations: [] });
    }

    const roads = await db
      .select()
      .from(restrictedRoads)
      .where(
        and(
          inArray(restrictedRoads.stationId, stations.map((s) => s.id)),
          eq(restrictedRoads.isActive, true)
        )
      );

    const points = roads.length
      ? await db
          .select()
          .from(restrictedRoadPoints)
          .where(inArray(restrictedRoadPoints.roadId, roads.map((r) => r.id)))
      : [];

    const result = stations
      .map((station) => ({
        id: station.id,
        name: station.name,
        lat: station.lat,
        lng: station.lng,
        roads: roads
          .filter((r) => r.stationId === station.id)
          .map((road) => ({
            id: road.id,
            name: road.name,
            points: points
              .filter((p) => p.roadId === road.id)
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((p) => ({ lat: p.lat, lng: p.lng })),
          }))
          .filter((road) => road.points.length >= 2),
      }))
      .filter((station) => station.roads.length > 0);

    return NextResponse.json({ stations: result });
  } catch (error) {
    console.error('❌ Error fetching weigh stations:', error);
    return NextResponse.json({ stations: [] }, { status: 500 });
  }
}
