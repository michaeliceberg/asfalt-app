// app/components/SingleRouteMap.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { YandexMap, YandexMaps } from '@/lib/yandex-maps-types';
import { getFactoryColor } from '@/lib/constants';

// ============================================
// ТИПЫ
// ============================================

interface TruckData {
  licensePlate: string;
  driver: string;
  quantity: number;
  time: string;
  material: string;
}

interface RouteData {
  destination: string;
  factory: string;
  count: number;
  requestNumber: string;
  totalQuantity: number;
  trucks: TruckData[];
  destCoords: { lat: number; lng: number; name: string } | null;
  factoryCoords: { lat: number; lng: number; name: string } | null;
  licensePlates: string[];
}

interface SingleRouteMapProps {
  requestNumber: string;
}

interface TruckApiData {
  uid: string;
  name: string;
  position: {
    lat: number;
    lng: number;
    vel: number;
    time: number;
  } | null;
  lastUpdate: string | null;
  destination: string | null;
  factory: string;
}

interface TrucksApiResponse {
  success: boolean;
  count: number;
  total: number;
  trucks: TruckApiData[];
  routes: unknown[];
  timestamp: string;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function getColorBySpeed(vel: number): string {
  if (vel === 0) return '#f87171';
  if (vel < 20) return '#facc15';
  if (vel < 50) return '#4ade80';
  return '#60a5fa';
}

function getTruckTypeLocal(name: string): 'dumpTruck' | 'tipper' | 'mixer' {
  const lower = name.toLowerCase();
  if (lower.includes('мк') || lower.includes('миксер')) {
    return 'mixer';
  }
  if (lower.includes('р28') || lower.includes('р27') || lower.includes('р29')) {
    return 'tipper';
  }
  return 'dumpTruck';
}

function getTruckIconSVG(type: string, color: string): string {
  const size = 32;
  const strokeColor = '#2d3748';
  
  if (type === 'mixer') {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="12" width="8" height="6" rx="2" fill="${color}" stroke="${strokeColor}" stroke-width="1.5"/>
        <ellipse cx="20" cy="14" rx="8" ry="6" fill="${color}" stroke="${strokeColor}" stroke-width="1.5"/>
        <line x1="14" y1="12" x2="22" y2="16" stroke="${strokeColor}" stroke-width="1.5" opacity="0.6"/>
        <line x1="14" y1="16" x2="22" y2="12" stroke="${strokeColor}" stroke-width="1.5" opacity="0.6"/>
        <circle cx="10" cy="24" r="4" fill="#2d3748" stroke="${strokeColor}" stroke-width="1.5"/>
        <circle cx="22" cy="24" r="4" fill="#2d3748" stroke="${strokeColor}" stroke-width="1.5"/>
        <circle cx="10" cy="24" r="2" fill="#4a5568"/>
        <circle cx="22" cy="24" r="2" fill="#4a5568"/>
      </svg>
    `;
  }
  
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="12" width="20" height="10" rx="2" fill="${color}" stroke="${strokeColor}" stroke-width="1.5"/>
      <rect x="4" y="14" width="6" height="6" rx="1" fill="${color}" stroke="${strokeColor}" stroke-width="1.5" opacity="0.85"/>
      <rect x="5" y="15" width="4" height="3" rx="0.5" fill="rgba(255,255,255,0.3)"/>
      <circle cx="10" cy="24" r="4" fill="#2d3748" stroke="${strokeColor}" stroke-width="1.5"/>
      <circle cx="22" cy="24" r="4" fill="#2d3748" stroke="${strokeColor}" stroke-width="1.5"/>
      <circle cx="10" cy="24" r="2" fill="#4a5568"/>
      <circle cx="22" cy="24" r="2" fill="#4a5568"/>
    </svg>
  `;
}

function getTruckIconDataUrl(type: string, color: string): string {
  const svg = getTruckIconSVG(type, color);
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

// ============================================
// КОМПОНЕНТ СТАТУСА КАРТЫ
// ============================================

function MapStatus({ isReady, error }: { isReady: boolean; error: string | null }) {
  if (error) {
    return <span>❌ {error}</span>;
  }
  if (isReady) {
    return <span>✅ Карта загружена</span>;
  }
  return <span>⏳ Загрузка карты...</span>;
}

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================




export default function SingleRouteMap({ requestNumber }: SingleRouteMapProps) {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [truckPositions, setTruckPositions] = useState<Record<string, { lat: number; lng: number; vel: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  const isMapReadyRef = useRef(false);
  const mapRef = useRef<YandexMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScriptLoadingRef = useRef(false);
  const placemarksRef = useRef<Record<string, unknown>>({});
  const initMapCalledRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initMapRef = useRef<() => void>(() => {});

  // ============================================
  // ЗАГРУЗКА ДАННЫХ О МАРШРУТЕ (без изменений)
  // ============================================

  useEffect(() => {
    const loadRoute = async () => {
      try {
        setError(null);
        const response = await fetch(`/api/truck-route-by-request?requestNumber=${requestNumber}`);
        const data = await response.json();
        
        if (data.success && data.route) {
          setRoute(data.route);
          
          const plates: string[] = data.route.licensePlates || [];
          const positions: Record<string, { lat: number; lng: number; vel: number }> = {};
          
          try {
            const trucksResponse = await fetch('/api/trucks');
            const trucksData: TrucksApiResponse = await trucksResponse.json();
            
            if (trucksData.success && trucksData.trucks) {
              trucksData.trucks.forEach((truck: TruckApiData) => {
                const normalizedName = truck.name
                  .toUpperCase()
                  .replace(/\s/g, '')
                  .replace(/[^A-Z0-9]/g, '');
                
                const isInColumn = plates.some((plate: string) => {
                  const normalizedPlate = plate
                    .toUpperCase()
                    .replace(/\s/g, '')
                    .replace(/[^A-Z0-9]/g, '');
                  return normalizedName === normalizedPlate;
                });
                
                if (isInColumn && truck.position) {
                  positions[normalizedName] = {
                    lat: truck.position.lat,
                    lng: truck.position.lng,
                    vel: truck.position.vel,
                  };
                }
              });
            }
          } catch (err) {
            console.warn('Could not load truck positions:', err);
          }
          
          setTruckPositions(positions);
        } else {
          setError('Маршрут не найден');
        }
      } catch (err) {
        setError('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    loadRoute();
  }, [requestNumber]);

  // ============================================
  // ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ КАРТЫ
  // ============================================

  const initializeMap = useCallback(() => {
    console.log('🔵 initializeMap called');
    console.log('🔵 containerRef.current:', containerRef.current);
    
    if (!containerRef.current) {
      console.log('🔵 ❌ containerRef is null, will retry in 200ms...');
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      retryTimeoutRef.current = setTimeout(() => {
        console.log('🔵 Retry initMap');
        if (!mapRef.current && containerRef.current) {
          initMapRef.current();
        } else {
          console.log('🔵 Retry: container still null or map exists');
        }
      }, 200);
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
        center: [55.0, 38.5],
        zoom: 10,
        controls: ['zoomControl', 'fullscreenControl'],
      });

      console.log('🔵 Map created successfully');
      mapRef.current = map;
      isMapReadyRef.current = true;
      setIsMapReady(true);
      initMapCalledRef.current = true;
      setMapError(null);
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    } catch (err) {
      console.error('🔵 ❌ Error initializing map:', err);
      setMapError('Ошибка инициализации карты');
    }
  }, []);

  // ✅ Сохраняем функцию в ref
  useEffect(() => {
    initMapRef.current = initializeMap;
  }, [initializeMap]);

  // ============================================
  // ЗАГРУЗКА API ЯНДЕКС КАРТ - упрощённая версия
  // ============================================

  useEffect(() => {
    console.log('🔵 useEffect - checking ymaps');
    
    // Проверяем, загружен ли API
    if (window.ymaps) {
      console.log('🔵 ymaps already loaded');
      // Даём время на монтирование ref
      setTimeout(() => {
        if (!mapRef.current && !initMapCalledRef.current) {
          initMapRef.current();
        }
      }, 100);
      return;
    }

    // Если скрипт уже загружается, не создаём новый
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
          // Даём время на монтирование ref
          setTimeout(() => {
            if (!mapRef.current && !initMapCalledRef.current) {
              initMapRef.current();
            }
          }, 100);
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
  }, []); // ✅ Пустой массив зависимостей

  // ============================================
  // ОТРИСОВКА МАРШРУТА
  // ============================================

  useEffect(() => {
    console.log('🔵 Drawing route effect');
    console.log('🔵 isMapReadyRef.current:', isMapReadyRef.current);
    console.log('🔵 mapRef.current:', !!mapRef.current);
    console.log('🔵 route:', !!route);
    
    if (!isMapReadyRef.current || !mapRef.current || !route || !window.ymaps) {
      console.log('🔵 Skipping draw - conditions not met');
      return;
    }

    try {
      const map = mapRef.current;
      const ymaps = window.ymaps;

      map.geoObjects.removeAll();
      placemarksRef.current = {};

      if (!route.destCoords || !route.factoryCoords) {
        console.warn('⚠️ No coordinates for route:', route.destination);
        
        const messagePlacemark = new ymaps.Placemark(
          [55.0, 38.5],
          {
            iconContent: `
              <div style="
                background: rgba(0,0,0,0.8);
                color: #fff;
                padding: 16px 24px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 500;
                text-align: center;
              ">
                🗺️ Нет координат для ${route.destination}
              </div>
            `,
          },
          {
            iconLayout: 'default#imageWithContent',
            iconContentOffset: [0, 0],
          }
        );
        map.geoObjects.add(messagePlacemark);
        map.setCenter([55.0, 38.5], 7);
        return;
      }


      const color = getFactoryColor(route.factory) || '#4ade80';

      // Линия маршрута
      const routeLine = new ymaps.Polyline(
        [
          [route.factoryCoords.lat, route.factoryCoords.lng],
          [route.destCoords.lat, route.destCoords.lng],
        ],
        {
          balloonContent: `
            <div style="padding: 12px; min-width: 220px; color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
              <div style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">🎯 ${route.destination}</div>
              <div style="display: flex; flex-direction: column; gap: 3px; color: #4a5568;">
                <div>🚛 Машин: <strong style="color: #1a1a2e;">${route.count}</strong></div>
                <div>📊 Всего: <strong style="color: #1a1a2e;">${route.totalQuantity} т</strong></div>
                <div style="margin-top: 4px; font-size: 12px; color: #718096;">
                  📦 ${route.trucks[0]?.material || '—'}
                </div>
              </div>
            </div>
          `,
        },
        {
          strokeColor: color,
          strokeWidth: 4,
          strokeOpacity: 0.6,
          strokeStyle: 'solid',
        }
      );

      map.geoObjects.add(routeLine);

      // Точка с количеством машин
      const midLat = (route.factoryCoords.lat + route.destCoords.lat) / 2;
      const midLng = (route.factoryCoords.lng + route.destCoords.lng) / 2;

      const labelPlacemark = new ymaps.Placemark(
        [midLat, midLng],
        {
          iconContent: `
            <div style="
              background: ${color};
              color: #fff;
              font-size: 14px;
              font-weight: 700;
              padding: 6px 16px;
              border-radius: 16px;
              border: 2px solid #fff;
              box-shadow: 0 2px 12px rgba(0,0,0,0.25);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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

      // 🏁 Метка пункта назначения
      const destPlacemark = new ymaps.Placemark(
        [route.destCoords.lat, route.destCoords.lng],
        {
          balloonContent: `
            <div style="padding: 8px;">
              <strong>🎯 ${route.destination}</strong>
            </div>
          `,
        },
        {
          preset: 'islands#circleIcon',
          iconColor: '#ef4444',
          iconContent: '🏁',
        }
      );

      map.geoObjects.add(destPlacemark);

      // 🚛 Добавляем машины на карту
      const plates: string[] = route.licensePlates || [];
      let trucksAdded = 0;
      
      plates.forEach((plate: string) => {
        const normalizedPlate = plate
          .toUpperCase()
          .replace(/\s/g, '')
          .replace(/[^A-Z0-9]/g, '');
        
        const position = truckPositions[normalizedPlate];
        if (!position) return;

        const truckColor = getColorBySpeed(position.vel);
        const truckType = getTruckTypeLocal(plate);
        const iconUrl = getTruckIconDataUrl(truckType, truckColor);

        const placemark = new ymaps.Placemark(
          [position.lat, position.lng],
          {
            balloonContent: `
              <div style="padding: 8px; min-width: 180px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="font-size: 16px; font-weight: 700;">🚛 ${plate}</div>
                <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px; font-size: 14px;">
                  <div>⚡ ${position.vel} км/ч</div>
                </div>
              </div>
            `,
          },
          {
            iconLayout: 'default#image',
            iconImageHref: iconUrl,
            iconImageSize: [32, 32],
            iconImageOffset: [-16, -16],
            iconShadow: true,
            iconShadowSize: [32, 32],
            iconShadowOffset: [-4, -4],
          }
        );

        map.geoObjects.add(placemark);
        placemarksRef.current[plate] = placemark;
        trucksAdded++;
      });

      console.log(`🔵 Added ${trucksAdded} trucks to map`);

      // Центрируем карту
      const centerLat = (route.factoryCoords.lat + route.destCoords.lat) / 2;
      const centerLng = (route.factoryCoords.lng + route.destCoords.lng) / 2;
      map.setCenter([centerLat, centerLng], 11);

    } catch (err) {
      console.error('🔵 ❌ Error drawing route:', err);
    }
  }, [route, truckPositions]);

  // ============================================
  // РЕНДЕР
  // ============================================

  if (loading) {
    return <LoadingSpinner message="Загрузка маршрута..." size="medium" />;
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            background: '#4a90d9',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          🔄 Обновить
        </button>
      </div>
    );
  }

  if (!route) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
        <p>Маршрут не найден</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* Информация о колонне сверху */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        padding: '12px 20px',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
          🎯 {route.destination}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: '#4a5568' }}>
          <span>🚛 {route.count} машин</span>
          <span>📊 {route.totalQuantity} т</span>
          <span>🏭 {route.factory}</span>
        </div>
      </div>

      {/* Индикатор состояния карты */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
        color: '#888',
        fontSize: 14,
        background: 'rgba(255,255,255,0.9)',
        padding: '8px 16px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        pointerEvents: 'none',
      }}>
        <MapStatus isReady={isMapReady} error={mapError} />
      </div>

      {/* Список машин внизу */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 10,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        padding: '12px 16px',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0',
        maxHeight: 120,
        overflow: 'auto',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>
          🚛 Машины в колонне:
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(route.licensePlates || []).map((plate: string, idx: number) => {
            const normalizedPlate = plate
              .toUpperCase()
              .replace(/\s/g, '')
              .replace(/[^A-Z0-9]/g, '');
            const hasPosition = !!truckPositions[normalizedPlate];
            return (
              <span key={idx} style={{
                background: hasPosition ? '#d1fae5' : '#f1f5f9',
                padding: '2px 10px',
                borderRadius: 12,
                fontSize: 12,
                color: hasPosition ? '#065f46' : '#1a1a2e',
                whiteSpace: 'nowrap',
                border: hasPosition ? '1px solid #34d399' : 'none',
              }}>
                {plate} {hasPosition ? '🟢' : '⚪'}
              </span>
            );
          })}
        </div>
      </div>

      {/* Контейнер для карты */}
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