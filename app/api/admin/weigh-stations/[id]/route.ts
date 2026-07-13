// app/api/admin/weigh-stations/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { weighStations, restrictedRoads, restrictedRoadPoints, geofenceAlerts } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth';
import { eq, inArray } from 'drizzle-orm';

export async function PATCH(
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

  try {
    const body = await request.json();
    const update: Partial<typeof weighStations.$inferInsert> = {};

    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.lat !== undefined) update.lat = Number(body.lat);
    if (body.lng !== undefined) update.lng = Number(body.lng);
    if (body.isActive !== undefined) update.isActive = Boolean(body.isActive);

    const [updated] = await db
      .update(weighStations)
      .set(update)
      .where(eq(weighStations.id, stationId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    }

    return NextResponse.json({ station: updated });
  } catch (error) {
    console.error('❌ Error updating weigh station:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(
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

  // Каскад вручную — SQLite-FK у нас без ON DELETE CASCADE, поэтому
  // сначала чистим дочерние точки/дороги/тревоги, потом саму станцию.
  const roads = await db.select().from(restrictedRoads).where(eq(restrictedRoads.stationId, stationId));
  const roadIds = roads.map((r) => r.id);

  if (roadIds.length) {
    await db.delete(restrictedRoadPoints).where(inArray(restrictedRoadPoints.roadId, roadIds));
    await db.delete(geofenceAlerts).where(inArray(geofenceAlerts.roadId, roadIds));
    await db.delete(restrictedRoads).where(inArray(restrictedRoads.id, roadIds));
  }
  await db.delete(weighStations).where(eq(weighStations.id, stationId));

  return NextResponse.json({ success: true });
}
