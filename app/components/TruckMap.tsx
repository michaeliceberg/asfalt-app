// app/components/TruckMap.tsx
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getStatusColor } from '@/lib/truck-icons';
import { getFactoryColor, getFactoryCoords } from '@/lib/constants';
import type { YandexMap, YandexPlacemark } from '@/lib/yandex-maps-types';
import { Truck as TruckIconLucide, Zap, Target, Phone, X } from 'lucide-react';

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
  // Водитель/тоннаж — теперь подтягиваются в /api/trucks из самой свежей
  // отгрузки этого госномера (см. plateToLatestShipment там), поэтому могут
  // быть null (отгрузок ещё не было). Телефон водителя пока не хранится
  // нигде в 1С-фиде — заполняется только в демо.
  driver?: string | null;
  driverPhone?: string;
  quantity?: number | null;
  // Прибыла ли машина (см. shipments.arrived, calc-distances.ts) — на
  // основе той же самой последней отгрузки по госномеру. Используется для
  // мини-значка статуса рядом с машинкой (бегущий человечек / флаг финиша).
  arrived?: boolean;
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

// Весовые рамки — см. /admin/weigh-stations. Загружаются с /api/weigh-stations
// (публичный read-only эндпоинт, без requireAdmin — карта GPS доступна не
// только админам) и рисуются на карте, если showWeighStations=true.
interface WeighStationRoad {
  id: number;
  name: string | null;
  points: { lat: number; lng: number }[];
}

interface WeighStationData {
  id: number;
  name: string;
  lat: number;
  lng: number;
  roads: WeighStationRoad[];
}

interface TruckMapProps {
  trucks: Truck[];
  routes?: Route[];
  onTruckSelect?: (truck: Truck) => void;
  onMapReady?: (map: YandexMap) => void;
  // Раньше сужали карту до одной заявки по госномеру (filterPlate) — но
  // одна и та же машина за день может отработать НЕСКОЛЬКО разных заявок,
  // и её госномер попадает в licensePlates сразу нескольких routes. Из-за
  // этого при выборе одной заявки на карте/в чипах-селекторе иногда
  // подсвечивались/фильтровались сразу две. requestNumber — ключ, по
  // которому строятся сами routes (см. /api/truck-routes), уникален на
  // маршрут, поэтому однозначно определяет ровно одну заявку.
  filterRequestNumber?: string | null;
  // Рисовать ли весовые рамки и запретные дороги к ним (см. /admin/weigh-stations).
  // По умолчанию выключено — например, DemoTruckColonna не должен светить
  // реальную инфраструктуру безопасности в публичном демо.
  showWeighStations?: boolean;
}

