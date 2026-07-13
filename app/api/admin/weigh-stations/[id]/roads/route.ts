// app/api/admin/weigh-stations/[id]/roads/route.ts
// Добавление "запретной дороги" (ломаной линии) к весовой рамке —
// точки рисуются на карте в /admin/weigh-stations и приходят сюда разом.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { restrictedRoads, restrictedRoadPoints, weighStations } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth';
import { eq } from 'drizzle-orm';

interface PointInput {
  lat: number;
  lng: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const stationId = Number(id);
  if (!Number.isFinite(stationId)) {
    return NextResponse.json({ error: 'Некорректный id' }, { status: 400 });
  }

  const [station] = await db.select().from(weighStations).where(eq(weighStations.id, stationId));
  if (!station) {
    return NextResponse.json({ error: 'Рамка не найдена' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const name = body.name ? String(body.name).trim() : null;
    const points: PointInput[] = Array.isArray(body.points) ? body.points : [];

    const validPoints = points.filter(
      (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
    );

    if (validPoints.length < 2) {
      return NextResponse.json({ error: 'Нужно минимум 2 точки для линии дороги' }, { status: 400 });
    }

    const [road] = await db
      .insert(restrictedRoads)
      .values({ stationId, name, isActive: true, createdAt: Date.now() })
      .returning();

    const pointRows = validPoints.map((p, i) => ({
      roadId: road.id,
      orderIndex: i,
      lat: Number(p.lat),
      lng: Number(p.lng),
    }));
    await db.insert(restrictedRoadPoints).values(pointRows);

    return NextResponse.json({ road: { ...road, points: pointRows } }, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating restricted road:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
