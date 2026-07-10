// app/api/push/unregister-native/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apnsTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { token: deviceToken } = await request.json();

    if (!deviceToken || typeof deviceToken !== 'string') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    await db.delete(apnsTokens).where(eq(apnsTokens.device_token, deviceToken));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unregister native push error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
