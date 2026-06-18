// proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

export async function proxy(request: NextRequest) {
  console.log('🔵 PATH:', request.nextUrl.pathname);
  
  // Публичные пути
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
    '/api/last-import-update', // ✅ ДОБАВЛЯЕМ
    '/api/cron-info',
    
    // API для синхронизации (крон)
    '/api/cron',
    '/api/cron-shipments',
    '/api/cron-outgoing-requests',
    '/api/cron-info-shipments',
    '/api/check-sync',
    '/api/send-plan',
    '/api/excel-import',
    
    // API для аутентификации
    '/api/auth/login',

    '/api/trucks',           // ← уже есть
    '/api/truck-routes',     // ← ДОБАВИТЬ!
  ];

  const pathname = request.nextUrl.pathname;
  
  // Проверяем, является ли путь публичным
  const isPublicPath = publicPaths.some(path => {
    // Точное совпадение
    if (pathname === path) return true;
    // Начинается с пути (для вложенных маршрутов)
    if (pathname.startsWith(path + '/')) return true;
    // Для API с параметрами (например, ?demo=true)
    if (pathname.startsWith(path) && request.nextUrl.search.includes('demo=true')) return true;
    return false;
  });

  console.log('🔵 Is public?', isPublicPath, 'Path:', pathname);

  // Если путь публичный — пропускаем
  if (isPublicPath) {
    console.log('✅ PUBLIC PATH - пропускаем');
    return NextResponse.next();
  }

  // Получаем токен
  const token = request.cookies.get('token')?.value;
  console.log('🔵 Token exists?', !!token);

  if (!token) {
    console.log('❌ NO TOKEN - редирект на /login');
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
    console.log('❌ TOKEN INVALID - редирект на /login');
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




// // proxy.ts
// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';
// import { jwtVerify } from 'jose';

// const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

// export async function proxy(request: NextRequest) {
//   // Публичные пути (не требуют авторизации)
//   const publicPaths = [
//     '/login',
//     '/demo', // ← ДЕМО-СТРАНИЦА ДОЛЖНА БЫТЬ ПУБЛИЧНОЙ
//     '/api/auth/login',
//     '/landing',
//     '/_next',
//     '/favicon.ico',
//     '/api/cron',
//     '/api/cron-shipments',
//     '/api/cron-outgoing-requests',
//     '/api/cron-info',
//     '/api/cron-info-shipments',
//     '/api/check-sync',
//     '/api/send-plan',
//     '/api/excel-import',
//   ];

//   // Проверяем, является ли текущий путь публичным
//   const pathname = request.nextUrl.pathname;
//   const isPublicPath = publicPaths.some(path => 
//     pathname === path || 
//     pathname.startsWith(path + '/')
//   );

//   // Если путь публичный — пропускаем без проверки
//   if (isPublicPath) {
//     return NextResponse.next();
//   }

//   // Получаем токен из cookie
//   const token = request.cookies.get('token')?.value;

//   // Если токена нет — редирект на логин
//   if (!token) {
//     // Для API возвращаем 401
//     if (pathname.startsWith('/api')) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }
//     const url = new URL('/login', request.url);
//     return NextResponse.redirect(url);
//   }

//   // Проверяем валидность токена
//   try {
//     await jwtVerify(token, JWT_SECRET);
//     return NextResponse.next();
//   } catch (error) {
//     // Если токен невалидный — редирект на логин
//     if (pathname.startsWith('/api')) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }
//     const url = new URL('/login', request.url);
//     return NextResponse.redirect(url);
//   }
// }

// export const config = {
//   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
// };