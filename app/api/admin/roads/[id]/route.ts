// app/api/admin/roads/[id]/route.ts
// Точечное управление одной "запретной дорогой" — вкл/выкл или удаление,
// без пересоздания всей станции.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { restrictedRoads, restrictedRoadPoints, geofenceAlerts } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const roadId = Number(id);
  if (!Number.isFinite(roadId)) {
    return NextResponse.json({ error: 'Некорректный id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const update: Partial<typeof restrictedRoads.$inferInsert> = {};
    if (body.isActive !== undefined) update.isActive = Boolean(body.isActive);
    if (body.name !== undefined) update.name = body.name ? String(body.name).trim() : null;

    const [updated] = await db
      .update(restrictedRoads)
      .set(update)
      .where(eq(restrictedRoads.id, roadId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    }

    return NextResponse.json({ road: updated });
  } catch (error) {
    console.error('❌ Error updating restricted road:', error);
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
  const roadId = Number(id);
  if (!Number.isFinite(roadId)) {
    return NextResponse.json({ error: 'Некорректный id' }, { status: 400 });
  }

  await db.delete(restrictedRoadPoints).where(eq(restrictedRoadPoints.roadId, roadId));
  await db.delete(geofenceAlerts).where(eq(geofenceAlerts.roadId, roadId));
  await db.delete(restrictedRoads).where(eq(restrictedRoads.id, roadId));

  return NextResponse.json({ success: true });
}
