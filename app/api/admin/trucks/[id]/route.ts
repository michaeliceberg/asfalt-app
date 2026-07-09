// app/api/admin/trucks/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trucks } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth';
import { normalizePlate } from '@/lib/utils';
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
  const truckId = Number(id);
  if (!Number.isFinite(truckId)) {
    return NextResponse.json({ error: 'Некорректный id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const update: Partial<typeof trucks.$inferInsert> = { updatedAt: Date.now() };

    if (body.uid !== undefined) update.uid = String(body.uid).trim();
    if (body.licensePlate !== undefined) update.licensePlate = normalizePlate(body.licensePlate);
    if (body.vehicleType !== undefined) update.vehicleType = body.vehicleType ? String(body.vehicleType).trim() : null;
    if (body.isActive !== undefined) update.isActive = Boolean(body.isActive);

    if (update.uid === '' || update.licensePlate === '') {
      return NextResponse.json({ error: 'uid и госномер не могут быть пустыми' }, { status: 400 });
    }

    const [updated] = await db
      .update(trucks)
      .set(update)
      .where(eq(trucks.id, truckId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
    }

    return NextResponse.json({ truck: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE')) {
      return NextResponse.json(
        { error: 'Машина с таким uid или госномером уже есть' },
        { status: 409 }
      );
    }
    console.error('❌ Error updating truck:', error);
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
  const truckId = Number(id);
  if (!Number.isFinite(truckId)) {
    return NextResponse.json({ error: 'Некорректный id' }, { status: 400 });
  }

  await db.delete(trucks).where(eq(trucks.id, truckId));
  return NextResponse.json({ success: true });
}
