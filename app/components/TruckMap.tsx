// app/components/TruckMap.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getTruckType, getStatusColor } from '@/lib/truck-icons';
import { FACTORIES, FACTORY_COLORS, FactoryCode, getFactoryColor } from '@/lib/constants';
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

interface YandexMap {
  geoObjects: {
    add: (object: unknown) => void;
    remove: (object: unknown) => void;
    removeAll: () => void;
  };
  setCenter: (center: [number, number], zoom: number) => void;
  destroy: () => void;
}

interface YandexPlacemark {
  events: {
    add: (event: string, handler: () => void) => void;
  };
}

interface YandexMaps {
  Map: new (element: HTMLElement, options: unknown) => YandexMap;
  Placemark: new (
    coordinates: [number, number],
    properties: Record<string, string>,
    options: Record<string, unknown>
  ) => YandexPlacemark;
  Polyline: new (
    coordinates: [number, number][],
    properties: Record<string, string>,
    options: Record<string, unknown>
  ) => unknown;
  ready: (callback: () => void) => void;
}

declare global {
  interface Window {
    ymaps: YandexMaps | undefined;
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

// ============================================
// SVG-ИКОНКИ
// ============================================

const STROKE_COLOR = '#2d3748';

function getDumpTruckSVG(color: string): string {
  return `
    <svg width="36" height="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="28" rx="12" ry="2" fill="rgba(0,0,0,0.15)"/>
      <rect x="6" y="12" width="20" height="10" rx="2" fill="${color}" stroke="${STROKE_COLOR}" stroke-width="1.8"/>
      <rect x="4" y="14" width="6" height="6" rx="1" fill="${color}" stroke="${STROKE_COLOR}" stroke-width="1.8" opacity="0.85"/>
      <rect x="5" y="15" width="4" height="3" rx="0.5" fill="rgba(255,255,255,0.3)" stroke="${STROKE_COLOR}" stroke-width="0.5"/>
      <circle cx="10" cy="24" r="4" fill="#2d3748" stroke="${STROKE_COLOR}" stroke-width="1.5"/>
      <circle cx="22" cy="24" r="4" fill="#2d3748" stroke="${STROKE_COLOR}" stroke-width="1.5"/>
      <circle cx="10" cy="24" r="2" fill="#4a5568"/>
      <circle cx="22" cy="24" r="2" fill="#4a5568"/>
    </svg>
  `;
}

function getTipperSVG(color: string): string {
  return `
    <svg width="36" height="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="28" rx="12" ry="2" fill="rgba(0,0,0,0.15)"/>
      <polygon points="6,14 26,14 22,22 10,22" fill="${color}" stroke="${STROKE_COLOR}" stroke-width="1.8"/>
      <rect x="4" y="16" width="6" height="4" rx="1" fill="${color}" stroke="${STROKE_COLOR}" stroke-width="1.8" opacity="0.85"/>
      <rect x="5" y="17" width="4" height="2" rx="0.5" fill="rgba(255,255,255,0.3)" stroke="${STROKE_COLOR}" stroke-width="0.5"/>
      <circle cx="10" cy="24" r="4" fill="#2d3748" stroke="${STROKE_COLOR}" stroke-width="1.5"/>
      <circle cx="22" cy="24" r="4" fill="#2d3748" stroke="${STROKE_COLOR}" stroke-width="1.5"/>
      <circle cx="10" cy="24" r="2" fill="#4a5568"/>
      <circle cx="22" cy="24" r="2" fill="#4a5568"/>
    </svg>
  `;
}

function getMixerSVG(color: string): string {
  return `
    <svg width="36" height="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="28" rx="12" ry="2" fill="rgba(0,0,0,0.15)"/>
      <rect x="4" y="12" width="8" height="6" rx="2" fill="${color}" stroke="${STROKE_COLOR}" stroke-width="1.8"/>
      <rect x="5" y="13" width="6" height="3" rx="0.5" fill="rgba(255,255,255,0.3)" stroke="${STROKE_COLOR}" stroke-width="0.5"/>
      <ellipse cx="20" cy="14" rx="8" ry="6" fill="${color}" stroke="${STROKE_COLOR}" stroke-width="1.8"/>
      <line x1="14" y1="12" x2="22" y2="16" stroke="${STROKE_COLOR}" stroke-width="1.5" opacity="0.6"/>
      <line x1="14" y1="16" x2="22" y2="12" stroke="${STROKE_COLOR}" stroke-width="1.5" opacity="0.6"/>
      <circle cx="10" cy="22" r="4" fill="#2d3748" stroke="${STROKE_COLOR}" stroke-width="1.5"/>
      <circle cx="22" cy="22" r="4" fill="#2d3748" stroke="${STROKE_COLOR}" stroke-width="1.5"/>
      <circle cx="10" cy="22" r="2" fill="#4a5568"/>
      <circle cx="22" cy="22" r="2" fill="#4a5568"/>
    </svg>
  `;
}

function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function getTruckIcon(type: string, color: string): string {
  switch (type) {
    case 'tipper':
      return svgToDataUrl(getTipperSVG(color));
    case 'mixer':
      return svgToDataUrl(getMixerSVG(color));
    default:
      return svgToDataUrl(getDumpTruckSVG(color));
  }
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
  const isMapReadyRef = useRef(false);
  const isScriptLoadingRef = useRef(false);
  const initMapCalledRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // РАСЧЁТ ВРЕМЕНИ МАРШРУТА
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
// ОТРИСОВКА ЗАВОДОВ (без круга, только плашки)
// ============================================

const drawFactories = useCallback(() => {
  if (!isMapReady || !mapRef.current || !window.ymaps) return;
  
  const map = mapRef.current;
  const ymaps = window.ymaps;
  
  const factories = [
    { 
      lat: 54.961524, 
      lng: 38.839336, 
      color: '#166534', 
      fullName: 'Завод Луховицы',
    },
    { 
      lat: 55.702066, 
      lng: 37.995442, 
      color: '#1d4ed8', 
      fullName: 'Завод Люберцы',
    },
    { 
      lat: 56.363355, 
      lng: 38.175478, 
      color: '#ca8a04', 
      fullName: 'Завод Сергиев Посад',
    },
    { 
      lat: 55.917957, 
      lng: 38.027629, 
      color: '#b91c1c', 
      fullName: 'Завод Щёлково',
    },
  ];
  
  factories.forEach((factory) => {
    // Плашка с названием завода
    const labelPlacemark = new ymaps.Placemark(
      [factory.lat, factory.lng],
      {
        iconContent: `
          <div style="
            background: ${factory.color};
            color: #fff;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 16px;
            font-weight: 700;
            border: 3px solid #fff;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            white-space: nowrap;
            text-align: center;
            letter-spacing: 0.5px;
            text-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            🏭 ${factory.fullName}
          </div>
        `,
      },
      {
        iconLayout: 'default#imageWithContent',
        iconContentOffset: [0, -20],
      }
    );
    map.geoObjects.add(labelPlacemark);
  });
}, [isMapReady]);











  // ============================================
  // ОТРИСОВКА МАРШРУТОВ
  // ============================================

  const drawRoutes = useCallback(() => {
    console.log('🔵 🔵 🔵 drawRoutes CALLED');
    console.log('🔵 routes length:', routes?.length);
    console.log('🔵 isMapReady:', isMapReady);
    console.log('🔵 mapRef:', !!mapRef.current);
    console.log('🔵 ymaps:', !!window.ymaps);
    
    if (!isMapReady || !mapRef.current || !window.ymaps || !routes || routes.length === 0) {
      console.log('🔵 ❌ SKIP - conditions not met');
      return;
    }

    const map = mapRef.current;
    const ymaps = window.ymaps;

    console.log('🔵 Removing old routes...');
    Object.values(routesRef.current).forEach((route) => {
      map.geoObjects.remove(route);
    });
    routesRef.current = {};

    let routesAdded = 0;

    routes.forEach((route) => {
      if (!route.destCoords || !route.factoryCoords) {
        console.log('🔵 ⚠️ Skipping route - no coordinates:', route.destination);
        return;
      }

      const color = getFactoryColor(route.factory) || '#4ade80';
      console.log('🔵 Drawing route:', route.destination, 'color:', color);
      routesAdded++;

      // Линия маршрута
      const routeLine = new ymaps.Polyline(
        [
          [route.factoryCoords.lat, route.factoryCoords.lng],
          [route.destCoords.lat, route.destCoords.lng],
        ],
        {
          balloonContent: `
            <div style="padding: 12px; min-width: 200px; color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
              <div style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">🎯 ${route.destination}</div>
              <div style="display: flex; flex-direction: column; gap: 3px; color: #4a5568;">
                <div>🚛 Машин: <strong style="color: #1a1a2e;">${route.count}</strong></div>
                <div>🏭 Завод: <strong style="color: #1a1a2e;">${route.factory}</strong></div>
                <div>📊 Всего: <strong style="color: #1a1a2e;">${Number(route.totalQuantity).toFixed(1)} т</strong></div>
              </div>
            </div>
          `,
        },
        {
          strokeColor: color,
          strokeWidth: 3,
          strokeOpacity: 0.5,
          strokeStyle: 'solid',
        }
      );

      map.geoObjects.add(routeLine);
      routesRef.current[route.destination] = routeLine;

      // 📍 ТОЧКА НАЗНАЧЕНИЯ
      const destPlacemark = new ymaps.Placemark(
        [route.destCoords.lat, route.destCoords.lng],
        {
          iconContent: `
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 2px;
            ">
              <div style="
                width: 16px;
                height: 16px;
                background: ${color};
                border-radius: 50%;
                border: 3px solid #fff;
                box-shadow: 0 2px 12px rgba(0,0,0,0.3);
              "></div>
              <div style="
                background: rgba(0,0,0,0.8);
                color: #fff;
                padding: 2px 10px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 600;
                white-space: nowrap;
                border: 1px solid ${color};
              ">
                🎯 ${route.destination.replace('ПК 25 ', '').replace('ПК 26 ', '').replace('АЙСБЕРГ ООО', 'АЙСБЕРГ')}
              </div>
            </div>
          `,
        },
        {
          iconLayout: 'default#imageWithContent',
          iconContentOffset: [0, -25],
        }
      );

      map.geoObjects.add(destPlacemark);

      // 📍 ТОЧКА с количеством машин на середине маршрута
      const midLat = (route.factoryCoords.lat + route.destCoords.lat) / 2;
      const midLng = (route.factoryCoords.lng + route.destCoords.lng) / 2;
      
      const offsetLat = (route.destCoords.lat - route.factoryCoords.lat) * 0.05;
      const offsetLng = (route.destCoords.lng - route.factoryCoords.lng) * 0.05;
      
      const labelPlacemark = new ymaps.Placemark(
        [midLat + offsetLat, midLng + offsetLng],
        {
          iconContent: `
            <div style="
              background: ${color};
              color: #fff;
              font-size: 11px;
              font-weight: 700;
              padding: 4px 10px;
              border-radius: 12px;
              border: 2px solid #fff;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              white-space: nowrap;
              pointer-events: none;
            ">
              ${route.count} 🚛
            </div>
          `,
        },
        {
          iconLayout: 'default#imageWithContent',
          iconContentOffset: [0, 0],
        }
      );

      map.geoObjects.add(labelPlacemark);
      routesRef.current[route.destination + '_label'] = labelPlacemark;
    });

    console.log('🔵 ✅ Routes added:', routesAdded, 'out of', routes.length);

    // Рисуем заводы
    drawFactories();

  }, [routes, isMapReady, drawFactories]);

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ КАРТЫ
  // ============================================

  const initMap = useCallback(() => {
    console.log('🔵 initMap called');
    
    if (!containerRef.current) {
      console.log('🔵 ❌ containerRef is null');
      return;
    }
    
    if (mapRef.current) {
      console.log('🔵 ❌ map already exists');
      return;
    }
    
    if (!window.ymaps) {
      console.log('🔵 ❌ ymaps is null');
      setMapError('API Яндекс Карт не загружен');
      return;
    }

    try {
      const ymaps = window.ymaps;
      console.log('🔵 Creating map...');
      
      const map = new ymaps.Map(containerRef.current, {
        center: [55.76, 37.64],
        zoom: 10,
        controls: ['zoomControl', 'fullscreenControl'],
      });

      console.log('🔵 Map created successfully');
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
        console.log('🔵 Drawing routes after map init, count:', routes.length);
        setTimeout(() => {
          drawRoutes();
        }, 100);
      }
    } catch (err) {
      console.error('🔵 ❌ Error initializing map:', err);
      setMapError('Ошибка инициализации карты');
    }
  }, [trucks, routes, drawRoutes]);

  // ============================================
  // ЗАГРУЗКА API ЯНДЕКС КАРТ
  // ============================================

  useEffect(() => {
    console.log('🔵 useEffect - checking ymaps');
    
    if (window.ymaps) {
      console.log('🔵 ymaps already loaded');
      if (!mapRef.current && !initMapCalledRef.current) {
        initMap();
      }
      return;
    }

    if (isScriptLoadingRef.current) return;
    isScriptLoadingRef.current = true;

    console.log('🔵 Loading Yandex Maps API script...');
    
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || ''}&lang=ru_RU`;
    script.async = true;
    
    script.onload = () => {
      console.log('🔵 Script loaded');
      if (window.ymaps) {
        window.ymaps.ready(() => {
          console.log('🔵 ymaps ready');
          if (!mapRef.current && !initMapCalledRef.current) {
            initMap();
          }
        });
      } else {
        console.error('🔵 ❌ ymaps not available after script load');
        setMapError('API Яндекс Карт не загрузился');
        isScriptLoadingRef.current = false;
      }
    };
    
    script.onerror = () => {
      console.error('🔵 ❌ Failed to load Yandex Maps API');
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
        } catch (e) {
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
    console.log('🔵 Marker update effect - trucks:', trucks.length, 'isMapReady:', isMapReady);
    
    if (!isMapReady || !mapRef.current || !window.ymaps) {
      console.log('🔵 Skipping marker update - map not ready');
      return;
    }

    if (trucks.length === 0) {
      console.log('🔵 No trucks to display');
      return;
    }

    const map = mapRef.current;
    const ymaps = window.ymaps;

    // Удаляем старые маркеры
    Object.values(placemarksRef.current).forEach((placemark) => {
      map.geoObjects.remove(placemark);
    });
    placemarksRef.current = {};

    // ✅ Фильтруем машины по номеру колонны (если задан filterPlate)
    let filteredTrucks = trucks;
    if (filterPlate) {
      const normalizedFilter = filterPlate
        .toUpperCase()
        .replace(/\s/g, '')
        .replace(/[^A-Z0-9]/g, '');
      
      // Находим маршрут, который содержит эту машину
      const route = routes.find(r => 
        r.licensePlates.some(p => {
          const pName = p
            .toUpperCase()
            .replace(/\s/g, '')
            .replace(/[^A-Z0-9]/g, '');
          return pName === normalizedFilter;
        })
      );
      
      if (route) {
        const plateSet = new Set(route.licensePlates.map(p => 
          p.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '')
        ));
        filteredTrucks = trucks.filter(t => {
          const tName = t.name
            .toUpperCase()
            .replace(/\s/g, '')
            .replace(/[^A-Z0-9]/g, '');
          return plateSet.has(tName);
        });
      }
    }

    console.log('🔵 Displaying', filteredTrucks.length, 'trucks (filtered from', trucks.length, ')');

    let trucksAdded = 0;

    filteredTrucks.forEach((truck) => {
      if (!truck.position) return;

      const vel = truck.position.vel;
      const statusColor = getStatusColor(vel, truck.lastUpdate);
      const truckType = getTruckType(truck.name);
      const isSelected = selectedTruck?.uid === truck.uid;
      
      const iconUrl = getTruckIcon(truckType, statusColor);
      const size = isSelected ? 44 : 36;
      const offset = isSelected ? -22 : -18;

      const destinationInfo = truck.destination ? `
        <div style="font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 4px; margin-top: 4px;">
          🎯 ${truck.destination}
        </div>
      ` : '';

      const placemark = new ymaps.Placemark(
        [truck.position.lat, truck.position.lng],
        {
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
          iconLayout: 'default#image',
          iconImageHref: iconUrl,
          iconImageSize: [size, size],
          iconImageOffset: [offset, offset],
          iconShadow: true,
          iconShadowSize: [32, 32],
          iconShadowOffset: [-4, -4],
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
      trucksAdded++;
    });

    console.log('🔵 ✅ Added', trucksAdded, 'trucks to map');

  }, [trucks, selectedTruck, isMapReady, onTruckSelect, filterPlate, routes]);

  // ============================================
  // ЭФФЕКТЫ ДЛЯ МАРШРУТОВ
  // ============================================

  useEffect(() => {
    console.log('🔵 🔵 🔵 useEffect for routes TRIGGERED');
    console.log('🔵 isMapReady:', isMapReady);
    console.log('🔵 routes length:', routes?.length);
    
    if (isMapReady && routes && routes.length > 0) {
      console.log('🔵 ✅ Calling drawRoutes');
      drawRoutes();
    } else {
      console.log('🔵 ❌ Skipping drawRoutes - conditions not met');
    }
  }, [routes, isMapReady, drawRoutes]);

  useEffect(() => {
    console.log('🔵 🔵 🔵 useEffect for isMapReady TRIGGERED');
    console.log('🔵 isMapReady:', isMapReady);
    console.log('🔵 routes length:', routes?.length);
    
    if (isMapReady && routes && routes.length > 0) {
      console.log('🔵 ✅ Map is ready, drawing routes...');
      drawRoutes();
    }
  }, [isMapReady, routes, drawRoutes]);

  // ============================================
  // ЦЕНТРИРОВАНИЕ НА ПЕРВОЙ МАШИНЕ КОЛОННЫ
  // ============================================

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !routes || routes.length === 0) return;
    
    if (routes.length === 1) {
      const route = routes[0];
      
      const firstPlate = route.licensePlates?.[0];
      if (!firstPlate) return;
      
      const normalizedFirstPlate = firstPlate
        .toUpperCase()
        .replace(/\s/g, '')
        .replace(/[^A-Z0-9]/g, '');
      
      const matchingTrucks = trucks.filter(t => {
        const tName = t.name
          .toUpperCase()
          .replace(/\s/g, '')
          .replace(/[^A-Z0-9]/g, '');
        return tName === normalizedFirstPlate && t.position;
      });
      
      matchingTrucks.sort((a, b) => {
        const timeA = a.position?.time || 0;
        const timeB = b.position?.time || 0;
        return timeA - timeB;
      });
      
      const firstTruck = matchingTrucks[0];
      
      if (!firstTruck?.position) {
        if (route.destCoords) {
          console.log('🔵 No truck position, centering on destination:', route.destination);
          mapRef.current.setCenter([route.destCoords.lat, route.destCoords.lng], 12);
        }
        return;
      }

      if (!route.destCoords) {
        console.log('🔵 No destination coordinates');
        return;
      }

      const truckPos = firstTruck.position;
      const destCoords = route.destCoords;
      
      console.log('🔵 Centering on first truck:', firstTruck.name);
      mapRef.current.setCenter([truckPos.lat, truckPos.lng], 14);

      // РАСЧЁТ ВРЕМЕНИ ДО ЦЕЛИ
      getRouteTime(
        truckPos.lat,
        truckPos.lng,
        destCoords.lat,
        destCoords.lng
      ).then(routeInfo => {
        if (routeInfo && mapRef.current) {
          console.log('🔵 Route info:', routeInfo);
          
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
                  background: rgba(0,0,0,0.85);
                  color: #fff;
                  padding: 8px 14px;
                  border-radius: 12px;
                  font-size: 13px;
                  font-weight: 600;
                  border: 2px solid #ffd93d;
                  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  text-align: center;
                  min-width: 120px;
                ">
                  <div>⏱️ ${routeInfo.durationFormatted}</div>
                  <div style="font-size: 11px; color: #aaa;">📏 ${routeInfo.distance} км</div>
                </div>
              `,
            },
            {
              iconLayout: 'default#imageWithContent',
              iconContentOffset: [0, -50],
            }
          );

          mapRef.current.geoObjects.add(placemark);
          window._routeTimePlacemark = placemark;
          console.log('🔵 ✅ Placemark added');
        }
      });
    }
  }, [routes, isMapReady, trucks]);

  // ============================================
  // ПЕРЕДАЧА КАРТЫ В РОДИТЕЛЬСКИЙ КОМПОНЕНТ
  // ============================================

  useEffect(() => {
    if (onMapReady && mapRef.current) {
      console.log('🔵 Map ready, calling onMapReady');
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


