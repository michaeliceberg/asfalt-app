// app/components/RoadMapEditor.tsx
'use client';

// Карта для /admin/weigh-stations: показывает весовые рамки и уже
// нарисованные "запретные дороги" к ним, и умеет ловить клики по карте —
// используется в двух режимах (переключает родительская страница):
// - "добавить рамку": клик ставит точку новой станции
// - "нарисовать дорогу": клики по очереди добавляют точки ломаной линии
// Сама карта ничего не сохраняет и не решает, что означает клик — просто
// прокидывает координаты наверх через onMapClick.
import { useEffect, useRef, useState } from 'react';
import type { YandexMap } from '@/lib/yandex-maps-types';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface StationWithRoads {
  id: number;
  name: string;
  lat: number;
  lng: number;
  isActive: boolean;
  roads: Array<{
    id: number;
    name: string | null;
    isActive: boolean;
    points: LatLng[];
  }>;
}

interface RoadMapEditorProps {
  stations: StationWithRoads[];
  drawingPoints: LatLng[];
  clickEnabled: boolean;
  onMapClick: (point: LatLng) => void;
  onStationClick?: (stationId: number) => void;
  selectedStationId?: number | null;
}

// Локальное расширение типа клика по карте — координаты клика не нужны
// нигде больше в приложении (см. TruckMap.tsx, там клик по пустой карте
// используется только чтобы закрыть карточку, без координат), поэтому
// не трогаем общий lib/yandex-maps-types.ts ради одного этого места.
interface YandexClickEvent {
  get: (key: 'coords') => [number, number];
}
interface YandexMapWithCoordClick extends YandexMap {
  events: {
    add: (event: string, handler: (e: YandexClickEvent) => void) => void;
  };
}

const DEFAULT_CENTER: [number, number] = [55.75, 37.6]; // Москва — точку почти сразу переставит первая станция/клик

export default function RoadMapEditor({
  stations,
  drawingPoints,
  clickEnabled,
  onMapClick,
  onStationClick,
  selectedStationId,
}: RoadMapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YandexMap | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const geoObjectsRef = useRef<unknown[]>([]);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  const clickEnabledRef = useRef(clickEnabled);
  useEffect(() => { clickEnabledRef.current = clickEnabled; }, [clickEnabled]);

  // Загрузка API Яндекс Карт (тот же паттерн, что в TruckMap.tsx)
  useEffect(() => {
    const initMap = () => {
      if (!containerRef.current || mapRef.current || !window.ymaps) return;
      const ymaps = window.ymaps;

      const initialCenter: [number, number] = stations.length
        ? [stations[0].lat, stations[0].lng]
        : DEFAULT_CENTER;

      const map = new ymaps.Map(containerRef.current, {
        center: initialCenter,
        zoom: stations.length ? 13 : 9,
        controls: ['zoomControl', 'typeSelector'],
      }) as YandexMap;

      (map as YandexMapWithCoordClick).events.add('click', (e: YandexClickEvent) => {
        if (!clickEnabledRef.current) return;
        const coords = e.get('coords');
        if (!coords) return;
        onMapClickRef.current({ lat: coords[0], lng: coords[1] });
      });

      mapRef.current = map;
      setIsMapReady(true);
    };

    if (window.ymaps) {
      window.ymaps.ready(initMap);
      return;
    }

    const existingScript = document.querySelector('script[data-yandex-maps]');
    if (existingScript) {
      existingScript.addEventListener('load', () => window.ymaps?.ready(initMap));
      return;
    }

    const script = document.createElement('script');
    script.dataset.yandexMaps = 'true';
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || ''}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      if (window.ymaps) {
        window.ymaps.ready(initMap);
      } else {
        setMapError('API Яндекс Карт не загрузился');
      }
    };
    script.onerror = () => setMapError('Ошибка загрузки API Яндекс Карт');
    document.body.appendChild(script);

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.destroy();
        } catch {
          // ignore
        }
        mapRef.current = null;
        setIsMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Перерисовка станций + существующих дорог + текущей рисуемой линии
  useEffect(() => {
    if (!isMapReady || !mapRef.current || !window.ymaps) return;
    const map = mapRef.current;
    const ymaps = window.ymaps;

    geoObjectsRef.current.forEach((obj) => map.geoObjects.remove(obj));
    geoObjectsRef.current = [];

    stations.forEach((station) => {
      const isSelected = station.id === selectedStationId;
      const placemark = new ymaps.Placemark(
        [station.lat, station.lng],
        { hintContent: station.name, balloonContent: station.name },
        {
          preset: isSelected ? 'islands#violetCircleIcon' : (station.isActive ? 'islands#blueCircleIcon' : 'islands#grayCircleIcon'),
        }
      );
      if (onStationClick) {
        placemark.events.add('click', () => onStationClick(station.id));
      }
      map.geoObjects.add(placemark);
      geoObjectsRef.current.push(placemark);

      station.roads.forEach((road) => {
        if (road.points.length < 2) return;
        const polyline = new ymaps.Polyline(
          road.points.map((p) => [p.lat, p.lng]),
          {},
          {
            strokeColor: road.isActive ? '#dc2626' : '#9ca3af',
            strokeWidth: 5,
            strokeOpacity: 0.85,
          }
        );
        map.geoObjects.add(polyline);
        geoObjectsRef.current.push(polyline);
      });
    });

    if (drawingPoints.length >= 1) {
      drawingPoints.forEach((p, i) => {
        const dot = new ymaps.Placemark(
          [p.lat, p.lng],
          { hintContent: `Точка ${i + 1}` },
          { preset: 'islands#orangeDotIcon' }
        );
        map.geoObjects.add(dot);
        geoObjectsRef.current.push(dot);
      });
    }

    if (drawingPoints.length >= 2) {
      const drawLine = new ymaps.Polyline(
        drawingPoints.map((p) => [p.lat, p.lng]),
        {},
        { strokeColor: '#f97316', strokeWidth: 4, strokeStyle: 'shortdash', strokeOpacity: 0.95 }
      );
      map.geoObjects.add(drawLine);
      geoObjectsRef.current.push(drawLine);
    }
  }, [stations, drawingPoints, isMapReady, selectedStationId, onStationClick]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 480, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {mapError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#dc2626', fontSize: 13, padding: 16, textAlign: 'center' }}>
          {mapError}
        </div>
      )}
      {!isMapReady && !mapError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#888', fontSize: 13 }}>
          Загрузка карты...
        </div>
      )}
    </div>
  );
}
