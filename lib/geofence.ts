// lib/geofence.ts
//
// Геометрия для алерта "машина заехала на дорогу к весовой рамке".
// Дорога хранится как ломаная линия (массив точек lat/lng, нарисованная
// вручную в /admin/weigh-stations) — проверяем, насколько близко живая
// GPS-точка машины подошла к ближайшему отрезку этой линии.
import { calculateDistance } from './utils';

export interface LatLng {
  lat: number;
  lng: number;
}

// Расстояние от точки до отрезка [a,b] в метрах. Точное геодезическое
// решение (например через проекцию на дугу большого круга) избыточно для
// отрезков в десятки-сотни метров — используем плоскую аппроксимацию:
// переводим все три точки в локальные метры относительно точки a через
// Haversine по каждой оси, дальше обычная геометрия точка-отрезок.
function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  // Метры на градус долготы в точке a (широта влияет на длину градуса долготы)
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((a.lat * Math.PI) / 180);

  const toXY = (pt: LatLng) => ({
    x: (pt.lng - a.lng) * metersPerDegLng,
    y: (pt.lat - a.lat) * metersPerDegLat,
  });

  const A = toXY(a); // всегда (0,0)
  const B = toXY(b);
  const P = toXY(p);

  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const lenSq = abx * abx + aby * aby;

  if (lenSq === 0) {
    // Вырожденный отрезок (точка) — просто расстояние до a
    return calculateDistance(p.lat, p.lng, a.lat, a.lng) * 1000;
  }

  let t = ((P.x - A.x) * abx + (P.y - A.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = A.x + t * abx;
  const closestY = A.y + t * aby;

  const dx = P.x - closestX;
  const dy = P.y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Минимальное расстояние от точки до всей ломаной линии (по всем отрезкам).
export function minDistanceToPolylineMeters(point: LatLng, polyline: LatLng[]): number | null {
  if (polyline.length === 0) return null;
  if (polyline.length === 1) {
    return calculateDistance(point.lat, point.lng, polyline[0].lat, polyline[0].lng) * 1000;
  }

  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distanceToSegmentMeters(point, polyline[i], polyline[i + 1]);
    if (d < min) min = d;
  }
  return min;
}
