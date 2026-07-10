// app/api/push/register-native/route.ts
//
// Приём device token из нативного iOS-приложения (Capacitor,
// @capacitor/push-notifications). Тот же принцип, что и в
// app/api/push/subscribe/route.ts для веб-пуша, только тут вместо
// endpoint+ключей — один APNs device token.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { apnsTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserFromToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const { token: deviceToken } = await request.json();

    if (!deviceToken || typeof deviceToken !== 'string') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(apnsTokens)
      .where(eq(apnsTokens.device_token, deviceToken))
      .limit(1);

    if (existing.length > 0) {
      // Токен уже был зарегистрирован — обновляем владельца (на случай,
      // если с этого телефона теперь заходит другой пользователь) и время.
      await db
        .update(apnsTokens)
        .set({ user_id: user.userId, updated_at: Date.now() })
        .where(eq(apnsTokens.device_token, deviceToken));
    } else {
      await db.insert(apnsTokens).values({
        user_id: user.userId,
        device_token: deviceToken,
        created_at: Date.now(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Register native push error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
