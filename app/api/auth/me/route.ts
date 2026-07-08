// app/api/auth/me/route.ts
// Проверка "я залогинен?" — источник истины сервер (cookie/Bearer),
// а не localStorage, которому нельзя доверять в PWA на iOS.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromToken, getUserAccessibleFactories } from '@/lib/auth';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const cookieStore = await cookies();
  const token = bearerToken || cookieStore.get('token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = await getUserFromToken(token);
  if (!decoded) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessibleFactories = await getUserAccessibleFactories(token);

  return NextResponse.json({
    user: {
      id: decoded.userId,
      username: decoded.username,
      groupId: decoded.groupId,
    },
    accessibleFactories,
  });
}
