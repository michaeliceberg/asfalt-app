// app/api/admin/places/[id]/route.ts — правка и удаление места (см. /admin/places)
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { places, trips } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth';
import { eq } from 'drizzle-orm';

const KINDS = ['factory', 'object', 'quarry'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  const b = await request.json();
  const upd: Partial<typeof places.$inferInsert> = {};
  if (b.name !== undefined) upd.name = String(b.name).trim();
  if (b.kind !== undefined && KINDS.includes(b.kind)) upd.kind = b.kind;
  if (b.lat !== undefined && Number.isFinite(Number(b.lat))) upd.lat = Number(b.lat);
  if (b.lng !== undefined && Number.isFinite(Number(b.lng))) upd.lng = Number(b.lng);
  if (b.radiusM !== undefined) upd.radiusM = Math.max(100, Math.min(3000, Number(b.radiusM) || 400));
  if (b.aliases !== undefined) upd.aliases = String(b.aliases).trim();
  // Место поправил человек — дальше система его не двигает
  upd.source = 'manual';
  const [updated] = await db.update(places).set(upd).where(eq(places.id, id)).returning();
  if (!updated) return NextResponse.json({ error: 'Не найдено' }, { status: 404 });
  return NextResponse.json({ place: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  await db.update(trips).set({ placeId: null }).where(eq(trips.placeId, id));
  await db.delete(places).where(eq(places.id, id));
  return NextResponse.json({ ok: true });
}
