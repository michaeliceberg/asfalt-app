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

  // Расчёт расстояния по формуле Гаверсинуса
  const distance = calculateDistance(lat, lng, destLat, destLng);
  
  // Средняя скорость: 50 км/ч (смешанный режим)
  const avgSpeed = 50;
  let durationSeconds = (distance / avgSpeed) * 3600;

  // Увеличиваем время на 30% (учёт пробок)
  const trafficMultiplier = 1.3;
  durationSeconds = durationSeconds * trafficMultiplier;

  return NextResponse.json({
    success: true,
    data: {
      duration: durationSeconds,
      durationInTraffic: durationSeconds,
      durationFormatted: formatDuration(durationSeconds),
      distance: Math.round(distance * 10) / 10,
      trafficDelay: Math.round(durationSeconds * 0.3 / 60),
      hasTraffic: true,
      trafficMultiplier: trafficMultiplier,
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
