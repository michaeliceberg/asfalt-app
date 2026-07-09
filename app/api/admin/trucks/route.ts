// app/api/admin/trucks/route.ts
// Список GPS-машин для страницы /admin/trucks. Раньше это редактировалось
// только правкой lib/trucks.ts и редеплоем — теперь через это API.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trucks } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth';
import { normalizePlate } from '@/lib/utils';
import { desc } from 'drizzle-orm';

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await db.select().from(trucks).orderBy(desc(trucks.createdAt));
  return NextResponse.json({ trucks: rows });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const uid = String(body.uid || '').trim();
    const licensePlate = normalizePlate(body.licensePlate);
    const vehicleType = body.vehicleType ? String(body.vehicleType).trim() : null;

    if (!uid || !licensePlate) {
      return NextResponse.json({ error: 'uid и госномер обязательны' }, { status: 400 });
    }

    const now = Date.now();
    const [created] = await db
      .insert(trucks)
      .values({ uid, licensePlate, vehicleType, isActive: true, createdAt: now })
      .returning();

    return NextResponse.json({ truck: created }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE')) {
      return NextResponse.json(
        { error: 'Машина с таким uid или госномером уже есть' },
        { status: 409 }
      );
    }
    console.error('❌ Error creating truck:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
