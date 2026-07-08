// proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

export async function proxy(request: NextRequest) {
  console.log('🔵 PATH:', request.nextUrl.pathname);





  // ✅ ПРОПУСКАЕМ ВСЕ CRON И SEND-PLAN
  if (request.nextUrl.pathname === '/api/send-plan' || 
      request.nextUrl.pathname.startsWith('/api/cron-')) {
    console.log('✅ CRON/SEND-PLAN - пропускаем');
    return NextResponse.next();
  }



  
  const publicPaths = [
    // Страницы
    '/login',
    '/demo',
    '/landing',
    
    // Статические файлы
    '/_next',
    '/favicon.ico',
    
    // API для демо-страницы
    '/api/incoming',
    '/api/shipments',
    '/api/combined-requests',
    '/api/outgoing-requests',
    '/api/last-import-info',
    '/api/last-import-update',
    '/api/cron-info',
    
    // API для синхронизации (крон)
    '/api/cron',
    '/api/cron-shipments',
    '/api/cron-outgoing-requests',
    '/api/cron-info-shipments',
    '/api/check-sync',
    '/api/send-plan',
    '/api/excel-import',
    '/api/cron-calc-distances',
    
    // API для аутентификации
    '/api/auth/login',
    '/api/auth/logout',

    // API для GPS и маршрутов
    '/api/route-time',
    '/api/trucks',
    '/api/truck-routes',
    '/api/truck-route-by-request',
    '/api/trucks-distances',
    
    // API для push уведомлений
    '/api/push/subscribe',
    '/api/push/unsubscribe',
    '/api/test-push',
    
    // API для тестирования
    '/api/test',
    
    // API для здоровья
    '/api/health',
    '/api/health-notify',

    // API для данных
    '/api/all-data',
  ];

  const pathname = request.nextUrl.pathname;
  
  // Проверяем, является ли путь публичным
  const isPublicPath = publicPaths.some(path => {
    if (pathname === path) return true;
    if (pathname.startsWith(path + '/')) return true;
    if (pathname.startsWith(path) && request.nextUrl.search.includes('demo=true')) return true;
    return false;
  });

  if (isPublicPath) {
    console.log('✅ PUBLIC PATH - пропускаем');
    return NextResponse.next();
  }

  // Получаем токен — сначала пробуем заголовок Authorization (нужно для
  // мобильного приложения, у него нет доступа к httpOnly cookie), иначе cookie (веб)
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || request.cookies.get('token')?.value;
  console.log('🔵 Token exists?', !!token, bearerToken ? '(из Authorization)' : '(из cookie)');

  if (!token) {
    console.log('❌ NO TOKEN');
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    console.log('✅ TOKEN VALID');
    return NextResponse.next();
  } catch (error) {
    console.log('❌ TOKEN INVALID');
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};









