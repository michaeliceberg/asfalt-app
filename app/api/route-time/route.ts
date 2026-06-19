// app/api/route-time/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const destLat = parseFloat(searchParams.get('destLat') || '0');
  const destLng = parseFloat(searchParams.get('destLng') || '0');

  if (!lat || !lng || !destLat || !destLng) {
    return NextResponse.json(
      { error: 'Missing coordinates' },
      { status: 400 }
    );
  }

  const distance = calculateDistance(lat, lng, destLat, destLng);
  const avgSpeed = 50;
  let durationSeconds = (distance / avgSpeed) * 3600;

  // ✅ Увеличиваем время на 30% (учёт пробок)
  const trafficMultiplier = 1.3; // +30%
  durationSeconds = durationSeconds * trafficMultiplier;

  return NextResponse.json({
    success: true,
    data: {
      duration: durationSeconds,
      durationInTraffic: durationSeconds,
      durationFormatted: formatDuration(durationSeconds),
      distance: Math.round(distance * 10) / 10,
      trafficDelay: 0,
      hasTraffic: false,
    }
  });
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  return `${minutes} мин`;
}



// // app/api/route-time/route.ts
// import { NextResponse } from 'next/server';

// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url);
//   const lat = searchParams.get('lat');
//   const lng = searchParams.get('lng');
//   const destLat = searchParams.get('destLat');
//   const destLng = searchParams.get('destLng');

//   if (!lat || !lng || !destLat || !destLng) {
//     return NextResponse.json(
//       { error: 'Missing coordinates' },
//       { status: 400 }
//     );
//   }

//   const API_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;

//   try {
//     // Яндекс Routing API
//     const url = `https://api.routing.yandex.net/v2/route?apikey=${API_KEY}&waypoints=${lat},${lng}|${destLat},${destLng}&mode=driving&traffic=optimal`;

//     const response = await fetch(url);

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const data = await response.json();

//     if (!data.routes || data.routes.length === 0) {
//       return NextResponse.json(
//         { error: 'No route found' },
//         { status: 404 }
//       );
//     }

//     const route = data.routes[0];
//     const leg = route.legs[0];

//     // Время в секундах
//     const duration = leg.duration; // без пробок
//     const durationInTraffic = leg.duration_in_traffic; // с пробками

//     // Разница в минутах
//     const trafficDelay = Math.round((durationInTraffic - duration) / 60);

//     return NextResponse.json({
//       success: true,
//       data: {
//         duration: duration, // секунды
//         durationInTraffic: durationInTraffic, // секунды
//         durationFormatted: formatDuration(durationInTraffic),
//         distance: Math.round(leg.distance / 1000), // км
//         trafficDelay: trafficDelay, // минуты
//         hasTraffic: trafficDelay > 0,
//       }
//     });

//   } catch (error) {
//     console.error('Route API error:', error);
//     return NextResponse.json(
//       { error: 'Failed to calculate route' },
//       { status: 500 }
//     );
//   }
// }

// function formatDuration(seconds: number): string {
//   const hours = Math.floor(seconds / 3600);
//   const minutes = Math.floor((seconds % 3600) / 60);
//   if (hours > 0) {
//     return `${hours} ч ${minutes} мин`;
//   }
//   return `${minutes} мин`;
// }