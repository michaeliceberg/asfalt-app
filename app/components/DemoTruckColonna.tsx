// app/components/DemoTruckColonna.tsx
//
// Демонстрация GPS-навигации (PRO-фича) в /demo. В демо нет живого GPS —
// поэтому "колонна" синтетическая: несколько машин ползут по гладкой
// кривой (квадратичный Безье) от завода к точке назначения, позиции
// пересчитываются каждые несколько секунд. Сама отрисовка (иконки,
// premium-бейджи заводов/destination, плавная маршрутная линия,
// автомасштаб) — тот же компонент TruckMap.tsx, что и на
// боевом /trucks: ему всё равно, откуда взялись координаты машин.
'use client';

import { useEffect, useMemo, useState } from 'react';
import TruckMap from '@/app/components/TruckMap';
import { Satellite, Truck as TruckIcon } from 'lucide-react';
import { DEMO_DRIVERS, DEMO_DRIVER_PHONES } from '@/lib/demo-data';

// Те же завод/заявка, что фигурируют в демо push-уведомлении "Новая заявка"
// (ДЕМО-СЕВ · ДСУ-5 Сосновский · ЩМА-20 · 380 т) — единая история в демо.
const FACTORY = { lat: 55.62, lng: 38.02, name: 'Северный' };
const DEST = { lat: 55.81, lng: 38.35, name: 'ДСУ-5 Сосновский' };
const MATERIAL = 'ЩМА-20';
const TOTAL_QTY = 380;
const PLATES = ['У317МХ190', 'О552НК150', 'Т884АР750', 'Х119ВЕ190', 'М440КТ150', 'Е705СУ190'];
const TICK_MS = 3500;

function getPathPoint(t: number): { lat: number; lng: number } {
  const dLat = DEST.lat - FACTORY.lat;
  const dLng = DEST.lng - FACTORY.lng;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
  const perpLat = -dLng / dist;
  const perpLng = dLat / dist;
  const bulge = dist * 0.16;
  const ctrlLat = (FACTORY.lat + DEST.lat) / 2 + perpLat * bulge;
  const ctrlLng = (FACTORY.lng + DEST.lng) / 2 + perpLng * bulge;
  const mt = 1 - t;
  return {
    lat: mt * mt * FACTORY.lat + 2 * mt * t * ctrlLat + t * t * DEST.lat,
    lng: mt * mt * FACTORY.lng + 2 * mt * t * ctrlLng + t * t * DEST.lng,
  };
}

interface DemoTruckState {
  plate: string;
  t: number;
  speed: number;
}

function initialTrucks(): DemoTruckState[] {
  return PLATES.map((plate, i) => ({
    plate,
    t: 0.06 + i * 0.145 + (i % 2 === 0 ? 0.015 : -0.015),
    speed: 36 + ((i * 7) % 18),
  }));
}

export default function DemoTruckColonna() {
  const [truckStates, setTruckStates] = useState<DemoTruckState[]>(initialTrucks);

  useEffect(() => {
    const interval = setInterval(() => {
      setTruckStates((prev) =>
        prev.map((ts) => {
          let next = ts.t + 0.01 + Math.random() * 0.012;
          if (next > 0.97) next = 0.03 + Math.random() * 0.04; // колонна бесконечна для демо — доехавшая машина "уступает место" новой
          return { ...ts, t: next };
        })
      );
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const trucks = useMemo(() => {
    const nowIso = new Date().toISOString();
    const nowSec = Math.floor(Date.now() / 1000);
    const perTruckQty = Math.round(TOTAL_QTY / PLATES.length);
    return truckStates.map((ts, i) => {
      const pos = getPathPoint(ts.t);
      const arrived = ts.t > 0.94;
      const driver = DEMO_DRIVERS[i % DEMO_DRIVERS.length];
      return {
        uid: `demo-colonna-${i}`,
        name: ts.plate,
        position: { lat: pos.lat, lng: pos.lng, vel: arrived ? 0 : ts.speed, time: nowSec },
        lastUpdate: nowIso,
        destination: DEST.name,
        factory: 'ДЕМО-СЕВ',
        driver,
        driverPhone: DEMO_DRIVER_PHONES[driver],
        quantity: perTruckQty,
      };
    });
  }, [truckStates]);

  const routes = useMemo(() => [{
    destination: DEST.name,
    factory: 'ДЕМО-СЕВ',
    count: trucks.length,
    requestNumber: 'ДЕМО-СЕВ-З202',
    totalQuantity: TOTAL_QTY,
    licensePlates: PLATES,
    destCoords: { lat: DEST.lat, lng: DEST.lng, name: DEST.name },
    factoryCoords: { lat: FACTORY.lat, lng: FACTORY.lng, name: FACTORY.name },
  }], [trucks.length]);

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: '14px 14px 0 0',
        padding: '12px 16px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'rgba(58,86,212,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Satellite size={17} strokeWidth={2.2} color="#8fa8ff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              Колонна в пути
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 9.5, fontWeight: 800, color: '#4ade80',
                background: 'rgba(74,222,128,0.12)', padding: '2px 7px', borderRadius: 6,
                letterSpacing: '0.3px',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                ЖИВОЕ ДВИЖЕНИЕ
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#9090b0', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              <TruckIcon size={11} strokeWidth={2.2} />{trucks.length} машин · {MATERIAL} · {TOTAL_QTY} т → {DEST.name}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 440, borderRadius: '0 0 14px 14px', overflow: 'hidden', border: '1px solid #e9ecef', borderTop: 'none' }}>
        <TruckMap trucks={trucks} routes={routes} filterRequestNumber={null} />
      </div>
    </div>
  );
}
