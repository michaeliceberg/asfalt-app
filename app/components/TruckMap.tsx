// app/components/TruckMap.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getTruckType, getStatusColor } from '@/lib/truck-icons';
import { getFactoryColor } from '@/lib/constants';

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

// ✅ Тип для маршрута
interface Route {
  destination: string;
  factory: string;
  count: number;
  requestNumber: string;
  totalQuantity: number;
  licensePlates: string[];
  destCoords: { lat: number; lng: number } | null;
  factoryCoords: { lat: number; lng: number } | null;
}

interface TruckMapProps {
  trucks: Truck[];
  routes?: Route[]; // ← Теперь без any
  onTruckSelect?: (truck: Truck) => void;
}

interface YandexMap {
  geoObjects: {
    add: (object: unknown) => void;
    remove: (object: unknown) => void;
  };
  setCenter: (center: [number, number], zoom: number) => void;
  destroy: () => void;
}

interface YandexPlacemark {
  events: {
    add: (event: string, handler: () => void) => void;
  };
}

// interface YandexPolyline {
//   // Для маршрутов
// }
type YandexPolyline = unknown;

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
  ) => YandexPolyline;
  ready: (callback: () => void) => void;
}

// declare global {
//   interface Window {
//     ymaps: YandexMaps | undefined;
//   }
// }

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

// Функции для генерации SVG иконок (без изменений)
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

export default function TruckMap({ trucks, routes = [], onTruckSelect }: TruckMapProps) {
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const mapRef = useRef<YandexMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const placemarksRef = useRef<Record<string, YandexPlacemark>>({});
  const routesRef = useRef<Record<string, YandexPolyline>>({});
  const isMapReadyRef = useRef(false);
  const isScriptLoadingRef = useRef(false);

  // Инициализация карты
  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current || !window.ymaps) return;

    try {
      const map = new window.ymaps.Map(containerRef.current, {
        center: [55.76, 37.64],
        zoom: 10,
        controls: ['zoomControl', 'fullscreenControl'],
      });

      mapRef.current = map;
      isMapReadyRef.current = true;

      const firstWithPosition = trucks.find(t => t.position !== null);
      if (firstWithPosition?.position) {
        map.setCenter([firstWithPosition.position.lat, firstWithPosition.position.lng], 12);
      }
    } catch (error) {
      console.error('❌ Ошибка инициализации карты:', error);
    }
  }, [trucks]);

  // Загрузка API Яндекс Карт
  useEffect(() => {
    if (window.ymaps) {
      initMap();
      return;
    }

    if (isScriptLoadingRef.current) return;
    isScriptLoadingRef.current = true;

    const existingScript = document.querySelector('script[src*="api-maps.yandex.ru"]');
    if (existingScript) {
      const checkReady = () => {
        if (window.ymaps) {
          window.ymaps.ready(initMap);
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || ''}&lang=ru_RU`;
    script.async = true;
    
    script.onload = () => {
      if (window.ymaps) {
        window.ymaps.ready(initMap);
      }
    };
    
    script.onerror = () => {
      console.error('❌ Ошибка загрузки Яндекс Карт');
      isScriptLoadingRef.current = false;
    };
    
    document.body.appendChild(script);

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
        isMapReadyRef.current = false;
      }
    };
  }, [initMap]);






  


  // app/components/TruckMap.tsx - внутри drawRoutes

const drawRoutes = useCallback(() => {
  if (!isMapReadyRef.current || !mapRef.current || !window.ymaps || !routes || routes.length === 0) {
    return;
  }

  const map = mapRef.current;
  const ymaps = window.ymaps;

  // Удаляем старые маршруты
  Object.values(routesRef.current).forEach((route) => {
    map.geoObjects.remove(route);
  });
  routesRef.current = {};

  routes.forEach((route) => {
    if (!route.destCoords || !route.factoryCoords) return;

    const color = getFactoryColor(route.factory) || '#4ade80';

    // 📍 Линия маршрута - тонкая, полупрозрачная
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
              <div>📊 Всего: <strong style="color: #1a1a2e;">${route.totalQuantity} т</strong></div>
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

    // 📍 ТОЧКА (капелька) на середине маршрута - без иконки, только точка с числом
    const midLat = (route.factoryCoords.lat + route.destCoords.lat) / 2;
    const midLng = (route.factoryCoords.lng + route.destCoords.lng) / 2;
    
    // Смещаем точку чуть в сторону, чтобы не перекрывать линию
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
}, [routes]);













  // Обновление маркеров с кастомными иконками
  useEffect(() => {
    if (!isMapReadyRef.current || !mapRef.current || !window.ymaps) return;

    const map = mapRef.current;
    const ymaps = window.ymaps;

    // Удаляем старые маркеры
    Object.values(placemarksRef.current).forEach((placemark) => {
      map.geoObjects.remove(placemark);
    });
    placemarksRef.current = {};

    trucks.forEach((truck) => {
      if (!truck.position) return;

      const vel = truck.position.vel;
      const statusColor = getStatusColor(vel, truck.lastUpdate);
      const truckType = getTruckType(truck.name);
      const isSelected = selectedTruck?.uid === truck.uid;
      
      const iconUrl = getTruckIcon(truckType, statusColor);
      const size = isSelected ? 44 : 36;
      const offset = isSelected ? -22 : -18;

      // Формируем содержимое балуна с информацией о маршруте
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
    });
  }, [trucks, selectedTruck, onTruckSelect]);

  // Рисуем маршруты при изменении данных
  useEffect(() => {
    if (isMapReadyRef.current && routes && routes.length > 0) {
      drawRoutes();
    }
  }, [routes, drawRoutes]);

  // ============================================
  // РЕНДЕР
  // ============================================

  const activeTrucks = trucks.filter(t => t.position !== null);
  
  const mixerCount = trucks.filter(t => getTruckType(t.name) === 'mixer' && t.position !== null).length;
  const tipperCount = trucks.filter(t => getTruckType(t.name) === 'tipper' && t.position !== null).length;
  const dumpCount = trucks.filter(t => getTruckType(t.name) === 'dumpTruck' && t.position !== null).length;

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        padding: '14px 20px',
        borderRadius: 12,
        color: '#fff',
        fontSize: 13,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>🚛 Всего: <strong>{trucks.length}</strong></span>
          <span>🟢 Активны: <strong style={{ color: '#4ade80' }}>{activeTrucks.length}</strong></span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>🚛</span> {dumpCount}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>🪨</span> {tipperCount}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>🧱</span> {mixerCount}
          </span>
        </div>
      </div>

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
            {getTruckTypeEmoji(getTruckType(selectedTruck.name))}
            {selectedTruck.name}
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap', fontSize: 14 }}>
            <span>{getStatusLabel(selectedTruck.position.vel, selectedTruck.lastUpdate)}</span>
            <span>⚡ {selectedTruck.position.vel} км/ч</span>
            <span>🕐 {new Date(selectedTruck.position.time * 1000).toLocaleTimeString()}</span>
          </div>
          {selectedTruck.destination && (
            <div style={{ fontSize: 14, color: '#ffd93d', marginTop: 4 }}>
              🎯 {selectedTruck.destination}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            📍 {selectedTruck.position.lat.toFixed(6)}, {selectedTruck.position.lng.toFixed(6)}
          </div>
        </div>
      )}

      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          borderRadius: 12,
          background: '#1a1a2e',
        }} 
      />
    </div>
  );
}


