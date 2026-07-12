// app/components/TruckMap.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getTruckType, getStatusColor } from '@/lib/truck-icons';
import { getFactoryColor, getFactoryCoords } from '@/lib/constants';
import type { YandexMap, YandexPlacemark } from '@/lib/yandex-maps-types';
import { Truck as TruckIconLucide, Zap, Clock, Target, MapPin } from 'lucide-react';

// ============================================
// ТИПЫ
// ============================================

interface TruckPosition {
  lat: number;
  lng: number;
  vel: number;
  time: number;
}

interface Truck {
  uid: string;
  name: string;
  position: TruckPosition | null;
  lastUpdate: string | null;
  destination?: string | null;
  factory?: string;
}

interface Route {
  destination: string;
  factory: string;
  count: number;
  requestNumber: string;
  totalQuantity: number;
  licensePlates: string[];
  destCoords: { lat: number; lng: number; name: string } | null;
  factoryCoords: { lat: number; lng: number; name: string } | null;
}

interface TruckMapProps {
  trucks: Truck[];
  routes?: Route[];
  onTruckSelect?: (truck: Truck) => void;
  onMapReady?: (map: YandexMap) => void;
  filterPlate?: string | null;
}

declare global {
  interface Window {
    _routeTimePlacemark?: unknown;
  }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function getStatusLabel(vel: number, lastUpdate: string | null): string {
  if (!lastUpdate) return '⚪ Нет данных';

  const now = Date.now();
  const lastUpdateTime = new Date(lastUpdate).getTime();
  const minutesSinceUpdate = (now - lastUpdateTime) / 1000 / 60;

  if (minutesSinceUpdate > 60) return '⚪ Офлайн';
  if (vel === 0 && minutesSinceUpdate > 30) return '🔴 Стоит';
  if (vel === 0) return '🟡 Загружается';
  if (vel < 20) return '🟡 Медленно';
  if (vel < 50) return '🟢 Едет';
  return '🔵 Быстро';
}

function getTruckTypeEmoji(type: string): string {
  switch (type) {
    case 'mixer': return '🧱';
    case 'tipper': return '🪨';
    default: return '🚛';
  }
}

// Версия статуса для JSX (карточка выбранной машины) — цветной кружок + текст
// вместо emoji-строки (та используется в HTML-балунах Яндекс.Карт, где JSX
// не работает, поэтому getStatusLabel выше оставлен как есть).
function renderStatusBadge(vel: number, lastUpdate: string | null) {
  let color = '#9ca3af';
  let text = 'Нет данных';

  if (lastUpdate) {
    const now = Date.now();
    const minutesSinceUpdate = (now - new Date(lastUpdate).getTime()) / 1000 / 60;

    if (minutesSinceUpdate > 60) {
      color = '#9ca3af'; text = 'Офлайн';
    } else if (vel === 0 && minutesSinceUpdate > 30) {
      color = '#ef4444'; text = 'Стоит';
    } else if (vel === 0) {
      color = '#facc15'; text = 'Загружается';
    } else if (vel < 20) {
      color = '#facc15'; text = 'Медленно';
    } else if (vel < 50) {
      color = '#22c55e'; text = 'Едет';
    } else {
      color = '#3b82f6'; text = 'Быстро';
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {text}
    </span>
  );
}

function getTruckTypeLabel(type: string): string {
  switch (type) {
    case 'mixer': return 'Бетоновоз';
    case 'tipper': return 'Тонар';
    default: return 'Самосвал';
  }
}

function cleanDestName(name: string): string {
  return name.replace('ПК 25 ', '').replace('ПК 26 ', '').replace('АЙСБЕРГ ООО', 'АЙСБЕРГ');
}

// ============================================
// ПРЕМИАЛЬНЫЕ HTML-МАРКЕРЫ
// ============================================
// Раньше машины рисовались детальной SVG-иконкой грузовика (растянутой
// растровой картинкой ~36px) — на таком размере деталь теряется и выглядит
// мутно/дёшево. Теперь — компактный флэт-бейдж: цветной кружок (цвет = статус
// машины) с простым белым силуэтом грузовика внутри, как в современных
// трекерах (Яндекс.Такси и т.п.). Заводы и destination — такой же язык:
// кружок-иконка + чистая подпись-чип снизу, без резких обводок и emoji.

const TRUCK_GLYPH = `
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 15V6.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1V15M2 15h1M2 15a2.2 2.2 0 1 0 4.4 0M12 15h6.5M12 15a2.2 2.2 0 1 0 4.4 0M12 9.5h4.2l3.3 3.3v2.2h-1.5"
      stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

const FACTORY_GLYPH = `
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 21V11l5 3.2V11l5 3.2V11l6-3.6V21H3Z" stroke="#ffffff" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M8 21v-4h3v4" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M17.5 7.4V4.6M17.5 4.6c0-1 1.6-1 1.6-2.1" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"/>
  </svg>
`;

const DEST_GLYPH = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="8.5" stroke="#ffffff" stroke-width="1.9"/>
    <circle cx="12" cy="12" r="4.2" stroke="#ffffff" stroke-width="1.9"/>
    <circle cx="12" cy="12" r="1.1" fill="#ffffff"/>
  </svg>
`;

function buildTruckBadgeHtml(color: string, selected: boolean): string {
  const size = selected ? 40 : 30;
  const ring = selected
    ? `<div class="truck-badge-pulse" style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};"></div>`
    : '';
  return `
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${ring}
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};
        border:2.5px solid #fff;
        box-shadow:0 3px 10px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      ">${TRUCK_GLYPH}</div>
    </div>
  `;
}

function buildFactoryBadgeHtml(name: string): string {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="
        width:38px;height:38px;border-radius:50%;
        background:linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        border:3px solid #fff;
        box-shadow:0 4px 14px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      ">${FACTORY_GLYPH}</div>
      <div style="
        margin-top:5px;
        background:#1a1a2e;
        color:#fff;
        padding:3px 11px;
        border-radius:8px;
        font-size:11px;
        font-weight:700;
        white-space:nowrap;
        letter-spacing:0.2px;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
        border:1px solid rgba(255,217,61,0.35);
        font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">ЗАВОД · ${name}</div>
    </div>
  `;
}

function buildDestinationBadgeHtml(name: string, count: number, color: string): string {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="
        width:34px;height:34px;border-radius:50%;
        background:${color};
        border:3px solid #fff;
        box-shadow:0 4px 14px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
      ">${DEST_GLYPH}</div>
      <div style="
        margin-top:5px;
        background:#fff;
        color:#1a1a2e;
        padding:3px 11px;
        border-radius:8px;
        font-size:11px;
        font-weight:700;
        white-space:nowrap;
        box-shadow:0 2px 8px rgba(0,0,0,0.18);
        border:1.5px solid ${color};
        font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">${cleanDestName(name)} · ${count} <span style="opacity:0.6">машин</span></div>
    </div>
  `;
}

// ============================================
// АВТО-МАСШТАБ
// ============================================

// Плавная маршрутная линия завод → destination. Раньше здесь был
// ymaps.multiRouter.MultiRoute (прокладка по реальным дорогам) — но
// у Яндекса это отдельный ПЛАТНЫЙ продукт "Получение деталей маршрута"
// (бесплатного тарифа нет вообще, от 226 200 ₽/год), в то время как сам
// JavaScript API с картой и метками бесплатен. Чтобы не подключать
// платную лицензию, линия колонны — сглаженная кривая (квадратичный
// Безье с изгибом перпендикулярно направлению), визуально читается как
// "путь", но не претендует на точное повторение дорог и ничего не стоит.
function buildRouteCurvePoints(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  segments = 28
): [number, number][] {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
  const perpLat = -dLng / dist;
  const perpLng = dLat / dist;
  const bulge = dist * 0.14;
  const ctrlLat = (from.lat + to.lat) / 2 + perpLat * bulge;
  const ctrlLng = (from.lng + to.lng) / 2 + perpLng * bulge;

  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    points.push([
      mt * mt * from.lat + 2 * mt * t * ctrlLat + t * t * to.lat,
      mt * mt * from.lng + 2 * mt * t * ctrlLng + t * t * to.lng,
    ]);
  }
  return points;
}

function computeBounds(points: [number, number][]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  let minLat = points[0][0], maxLat = points[0][0];
  let minLng = points[0][1], maxLng = points[0][1];
  for (const [lat, lng] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [[minLat, minLng], [maxLat, maxLng]];
}

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================

export default function TruckMap({ trucks, routes = [], onTruckSelect, onMapReady, filterPlate }: TruckMapProps) {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const mapRef = useRef<YandexMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const placemarksRef = useRef<Record<string, YandexPlacemark>>({});
  const routesRef = useRef<Record<string, unknown>>({});
  const factoryMarksRef = useRef<unknown[]>([]);
  const isMapReadyRef = useRef(false);
  const isScriptLoadingRef = useRef(false);
  const initMapCalledRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // РАСЧЁТ ВРЕМЕНИ МАРШРУТА (формула на сервере — без изменений)
  // ============================================

  const getRouteTime = async (
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ) => {
    try {
      const response = await fetch(
        `/api/route-time?lat=${fromLat}&lng=${fromLng}&destLat=${toLat}&destLng=${toLng}`
      );
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error('Error getting route time:', error);
      return null;
    }
  };

  // ============================================
  // ОТРИСОВКА ЗАВОДОВ — только те, что реально фигурируют в routes
  // (раньше рисовались все 4 всегда, плюс старые бейджи никогда не
  // удалялись перед перерисовкой — они дублировались друг на друга
  // при каждом обновлении данных)
  // ============================================

  const drawFactories = useCallback(() => {
    if (!isMapReady || !mapRef.current || !window.ymaps) return;

    const map = mapRef.current;
    const ymaps = window.ymaps;

    factoryMarksRef.current.forEach((mark) => map.geoObjects.remove(mark));
    factoryMarksRef.current = [];

    const seen = new Set<string>();
    routes.forEach((route) => {
      if (seen.has(route.factory)) return;
      seen.add(route.factory);

      const coords = route.factoryCoords || getFactoryCoords(route.factory);
      if (!coords) return;

      const placemark = new ymaps.Placemark(
        [coords.lat, coords.lng],
        { iconContent: buildFactoryBadgeHtml(coords.name || route.factory) },
        { iconLayout: 'default#imageWithContent', iconContentOffset: [0, -19] }
      );
      map.geoObjects.add(placemark);
      factoryMarksRef.current.push(placemark);
    });
  }, [isMapReady, routes]);

  // ============================================
  // ОТРИСОВКА МАРШРУТОВ — плавная кривая завод → destination (бесплатно,
  // без платного Router API — см. комментарий у buildRouteCurvePoints)
  // ============================================

  const drawRoutes = useCallback(() => {
    if (!isMapReady || !mapRef.current || !window.ymaps || !routes || routes.length === 0) {
      return;
    }

    const map = mapRef.current;
    const ymaps = window.ymaps;

    Object.values(routesRef.current).forEach((obj) => {
      map.geoObjects.remove(obj);
    });
    routesRef.current = {};

    routes.forEach((route) => {
      if (!route.destCoords || !route.factoryCoords) return;

      const color = getFactoryColor(route.factory) || '#4ade80';
      const curvePoints = buildRouteCurvePoints(route.factoryCoords, route.destCoords);

      // Мягкое "свечение" под линией — визуально премиальнее плоской линии.
      const glowLine = new ymaps.Polyline(
        curvePoints,
        {},
        {
          strokeColor: color,
          strokeWidth: 9,
          strokeOpacity: 0.16,
        }
      );
      map.geoObjects.add(glowLine);
      routesRef.current[route.destination + '_glow'] = glowLine;

      // Основная маршрутная линия.
      const routeLine = new ymaps.Polyline(
        curvePoints,
        {},
        {
          strokeColor: color,
          strokeWidth: 3.5,
          strokeOpacity: 0.9,
        }
      );
      map.geoObjects.add(routeLine);
      routesRef.current[route.destination] = routeLine;

      // Точка назначения — премиальный бейдж с числом машин прямо в подписи
      const destPlacemark = new ymaps.Placemark(
        [route.destCoords.lat, route.destCoords.lng],
        { iconContent: buildDestinationBadgeHtml(route.destination, route.count, color) },
        { iconLayout: 'default#imageWithContent', iconContentOffset: [0, -17] }
      );
      map.geoObjects.add(destPlacemark);
      routesRef.current[route.destination + '_dest'] = destPlacemark;
    });

    drawFactories();
  }, [routes, isMapReady, drawFactories]);

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ КАРТЫ
  // ============================================

  const initMap = useCallback(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    if (!window.ymaps) {
      setMapError('API Яндекс Карт не загружен');
      return;
    }

    try {
      const ymaps = window.ymaps;

      const map = new ymaps.Map(containerRef.current, {
        center: [55.76, 37.64],
        zoom: 10,
        controls: ['zoomControl', 'fullscreenControl'],
      });

      mapRef.current = map;
      isMapReadyRef.current = true;
      setIsMapReady(true);
      initMapCalledRef.current = true;
      setMapError(null);

      const firstWithPosition = trucks.find(t => t.position !== null);
      if (firstWithPosition?.position) {
        map.setCenter([firstWithPosition.position.lat, firstWithPosition.position.lng], 12);
      }

      if (routes && routes.length > 0) {
        setTimeout(() => {
          drawRoutes();
        }, 100);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setMapError('Ошибка инициализации карты');
    }
  }, [trucks, routes, drawRoutes]);

  // ============================================
  // ЗАГРУЗКА API ЯНДЕКС КАРТ
  // ============================================

  useEffect(() => {
    if (window.ymaps) {
      if (!mapRef.current && !initMapCalledRef.current) {
        initMap();
      }
      return;
    }

    if (isScriptLoadingRef.current) return;
    isScriptLoadingRef.current = true;

    const script = document.createElement('script');
    // Базовый набор модулей — без multiRouter.MultiRoute, т.к. прокладка
    // маршрута по реальным дорогам это отдельный платный продукт Яндекса
    // (см. комментарий у buildRouteCurvePoints выше). Линия колонны
    // рисуется бесплатной Polyline по сглаженной кривой.
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || ''}&lang=ru_RU`;
    script.async = true;

    script.onload = () => {
      if (window.ymaps) {
        window.ymaps.ready(() => {
          if (!mapRef.current && !initMapCalledRef.current) {
            initMap();
          }
        });
      } else {
        setMapError('API Яндекс Карт не загрузился');
        isScriptLoadingRef.current = false;
      }
    };

    script.onerror = () => {
      setMapError('Ошибка загрузки API Яндекс Карт');
      isScriptLoadingRef.current = false;
    };

    document.body.appendChild(script);

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (mapRef.current) {
        try {
          mapRef.current.geoObjects.removeAll();
        } catch {
          // ignore
        }
        mapRef.current = null;
        isMapReadyRef.current = false;
        setIsMapReady(false);
        initMapCalledRef.current = false;
      }
    };
  }, [initMap]);

  // ============================================
  // ОБНОВЛЕНИЕ МАРКЕРОВ МАШИН
  // ============================================

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !window.ymaps) return;
    if (trucks.length === 0) return;

    const map = mapRef.current;
    const ymaps = window.ymaps;

    Object.values(placemarksRef.current).forEach((placemark) => {
      map.geoObjects.remove(placemark);
    });
    placemarksRef.current = {};

    let filteredTrucks = trucks;
    if (filterPlate) {
      const normalizedFilter = filterPlate
        .toUpperCase()
        .replace(/\s/g, '')
        .replace(/[^A-Z0-9]/g, '');

      const route = routes.find(r =>
        r.licensePlates.some(p => {
          const pName = p.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
          return pName === normalizedFilter;
        })
      );

      if (route) {
        const plateSet = new Set(route.licensePlates.map(p =>
          p.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '')
        ));
        filteredTrucks = trucks.filter(t => {
          const tName = t.name.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
          return plateSet.has(tName);
        });
      }
    }

    filteredTrucks.forEach((truck) => {
      if (!truck.position) return;

      const vel = truck.position.vel;
      const statusColor = getStatusColor(vel, truck.lastUpdate);
      const truckType = getTruckType(truck.name);
      const isSelected = selectedTruck?.uid === truck.uid;

      const destinationInfo = truck.destination ? `
        <div style="font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 4px; margin-top: 4px;">
          🎯 ${truck.destination}
        </div>
      ` : '';

      const placemark = new ymaps.Placemark(
        [truck.position.lat, truck.position.lng],
        {
          iconContent: buildTruckBadgeHtml(statusColor, isSelected),
          balloonContent: `
            <div style="padding: 8px; min-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                ${getTruckTypeEmoji(truckType)}
                ${truck.name}
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px; font-size: 14px;">
                <div>${getStatusLabel(vel, truck.lastUpdate)}</div>
                <div>⚡ ${vel} км/ч</div>
                <div>🕐 ${new Date(truck.position.time * 1000).toLocaleString()}</div>
                <div style="font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 4px; margin-top: 4px;">
                  🏷️ ${getTruckTypeLabel(truckType)}
                </div>
                ${destinationInfo}
              </div>
            </div>
          `,
        },
        {
          iconLayout: 'default#imageWithContent',
          iconContentOffset: isSelected ? [-20, -20] : [-15, -15],
        }
      );

      placemark.events.add('click', () => {
        setSelectedTruck(truck);
        if (onTruckSelect) {
          onTruckSelect(truck);
        }
      });

      map.geoObjects.add(placemark);
      placemarksRef.current[truck.uid] = placemark;
    });
  }, [trucks, selectedTruck, isMapReady, onTruckSelect, filterPlate, routes]);

  // ============================================
  // ЭФФЕКТЫ ДЛЯ МАРШРУТОВ
  // ============================================

  useEffect(() => {
    if (isMapReady && routes && routes.length > 0) {
      drawRoutes();
    }
  }, [routes, isMapReady, drawRoutes]);

  // ============================================
  // АВТО-МАСШТАБ: завод + вся колонна + destination — одним взглядом
  // ============================================
  // Раньше карта либо центрировалась на первой попавшейся машине с
  // фиксированным zoom, либо вообще оставалась на дефолтном виде Москвы —
  // нужно было вручную скроллить/зумить, чтобы увидеть и завод, и точку
  // назначения. Теперь считаем bounding box по всем точкам, которые сейчас
  // реально показаны на карте, и просим карту сама подобрать масштаб.

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !routes || routes.length === 0) return;

    const points: [number, number][] = [];

    routes.forEach((route) => {
      if (route.factoryCoords) points.push([route.factoryCoords.lat, route.factoryCoords.lng]);
      if (route.destCoords) points.push([route.destCoords.lat, route.destCoords.lng]);
    });

    const relevantPlates = new Set(
      routes.flatMap(r => r.licensePlates.map(p => p.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '')))
    );
    trucks.forEach((t) => {
      if (!t.position) return;
      const tName = t.name.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
      if (relevantPlates.size === 0 || relevantPlates.has(tName)) {
        points.push([t.position.lat, t.position.lng]);
      }
    });

    const bounds = computeBounds(points);
    if (!bounds) return;

    const [[minLat, minLng], [maxLat, maxLng]] = bounds;
    const degenerate = Math.abs(maxLat - minLat) < 0.0005 && Math.abs(maxLng - minLng) < 0.0005;

    // Небольшая задержка — даём multiRoute-линиям и меткам успеть встать
    // на карту, чтобы zoomMargin считался от актуального набора объектов.
    const t = setTimeout(() => {
      if (!mapRef.current) return;
      if (degenerate) {
        mapRef.current.setCenter([minLat, minLng], 13);
      } else {
        mapRef.current.setBounds(bounds, { checkZoomRange: true, zoomMargin: 56, duration: 300 });
      }
    }, 350);

    return () => clearTimeout(t);
  }, [routes, trucks, isMapReady]);

  // ============================================
  // ВРЕМЯ ДО ПРИБЫТИЯ ДЛЯ ВЕДУЩЕЙ МАШИНЫ КОЛОННЫ (формула — без изменений)
  // ============================================

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !routes || routes.length === 0) return;

    if (routes.length === 1) {
      const route = routes[0];

      const firstPlate = route.licensePlates?.[0];
      if (!firstPlate) return;

      const normalizedFirstPlate = firstPlate.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');

      const matchingTrucks = trucks.filter(t => {
        const tName = t.name.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
        return tName === normalizedFirstPlate && t.position;
      });

      matchingTrucks.sort((a, b) => (a.position?.time || 0) - (b.position?.time || 0));
      const firstTruck = matchingTrucks[0];

      if (!firstTruck?.position || !route.destCoords) return;

      const truckPos = firstTruck.position;
      const destCoords = route.destCoords;

      getRouteTime(truckPos.lat, truckPos.lng, destCoords.lat, destCoords.lng).then(routeInfo => {
        if (routeInfo && mapRef.current) {
          const ymaps = window.ymaps;
          if (!ymaps) return;

          if (window._routeTimePlacemark) {
            mapRef.current.geoObjects.remove(window._routeTimePlacemark);
          }

          const placemark = new ymaps.Placemark(
            [truckPos.lat, truckPos.lng],
            {
              iconContent: `
                <div style="
                  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
                  color: #fff;
                  padding: 9px 15px;
                  border-radius: 13px;
                  font-size: 13px;
                  font-weight: 700;
                  border: 1.5px solid rgba(255,217,61,0.5);
                  box-shadow: 0 6px 20px rgba(0,0,0,0.35);
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  text-align: center;
                  min-width: 120px;
                ">
                  <div style="color:#ffd93d;">⏱ ${routeInfo.durationFormatted}</div>
                  <div style="font-size: 11px; color: #9090b0; font-weight:500; margin-top:2px;">до места · ${routeInfo.distance} км</div>
                </div>
              `,
            },
            {
              iconLayout: 'default#imageWithContent',
              iconContentOffset: [0, -56],
            }
          );

          mapRef.current.geoObjects.add(placemark);
          window._routeTimePlacemark = placemark;
        }
      });
    }
  }, [routes, isMapReady, trucks]);

  // ============================================
  // ПЕРЕДАЧА КАРТЫ В РОДИТЕЛЬСКИЙ КОМПОНЕНТ
  // ============================================

  useEffect(() => {
    if (onMapReady && mapRef.current) {
      onMapReady(mapRef.current);
    }
  }, [isMapReady, onMapReady]);

  // ============================================
  // РЕНДЕР
  // ============================================

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {selectedTruck && selectedTruck.position && (
        <div style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(12px)',
          padding: '16px 24px',
          borderRadius: 16,
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.08)',
          minWidth: 280,
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <TruckIconLucide size={18} strokeWidth={2.2} />
            {selectedTruck.name}
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap', fontSize: 14 }}>
            <span>{renderStatusBadge(selectedTruck.position.vel, selectedTruck.lastUpdate)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Zap size={13} strokeWidth={2.2} />{selectedTruck.position.vel} км/ч</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={13} strokeWidth={2.2} />{new Date(selectedTruck.position.time * 1000).toLocaleTimeString()}</span>
          </div>
          {selectedTruck.destination && (
            <div style={{ fontSize: 14, color: '#ffd93d', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Target size={13} strokeWidth={2.2} />{selectedTruck.destination}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <MapPin size={11} strokeWidth={2.2} />{selectedTruck.position.lat.toFixed(6)}, {selectedTruck.position.lng.toFixed(6)}
          </div>
        </div>
      )}

      {mapError && (
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
          background: 'rgba(220,38,38,0.95)', color: '#fff', padding: '8px 14px',
          borderRadius: 10, fontSize: 13, textAlign: 'center',
        }}>
          {mapError}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 12,
          background: '#e8e8e8',
          minHeight: '400px',
        }}
      />
    </div>
  );
}
