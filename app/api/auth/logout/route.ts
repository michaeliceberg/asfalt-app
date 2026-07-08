// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Стираем httpOnly cookie — из клиентского JS это больше не сделать
  // (та же защита, что не даёт её угнать через XSS, мешает и document.cookie)
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
