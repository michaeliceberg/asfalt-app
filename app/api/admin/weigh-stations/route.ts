// app/api/admin/weigh-stations/route.ts
// Список весовых рамок для страницы /admin/weigh-stations, вместе со
// всеми их запретными дорогами (и точками этих дорог) — чтобы страница
// сразу отрисовала карту без N+1 запросов на клиенте.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { weighStations, restrictedRoads, restrictedRoadPoints } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth';
import { desc, eq, inArray } from 'drizzle-orm';

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stations = await db.select().from(weighStations).orderBy(desc(weighStations.createdAt));

  const roads = stations.length
    ? await db
        .select()
        .from(restrictedRoads)
        .where(inArray(restrictedRoads.stationId, stations.map((s) => s.id)))
    : [];

  const points = roads.length
    ? await db
        .select()
        .from(restrictedRoadPoints)
        .where(inArray(restrictedRoadPoints.roadId, roads.map((r) => r.id)))
    : [];

  const result = stations.map((station) => ({
    ...station,
    roads: roads
      .filter((r) => r.stationId === station.id)
      .map((road) => ({
        ...road,
        points: points
          .filter((p) => p.roadId === road.id)
          .sort((a, b) => a.orderIndex - b.orderIndex),
      })),
  }));

  return NextResponse.json({ stations: result });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Название и координаты обязательны' }, { status: 400 });
    }

    const [created] = await db
      .insert(weighStations)
      .values({ name, lat, lng, isActive: true, createdAt: Date.now() })
      .returning();

    return NextResponse.json({ station: { ...created, roads: [] } }, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating weigh station:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