declare global {
  interface Window {
    _routeTimePlacemark?: unknown;
  }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// Цветной кружок + текст статуса — для JSX-карточки выбранной машины
// (HTML-балун Яндекса больше не используется, вся инфа теперь только тут).
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

// Мини-значок статуса рядом с машинкой: "в пути" (бегущий человечек) либо
// "прибыл" (флаг финиша) — см. selectedTruck.arrived. Цвет заливки задаётся
// снаружи через currentColor у обёртки, поэтому сам SVG использует
// currentColor вместо жёстко зашитого цвета.
const RUNNING_GLYPH = `
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="15.5" cy="4.8" r="2.2" fill="currentColor"/>
    <path d="M13 8l3 2.3-1 4.4M16.3 10.3l3 1.6M13 8l-4 1.2 1 3.8-3 5M9 9.2l-2.2 2.8 3 2.2"
      stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

const FINISH_GLYPH = `
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 2.5v19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M6 4h12l-2.4 3L18 10H6V4Z" fill="currentColor"/>
    <path d="M8.2 4v2h2V4h-2Zm3.8 0v2h2V4h-2ZM8.2 7.6v2.1h2V7.6h-2Zm3.8 0v2.1h2V7.6h-2Z" fill="#fff"/>
  </svg>
`;

// Короткий номер для подписи у машинки: убираем код региона (2-3 цифры в
// конце), чтобы не занимать место на карте — по просьбе пользователя,
// регион не нужен, важно видеть только сам номер. Формат российского
// госномера: буква + 3 цифры + 2 буквы (+ опционально регион), например
// "Е100ВК150" → "Е100ВК". Если номер не совпал с этим паттерном (нестандартный
// формат/иностранный борт), возвращаем как есть — лучше показать полностью,
// чем обрезать неправильно.
function shortPlate(name: string): string {
  const clean = name.toUpperCase().replace(/\s/g, '');
  const match = clean.match(/^([A-ZА-Я]\d{3}[A-ZА-Я]{2})\d{0,3}$/);
  return match ? match[1] : clean;
}

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

// Все бейджи ниже — корневой div ставится в position:absolute;left:0;top:0
// и центруется через transform: translate(-50%,-50%). Это нужно потому что
// раньше метки рисовались через iconLayout: 'default#imageWithContent' —
// пресет Яндекса, который ВСЕГДА подкладывает под контент свою стандартную
// иконку (синяя "капелька"), а iconContentOffset лишь придвигал наш HTML
// рядом с ней, а не поверх — отсюда были "две метки рядом". Теперь метки —
// полностью кастомный ymaps.templateLayoutFactory-макет (см. ниже), без
// какой-либо дефолтной формы под низом, поэтому сами следим за центровкой.

// name/arrived — новое: короткая плашка с госномером под машинкой (без
// региона, чтобы не занимать место — см. shortPlate) и мини-значок статуса
// (бегущий человечек / флаг финиша). ВАЖНО: оба добавления — position:
// absolute внутри контейнера, у которого явно заданы width/height=size —
// поэтому они рисуются "поверх границ" контейнера, не увеличивая его
// собственный размер. Это критично для клика: getShape (см. ниже, в месте
// создания placemark) считает область клика кругом радиуса size/2 с центром
// в (0,0), что совпадает с центром контейнера ПОСЛЕ transform:translate(-50%,
// -50%) только если размер контейнера не менялся — иначе клик снова "мимо".
function buildTruckBadgeHtml(name: string, color: string, selected: boolean, arrived: boolean): string {
  const size = selected ? 40 : 30;
  const ring = selected
    ? `<div class="truck-badge-pulse" style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};"></div>`
    : '';
  const statusColor = arrived ? '#16a34a' : '#3a56d4';
  const statusGlyph = arrived ? FINISH_GLYPH : RUNNING_GLYPH;
  const plate = shortPlate(name);
  return `
    <div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:${size}px;height:${size}px;">
      ${ring}
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};
        border:2.5px solid #fff;
        box-shadow:0 3px 10px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      ">${TRUCK_GLYPH}</div>
      <div style="
        position:absolute;top:-3px;right:-3px;
        width:15px;height:15px;border-radius:50%;
        background:#fff;color:${statusColor};
        border:1.5px solid ${statusColor};
        box-shadow:0 1px 4px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      ">${statusGlyph}</div>
      <div style="
        position:absolute;top:100%;left:50%;
        transform:translateX(-50%);
        margin-top:3px;
        background:rgba(15,15,26,0.88);
        color:#fff;
        padding:1.5px 6px;
        border-radius:6px;
        font-size:10px;
        font-weight:700;
        white-space:nowrap;
        letter-spacing:0.2px;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">${plate}</div>
    </div>
  `;
}

