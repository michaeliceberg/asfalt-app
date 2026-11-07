// app/api/admin/places/route.ts
// Места для навигации (lib/nav.ts): заводы, объекты получателей, карьеры.
// GET — все места + получатели за 30 дней, для которых место ещё неизвестно.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { places, shipments, trips } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { placeAliases } from '@/lib/nav';
import { parseRussianDate } from '@/lib/utils';

const KINDS = ['factory', 'object', 'quarry'];

const norm = (s: string | null | undefined) =>
  (s || '').toLowerCase().replace(/[«»"'.,]/g, ' ').replace(/\s+/g, ' ').trim();

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const all = await db.select().from(places);
  const tripCounts = await db.all<{ placeId: number; n: number; median: number }>(
    sql`SELECT place_id AS placeId, COUNT(*) AS n, AVG(duration_min) AS median FROM ${trips} GROUP BY place_id`
  );
  const countByPlace = new Map(tripCounts.map(r => [r.placeId, r]));

  const known = new Set<string>();
  for (const p of all) {
    known.add(norm(p.name));
    placeAliases(p).forEach(a => known.add(a));
  }

  // Получатели без места: только отгрузки без координат из 1С
  const since = Date.now() - 30 * 86400_000;
  const unknown = new Map<string, { name: string; count: number; factories: Set<string> }>();
  for (const s of await db.select({
    consignee: shipments.consignee, customer: shipments.customer, date: shipments.date,
    division: shipments.division, dp: shipments.destinationPoint,
  }).from(shipments)) {
    if (s.dp) continue;
    const name = (s.consignee || s.customer || '').trim();
    if (!name || known.has(norm(name))) continue;
    if (parseRussianDate(s.date).getTime() < since) continue;
    const k = norm(name);
    const u = unknown.get(k) || { name, count: 0, factories: new Set<string>() };
    u.count++; u.factories.add(s.division);
    unknown.set(k, u);
  }

  return NextResponse.json({
    places: all.map(p => ({
      ...p,
      trips: countByPlace.get(p.id)?.n ?? 0,
      avgTripMin: countByPlace.get(p.id)?.median ? Math.round(countByPlace.get(p.id)!.median) : null,
    })),
    unknown: [...unknown.values()]
      .map(u => ({ name: u.name, count: u.count, factories: [...u.factories] }))
      .sort((a, b) => b.count - a.count),
  });
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json();
  const name = String(b.name || '').trim();
  const lat = Number(b.lat), lng = Number(b.lng);
  const kind = KINDS.includes(b.kind) ? b.kind : 'object';
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Нужны название и точка на карте' }, { status: 400 });
  }
  const [created] = await db.insert(places).values({
    name, kind, lat, lng,
    radiusM: Math.max(100, Math.min(3000, Number(b.radiusM) || 400)),
    aliases: String(b.aliases || '').trim(),
    source: 'manual', createdAt: Date.now(),
  }).returning();
  return NextResponse.json({ place: created });
}
