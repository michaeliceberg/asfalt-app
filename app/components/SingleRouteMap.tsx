// app/components/SingleRouteMap.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { YandexMap } from '@/lib/yandex-maps-types';

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
  mapInstance?: YandexMap | null; // ✅ Принимаем карту извне
  onMapReady?: (map: YandexMap) => void;
  
}

export default function SingleRouteMap({ requestNumber, mapInstance, onMapReady }: SingleRouteMapProps) {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    const loadRoute = async () => {
      try {
        const response = await fetch(`/api/truck-route-by-request?requestNumber=${requestNumber}`);
        const data = await response.json();
        
        if (isMounted.current && data.success && data.route) {
          setRoute(data.route);
        }
      } catch (err) {
        setError('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    loadRoute();

    return () => {
      isMounted.current = false;
    };
  }, [requestNumber]);

  // Если есть карта — используем её
  useEffect(() => {
    if (!mapInstance || !route || !isMounted.current) return;

    const map = mapInstance;
    const ymaps = window.ymaps;
    if (!ymaps) return;

    try {
      // Очищаем старые объекты
      map.geoObjects.removeAll();

      if (!route.destCoords || !route.factoryCoords) {
        return;
      }

      const color = '#3b82f6';

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

      // Центрируем карту на маршрут
      const centerLat = (route.factoryCoords.lat + route.destCoords.lat) / 2;
      const centerLng = (route.factoryCoords.lng + route.destCoords.lng) / 2;
      map.setCenter([centerLat, centerLng], 11);

    } catch (err) {
      console.error('Error drawing route:', err);
    }
  }, [route, mapInstance]);

  if (loading) {
    return <LoadingSpinner message="Загрузка маршрута..." size="medium" />;
  }

  if (error || !route) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
        {error || 'Маршрут не найден'}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
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

      {/* Список машин */}
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
          {route.licensePlates.map((plate, idx) => (
            <span key={idx} style={{
              background: '#f1f5f9',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: 12,
              color: '#1a1a2e',
              whiteSpace: 'nowrap',
            }}>
              {plate}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
