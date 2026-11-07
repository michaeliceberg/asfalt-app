// proxy.ts
//
// Кто куда пускается:
//  - публичные страницы (вход, демо, лендинг) и статические файлы;
//  - вход/выход;
//  - /api/excel-import и /api/last-import-update — без токена, сами проверяют IP завода Айсберг;
//  - POST /api/send-plan — вебхук Telegram (кнопки в боте);
//  - /api/health — общий статус для мониторинга (без данных);
//  - крон-ручки — по заголовку Authorization: Bearer <CRON_SECRET> (crontab на сервере);
//  - всё остальное (в т.ч. все данные и GPS) — только с JWT пользователя
//    (cookie token в браузере/iOS или Authorization: Bearer <jwt>).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

const PUBLIC_PAGES = ['/login', '/demo', '/landing'];

const PUBLIC_API = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/excel-import',
  '/api/last-import-update',
  '/api/health',
];

// Ручки, которые дёргает crontab сервера. Пускаем по CRON_SECRET, а
// пользователя — как обычно по JWT (кнопка «Обновить» на главной).
const CRON_API = [
  '/api/cron',
  '/api/cron-shipments',
  '/api/cron-outgoing-requests',
  '/api/cron-calc-distances',
  '/api/check-sync',
  '/api/health-notify',
  '/api/send-plan',
];

function matches(pathname: string, list: string[]): boolean {
  return list.some(p => pathname === p || pathname.startsWith(p + '/'));
}

function unauthorized(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') return NextResponse.next();

  // Файлы из public/ (sw.js, manifest, иконки) — на странице входа они нужны без токена
  if (!pathname.startsWith('/api') && /\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();

  if (matches(pathname, PUBLIC_PAGES) || matches(pathname, PUBLIC_API)) return NextResponse.next();

  // Telegram присылает нажатия кнопок POST-запросом без токена
  if (pathname === '/api/send-plan' && request.method === 'POST') return NextResponse.next();

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && bearerToken === cronSecret && matches(pathname, CRON_API)) {
    return NextResponse.next();
  }

  const token = bearerToken || request.cookies.get('token')?.value;
  if (!token) return unauthorized(request);

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    return unauthorized(request);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