function buildFactoryBadgeHtml(name: string): string {
  return `
    <div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);">
      <div style="
        width:38px;height:38px;border-radius:50%;
        background:linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        border:3px solid #fff;
        box-shadow:0 4px 14px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      ">${FACTORY_GLYPH}</div>
      <div style="
        position:absolute;top:100%;left:50%;
        transform:translateX(-50%);
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
    <div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);">
      <div style="
        width:34px;height:34px;border-radius:50%;
        background:${color};
        border:3px solid #fff;
        box-shadow:0 4px 14px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
      ">${DEST_GLYPH}</div>
      <div style="
        position:absolute;top:100%;left:50%;
        transform:translateX(-50%);
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

const WEIGH_STATION_GLYPH = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3 2 20h20L12 3Z" stroke="#ffffff" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M12 10v4" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round"/>
    <circle cx="12" cy="17" r="1" fill="#ffffff"/>
  </svg>
`;

// Весовая рамка — предупреждающий (красный) бейдж, визуально явно отличный
// от заводов/точек назначения: это не часть маршрута, а зона, куда грузовику
// с превышением ЗАПРЕЩЕНО заезжать (штраф 200 000 ₽).
function buildWeighStationBadgeHtml(name: string): string {
  return `
    <div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);">
      <div style="
        width:34px;height:34px;border-radius:50%;
        background:#dc2626;
        border:3px solid #fff;
        box-shadow:0 4px 14px rgba(220,38,38,0.45);
        display:flex;align-items:center;justify-content:center;
      ">${WEIGH_STATION_GLYPH}</div>
      <div style="
        position:absolute;top:100%;left:50%;
        transform:translateX(-50%);
        margin-top:5px;
        background:#dc2626;
        color:#fff;
        padding:3px 11px;
        border-radius:8px;
        font-size:11px;
        font-weight:700;
        white-space:nowrap;
        letter-spacing:0.2px;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
        border:1px solid rgba(255,255,255,0.4);
        font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">⚠ ВЕСОВАЯ · ${name}</div>
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

export default function TruckMap({ trucks, routes = [], onTruckSelect, onMapReady, filterRequestNumber, showWeighStations = false }: TruckMapProps) {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [weighStations, setWeighStations] = useState<WeighStationData[]>([]);

  const mapRef = useRef<YandexMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);
  const placemarksRef = useRef<Record<string, YandexPlacemark>>({});
  const routesRef = useRef<Record<string, unknown>>({});
  const factoryMarksRef = useRef<unknown[]>([]);
  const weighStationMarksRef = useRef<unknown[]>([]);
  const isMapReadyRef = useRef(false);
  const isScriptLoadingRef = useRef(false);
  const initMapCalledRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // ФИЛЬТРАЦИЯ ДО ОДНОГО МАРШРУТА (если пришли из конкретной заявки)
  // ============================================
  // Раньше сужали до ОДНОГО маршрута по госномеру (filterPlate) — но
  // requestNumber уникален на маршрут (ключ группировки в
  // /api/truck-routes), а госномер — нет: одна машина может отработать
  // за день несколько разных заявок, и её плейт попадёт в licensePlates
  // сразу нескольких routes, из-за чего "сужение" ловило лишний маршрут.
  // filterRequestNumber однозначен — просто ищем route с таким же id.
  const filteredRoutes = useMemo(() => {
    if (!filterRequestNumber) return routes;
    const route = routes.find((r) => r.requestNumber === filterRequestNumber);
    return route ? [route] : routes;
  }, [routes, filterRequestNumber]);

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
    filteredRoutes.forEach((route) => {
      if (seen.has(route.factory)) return;
      seen.add(route.factory);

      const coords = route.factoryCoords || getFactoryCoords(route.factory);
      if (!coords) return;

      const placemark = new ymaps.Placemark(
        [coords.lat, coords.lng],
        {},
        { iconLayout: ymaps.templateLayoutFactory.createClass(buildFactoryBadgeHtml(coords.name || route.factory)) }
      );
      map.geoObjects.add(placemark);
      factoryMarksRef.current.push(placemark);
    });
  }, [isMapReady, filteredRoutes]);

  // ============================================
  // ОТРИСОВКА МАРШРУТОВ — плавная кривая завод → destination (бесплатно,
  // без платного Router API — см. комментарий у buildRouteCurvePoints)
  // ============================================

  const drawRoutes = useCallback(() => {
    if (!isMapReady || !mapRef.current || !window.ymaps || !filteredRoutes || filteredRoutes.length === 0) {
      return;
    }

    const map = mapRef.current;
    const ymaps = window.ymaps;

    Object.values(routesRef.current).forEach((obj) => {
      map.geoObjects.remove(obj);
    });
    routesRef.current = {};

    filteredRoutes.forEach((route) => {
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
        {},
        { iconLayout: ymaps.templateLayoutFactory.createClass(buildDestinationBadgeHtml(route.destination, route.count, color)) }
      );
      map.geoObjects.add(destPlacemark);
      routesRef.current[route.destination + '_dest'] = destPlacemark;
    });

    drawFactories();
  }, [filteredRoutes, isMapReady, drawFactories]);

  // ============================================
  // ВЕСОВЫЕ РАМКИ И ЗАПРЕТНЫЕ ДОРОГИ (см. /admin/weigh-stations)
  // ============================================
  // Загружаются с публичного /api/weigh-stations один раз при монтировании
  // (если showWeighStations включён) — новые рамки/дороги, добавленные в
  // админке, появятся на карте сами при следующей загрузке страницы, без
  // изменений кода. Рисуются отдельным слоем, поверх заводов/маршрутов:
  // красные пунктирные линии дорог + красный предупреждающий бейдж станции.

  useEffect(() => {
    if (!showWeighStations) return;

    let cancelled = false;
    fetch('/api/weigh-stations')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.stations)) {
          setWeighStations(data.stations);
        }
      })
      .catch((err) => console.error('❌ Error loading weigh stations:', err));

    return () => { cancelled = true; };
  }, [showWeighStations]);

  const drawWeighStations = useCallback(() => {
    if (!isMapReady || !mapRef.current || !window.ymaps) return;

    const map = mapRef.current;
    const ymaps = window.ymaps;

    weighStationMarksRef.current.forEach((mark) => map.geoObjects.remove(mark));
    weighStationMarksRef.current = [];

    if (!showWeighStations) return;

    weighStations.forEach((station) => {
      station.roads.forEach((road) => {
        const coords: [number, number][] = road.points.map((p) => [p.lat, p.lng]);

        // Свечение под линией дороги — та же техника, что у маршрутных линий,
        // но красное и с пунктиром, чтобы явно читаться как "опасная зона".
        const glowLine = new ymaps.Polyline(
          coords,
          {},
          { strokeColor: '#dc2626', strokeWidth: 12, strokeOpacity: 0.18 }
        );
        map.geoObjects.add(glowLine);
        weighStationMarksRef.current.push(glowLine);

        const roadLine = new ymaps.Polyline(
          coords,
          {},
          { strokeColor: '#dc2626', strokeWidth: 4, strokeOpacity: 0.85, strokeStyle: 'shortdash' }
        );
        map.geoObjects.add(roadLine);
        weighStationMarksRef.current.push(roadLine);
      });

      const stationPlacemark = new ymaps.Placemark(
        [station.lat, station.lng],
        {},
        { iconLayout: ymaps.templateLayoutFactory.createClass(buildWeighStationBadgeHtml(station.name)) }
      );
      map.geoObjects.add(stationPlacemark);
      weighStationMarksRef.current.push(stationPlacemark);
    });
  }, [isMapReady, showWeighStations, weighStations]);

  useEffect(() => {
    drawWeighStations();
  }, [drawWeighStations]);

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

  // initMap пересоздаётся при каждом обновлении trucks/routes (позиции машин
  // тикают каждые несколько секунд). Раньше эффект загрузки скрипта ниже
  // зависел прямо от initMap ([initMap]) — а значит, при КАЖДОМ тике эффект
  // "перезапускался": срабатывал cleanup (map.geoObjects.removeAll(),
  // isMapReady=false, mapRef=null), а следом карта пересоздавалась заново.
  // Именно из-за этого при первом заходе на вкладку GPS ничего не успевало
  // нарисоваться (пересоздание обрывало отрисовку на полпути), а после
  // переключения на другую вкладку и обратно — уже успевало устояться.
  // Держим последнюю версию initMap в ref и вызываем эффект только один раз.
  const initMapRef = useRef(initMap);
  useEffect(() => {
    initMapRef.current = initMap;
  }, [initMap]);

  // ============================================
  // ЗАГРУЗКА API ЯНДЕКС КАРТ (запускается один раз при монтировании)
  // ============================================

  useEffect(() => {
    if (window.ymaps) {
      if (!mapRef.current && !initMapCalledRef.current) {
        initMapRef.current();
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
            initMapRef.current();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // намеренно один раз при монтировании — см. комментарий выше про initMapRef

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

    // filteredRoutes уже сужен до одного маршрута, если задан
    // filterRequestNumber (см. useMemo выше) — здесь просто берём машины
    // из его licensePlates, без повторного поиска маршрута по номеру.
    let filteredTrucks = trucks;
    if (filterRequestNumber) {
      const plateSet = new Set(
        filteredRoutes.flatMap((r) => r.licensePlates.map((p) => p.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '')))
      );
      filteredTrucks = trucks.filter((t) => {
        const tName = t.name.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
        return plateSet.has(tName);
      });
    }

    filteredTrucks.forEach((truck) => {
      if (!truck.position) return;

      const vel = truck.position.vel;
      const statusColor = getStatusColor(vel, truck.lastUpdate);
      const isSelected = selectedTruck?.uid === truck.uid;

      // Раньше тут ещё был balloonContent (стандартный балун Яндекса) —
      // он открывался ПОВЕРХ нашей собственной карточки внизу карты (см.
      // selectedTruck-карточку в рендере), дублируя часть той же информации
      // (в частности время последнего обновления) — по фидбеку это и есть
      // "избыточная информация". Теперь вся инфа — только в компактной
      // карточке снизу, у placemark баллуна нет вообще (openBalloonOnClick:
      // false на всякий случай, если Яндекс попробует открыть пустой).
      const placemark = new ymaps.Placemark(
        [truck.position.lat, truck.position.lng],
        {},
        {
          openBalloonOnClick: false,
          // getShape ниже — это и есть исправление "нельзя нажать на машинку".
          // У кастомного HTML-макета (templateLayoutFactory) без явного
          // getShape область клика по умолчанию нулевая (0×0) — сам HTML
          // рисуется поверх через CSS transform:translate(-50%,-50%), но
          // Яндекс про этот transform ничего не знает и по-прежнему считает
          // область клика от НЕтрансформированного бокса макета. Поэтому
          // клик визуально "по машинке" на самом деле проваливался в слой
          // карты под меткой. Явно задаём круглую область клика того же
          // радиуса, что и сам бейдж, с центром в точке маркера (0,0) —
          // ровно туда, куда CSS-transform визуально ставит кружок.
          iconLayout: ymaps.templateLayoutFactory.createClass(buildTruckBadgeHtml(truck.name, statusColor, isSelected, !!truck.arrived), {
            getShape: function () {
              const r = (isSelected ? 40 : 30) / 2;
              return new ymaps.shape.Circle(new ymaps.geometry.pixel.Circle([0, 0], r));
            },
          }),
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
  }, [trucks, selectedTruck, isMapReady, onTruckSelect, filterRequestNumber, filteredRoutes]);

  // ============================================
  // ЭФФЕКТЫ ДЛЯ МАРШРУТОВ
  // ============================================

  useEffect(() => {
    if (isMapReady && filteredRoutes && filteredRoutes.length > 0) {
      drawRoutes();
    }
  }, [filteredRoutes, isMapReady, drawRoutes]);

  // ============================================
  // АВТО-МАСШТАБ: завод + вся колонна + destination — одним взглядом
  // ============================================
  // Раньше карта либо центрировалась на первой попавшейся машине с
  // фиксированным zoom, либо вообще оставалась на дефолтном виде Москвы —
  // нужно было вручную скроллить/зумить, чтобы увидеть и завод, и точку
  // назначения. Теперь считаем bounding box по всем точкам, которые сейчас
  // реально показаны на карте, и просим карту сама подобрать масштаб —
  // плавно (setBounds с duration ниже), на каждое обновление позиций машин,
  // чтобы колонна всегда была в кадре.
  //
  // Раньше это временно отключали (пересчитывали bounds только один раз на
  // маршрут), подозревая, что постоянный recenter мешает попасть тапом по
  // машинке — но настоящая причина немого клика была в другом (отсутствие
  // getShape у кастомной HTML-метки, см. ниже в placemark.events.add), и
  // это уже починено. Плавное автоцентрирование теперь безопасно вернуть.

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !filteredRoutes || filteredRoutes.length === 0) return;

    const points: [number, number][] = [];

    filteredRoutes.forEach((route) => {
      if (route.factoryCoords) points.push([route.factoryCoords.lat, route.factoryCoords.lng]);
      if (route.destCoords) points.push([route.destCoords.lat, route.destCoords.lng]);
    });

    const relevantPlates = new Set(
      filteredRoutes.flatMap(r => r.licensePlates.map(p => p.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '')))
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
  }, [filteredRoutes, trucks, isMapReady]);

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

          // Полупрозрачный фон (rgba + blur) — раньше карточка была полностью
          // непрозрачной и заслоняла кусок карты под собой.
          const etaHtml = `
            <div style="
              position:absolute;left:0;top:0;
              transform:translate(-50%, calc(-100% - 14px));
              background: linear-gradient(135deg, rgba(26,26,46,0.82) 0%, rgba(22,33,62,0.82) 50%, rgba(15,52,96,0.82) 100%);
              backdrop-filter: blur(6px);
              -webkit-backdrop-filter: blur(6px);
              color: #fff;
              padding: 9px 15px;
              border-radius: 13px;
              font-size: 13px;
              font-weight: 700;
              border: 1.5px solid rgba(255,217,61,0.5);
              box-shadow: 0 6px 20px rgba(0,0,0,0.3);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              min-width: 120px;
              white-space: nowrap;
            ">
              <div style="color:#ffd93d;">⏱ ${routeInfo.durationFormatted}</div>
              <div style="font-size: 11px; color: #cfd2e6; font-weight:500; margin-top:2px;">до места · ${routeInfo.distance} км</div>
            </div>
          `;

          const placemark = new ymaps.Placemark(
            [truckPos.lat, truckPos.lng],
            {},
            { iconLayout: ymaps.templateLayoutFactory.createClass(etaHtml) }
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
  // ЗАКРЫТИЕ КАРТОЧКИ ВЫБРАННОЙ МАШИНЫ ПО КЛИКУ МИМО
  // ============================================
  // Клик по метке машины отдельно ставит выбор (см. placemark.events.add
  // выше) — клик по "пустой" карте (сама карта не считает это кликом по
  // объекту) закрывает карточку. Плюс клик вообще где угодно за пределами
  // самой карточки на странице — на случай, если карта не занимает весь
  // экран и пользователь тапнет рядом с картой, а не по ней.

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;
    const map = mapRef.current;
    const handleMapClick = () => setSelectedTruck(null);
    map.events.add('click', handleMapClick);
  }, [isMapReady]);

  useEffect(() => {
    if (!selectedTruck) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (selectedCardRef.current && !selectedCardRef.current.contains(e.target as Node)) {
        setSelectedTruck(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [selectedTruck]);

  // ============================================
  // РЕНДЕР
  // ============================================

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {selectedTruck && selectedTruck.position && (
        <div
          ref={selectedCardRef}
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(12px)',
            padding: '12px 16px',
            borderRadius: 14,
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.08)',
            width: 240,
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <button
            onClick={() => setSelectedTruck(null)}
            aria-label="Закрыть"
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#aaa', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} strokeWidth={2.2} />
          </button>

          <div style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <TruckIconLucide size={16} strokeWidth={2.2} />
            {selectedTruck.name}
          </div>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap', fontSize: 13 }}>
            <span>{renderStatusBadge(selectedTruck.position.vel, selectedTruck.lastUpdate)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Zap size={12} strokeWidth={2.2} />{selectedTruck.position.vel} км/ч</span>
          </div>

          {selectedTruck.destination && (
            <div style={{ fontSize: 12.5, color: '#ffd93d', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Target size={12} strokeWidth={2.2} />{selectedTruck.destination}
            </div>
          )}

          {(selectedTruck.driver || selectedTruck.quantity) && (
            <div style={{ fontSize: 12.5, color: '#cfd2e6', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
              {selectedTruck.driver && <span>{selectedTruck.driver}</span>}
              {selectedTruck.quantity ? <span>· {selectedTruck.quantity} т</span> : null}
            </div>
          )}

          {selectedTruck.driverPhone && (
            <a
              href={`tel:${selectedTruck.driverPhone.replace(/[^\d+]/g, '')}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                marginTop: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                background: 'rgba(74,222,128,0.16)',
                color: '#4ade80',
                fontSize: 16,
                fontWeight: 700,
                padding: '9px 10px',
                borderRadius: 10,
                textDecoration: 'none',
              }}
            >
              <Phone size={16} strokeWidth={2.4} />{selectedTruck.driverPhone}
            </a>
          )}
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
