// app/components/CompactView.tsx

'use client';

import { IncomingItem, ShipmentItem } from '@/app/page';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ActivityChart from './ActivityChart';
import LoadingSpinner from './LoadingSpinner';
import { 
  isConcreteMaterial, 
  isSpecialMaterial,
  parseRussianDate,
  formatTime,
  getDateKey,
  getFactoryBadgeClass,
  formatWithUnit,
  formatFullDateTime,
  getIncomingDateKey,
  formatIncomingDateLabel,
  isIncomingDateToday
} from '@/lib/utils';
import TruckProgressBar from './TruckProgressBar';
import { Factory, Truck, Package, User, Lock, Pointer, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { tapHaptic } from '@/lib/haptics';
import { DEMO_DRIVER_PHONES } from '@/lib/demo-data';

type UnifiedDataItem = IncomingItem | ShipmentItem;

interface CombinedRequest {
  requestNumber: string;
  requestDate: string;
  material: string;
  planQuantity: number;
  factQuantity: number;
  consignee: string;
  division: string;
  closed: boolean | null;
  delivery_date: string | null;
  lastShipmentTime: string | null;
  lastShipmentFullDate?: string | null;
  truckCount: number;
  unit?: string;
  vehicles: Array<{
    time: string;
    fullDateTime?: string;
    licensePlate: string;
    driver: string;
    quantity: number;
  }>;
}

interface CompactViewProps {
  data: UnifiedDataItem[];
  mainTab: 'incoming' | 'shipment' | 'shipmentConcrete';
  outgoingRequests?: Array<{
    number: string;
    date: string;
    division: string;
    quantity: number;
    consignee: string;
    material: string;
    closed?: boolean | null;
  }>;
  allShipments?: ShipmentItem[];
  allShipmentsForChart?: ShipmentItem[];
  selectedFactory?: string;
  mode?: 'tas' | 'iceberg';
  // Демо-режим: показываем ту же диаграмму "машина в пути / прибыла",
  // что и в ТАС, но с синтетическими (не GPS) статусами — реальных
  // координат у демо-машин нет, а /api/trucks-distances требует авторизацию.
  demoMode?: boolean;
}

interface VehicleItem {
  licensePlate: string;
  factory: string;
  quantity: number;
  time: string;
  fullDateTime?: string;
  driver?: string;
  // Только для демо — в боевых данных такого поля нет (см. lib/demo-data.ts).
  driverPhone?: string;
  material?: string;
  supplier?: string;
  // Уникальный номер конкретной отгрузки (рейса) — для сопоставления
  // статуса "прибыл" именно с этим рейсом, а не с госномером машины
  // (см. truckDistances ниже).
  shipmentNumber?: string;
}

interface GroupedItem {
  time: string;
  lastFullDateTime?: string;
  factQuantity: number;
  planQuantity: number;
  consignee: string;
  factories: string[];
  truckCount: number;
  material: string;
  requestNumber: string;
  requestDate: string;
  closed: boolean | null;
  supplier?: string;
  unit?: string;
  vehicles: VehicleItem[];
  vehiclesMap?: Map<string, VehicleItem>;
}


interface TruckDistanceData {
  licensePlate: string;
  distance_to_dest: number | null;
  eta_minutes: number | null;
  arrived: boolean;
  arrived_at: string | null;
}

// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ
// ============================================

const formatDateLabel = (dateStr: string): string => {
  const date = parseRussianDate(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  
  return `${day} ${month}`;
};

const isDateToday = (dateStr: string): boolean => {
  const date = parseRussianDate(dateStr);
  if (isNaN(date.getTime())) return false;
  
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
};

const compareDatesDesc = (dateA: string, dateB: string): number => {
  const a = parseRussianDate(dateA);
  const b = parseRussianDate(dateB);
  return b.getTime() - a.getTime();
};

const detectFactory = (item: IncomingItem | ShipmentItem, type: 'incoming' | 'shipment'): string => {
  if (type === 'incoming') {
    const incoming = item as IncomingItem;
    if (incoming.division === 'ЛХ') return 'ЛХ';
    if (incoming.division === 'ЛЮ') return 'ЛЮ';
    if (incoming.division === 'СП') return 'СП';
    if (incoming.division === 'Щ') return 'Щ';
    // Демо-дивизии — короткий код бейджа (СЕ/ЮГ), а не сырой division
    // ("ДЕМО-СЕВ"/"ДЕМО-ЮГ"), иначе бейдж в "Поступлении" показывал
    // длинную "первоначальную" строку вместо короткого СЕ/ЮГ, как везде.
    if (incoming.division === 'ДЕМО-СЕВ') return 'СЕ';
    if (incoming.division === 'ДЕМО-ЮГ') return 'ЮГ';
    if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
    if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
    if (incoming.number?.startsWith('СП')) return 'СП';
    if (incoming.number?.startsWith('Щ')) return 'Щ';
  } else if (type === 'shipment') {
    const shipment = item as ShipmentItem;
    if (shipment.division === 'ЛХ') return 'ЛХ';
    if (shipment.division === 'ЛЮ') return 'ЛЮ';
    if (shipment.division === 'СП') return 'СП';
    if (shipment.division === 'Щ') return 'Щ';
    if (shipment.division === 'ДЕМО-СЕВ') return 'СЕ';
    if (shipment.division === 'ДЕМО-ЮГ') return 'ЮГ';
  }
  // Любой другой незнакомый код — возвращаем реальный division как
  // крайний fallback, а не схлопываем его в общий "Другой".
  return item.division || 'Другой';
};

const hasTodayShipments = (shipments: ShipmentItem[], requestNumber: string): boolean => {
  const today = new Date();
  return shipments.some(ship => {
    const shipDate = parseRussianDate(ship.date);
    const isToday = shipDate.getDate() === today.getDate() &&
                    shipDate.getMonth() === today.getMonth() &&
                    shipDate.getFullYear() === today.getFullYear();
    return ship.clientRequestNumber === requestNumber && isToday;
  });
};

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================

export default function CompactView({ 
  data, 
  mainTab, 
  outgoingRequests = [], 
  allShipments = [],
  allShipmentsForChart = [],
  selectedFactory = 'all',
  mode = 'tas',
  demoMode = false
}: CompactViewProps) {

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [combinedData, setCombinedData] = useState<CombinedRequest[]>([]);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const isMountedRef = useRef(true);

  // Сворачивание по дням: верхние 2 дня развёрнуты по умолчанию, остальные
  // свёрнуты — иначе список на длинном периоде становится очень длинным.
  // toggledDates хранит только ОТКЛОНЕНИЯ от дефолта (XOR-логика в
  // isDayExpanded ниже), поэтому и верхние дни можно свернуть кликом,
  // и нижние — развернуть кнопкой "Развернуть".
  const [toggledDates, setToggledDates] = useState<Set<string>>(new Set());
  const toggleDate = (date: string) => {
    setToggledDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };
  const isDayExpanded = (dateIdx: number, date: string) => (dateIdx < 2) !== toggledDates.has(date);
  










  // ✅ Состояние для хранения расстояний машин (из БД)
  const [truckDistances, setTruckDistances] = useState<Map<string, { 
    distance: number | null; 
    eta: number | null; 
    arrived: boolean;
    arrived_at: string | null;
  }>>(new Map());
  
  const isShipment = mainTab === 'shipment' || mainTab === 'shipmentConcrete';
  const isConcreteOnly = mainTab === 'shipmentConcrete';
  // В демо НЕ используем "combined"-режим — он самостоятельно тянет
  // реальные боевые данные с /api/combined-requests?factory=СП|Щ в обход
  // props (data/demoMode), из-за чего в демо утекали настоящие боевые
  // отгрузки и не работали ни диаграмма машин, ни подсказка "нажми".
  // Для демо всегда строим группировку локально из переданных props
  // (см. groupedByDateAndRequest ниже) — ровно как для ТАС.
  const shouldUseCombined = mode === 'iceberg' && isShipment && !demoMode;
  const effectiveData = shouldUseCombined ? [] : data;
  








  // // ✅ Загружаем расстояния машин из БД (только для ТАС)
  // useEffect(() => {
  //   if (mode !== 'tas') return;
    
  //   const fetchDistances = async () => {
  //     try {
  //       const response = await fetch('/api/trucks-distances');
  //       const data = await response.json();
  //       if (data.success) {
  //         const map = new Map();
  //         data.shipments.forEach((s: TruckDistanceData) => {
  //           if (s.licensePlate) {
  //             map.set(s.licensePlate, {
  //               distance: s.distance_to_dest,
  //               eta: s.eta_minutes,
  //               arrived: s.arrived || false,
  //               arrived_at: s.arrived_at,
  //             });
  //           }
  //         });
  //         setTruckDistances(map);
  //       }
  //     } catch (e) {
  //       console.error('Failed to fetch distances:', e);
  //     }
  //   };
    
  //   fetchDistances();
  //   const interval = setInterval(fetchDistances, 30000); // Обновляем каждые 30 секунд
  //   return () => clearInterval(interval);
  // }, [mode]);

// ✅ Загружаем расстояния машин из БД (только для ТАС, и не в демо —
// в демо своя синтетическая генерация статусов ниже, реальный GPS API
// требует авторизацию и у демо-машин всё равно нет настоящих госномеров).
useEffect(() => {
  if (mode !== 'tas' || demoMode) return;

  let retryCount = 0;
  const maxRetries = 3;
  
  const fetchDistances = async () => {
    try {
      const response = await fetch('/api/trucks-distances');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        const map = new Map();
        data.shipments.forEach((s: {
          licensePlate: string;
          number: string;
          distance_to_dest: number | null;
          eta_minutes: number | null;
          arrived: boolean;
          arrived_at: string | null;
        }) => {
          // Ключ — номер конкретной отгрузки (рейса), а не госномер машины.
          // Раньше ключом был только госномер, из-за чего статус "прибыл"
          // от ПРЕДЫДУЩЕГО рейса той же машины "протекал" в новую заявку —
          // машина только выехала с завода, а карточка уже показывала
          // "прибыл", потому что в карте лежала старая запись по тому же
          // госномеру.
          if (s.number) {
            map.set(s.number, {
              distance: s.distance_to_dest,
              eta: s.eta_minutes,
              arrived: s.arrived || false,
              arrived_at: s.arrived_at,
            });
          }
        });
        setTruckDistances(map);
        retryCount = 0; // Сброс при успехе
      }
    } catch (e) {
      console.error('Failed to fetch distances:', e);
      // Повторная попытка
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`🔄 Повторная попытка ${retryCount}/${maxRetries}...`);
        setTimeout(fetchDistances, 1000 * retryCount);
      }
    }
  };
  
  fetchDistances();
  const interval = setInterval(fetchDistances, 60000);
  return () => clearInterval(interval);
}, [mode, demoMode]);

// ✅ Демо: синтетические статусы "в пути / прибыл" вместо реального GPS.
// Статус стабильно вычисляется по номеру рейса (хэш), а не Math.random(),
// чтобы при каждом ре-рендере/обновлении картинка не "прыгала".
useEffect(() => {
  if (!demoMode) return;

  const source = allShipments.length > 0 ? allShipments : data;
  const map = new Map<string, { distance: number | null; eta: number | null; arrived: boolean; arrived_at: string | null }>();

  source.forEach((item) => {
    const number = (item as { number?: string }).number;
    if (!number) return;

    let hash = 0;
    for (let i = 0; i < number.length; i++) {
      hash = (hash * 31 + number.charCodeAt(i)) >>> 0;
    }

    const arrived = hash % 2 === 0;
    if (arrived) {
      map.set(number, { distance: 0, eta: 0, arrived: true, arrived_at: null });
    } else {
      const distance = 3 + (hash % 25); // 3–27 км до объекта
      const eta = 4 + (hash % 40); // 4–43 мин
      map.set(number, { distance, eta, arrived: false, arrived_at: null });
    }
  });

  setTruckDistances(map);
}, [demoMode, allShipments, data]);





  
  
  // Загрузка объединённых данных для Айсберг
  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchCombinedData = async () => {
      if (!shouldUseCombined) {
        if (isMountedRef.current) {
          setCombinedData([]);
          setCombinedLoading(false);
        }
        return;
      }
      
      if (isMountedRef.current) {
        setCombinedLoading(true);
      }
      
      try {
        let factoriesToLoad: string[] = [];
        if (selectedFactory === 'all') {
          factoriesToLoad = ['СП', 'Щ'];
        } else {
          factoriesToLoad = [selectedFactory];
        }
        
        const allResults: CombinedRequest[] = [];
        
        for (const factory of factoriesToLoad) {
          const encodedFactory = encodeURIComponent(factory);
          const response = await fetch(`/api/combined-requests?factory=${encodedFactory}`);
          const result = await response.json();
          
          if (isMountedRef.current && !result.error && Array.isArray(result)) {
            allResults.push(...result);
          }
        }
        
        let filteredResults = allResults;
        if (isConcreteOnly) {
          filteredResults = allResults.filter(item => isConcreteMaterial(item.material));
        } else if (mainTab === 'shipment') {
          filteredResults = allResults.filter(item => {
            return !isConcreteMaterial(item.material) && !isSpecialMaterial(item.material);
          });
        }
        
        if (isMountedRef.current) {
          setCombinedData(filteredResults);
          setCombinedLoading(false);
        }
      } catch (err) {
        console.error('Error loading combined data:', err);
        if (isMountedRef.current) {
          setCombinedData([]);
          setCombinedLoading(false);
        }
      }
    };
    
    fetchCombinedData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [shouldUseCombined, selectedFactory, isConcreteOnly, mainTab]);
  
  // ============================================
  // ЛОГИКА ДЛЯ ТАС (ЛХ, ЛЮ)
  // ============================================
  
  const requestsMap = new Map<string, { quantity: number; closed: boolean | null }>();
  outgoingRequests.forEach(req => {
    const key = req.number;
    requestsMap.set(key, { quantity: req.quantity, closed: req.closed || false });
  });
  
  const groupedByDateAndRequest = !shouldUseCombined ? data.reduce((acc, item) => {
    const dateKey = getDateKey(item.date);
    
    if (mainTab === 'incoming') {
      const incoming = item as IncomingItem;
      
      let factory = '—';
      if (incoming.number?.startsWith('ЛХ')) factory = 'ЛХ';
      else if (incoming.number?.startsWith('ЛЮ')) factory = 'ЛЮ';
      else if (incoming.number?.startsWith('СП')) factory = 'СП';
      else if (incoming.number?.startsWith('Щ')) factory = 'Щ';
      else if (incoming.division === 'ЛХ') factory = 'ЛХ';
      else if (incoming.division === 'ЛЮ') factory = 'ЛЮ';
      else if (incoming.division === 'СП') factory = 'СП';
      else if (incoming.division === 'Щ') factory = 'Щ';
      // Демо (и любые прочие незнакомые коды) — показываем короткой
      // меткой, вместо того чтобы схлопывать в "—".
      else if (incoming.division === 'ДЕМО-СЕВ') factory = 'СЕ';
      else if (incoming.division === 'ДЕМО-ЮГ') factory = 'ЮГ';
      else if (incoming.division) factory = incoming.division;

      // Раньше в ключ группы попадали ещё и номер документа, и госномер
      // машины — а они уникальны для КАЖДОЙ отдельной машины, поэтому
      // группа никогда не получала больше одной машины: "агрегат" не
      // работал, каждая поставка рисовалась отдельной строкой. Группируем
      // так же, как везде — по дню+заводу+материалу+поставщику, а машины
      // (документы) внутри дня складываются в один vehicles[] массив.
      const groupKey = `${dateKey}_${factory}_${incoming.material}_${incoming.supplier}`;

      if (!acc[dateKey]) {
        acc[dateKey] = new Map<string, GroupedItem>();
      }
      
      const itemTime = formatTime(incoming.date);
      const itemUnit = 'т';
      
      if (!acc[dateKey].has(groupKey)) {
        acc[dateKey].set(groupKey, {
          time: itemTime,
          factQuantity: incoming.quantity,
          planQuantity: 0,
          consignee: incoming.supplier,
          factories: [factory],
          truckCount: 1,
          material: incoming.material,
          requestNumber: '',
          requestDate: '',
          closed: false,
          supplier: incoming.supplier,
          unit: itemUnit,
          vehicles: [{
            licensePlate: incoming.licensePlate || '—',
            factory: factory,
            quantity: incoming.quantity,
            time: itemTime,
            driver: incoming.driver || '—',
            material: incoming.material,
            supplier: incoming.supplier,
          }],
        });
      } else {
        const existing = acc[dateKey].get(groupKey)!;
        existing.factQuantity += incoming.quantity;
        existing.truckCount += 1;
        if (!existing.factories.includes(factory) && factory !== '—') {
          existing.factories.push(factory);
        }
        existing.vehicles.push({
          licensePlate: incoming.licensePlate || '—',
          factory: factory,
          quantity: incoming.quantity,
          time: itemTime,
          driver: incoming.driver || '—',
          material: incoming.material,
          supplier: incoming.supplier,
        });
        if (itemTime > existing.time) {
          existing.time = itemTime;
        }
      }
    } else {
      const shipment = item as ShipmentItem;
      
      if (isConcreteOnly && !isConcreteMaterial(shipment.material)) return acc;
      if (mainTab === 'shipment' && isConcreteMaterial(shipment.material)) return acc;
      // Инертные материалы (БНД, Стилобит, гранит, щебень и т.п.) пока
      // нигде отдельно не отображаем — убираем и из Асфальта, и из Бетона.
      if (mainTab === 'shipment' && isSpecialMaterial(shipment.material)) return acc;

      const requestNumber = shipment.clientRequestNumber || '';
      const requestDate = shipment.clientRequestDate || '';
      const division = shipment.division || '';
      
      let factory = '—';
      if (shipment.division === 'ЛХ') factory = 'ЛХ';
      else if (shipment.division === 'ЛЮ') factory = 'ЛЮ';
      else if (shipment.division === 'СП') factory = 'СП';
      else if (shipment.division === 'Щ') factory = 'Щ';
      // Демо (и любые прочие незнакомые коды) — показываем короткой меткой.
      else if (shipment.division === 'ДЕМО-СЕВ') factory = 'СЕ';
      else if (shipment.division === 'ДЕМО-ЮГ') factory = 'ЮГ';
      else if (shipment.division) factory = shipment.division;

      const consigneeKey = shipment.consignee || shipment.customer || '—';
      const groupKey = `${dateKey}_${requestNumber}_${consigneeKey}_${shipment.material}`;
      
      let planQuantity = 0;
      let requestClosed = false;
      const request = requestsMap.get(requestNumber);
      if (request) {
        planQuantity = request.quantity;
        requestClosed = request.closed || false;
      }
      
      if (!acc[dateKey]) {
        acc[dateKey] = new Map<string, GroupedItem>();
      }
      
      const itemTime = formatTime(shipment.date);
      const itemUnit = isConcreteMaterial(shipment.material) ? 'м³' : 'т';
      
      if (!acc[dateKey].has(groupKey)) {
        acc[dateKey].set(groupKey, {
          time: itemTime,
          factQuantity: shipment.quantity,
          planQuantity: planQuantity,
          consignee: consigneeKey,
          factories: [factory],
          truckCount: 1,
          material: shipment.material,
          closed: requestClosed,
          requestNumber: requestNumber,
          requestDate: requestDate,
          unit: itemUnit,
          vehicles: [{
            licensePlate: shipment.licensePlate || '—',
            factory: factory,
            quantity: shipment.quantity,
            time: itemTime,
            driver: shipment.driver || '—',
            driverPhone: demoMode && shipment.driver ? DEMO_DRIVER_PHONES[shipment.driver] : undefined,
            shipmentNumber: shipment.number,
          }],
        });
      } else {
        const existing = acc[dateKey].get(groupKey)!;
        existing.factQuantity += shipment.quantity;
        existing.truckCount += 1;
        if (planQuantity > existing.planQuantity) {
          existing.planQuantity = planQuantity;
        }
        if (!existing.factories.includes(factory) && factory !== '—') {
          existing.factories.push(factory);
        }
        existing.vehicles.push({
          licensePlate: shipment.licensePlate || '—',
          factory: factory,
          quantity: shipment.quantity,
          time: itemTime,
          driver: shipment.driver || '—',
          driverPhone: demoMode && shipment.driver ? DEMO_DRIVER_PHONES[shipment.driver] : undefined,
          shipmentNumber: shipment.number,
        });
        if (itemTime > existing.time) {
          existing.time = itemTime;
        }
      }
    }
    
    return acc;
  }, {} as Record<string, Map<string, GroupedItem>>) : {};
  
  const sortedDates = !shouldUseCombined 
    ? Object.keys(groupedByDateAndRequest).sort(compareDatesDesc)
    : [];
  
  if (!shouldUseCombined && effectiveData.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных</p>
      </div>
    );
  }
  
  if (shouldUseCombined && combinedLoading) {
    return (
      <div className="compact-view">
        <ActivityChart shipments={[]} selectedFactory={selectedFactory} mode={mode} materialType={isConcreteOnly ? 'concrete' : 'asphalt'} />
        <LoadingSpinner message="Загрузка отгрузок..." size="medium" />
      </div>
    );
  }
  
  if (shouldUseCombined && combinedData.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных по заявкам</p>
      </div>
    );
  }
  
  // ============================================
  // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ) - ОТГРУЗКИ
  // ============================================
  
  if (shouldUseCombined && isShipment) {
    const groupedByDate = combinedData.reduce((acc, item) => {
      if (!item.delivery_date) return acc;
      const dateKey = getDateKey(item.delivery_date);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(item);
      return acc;
    }, {} as Record<string, CombinedRequest[]>);
    
    const combinedSortedDates = Object.keys(groupedByDate).sort(compareDatesDesc);
    
    return (
      <div className="compact-view">
        {allShipmentsForChart && allShipmentsForChart.length > 0 && (
          <ActivityChart 
            shipments={allShipmentsForChart} 
            selectedFactory={selectedFactory}
            mode={mode}
            materialType={isConcreteOnly ? 'concrete' : 'asphalt'}
          />
        )}
        
        {combinedSortedDates.map((date, dateIdx) => {
          const items = groupedByDate[date];
          const sortedItems = [...items].sort((a, b) => {
            const timeA = a.lastShipmentTime || '00:00';
            const timeB = b.lastShipmentTime || '00:00';
            const getMinutes = (time: string) => {
              const parts = time.split(':');
              const hours = parseInt(parts[0], 10);
              const minutes = parseInt(parts[1], 10);
              return hours * 60 + minutes;
            };
            return getMinutes(timeB) - getMinutes(timeA);
          });

          const dayTotal = sortedItems.reduce((sum, item) => sum + item.factQuantity, 0);
          const dayLabel = formatDateLabel(date);
          const isToday = isDateToday(date);
          const isExpandedDay = isDayExpanded(dateIdx, date);

          const firstItem = sortedItems[0];
          const unitLabel = firstItem?.unit === 'м³' ? '(м³)' : '(т)';

          return (
            <div key={date} className="compact-date-group">
              <div className="compact-date-header">
                <div
                  className="date-wrapper"
                  onClick={() => toggleDate(date)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  {isExpandedDay ? <ChevronDown size={14} strokeWidth={2.4} /> : <ChevronRight size={14} strokeWidth={2.4} />}
                  <span className="date-text" style={{ fontWeight: 'bold' }}>{dayLabel}</span>
                  {isToday && <span className="today-badge">СЕГОДНЯ</span>}
                </div>
                {isExpandedDay ? (
                  <span className="date-total" style={{ fontWeight: 'bold' }}>{dayTotal.toFixed(0)} т</span>
                ) : (
                  <button
                    onClick={() => toggleDate(date)}
                    style={{ background: 'transparent', border: 'none', color: '#3a56d4', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '2px 6px' }}
                  >
                    Развернуть ({sortedItems.length})
                  </button>
                )}
              </div>

              {isExpandedDay && (
              <div className="compact-table">
                <div className="compact-header" style={{ fontWeight: 'bold' }}>
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-slash"></span>
                  <span className="col-plan">Заяв {unitLabel}</span>
                  <span className="col-consignee">Грузополучатель</span>
                  <span className="col-factory"><Factory size={13} strokeWidth={2.2} /></span>
                  <span className="col-trucks"><Truck size={13} strokeWidth={2.2} /></span>
                </div>
                
                {sortedItems.map((item, idx) => {
                  const itemKey = `${date}_${idx}`;
                  const isExpanded = expandedId === itemKey;
                  const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
                  const isWarning = percentComplete < 90 && percentComplete > 0;
                  const isCompleted = percentComplete >= 90 && item.planQuantity > 0;
                  const displayTime = item.lastShipmentTime || '—';
                  const isSpecial = isSpecialMaterial(item.material);
                  
                  const { value: factValue } = formatWithUnit(
                    item.factQuantity,
                    item.unit ?? null,
                    item.material
                  );
                  const { value: planValue } = formatWithUnit(
                    item.planQuantity,
                    item.unit ?? null,
                    item.material
                  );
                  
                  const displayFact = Math.round(factValue);
                  const displayPlan = Math.round(planValue);
                  
                  return (
                    <div key={idx}>
                      <div 
                        className={`compact-row compact-clickable ${isCompleted ? 'completed-row' : ''}`}
                        style={{ fontWeight: 'bold', cursor: 'pointer' }}
                        onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
                      >
                        <span className="col-time">{displayTime}</span>
                        <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
                          {displayFact}
                        </span>
                        <span className="col-slash">/</span>
                        <span className="col-plan">
                          {displayPlan > 0 ? (
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {displayPlan}
                              {item.closed ? (
                                <span className="closed-lock"> <Lock size={10} strokeWidth={2.4} style={{ verticalAlign: -1 }} /></span>
                              ) : (
                                !isCompleted && item.factQuantity > 0 && percentComplete < 90 && (
                                  <span className="active-dot" title="Идут отгрузки"></span>
                                )
                              )}
                            </span>
                          ) : '—'}
                        </span>
                        <span className="col-consignee" style={{ fontSize: '12px' }}>
                          {item.consignee}
                          {isSpecial && <span className="special-badge">ИНЕРТНЫЕ</span>}
                        </span>
                        <span className="col-factory">
                          <div className="factory-badges-group">
                            <div className={getFactoryBadgeClass(item.division)}>{item.division}</div>
                          </div>
                        </span>
                        <span className="col-trucks">{item.truckCount}</span>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            className="compact-details"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="detail-row">
                              <span className="detail-label"><Package size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Материал:</span>
                              <span className="detail-value">{item.material}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label"><Factory size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Завод:</span>
                              <span className="detail-value">{item.division}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label"><Truck size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Машин:</span>
                              <span className="detail-value">{item.truckCount}</span>
                            </div>
                            {item.vehicles.length > 0 && (
                              <div className="vehicles-list">
                                <div className="vehicles-title"><Truck size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Транспорт:</div>
                                {item.vehicles.map((vehicle, vIdx) => {
                                  const vehicleQty = vehicle.quantity;
                                  return (
                                    <div key={vIdx} className="vehicle-item">
                                      <span className="vehicle-time">{vehicle.fullDateTime || vehicle.time}</span>
                                      <span className="vehicle-license">{vehicle.licensePlate}</span>
                                      <span className="vehicle-driver-inline"><User size={11} strokeWidth={2.2} style={{ marginRight: 2, verticalAlign: -1 }} />{vehicle.driver}</span>
                                      <span className="vehicle-quantity">
                                        {vehicleQty.toFixed(1)} {item.unit === 'м³' ? 'м³' : 'т'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================
  // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ) - ПОСТУПЛЕНИЯ
  // ============================================

  if (mode === 'iceberg' && mainTab === 'incoming') {
    const groupedIncoming = data.reduce((acc, item) => {
      const incoming = item as IncomingItem;
      const dateKey = getIncomingDateKey(incoming.date);
      const factory = detectFactory(incoming, 'incoming');

      // detectFactory() возвращает КОРОТКИЙ код (СЕ/ЮГ для демо-дивизий,
      // а не сырой division 'ДЕМО-СЕВ'/'ДЕМО-ЮГ') — раньше тут сверяли
      // с сырыми строками, которые из detectFactory никогда не приходят,
      // поэтому ВСЕ демо-поступления отсеивались и "Поступление" →
      // "Компактно" в демо была пустой.
      if (factory !== 'СП' && factory !== 'Щ' && factory !== 'СЕ' && factory !== 'ЮГ') return acc;
      
      const orderNumber = incoming.clientRequestNumber || incoming.number || 'unknown';
      const groupKey = `${dateKey}_${orderNumber}`;
      
      if (!acc[dateKey]) {
        acc[dateKey] = new Map();
      }
      
      const itemTime = formatTime(incoming.date);
      const fullDateTime = formatFullDateTime(incoming.date);
      
      if (!acc[dateKey].has(groupKey)) {
        const newGroup: GroupedItem = {
          time: itemTime,
          lastFullDateTime: fullDateTime,
          factQuantity: incoming.quantity,
          planQuantity: 0,
          consignee: incoming.supplier,
          factories: [factory],
          truckCount: 1,
          material: incoming.material,
          requestNumber: orderNumber,
          requestDate: incoming.date,
          closed: false,
          supplier: incoming.supplier,
          vehicles: [],
          vehiclesMap: new Map(),
        };
        
        const vehicleKey = `${incoming.licensePlate || '—'}_${fullDateTime}`;
        newGroup.vehiclesMap!.set(vehicleKey, {
          licensePlate: incoming.licensePlate || '—',
          factory: factory,
          quantity: incoming.quantity,
          time: itemTime,
          fullDateTime: fullDateTime,
          driver: incoming.driver || '—',
          material: incoming.material,
          supplier: incoming.supplier,
        });
        
        acc[dateKey].set(groupKey, newGroup);
      } else {
        const existing = acc[dateKey].get(groupKey)!;
        existing.factQuantity += incoming.quantity;
        existing.truckCount += 1;
        if (!existing.factories.includes(factory)) {
          existing.factories.push(factory);
        }

        if (!existing.vehiclesMap) {
          existing.vehiclesMap = new Map();
        }
        
        const vehicleKey = `${incoming.licensePlate || '—'}_${fullDateTime}`;
        const existingVehicle = existing.vehiclesMap?.get(vehicleKey);
        
        if (existingVehicle) {
          existingVehicle.quantity += incoming.quantity;
        } else {
          if (!existing.vehiclesMap) {
            existing.vehiclesMap = new Map();
          }
          existing.vehiclesMap.set(vehicleKey, {
            licensePlate: incoming.licensePlate || '—',
            factory: factory,
            quantity: incoming.quantity,
            time: itemTime,
            fullDateTime: fullDateTime,
            driver: incoming.driver || '—',
            material: incoming.material,
            supplier: incoming.supplier,
          });
        }
        
        if (fullDateTime > (existing.lastFullDateTime || existing.time)) {
          existing.lastFullDateTime = fullDateTime;
          existing.time = itemTime;
        }
      }
      
      return acc;
    }, {} as Record<string, Map<string, GroupedItem>>);
    
    for (const dateKey of Object.keys(groupedIncoming)) {
      for (const [groupKey, group] of groupedIncoming[dateKey]) {
        if (group.vehiclesMap) {
          group.vehicles = Array.from(group.vehiclesMap.values());
          delete group.vehiclesMap;
        }
      }
    }
    
    const incomingSortedDates = Object.keys(groupedIncoming).sort(compareDatesDesc);
    
    return (
      <div className="compact-view">
        {incomingSortedDates.map((dateKey, dateIdx) => {
          const items = Array.from(groupedIncoming[dateKey].values());
          const sortedItems = [...items].sort((a, b) => {
            const dateTimeA = a.lastFullDateTime || (a.vehicles[0]?.fullDateTime) || a.time;
            const dateTimeB = b.lastFullDateTime || (b.vehicles[0]?.fullDateTime) || b.time;
            return dateTimeB.localeCompare(dateTimeA);
          });
          const isToday = isIncomingDateToday(dateKey);
          const isExpandedDay = isDayExpanded(dateIdx, dateKey);

          return (
            <div key={dateKey} className="compact-date-group">
              <div className="compact-date-header">
                <div
                  className="date-wrapper"
                  onClick={() => toggleDate(dateKey)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  {isExpandedDay ? <ChevronDown size={14} strokeWidth={2.4} /> : <ChevronRight size={14} strokeWidth={2.4} />}
                  <span className="date-text" style={{ fontWeight: 'bold' }}>{formatIncomingDateLabel(dateKey)}</span>
                  {isToday && <span className="today-badge">СЕГОДНЯ</span>}
                </div>
                {!isExpandedDay && (
                  <button
                    onClick={() => toggleDate(dateKey)}
                    style={{ background: 'transparent', border: 'none', color: '#3a56d4', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '2px 6px' }}
                  >
                    Развернуть ({sortedItems.length})
                  </button>
                )}
              </div>

              {isExpandedDay && (
              <div className="compact-table">
                <div className="compact-header" style={{ fontWeight: 'bold' }}>
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-material-header">Материал</span>
                  <span className="col-supplier">Контрагент</span>
                  <span className="col-factory"><Factory size={13} strokeWidth={2.2} /></span>
                  <span className="col-trucks"><Truck size={13} strokeWidth={2.2} /></span>
                </div>
                
                {sortedItems.map((item, idx) => {
                  const itemKey = `${dateKey}_${idx}`;
                  const isExpanded = expandedId === itemKey;
                  
                  const { value: factValue } = formatWithUnit(
                    item.factQuantity,
                    item.unit ?? null,
                    item.material
                  );
                  const displayFact = Math.round(factValue);
                  
                  const sortedVehicles = [...item.vehicles].sort((a, b) => {
                    const dateA = a.fullDateTime || a.time;
                    const dateB = b.fullDateTime || b.time;
                    return dateB.localeCompare(dateA);
                  });
                  
                  return (
                    <div key={idx}>
                      <div
                        className="compact-row compact-clickable"
                        style={{ fontWeight: 'bold', cursor: 'pointer', position: 'relative' }}
                        onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
                      >
                        <span className="col-time">{item.time}</span>
                        <span className="col-fact">{displayFact}</span>
                        <span className="col-material-header" style={{ fontSize: '13px' }}>{item.material}</span>
                        <span className="col-supplier" style={{ fontSize: '12px' }}>{item.consignee}</span>
                        <span className="col-factory">
                          <div className="factory-badges-group">
                            {item.factories.map((factory, i) => (
                              <div key={i} className={getFactoryBadgeClass(factory)}>
                                {factory}
                              </div>
                            ))}
                          </div>
                        </span>
                        <span className="col-trucks">{item.truckCount}</span>
                        {demoMode && !isExpanded && <span className="tap-hint" aria-hidden="true"><Pointer size={14} strokeWidth={2.4} /></span>}
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            className="compact-details"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="detail-row">
                              <span className="detail-label"><Package size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Материал:</span>
                              <span className="detail-value">{item.material}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label"><Factory size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Завод:</span>
                              <span className="detail-value">{item.factories.join(', ')}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label"><Truck size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Машин:</span>
                              <span className="detail-value">{item.truckCount}</span>
                            </div>
                            {sortedVehicles.length > 0 && (
                              <div className="vehicles-list">
                                <div className="vehicles-title"><Truck size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Транспорт:</div>
                                {sortedVehicles.map((vehicle, i) => (
                                  <div key={i} className="vehicle-item">
                                    <span className="vehicle-time">{vehicle.fullDateTime || vehicle.time}</span>
                                    <span className="vehicle-license">{vehicle.licensePlate}</span>
                                    <span className="vehicle-driver-inline"><User size={11} strokeWidth={2.2} style={{ marginRight: 2, verticalAlign: -1 }} />{vehicle.driver}</span>
                                    <span className="vehicle-quantity">
                                      {Math.round(vehicle.quantity)} т
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================
  // РЕНДЕР ДЛЯ ТАС (ЛХ, ЛЮ) - ПОСТУПЛЕНИЯ И ОТГРУЗКИ
  // ============================================
  
  return (
    <div className="compact-view">
      {isShipment && allShipmentsForChart && allShipmentsForChart.length > 0 && (
        <ActivityChart 
          shipments={allShipmentsForChart} 
          selectedFactory={selectedFactory}
          mode={mode}
          materialType="asphalt"
        />
      )}
      
      {sortedDates.map((date, dateIdx) => {
        const items = Array.from(groupedByDateAndRequest[date].values());
        const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
        const isToday = isDateToday(date);
        const isExpandedDay = isDayExpanded(dateIdx, date);

        return (
          <div key={date} className="compact-date-group">
            <div className="compact-date-header">
              <div
                className="date-wrapper"
                onClick={() => toggleDate(date)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                {isExpandedDay ? <ChevronDown size={14} strokeWidth={2.4} /> : <ChevronRight size={14} strokeWidth={2.4} />}
                <span className="date-text" style={{ fontWeight: 'bold' }}>{formatDateLabel(date)}</span>
                {isToday && <span className="today-badge">СЕГОДНЯ</span>}
              </div>
              {isExpandedDay ? (
                isShipment && <span className="date-total" style={{ fontWeight: 'bold' }}>{Math.round(dayTotal)} т</span>
              ) : (
                <button
                  onClick={() => toggleDate(date)}
                  style={{ background: 'transparent', border: 'none', color: '#3a56d4', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '2px 6px' }}
                >
                  Развернуть ({items.length})
                </button>
              )}
            </div>

            {isExpandedDay && (
            <div className="compact-table">
              {isShipment && (
                <div className="compact-header" style={{ fontWeight: 'bold' }}>
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-slash"></span>
                  <span className="col-plan">Заяв (т)</span>
                  <span className="col-consignee">Грузополучатель</span>
                  <span className="col-factory"><Factory size={13} strokeWidth={2.2} /></span>
                  <span className="col-trucks"><Truck size={13} strokeWidth={2.2} /></span>
                </div>
              )}
              
              {!isShipment && (
                <div className="compact-header" style={{ fontWeight: 'bold' }}>
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-material-header">Материал</span>
                  <span className="col-supplier">Контрагент</span>
                  <span className="col-factory"><Factory size={13} strokeWidth={2.2} /></span>
                  <span className="col-trucks"><Truck size={13} strokeWidth={2.2} /></span>
                </div>
              )}

              {[...items].sort((a, b) => {
                const timeA = a.time.split(':').map(Number);
                const timeB = b.time.split(':').map(Number);
                const minutesA = timeA[0] * 60 + timeA[1];
                const minutesB = timeB[0] * 60 + timeB[1];
                return minutesB - minutesA;
              }).map((item, idx) => {
                const itemKey = `${date}_${idx}`;
                const isExpanded = expandedId === itemKey;
                const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
                const isWarning = percentComplete < 90;
                const isCompleted = percentComplete >= 90 && item.planQuantity > 0;

                const { value: factValue } = formatWithUnit(
                  item.factQuantity,
                  item.unit ?? null,
                  item.material
                );
                const displayFact = Math.round(factValue);
                
                if (isShipment) {
                  return (
                    <div key={idx}>
                      <div
                        className={`compact-row compact-clickable ${isCompleted ? 'completed-row' : ''}`}
                        style={{ fontWeight: 'bold', cursor: 'pointer', position: 'relative' }}
                        onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
                      >
                        <span className="col-time">{item.time}</span>
                        <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
                          {displayFact}
                        </span>
                        <span className="col-slash">/</span>
                        <span className="col-plan">
                          {item.planQuantity > 0 ? (
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {Math.round(item.planQuantity)}
                              {item.closed ? (
                                <span className="closed-lock"> <Lock size={10} strokeWidth={2.4} style={{ verticalAlign: -1 }} /></span>
                              ) : (
                                !isCompleted && hasTodayShipments(allShipments, item.requestNumber) && percentComplete < 90 && (
                                  <span className="active-dot" title="Идут отгрузки"></span>
                                )
                              )}
                            </span>
                          ) : '—'}
                        </span>
                        <span className="col-consignee" style={{ fontSize: '12px' }}>{item.consignee}</span>
                        <span className="col-factory">
                          <div className="factory-badges-group">
                            {item.factories.map((factory, i) => (
                              <div key={i} className={getFactoryBadgeClass(factory)}>
                                {factory}
                              </div>
                            ))}
                          </div>
                        </span>
                        <span className="col-trucks">{item.truckCount}</span>
                        {demoMode && !isExpanded && <span className="tap-hint" aria-hidden="true"><Pointer size={14} strokeWidth={2.4} /></span>}
                      </div>










<AnimatePresence>
  {isExpanded && (
    <motion.div
      className="compact-details"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Полное имя контрагента — в свёрнутой строке колонка узкая и имя
          обрезается многоточием (text-overflow: ellipsis), а тут места
          достаточно, показываем целиком без обрезки. */}
      <div className="detail-row">
          <span className="detail-label"><Building2 size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Грузополучатель:</span>
          <span className="detail-value">{item.consignee}</span>
      </div>

      {/* Материал, без дублей */}
      <div className="detail-row">
          <span className="detail-label"><Package size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Материал:</span>
          <span className="detail-value">{item.material}</span>
      </div>

      {/* Прогресс-бар для каждой машины */}
      {item.vehicles.length > 0 && (mode === 'tas' || demoMode) && (
        <div className="truck-progress-list">
          {[...item.vehicles]
            .sort((a, b) => {
              const dateA = a.fullDateTime || a.time;
              const dateB = b.fullDateTime || b.time;
              return dateB.localeCompare(dateA);
            })
            .map((vehicle, i) => {
              // Смотрим статус конкретно ЭТОГО рейса (по номеру отгрузки),
              // а не по госномеру машины — иначе подхватится статус
              // "прибыл" от прошлого рейса этой же машины.
              const distData = vehicle.shipmentNumber
                ? truckDistances.get(vehicle.shipmentNumber)
                : undefined;
              const distance = distData?.distance ?? null;
              const isArrived = distData?.arrived ?? false;
              
              // Вычисляем общее расстояние (от завода до ПК)
              // Для простоты используем максимальное расстояние из всех машин
              // или можно вычислить по координатам
              let totalDistance = 100; // Значение по умолчанию
              const allDistances = [...truckDistances.values()]
                .map(d => d.distance)
                .filter((d): d is number => d !== null && d !== undefined);
              if (allDistances.length > 0) {
                totalDistance = Math.max(...allDistances) * 1.1;
              }
              
              return (
                // <TruckProgressBar
                //   key={i}
                //   licensePlate={vehicle.licensePlate}
                //   driver={vehicle.driver || '—'}
                //   quantity={vehicle.quantity}
                //   time={vehicle.fullDateTime || vehicle.time}
                //   distance={distance}
                //   totalDistance={totalDistance}
                //   isArrived={isArrived}
                //   unit={item.unit === 'м³' ? 'м³' : 'т'}
                //   factoryCode={item.factories?.[0] || 'ЛХ'}
                // />
//                 <TruckProgressBar
//   key={i}
//   licensePlate={vehicle.licensePlate}
//   driver={vehicle.driver || '—'}
//   quantity={vehicle.quantity}
//   time={vehicle.fullDateTime || vehicle.time}
//   distance={distance}
//   etaMinutes={distData?.eta ?? null}
//   totalDistance={totalDistance}
//   isArrived={isArrived}
//   unit={item.unit === 'м³' ? 'м³' : 'т'}
//   factoryCode={item.factories?.[0] || 'ЛХ'}
// />



<TruckProgressBar
  key={i}
  licensePlate={vehicle.licensePlate}
  driver={vehicle.driver || '—'}
  driverPhone={vehicle.driverPhone}
  quantity={vehicle.quantity}
  time={vehicle.fullDateTime || vehicle.time}
  distance={distance}
  etaMinutes={distData?.eta ?? null}
  totalDistance={totalDistance}
  isArrived={isArrived}
  unit={item.unit === 'м³' ? 'м³' : 'т'}
  factoryCode={item.factories?.[0] || 'ЛХ'}
/>



              );



              
            })}
        </div>
      )}
      
      {/* Для Айсберг — простой список без прогресс-бара (кроме демо — там показываем диаграмму) */}
      {item.vehicles.length > 0 && mode !== 'tas' && !demoMode && (
        <div className="vehicles-list">
          <div className="vehicles-title"><Truck size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Транспорт:</div>
          {[...item.vehicles]
            .sort((a, b) => {
              const dateA = a.fullDateTime || a.time;
              const dateB = b.fullDateTime || b.time;
              return dateB.localeCompare(dateA);
            })
            .map((vehicle, i) => {
              const vehicleQty = vehicle.quantity;
              const dateTime = vehicle.fullDateTime || vehicle.time;
              return (
                <div key={i} className="vehicle-item">
                  <span className="vehicle-time">{dateTime}</span>
                  <span className="vehicle-license">{vehicle.licensePlate}</span>
                  <span className="vehicle-driver-inline"><User size={11} strokeWidth={2.2} style={{ marginRight: 2, verticalAlign: -1 }} />{vehicle.driver}</span>
                  <span className="vehicle-quantity">
                    {vehicleQty.toFixed(1)} {item.unit === 'м³' ? 'м³' : 'т'}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </motion.div>
  )}
</AnimatePresence>


















                      
                    </div>
                  );
                }

                // Поступления для ТАС
                return (
                  <div key={idx}>
                    <div 
                      className="compact-row compact-clickable"
                      style={{ fontWeight: 'bold', cursor: 'pointer' }}
                      onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
                    >
                      <span className="col-time">{item.time}</span>
                      <span className="col-fact">{displayFact}</span>
                      <span className="col-material-header" style={{ fontSize: '13px' }}>{item.material}</span>
                      <span className="col-supplier" style={{ fontSize: '12px' }}>{item.consignee}</span>
                      <span className="col-factory">
                        <div className="factory-badges-group">
                          {item.factories.map((factory, i) => (
                            <div key={i} className={getFactoryBadgeClass(factory)}>
                              {factory}
                            </div>
                          ))}
                        </div>
                      </span>
                      <span className="col-trucks">{item.truckCount}</span>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          className="compact-details"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="detail-row">
                            <span className="detail-label"><Package size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Материал:</span>
                            <span className="detail-value">{item.material}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label"><Factory size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Завод:</span>
                            <span className="detail-value">{item.factories.join(', ')}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label"><Truck size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Машин:</span>
                            <span className="detail-value">{item.truckCount}</span>
                          </div>
                          {item.vehicles.length > 0 && (
                            <div className="vehicles-list">
                              <div className="vehicles-title"><Truck size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Транспорт:</div>
                              {item.vehicles.map((vehicle, i) => {
                                const vehicleQty = vehicle.quantity;
                                return (
                                  <div key={i} className="vehicle-item">
                                    <span className="vehicle-time">{vehicle.time}</span>
                                    <span className="vehicle-license">{vehicle.licensePlate}</span>
                                    <span className="vehicle-driver-inline"><User size={11} strokeWidth={2.2} style={{ marginRight: 2, verticalAlign: -1 }} />{vehicle.driver}</span>
                                    <span className="vehicle-quantity">{Math.round(vehicleQty)} т</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}















// // app/components/CompactView.tsx

// 'use client';

// import { IncomingItem, ShipmentItem } from '@/app/page';
// import { useState, useEffect, useRef } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import ActivityChart from './ActivityChart';
// import LoadingSpinner from './LoadingSpinner';
// import { 
//   isConcreteMaterial, 
//   isSpecialMaterial,
//   parseRussianDate,
//   formatTime,
//   getDateKey,
//   getFactoryBadgeClass,
//   formatWithUnit,
//   formatFullDateTime,
//   getIncomingDateKey,
//   formatIncomingDateLabel,
//   isIncomingDateToday,
//   // ✅ НОВЫЕ ИМПОРТЫ
//   calculateDistance,
//   calculateETA,
//   formatETA,
//   getTruckStatusColor,
//   getFactoryCoords,
//   parseDestinationPoint,
// } from '@/lib/utils';

// type UnifiedDataItem = IncomingItem | ShipmentItem;

// interface CombinedRequest {
//   requestNumber: string;
//   requestDate: string;
//   material: string;
//   planQuantity: number;
//   factQuantity: number;
//   consignee: string;
//   division: string;
//   closed: boolean | null;
//   delivery_date: string | null;
//   lastShipmentTime: string | null;
//   lastShipmentFullDate?: string | null;
//   truckCount: number;
//   unit?: string;
//   vehicles: Array<{
//     time: string;
//     fullDateTime?: string;
//     licensePlate: string;
//     driver: string;
//     quantity: number;
//     // ✅ ДОБАВЛЯЕМ
//     distance_to_dest?: number | null;
//     arrived?: boolean;
//     arrived_at?: string | null;
//     eta_minutes?: number | null;

//   }>;
//   destinationPoint?: string | null;
// }

// interface CompactViewProps {
//   data: UnifiedDataItem[];
//   mainTab: 'incoming' | 'shipment' | 'shipmentConcrete';
//   outgoingRequests?: Array<{
//     number: string;
//     date: string;
//     division: string;
//     quantity: number;
//     consignee: string;
//     material: string;
//     closed?: boolean | null;
//   }>;
//   allShipments?: ShipmentItem[];
//   allShipmentsForChart?: ShipmentItem[];
//   selectedFactory?: string;
//   mode?: 'tas' | 'iceberg';
// }

// interface VehicleItem {
//   licensePlate: string;
//   factory: string;
//   quantity: number;
//   time: string;
//   fullDateTime?: string;
//   driver?: string;
//   material?: string;
//   supplier?: string;


//   distance_to_dest?: number | null;
//   arrived?: boolean;
//   arrived_at?: string | null;
//   eta_minutes?: number | null;
// }

// interface GroupedItem {
//   time: string;
//   lastFullDateTime?: string;
//   factQuantity: number;
//   planQuantity: number;
//   consignee: string;
//   factories: string[];
//   truckCount: number;
//   material: string;
//   requestNumber: string;
//   requestDate: string;
//   closed: boolean | null;
//   supplier?: string;
//   unit?: string;
//   vehicles: VehicleItem[];
//   vehiclesMap?: Map<string, VehicleItem>;
//   destinationPoint?: string | null;
// }

// // ============================================
// // ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ
// // ============================================

// const formatDateLabel = (dateStr: string): string => {
//   const date = parseRussianDate(dateStr);
//   if (isNaN(date.getTime())) return dateStr;
  
//   const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
//   const day = date.getDate();
//   const month = months[date.getMonth()];
  
//   return `${day} ${month}`;
// };

// const isDateToday = (dateStr: string): boolean => {
//   const date = parseRussianDate(dateStr);
//   if (isNaN(date.getTime())) return false;
  
//   const today = new Date();
//   return date.getDate() === today.getDate() &&
//          date.getMonth() === today.getMonth() &&
//          date.getFullYear() === today.getFullYear();
// };

// const compareDatesDesc = (dateA: string, dateB: string): number => {
//   const a = parseRussianDate(dateA);
//   const b = parseRussianDate(dateB);
//   return b.getTime() - a.getTime();
// };

// const detectFactory = (item: IncomingItem | ShipmentItem, type: 'incoming' | 'shipment'): string => {
//   if (type === 'incoming') {
//     const incoming = item as IncomingItem;
//     if (incoming.division === 'ЛХ') return 'ЛХ';
//     if (incoming.division === 'ЛЮ') return 'ЛЮ';
//     if (incoming.division === 'СП') return 'СП';
//     if (incoming.division === 'Щ') return 'Щ';
//     if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
//     if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
//     if (incoming.number?.startsWith('СП')) return 'СП';
//     if (incoming.number?.startsWith('Щ')) return 'Щ';
//   } else if (type === 'shipment') {
//     const shipment = item as ShipmentItem;
//     if (shipment.division === 'ЛХ') return 'ЛХ';
//     if (shipment.division === 'ЛЮ') return 'ЛЮ';
//     if (shipment.division === 'СП') return 'СП';
//     if (shipment.division === 'Щ') return 'Щ';
//   }
//   return 'Другой';
// };

// const hasTodayShipments = (shipments: ShipmentItem[], requestNumber: string): boolean => {
//   const today = new Date();
//   return shipments.some(ship => {
//     const shipDate = parseRussianDate(ship.date);
//     const isToday = shipDate.getDate() === today.getDate() &&
//                     shipDate.getMonth() === today.getMonth() &&
//                     shipDate.getFullYear() === today.getFullYear();
//     return ship.clientRequestNumber === requestNumber && isToday;
//   });
// };

// // ============================================
// // ОСНОВНОЙ КОМПОНЕНТ
// // ============================================

// export default function CompactView({ 
//   data, 
//   mainTab, 
//   outgoingRequests = [], 
//   allShipments = [],
//   allShipmentsForChart = [],
//   selectedFactory = 'all',
//   mode = 'tas'
// }: CompactViewProps) {

//   const [expandedId, setExpandedId] = useState<string | null>(null);
//   const [combinedData, setCombinedData] = useState<CombinedRequest[]>([]);
//   const [combinedLoading, setCombinedLoading] = useState(false);
//   const isMountedRef = useRef(true);
  
//   // ✅ СОСТОЯНИЯ ДЛЯ GPS
//   const [truckPositions, setTruckPositions] = useState<Map<string, { lat: number; lng: number; vel: number; time: number }>>(new Map());
  
//   const isShipment = mainTab === 'shipment' || mainTab === 'shipmentConcrete';
//   const isConcreteOnly = mainTab === 'shipmentConcrete';
//   const shouldUseCombined = mode === 'iceberg' && isShipment;
//   const effectiveData = shouldUseCombined ? [] : data;
  
//   // ✅ ЗАГРУЗКА GPS ПОЗИЦИЙ (только для ТАС)
//   useEffect(() => {
//     if (mode !== 'tas') return;
    
//     const loadTruckPositions = async () => {
//       try {
//         const response = await fetch('/api/trucks');
//         const data = await response.json();
//         if (data.success && data.trucks) {
//           const map = new Map<string, { lat: number; lng: number; vel: number; time: number }>();
//           data.trucks.forEach((t: { name: string; position: { lat: number; lng: number; vel: number; time: number } | null }) => {
//             if (t.position) {
//               map.set(t.name, t.position);
//             }
//           });
//           setTruckPositions(map);
//         }
//       } catch (err) {
//         console.error('Error loading truck positions:', err);
//       }
//     };
    
//     loadTruckPositions();
//     const interval = setInterval(loadTruckPositions, 60000); // Обновляем каждую минуту
    
//     return () => clearInterval(interval);
//   }, [mode]);
  
//   // Загрузка объединённых данных для Айсберг
//   useEffect(() => {
//     isMountedRef.current = true;
    
//     const fetchCombinedData = async () => {
//       if (!shouldUseCombined) {
//         if (isMountedRef.current) {
//           setCombinedData([]);
//           setCombinedLoading(false);
//         }
//         return;
//       }
      
//       if (isMountedRef.current) {
//         setCombinedLoading(true);
//       }
      
//       try {
//         let factoriesToLoad: string[] = [];
//         if (selectedFactory === 'all') {
//           factoriesToLoad = ['СП', 'Щ'];
//         } else {
//           factoriesToLoad = [selectedFactory];
//         }
        
//         const allResults: CombinedRequest[] = [];
        
//         for (const factory of factoriesToLoad) {
//           const encodedFactory = encodeURIComponent(factory);
//           const response = await fetch(`/api/combined-requests?factory=${encodedFactory}`);
//           const result = await response.json();
          
//           if (isMountedRef.current && !result.error && Array.isArray(result)) {
//             allResults.push(...result);
//           }
//         }
        
//         let filteredResults = allResults;
//         if (isConcreteOnly) {
//           filteredResults = allResults.filter(item => isConcreteMaterial(item.material));
//         } else if (mainTab === 'shipment') {
//           filteredResults = allResults.filter(item => {
//             return !isConcreteMaterial(item.material) && !isSpecialMaterial(item.material);
//           });
//         }
        
//         if (isMountedRef.current) {
//           setCombinedData(filteredResults);
//           setCombinedLoading(false);
//         }
//       } catch (err) {
//         console.error('Error loading combined data:', err);
//         if (isMountedRef.current) {
//           setCombinedData([]);
//           setCombinedLoading(false);
//         }
//       }
//     };
    
//     fetchCombinedData();
    
//     return () => {
//       isMountedRef.current = false;
//     };
//   }, [shouldUseCombined, selectedFactory, isConcreteOnly, mainTab]);
  
//   // ============================================
//   // ЛОГИКА ДЛЯ ТАС (ЛХ, ЛЮ)
//   // ============================================
  
//   const requestsMap = new Map<string, { quantity: number; closed: boolean | null }>();
//   outgoingRequests.forEach(req => {
//     const key = req.number;
//     requestsMap.set(key, { quantity: req.quantity, closed: req.closed || false });
//   });
  
//   const groupedByDateAndRequest = !shouldUseCombined ? data.reduce((acc, item) => {
//     const dateKey = getDateKey(item.date);
    
//     if (mainTab === 'incoming') {
//       const incoming = item as IncomingItem;
      
//       let factory = '—';
//       if (incoming.number?.startsWith('ЛХ')) factory = 'ЛХ';
//       else if (incoming.number?.startsWith('ЛЮ')) factory = 'ЛЮ';
//       else if (incoming.number?.startsWith('СП')) factory = 'СП';
//       else if (incoming.number?.startsWith('Щ')) factory = 'Щ';
//       else if (incoming.division === 'ЛХ') factory = 'ЛХ';
//       else if (incoming.division === 'ЛЮ') factory = 'ЛЮ';
//       else if (incoming.division === 'СП') factory = 'СП';
//       else if (incoming.division === 'Щ') factory = 'Щ';
      
//       const documentNumber = incoming.number || 'unknown';
//       const vehicleId = incoming.licensePlate || incoming.driver || 'unknown';
//       const groupKey = `${dateKey}_${factory}_${incoming.material}_${incoming.supplier}_${documentNumber}_${vehicleId}`;
      
//       if (!acc[dateKey]) {
//         acc[dateKey] = new Map<string, GroupedItem>();
//       }
      
//       const itemTime = formatTime(incoming.date);
//       const itemUnit = 'т';
      
//       if (!acc[dateKey].has(groupKey)) {
//         acc[dateKey].set(groupKey, {
//           time: itemTime,
//           factQuantity: incoming.quantity,
//           planQuantity: 0,
//           consignee: incoming.supplier,
//           factories: [factory],
//           truckCount: 1,
//           material: incoming.material,
//           requestNumber: '',
//           requestDate: '',
//           closed: false,
//           supplier: incoming.supplier,
//           unit: itemUnit,
//           vehicles: [{
//             licensePlate: incoming.licensePlate || '—',
//             factory: factory,
//             quantity: incoming.quantity,
//             time: itemTime,
//             driver: incoming.driver || '—',
//             material: incoming.material,
//             supplier: incoming.supplier,
//           }],
//         });
//       } else {
//         const existing = acc[dateKey].get(groupKey)!;
//         existing.factQuantity += incoming.quantity;
//         existing.truckCount += 1;
//         if (!existing.factories.includes(factory) && factory !== '—') {
//           existing.factories.push(factory);
//         }
//         existing.vehicles.push({
//           licensePlate: incoming.licensePlate || '—',
//           factory: factory,
//           quantity: incoming.quantity,
//           time: itemTime,
//           driver: incoming.driver || '—',
//           material: incoming.material,
//           supplier: incoming.supplier,
//         });
//         if (itemTime > existing.time) {
//           existing.time = itemTime;
//         }
//       }
//     } else {
//       const shipment = item as ShipmentItem;
      
//       if (isConcreteOnly && !isConcreteMaterial(shipment.material)) return acc;
//       if (mainTab === 'shipment' && isConcreteMaterial(shipment.material)) return acc;
      
//       const requestNumber = shipment.clientRequestNumber || '';
//       const requestDate = shipment.clientRequestDate || '';
//       const division = shipment.division || '';
      
//       let factory = '—';
//       if (shipment.division === 'ЛХ') factory = 'ЛХ';
//       else if (shipment.division === 'ЛЮ') factory = 'ЛЮ';
//       else if (shipment.division === 'СП') factory = 'СП';
//       else if (shipment.division === 'Щ') factory = 'Щ';

//       const consigneeKey = shipment.consignee || shipment.customer || '—';
//       const groupKey = `${dateKey}_${requestNumber}_${consigneeKey}_${shipment.material}`;
      
//       let planQuantity = 0;
//       let requestClosed = false;
//       const request = requestsMap.get(requestNumber);
//       if (request) {
//         planQuantity = request.quantity;
//         requestClosed = request.closed || false;
//       }
      
//       if (!acc[dateKey]) {
//         acc[dateKey] = new Map<string, GroupedItem>();
//       }
      
//       const itemTime = formatTime(shipment.date);
//       const itemUnit = isConcreteMaterial(shipment.material) ? 'м³' : 'т';
      
//       if (!acc[dateKey].has(groupKey)) {
//         acc[dateKey].set(groupKey, {
//           time: itemTime,
//           factQuantity: shipment.quantity,
//           planQuantity: planQuantity,
//           consignee: consigneeKey,
//           factories: [factory],
//           truckCount: 1,
//           material: shipment.material,
//           closed: requestClosed,
//           requestNumber: requestNumber,
//           requestDate: requestDate,
//           unit: itemUnit,
//           destinationPoint: shipment.destinationPoint || null,
//           vehicles: [{
//             licensePlate: shipment.licensePlate || '—',
//             factory: factory,
//             quantity: shipment.quantity,
//             time: itemTime,
//             driver: shipment.driver || '—',
//           }],
//         });
//       } else {
//         const existing = acc[dateKey].get(groupKey)!;
//         existing.factQuantity += shipment.quantity;
//         existing.truckCount += 1;
//         if (planQuantity > existing.planQuantity) {
//           existing.planQuantity = planQuantity;
//         }
//         if (!existing.factories.includes(factory) && factory !== '—') {
//           existing.factories.push(factory);
//         }
//         existing.vehicles.push({
//           licensePlate: shipment.licensePlate || '—',
//           factory: factory,
//           quantity: shipment.quantity,
//           time: itemTime,
//           driver: shipment.driver || '—',
//         });
//         if (itemTime > existing.time) {
//           existing.time = itemTime;
//         }
//       }
//     }
    
//     return acc;
//   }, {} as Record<string, Map<string, GroupedItem>>) : {};
  
//   const sortedDates = !shouldUseCombined 
//     ? Object.keys(groupedByDateAndRequest).sort(compareDatesDesc)
//     : [];
  
//   if (!shouldUseCombined && effectiveData.length === 0) {
//     return (
//       <div className="empty">
//         <p>Нет данных</p>
//       </div>
//     );
//   }
  
//   if (shouldUseCombined && combinedLoading) {
//     return (
//       <div className="compact-view">
//         <ActivityChart shipments={[]} selectedFactory={selectedFactory} mode={mode} materialType={isConcreteOnly ? 'concrete' : 'asphalt'} />
//         <LoadingSpinner message="Загрузка отгрузок..." size="medium" />
//       </div>
//     );
//   }
  
//   if (shouldUseCombined && combinedData.length === 0) {
//     return (
//       <div className="empty">
//         <p>Нет данных по заявкам</p>
//       </div>
//     );
//   }
  
//   // ============================================
//   // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ) - ОТГРУЗКИ
//   // ============================================
  
//   if (shouldUseCombined && isShipment) {
//     const groupedByDate = combinedData.reduce((acc, item) => {
//       if (!item.delivery_date) return acc;
//       const dateKey = getDateKey(item.delivery_date);
//       if (!acc[dateKey]) {
//         acc[dateKey] = [];
//       }
//       acc[dateKey].push(item);
//       return acc;
//     }, {} as Record<string, CombinedRequest[]>);
    
//     const combinedSortedDates = Object.keys(groupedByDate).sort(compareDatesDesc);
    
//     return (
//       <div className="compact-view">
//         {allShipmentsForChart && allShipmentsForChart.length > 0 && (
//           <ActivityChart 
//             shipments={allShipmentsForChart} 
//             selectedFactory={selectedFactory}
//             mode={mode}
//             materialType={isConcreteOnly ? 'concrete' : 'asphalt'}
//           />
//         )}
        
//         {combinedSortedDates.map(date => {
//           const items = groupedByDate[date];
//           const sortedItems = [...items].sort((a, b) => {
//             const timeA = a.lastShipmentTime || '00:00';
//             const timeB = b.lastShipmentTime || '00:00';
//             const getMinutes = (time: string) => {
//               const parts = time.split(':');
//               const hours = parseInt(parts[0], 10);
//               const minutes = parseInt(parts[1], 10);
//               return hours * 60 + minutes;
//             };
//             return getMinutes(timeB) - getMinutes(timeA);
//           });
          
//           const dayTotal = sortedItems.reduce((sum, item) => sum + item.factQuantity, 0);
//           const dayLabel = formatDateLabel(date);
//           const isToday = isDateToday(date);
          
//           const firstItem = sortedItems[0];
//           const unitLabel = firstItem?.unit === 'м³' ? '(м³)' : '(т)';
          
//           return (
//             <div key={date} className="compact-date-group">
//               <div className="compact-date-header">
//                 <div className="date-wrapper">
//                   <span className="date-text" style={{ fontWeight: 'bold' }}>{dayLabel}</span>
//                   {isToday && <span className="today-badge">СЕГОДНЯ</span>}
//                 </div>
//                 <span className="date-total" style={{ fontWeight: 'bold' }}>{dayTotal.toFixed(0)} т</span>
//               </div>
              
//               <div className="compact-table">
//                 <div className="compact-header" style={{ fontWeight: 'bold' }}>
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-slash"></span>
//                   <span className="col-plan">Заяв {unitLabel}</span>
//                   <span className="col-consignee">Грузополучатель</span>
//                   <span className="col-factory">🏭</span>
//                   <span className="col-trucks">🚛</span>
//                 </div>
                
//                 {sortedItems.map((item, idx) => {
//                   const itemKey = `${date}_${idx}`;
//                   const isExpanded = expandedId === itemKey;
//                   const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
//                   const isWarning = percentComplete < 90 && percentComplete > 0;
//                   const isCompleted = percentComplete >= 90 && item.planQuantity > 0;
//                   const displayTime = item.lastShipmentTime || '—';
//                   const isSpecial = isSpecialMaterial(item.material);
                  
//                   const { value: factValue } = formatWithUnit(
//                     item.factQuantity,
//                     item.unit ?? null,
//                     item.material
//                   );
//                   const { value: planValue } = formatWithUnit(
//                     item.planQuantity,
//                     item.unit ?? null,
//                     item.material
//                   );
                  
//                   const displayFact = Math.round(factValue);
//                   const displayPlan = Math.round(planValue);
                  
//                   return (
//                     <div key={idx}>
//                       <div 
//                         className={`compact-row compact-clickable ${isCompleted ? 'completed-row' : ''}`}
//                         style={{ fontWeight: 'bold', cursor: 'pointer' }}
//                         onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
//                       >
//                         <span className="col-time">{displayTime}</span>
//                         <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
//                           {displayFact}
//                         </span>
//                         <span className="col-slash">/</span>
//                         <span className="col-plan">
//                           {displayPlan > 0 ? (
//                             <span style={{ whiteSpace: 'nowrap' }}>
//                               {displayPlan}
//                               {item.closed ? (
//                                 <span className="closed-lock"> <Lock size={10} strokeWidth={2.4} style={{ verticalAlign: -1 }} /></span>
//                               ) : (
//                                 !isCompleted && item.factQuantity > 0 && percentComplete < 90 && (
//                                   <span className="active-dot" title="Идут отгрузки"></span>
//                                 )
//                               )}
//                             </span>
//                           ) : '—'}
//                         </span>
//                         <span className="col-consignee" style={{ fontSize: '12px' }}>
//                           {item.consignee}
//                           {isSpecial && <span className="special-badge">ИНЕРТНЫЕ</span>}
//                         </span>
//                         <span className="col-factory">
//                           <div className="factory-badges-group">
//                             <div className={getFactoryBadgeClass(item.division)}>{item.division}</div>
//                           </div>
//                         </span>
//                         <span className="col-trucks">{item.truckCount}</span>
//                       </div>

//                       <AnimatePresence>
//                         {isExpanded && (
//                           <motion.div
//                             className="compact-details"
//                             initial={{ opacity: 0, height: 0 }}
//                             animate={{ opacity: 1, height: 'auto' }}
//                             exit={{ opacity: 0, height: 0 }}
//                             transition={{ duration: 0.2 }}
//                           >
//                             <div className="detail-row">
//                               <span className="detail-label"><Package size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Материал:</span>
//                               <span className="detail-value">{item.material}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label"><Factory size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Завод:</span>
//                               <span className="detail-value">{item.division}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label">🚛 Машин:</span>
//                               <span className="detail-value">{item.truckCount}</span>
//                             </div>
//                             {item.vehicles.length > 0 && (
//                               <div className="vehicles-list">
//                                 <div className="vehicles-title">🚛 Транспорт:</div>
//                                 {item.vehicles.map((vehicle, vIdx) => {
//                                   const vehicleQty = vehicle.quantity;
//                                   return (
//                                     <div key={vIdx} className="vehicle-item">
//                                       <span className="vehicle-time">{vehicle.fullDateTime || vehicle.time}</span>
//                                       <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                       <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                       <span className="vehicle-quantity">
//                                         {vehicleQty.toFixed(1)} {item.unit === 'м³' ? 'м³' : 'т'}
//                                       </span>
//                                     </div>
//                                   );
//                                 })}
//                               </div>
//                             )}
//                           </motion.div>
//                         )}
//                       </AnimatePresence>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     );
//   }
  
//   // ============================================
//   // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ) - ПОСТУПЛЕНИЯ
//   // ============================================
  
//   if (mode === 'iceberg' && mainTab === 'incoming') {
//     const groupedIncoming = data.reduce((acc, item) => {
//       const incoming = item as IncomingItem;
//       const dateKey = getIncomingDateKey(incoming.date);
//       const factory = detectFactory(incoming, 'incoming');
      
//       if (factory !== 'СП' && factory !== 'Щ') return acc;
      
//       const orderNumber = incoming.clientRequestNumber || incoming.number || 'unknown';
//       const groupKey = `${dateKey}_${orderNumber}`;
      
//       if (!acc[dateKey]) {
//         acc[dateKey] = new Map();
//       }
      
//       const itemTime = formatTime(incoming.date);
//       const fullDateTime = formatFullDateTime(incoming.date);
      
//       if (!acc[dateKey].has(groupKey)) {
//         const newGroup: GroupedItem = {
//           time: itemTime,
//           lastFullDateTime: fullDateTime,
//           factQuantity: incoming.quantity,
//           planQuantity: 0,
//           consignee: incoming.supplier,
//           factories: [factory],
//           truckCount: 1,
//           material: incoming.material,
//           requestNumber: orderNumber,
//           requestDate: incoming.date,
//           closed: false,
//           supplier: incoming.supplier,
//           vehicles: [],
//           vehiclesMap: new Map(),
//         };
        
//         const vehicleKey = `${incoming.licensePlate || '—'}_${fullDateTime}`;
//         newGroup.vehiclesMap!.set(vehicleKey, {
//           licensePlate: incoming.licensePlate || '—',
//           factory: factory,
//           quantity: incoming.quantity,
//           time: itemTime,
//           fullDateTime: fullDateTime,
//           driver: incoming.driver || '—',
//           material: incoming.material,
//           supplier: incoming.supplier,
//         });
        
//         acc[dateKey].set(groupKey, newGroup);
//       } else {
//         const existing = acc[dateKey].get(groupKey)!;
//         existing.factQuantity += incoming.quantity;
//         existing.truckCount += 1;
//         if (!existing.factories.includes(factory)) {
//           existing.factories.push(factory);
//         }

//         if (!existing.vehiclesMap) {
//           existing.vehiclesMap = new Map();
//         }
        
//         const vehicleKey = `${incoming.licensePlate || '—'}_${fullDateTime}`;
//         const existingVehicle = existing.vehiclesMap?.get(vehicleKey);
        
//         if (existingVehicle) {
//           existingVehicle.quantity += incoming.quantity;
//         } else {
//           if (!existing.vehiclesMap) {
//             existing.vehiclesMap = new Map();
//           }
//           existing.vehiclesMap.set(vehicleKey, {
//             licensePlate: incoming.licensePlate || '—',
//             factory: factory,
//             quantity: incoming.quantity,
//             time: itemTime,
//             fullDateTime: fullDateTime,
//             driver: incoming.driver || '—',
//             material: incoming.material,
//             supplier: incoming.supplier,
//           });
//         }
        
//         if (fullDateTime > (existing.lastFullDateTime || existing.time)) {
//           existing.lastFullDateTime = fullDateTime;
//           existing.time = itemTime;
//         }
//       }
      
//       return acc;
//     }, {} as Record<string, Map<string, GroupedItem>>);
    
//     for (const dateKey of Object.keys(groupedIncoming)) {
//       for (const [groupKey, group] of groupedIncoming[dateKey]) {
//         if (group.vehiclesMap) {
//           group.vehicles = Array.from(group.vehiclesMap.values());
//           delete group.vehiclesMap;
//         }
//       }
//     }
    
//     const incomingSortedDates = Object.keys(groupedIncoming).sort(compareDatesDesc);
    
//     return (
//       <div className="compact-view">
//         {incomingSortedDates.map(dateKey => {
//           const items = Array.from(groupedIncoming[dateKey].values());
//           const sortedItems = [...items].sort((a, b) => {
//             const dateTimeA = a.lastFullDateTime || (a.vehicles[0]?.fullDateTime) || a.time;
//             const dateTimeB = b.lastFullDateTime || (b.vehicles[0]?.fullDateTime) || b.time;
//             return dateTimeB.localeCompare(dateTimeA);
//           });
//           const isToday = isIncomingDateToday(dateKey);
          
//           return (
//             <div key={dateKey} className="compact-date-group">
//               <div className="compact-date-header">
//                 <div className="date-wrapper">
//                   <span className="date-text" style={{ fontWeight: 'bold' }}>{formatIncomingDateLabel(dateKey)}</span>
//                   {isToday && <span className="today-badge">СЕГОДНЯ</span>}
//                 </div>
//               </div>
              
//               <div className="compact-table">
//                 <div className="compact-header" style={{ fontWeight: 'bold' }}>
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-material-header">Материал</span>
//                   <span className="col-supplier">Контрагент</span>
//                   <span className="col-factory">🏭</span>
//                   <span className="col-trucks">🚛</span>
//                 </div>
                
//                 {sortedItems.map((item, idx) => {
//                   const itemKey = `${dateKey}_${idx}`;
//                   const isExpanded = expandedId === itemKey;
                  
//                   const { value: factValue } = formatWithUnit(
//                     item.factQuantity,
//                     item.unit ?? null,
//                     item.material
//                   );
//                   const displayFact = Math.round(factValue);
                  
//                   const sortedVehicles = [...item.vehicles].sort((a, b) => {
//                     const dateA = a.fullDateTime || a.time;
//                     const dateB = b.fullDateTime || b.time;
//                     return dateB.localeCompare(dateA);
//                   });
                  
//                   return (
//                     <div key={idx}>
//                       <div 
//                         className="compact-row compact-clickable"
//                         style={{ fontWeight: 'bold', cursor: 'pointer' }}
//                         onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
//                       >
//                         <span className="col-time">{item.time}</span>
//                         <span className="col-fact">{displayFact}</span>
//                         <span className="col-material-header" style={{ fontSize: '13px' }}>{item.material}</span>
//                         <span className="col-supplier" style={{ fontSize: '12px' }}>{item.consignee}</span>
//                         <span className="col-factory">
//                           <div className="factory-badges-group">
//                             {item.factories.map((factory, i) => (
//                               <div key={i} className={getFactoryBadgeClass(factory)}>
//                                 {factory}
//                               </div>
//                             ))}
//                           </div>
//                         </span>
//                         <span className="col-trucks">{item.truckCount}</span>
//                       </div>
                      
//                       <AnimatePresence>
//                         {isExpanded && (
//                           <motion.div
//                             className="compact-details"
//                             initial={{ opacity: 0, height: 0 }}
//                             animate={{ opacity: 1, height: 'auto' }}
//                             exit={{ opacity: 0, height: 0 }}
//                             transition={{ duration: 0.2 }}
//                           >
//                             <div className="detail-row">
//                               <span className="detail-label"><Package size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Материал:</span>
//                               <span className="detail-value">{item.material}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label"><Factory size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Завод:</span>
//                               <span className="detail-value">{item.factories.join(', ')}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label">🚛 Машин:</span>
//                               <span className="detail-value">{item.truckCount}</span>
//                             </div>
//                             {sortedVehicles.length > 0 && (
//                               <div className="vehicles-list">
//                                 <div className="vehicles-title">🚛 Транспорт:</div>
//                                 {sortedVehicles.map((vehicle, i) => (
//                                   <div key={i} className="vehicle-item">
//                                     <span className="vehicle-time">{vehicle.fullDateTime || vehicle.time}</span>
//                                     <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                     <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                     <span className="vehicle-quantity">
//                                       {Math.round(vehicle.quantity)} т
//                                     </span>
//                                   </div>
//                                 ))}
//                               </div>
//                             )}
//                           </motion.div>
//                         )}
//                       </AnimatePresence>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     );
//   }
  
//   // ============================================
//   // РЕНДЕР ДЛЯ ТАС (ЛХ, ЛЮ) - ПОСТУПЛЕНИЯ И ОТГРУЗКИ
//   // ============================================
  
//   return (
//     <div className="compact-view">
//       {isShipment && allShipmentsForChart && allShipmentsForChart.length > 0 && (
//         <ActivityChart 
//           shipments={allShipmentsForChart} 
//           selectedFactory={selectedFactory}
//           mode={mode}
//           materialType="asphalt"
//         />
//       )}
      
//       {sortedDates.map(date => {
//         const items = Array.from(groupedByDateAndRequest[date].values());
//         const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
//         const isToday = isDateToday(date);
        
//         return (
//           <div key={date} className="compact-date-group">
//             <div className="compact-date-header">
//               <div className="date-wrapper">
//                 <span className="date-text" style={{ fontWeight: 'bold' }}>{formatDateLabel(date)}</span>
//                 {isToday && <span className="today-badge">СЕГОДНЯ</span>}
//               </div>
//               {isShipment && <span className="date-total" style={{ fontWeight: 'bold' }}>{Math.round(dayTotal)} т</span>}
//             </div>
            
//             <div className="compact-table">
//               {isShipment && (
//                 <div className="compact-header" style={{ fontWeight: 'bold' }}>
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-slash"></span>
//                   <span className="col-plan">Заяв (т)</span>
//                   <span className="col-consignee">Грузополучатель</span>
//                   <span className="col-factory">🏭</span>
//                   <span className="col-trucks">🚛</span>
//                 </div>
//               )}
              
//               {!isShipment && (
//                 <div className="compact-header" style={{ fontWeight: 'bold' }}>
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-material-header">Материал</span>
//                   <span className="col-supplier">Контрагент</span>
//                   <span className="col-factory">🏭</span>
//                   <span className="col-trucks">🚛</span>
//                 </div>
//               )}

//               {[...items].sort((a, b) => {
//                 const timeA = a.time.split(':').map(Number);
//                 const timeB = b.time.split(':').map(Number);
//                 const minutesA = timeA[0] * 60 + timeA[1];
//                 const minutesB = timeB[0] * 60 + timeB[1];
//                 return minutesB - minutesA;
//               }).map((item, idx) => {
//                 const itemKey = `${date}_${idx}`;
//                 const isExpanded = expandedId === itemKey;
//                 const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
//                 const isWarning = percentComplete < 90;
//                 const isCompleted = percentComplete >= 90 && item.planQuantity > 0;

//                 const { value: factValue } = formatWithUnit(
//                   item.factQuantity,
//                   item.unit ?? null,
//                   item.material
//                 );
//                 const displayFact = Math.round(factValue);
                
//                 if (isShipment) {
//                   return (
//                     <div key={idx}>
//                       <div 
//                         className={`compact-row compact-clickable ${isCompleted ? 'completed-row' : ''}`}
//                         style={{ fontWeight: 'bold', cursor: 'pointer' }}
//                         onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
//                       >
//                         <span className="col-time">{item.time}</span>
//                         <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
//                           {displayFact}
//                         </span>
//                         <span className="col-slash">/</span>
//                         <span className="col-plan">
//                           {item.planQuantity > 0 ? (
//                             <span style={{ whiteSpace: 'nowrap' }}>
//                               {Math.round(item.planQuantity)}
//                               {item.closed ? (
//                                 <span className="closed-lock"> <Lock size={10} strokeWidth={2.4} style={{ verticalAlign: -1 }} /></span>
//                               ) : (
//                                 !isCompleted && hasTodayShipments(allShipments, item.requestNumber) && percentComplete < 90 && (
//                                   <span className="active-dot" title="Идут отгрузки"></span>
//                                 )
//                               )}
//                             </span>
//                           ) : '—'}
//                         </span>
//                         <span className="col-consignee" style={{ fontSize: '12px' }}>{item.consignee}</span>
//                         <span className="col-factory">
//                           <div className="factory-badges-group">
//                             {item.factories.map((factory, i) => (
//                               <div key={i} className={getFactoryBadgeClass(factory)}>
//                                 {factory}
//                               </div>
//                             ))}
//                           </div>
//                         </span>
//                         <span className="col-trucks">{item.truckCount}</span>
//                       </div>

//                       <AnimatePresence>
//                         {isExpanded && (
//                           <motion.div
//                             className="compact-details"
//                             initial={{ opacity: 0, height: 0 }}
//                             animate={{ opacity: 1, height: 'auto' }}
//                             exit={{ opacity: 0, height: 0 }}
//                             transition={{ duration: 0.2 }}
//                           >
//                             <div className="detail-row">
//                               <span className="detail-label"><Package size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Материал:</span>
//                               <span className="detail-value">{item.material}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label"><Factory size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Завод:</span>
//                               <span className="detail-value">
//                                 {item.factories?.join(', ') || '—'}
//                               </span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label">🚛 Машин:</span>
//                               <span className="detail-value">{item.truckCount}</span>
//                             </div>
                            






//                             {/* {item.vehicles.length > 0 && mode === 'tas' && (
//                               <div className="vehicles-list">
//                                 <div className="vehicles-title">🚛 Транспорт:</div>
//                                 {[...item.vehicles]
//                                   .sort((a, b) => {
//                                     const dateA = a.fullDateTime || a.time;
//                                     const dateB = b.fullDateTime || b.time;
//                                     return dateB.localeCompare(dateA);
//                                   })
//                                   .map((vehicle, i) => {
//                                     const vehicleQty = vehicle.quantity;
//                                     const dateTime = vehicle.fullDateTime || vehicle.time;
                                    
//                                     // ============================================
//                                     // РАСЧЕТ РАССТОЯНИЯ И ВРЕМЕНИ (ТОЛЬКО ДЛЯ ТАС)
//                                     // ============================================
//                                     let distanceToDest: number | null = null;
//                                     let etaText: string = '⏳ Нет данных';
//                                     let isArrived = false;
                                    
//                                     // Получаем координаты ПК из destinationPoint
//                                     let destCoords = null;
//                                     if (item.destinationPoint) {
//                                       destCoords = parseDestinationPoint(item.destinationPoint);
//                                     }
                                    
//                                     // Нормализуем номер машины для поиска в GPS
//                                     const normalizedPlate = vehicle.licensePlate
//                                       .toUpperCase()
//                                       .replace(/\s/g, '')
//                                       .replace(/[^A-Z0-9]/g, '');
                                    
//                                     // Ищем позицию машины в GPS (по оригинальному номеру без нормализации)
//                                     const truck = truckPositions.get(vehicle.licensePlate);
                                    
//                                     if (truck && destCoords) {
//                                       // ✅ Есть GPS и координаты ПК — точный расчет
//                                       distanceToDest = calculateDistance(
//                                         truck.lat,
//                                         truck.lng,
//                                         destCoords.lat,
//                                         destCoords.lng
//                                       );
                                      
//                                       if (distanceToDest < 2) {
//                                         isArrived = true;
//                                         etaText = '✅ Прибыл';
//                                       } else {
//                                         const eta = calculateETA(distanceToDest);
//                                         etaText = `⏱️ ${eta.hours > 0 ? eta.hours + 'ч ' : ''}${eta.minutes}м (${distanceToDest.toFixed(1)} км)`;
//                                       }
//                                     } else if (destCoords) {
//                                       // ❌ Нет GPS — используем приблизительную оценку по порядку отгрузки
//                                       const totalVehicles = item.vehicles.length;
//                                       const sortedByTime = [...item.vehicles].sort((a, b) => {
//                                         const dateA = new Date(a.fullDateTime || a.time);
//                                         const dateB = new Date(b.fullDateTime || b.time);
//                                         return dateA.getTime() - dateB.getTime();
//                                       });
//                                       const position = sortedByTime.indexOf(vehicle);
//                                       const progress = totalVehicles > 1 ? position / (totalVehicles - 1) : 0;
                                      
//                                       // Получаем координаты завода
//                                       const factoryCoords = getFactoryCoords(item.factories?.[0] || '');
//                                       if (factoryCoords) {
//                                         const totalDistance = calculateDistance(
//                                           factoryCoords.lat,
//                                           factoryCoords.lng,
//                                           destCoords.lat,
//                                           destCoords.lng
//                                         );
//                                         const remainingDistance = totalDistance * (1 - progress);
//                                         distanceToDest = remainingDistance;
                                        
//                                         if (remainingDistance < 2) {
//                                           isArrived = true;
//                                           etaText = '✅ Прибыл';
//                                         } else {
//                                           const eta = calculateETA(remainingDistance);
//                                           etaText = `⏱️ ~${eta.hours > 0 ? eta.hours + 'ч ' : ''}${eta.minutes}м (${remainingDistance.toFixed(1)} км)`;
//                                         }
//                                       }
//                                     }
                                    
//                                     const statusColor = getTruckStatusColor(distanceToDest);
//                                     const isNear = distanceToDest !== null && distanceToDest < 10 && distanceToDest >= 2;
                                    
//                                     return (
//                                       <div key={i} className="vehicle-item" style={{
//                                         borderLeft: isArrived ? '3px solid #4ade80' : (isNear ? '3px solid #60a5fa' : 'none'),
//                                         paddingLeft: isArrived || isNear ? '8px' : '0',
//                                         background: isArrived ? 'rgba(74,222,128,0.05)' : 'transparent',
//                                         borderRadius: '4px',
//                                       }}>
//                                         <span className="vehicle-time">{dateTime}</span>
//                                         <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                         <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                         <span className="vehicle-quantity">
//                                           {vehicleQty.toFixed(1)} {item.unit === 'м³' ? 'м³' : 'т'}
//                                         </span>
//                                         <span style={{
//                                           fontSize: '11px',
//                                           color: statusColor,
//                                           marginLeft: 'auto',
//                                           minWidth: '140px',
//                                           textAlign: 'right',
//                                           fontWeight: isArrived ? 600 : (isNear ? 500 : 400),
//                                         }}>
//                                           {isArrived ? '✅ Прибыл' : etaText}
//                                         </span>
//                                       </div>
//                                     );
//                                   })}
//                               </div>
//                             )} */}
// {/* Список машин в деталях - ТАС */}

// {/* Список машин в деталях - ТАС */}
// {item.vehicles.length > 0 && mode === 'tas' && (
//   <div className="vehicles-list">
//     <div className="vehicles-title">🚛 Транспорт:</div>
//     {[...item.vehicles]
//       .sort((a, b) => {
//         const dateA = a.fullDateTime || a.time;
//         const dateB = b.fullDateTime || b.time;
//         return dateB.localeCompare(dateA);
//       })
//       .map((vehicle, i) => {
//         const vehicleQty = vehicle.quantity;
//         const dateTime = vehicle.fullDateTime || vehicle.time;
        
//         // ✅ Берем данные из БД (уже посчитаны кроном)
//         const distance = vehicle.distance_to_dest;
//         const isArrived = vehicle.arrived || false;
//         const etaMinutes = vehicle.eta_minutes;
        
//         let etaText = '⏳ Нет данных';
//         if (isArrived) {
//           etaText = '✅ Прибыл';
//         } else if (distance !== null && distance !== undefined) {
//           const hours = Math.floor((etaMinutes || 0) / 60);
//           const minutes = (etaMinutes || 0) % 60;
//           etaText = `⏱️ ${hours > 0 ? hours + 'ч ' : ''}${minutes}м (${distance.toFixed(1)} км)`;
//         }
        
//         const statusColor = isArrived 
//           ? '#4ade80' 
//           : (distance !== null && distance !== undefined && distance < 10 ? '#60a5fa' : '#94a3b8');
        
//         return (
//           <div key={i} className="vehicle-item" style={{
//             borderLeft: isArrived ? '3px solid #4ade80' : 'none',
//             paddingLeft: isArrived ? '8px' : '0',
//             background: isArrived ? 'rgba(74,222,128,0.05)' : 'transparent',
//             borderRadius: '4px',
//           }}>
//             <span className="vehicle-time">{dateTime}</span>
//             <span className="vehicle-license">{vehicle.licensePlate}</span>
//             <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//             <span className="vehicle-quantity">
//               {vehicleQty.toFixed(1)} {item.unit === 'м³' ? 'м³' : 'т'}
//             </span>
//             <span style={{
//               fontSize: '11px',
//               color: statusColor,
//               marginLeft: 'auto',
//               minWidth: '140px',
//               textAlign: 'right',
//               fontWeight: isArrived ? 600 : 400,
//             }}>
//               {etaText}
//             </span>
//           </div>
//         );
//       })}
//   </div>
// )}









                            
//                             {/* Для Айсберг или если нет GPS — показываем без расстояния */}
//                             {item.vehicles.length > 0 && mode !== 'tas' && (
//                               <div className="vehicles-list">
//                                 <div className="vehicles-title">🚛 Транспорт:</div>
//                                 {[...item.vehicles]
//                                   .sort((a, b) => {
//                                     const dateA = a.fullDateTime || a.time;
//                                     const dateB = b.fullDateTime || b.time;
//                                     return dateB.localeCompare(dateA);
//                                   })
//                                   .map((vehicle, i) => {
//                                     const vehicleQty = vehicle.quantity;
//                                     const dateTime = vehicle.fullDateTime || vehicle.time;
//                                     return (
//                                       <div key={i} className="vehicle-item">
//                                         <span className="vehicle-time">{dateTime}</span>
//                                         <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                         <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                         <span className="vehicle-quantity">
//                                           {vehicleQty.toFixed(1)} {item.unit === 'м³' ? 'м³' : 'т'}
//                                         </span>
//                                       </div>
//                                     );
//                                   })}
//                               </div>
//                             )}
//                           </motion.div>
//                         )}
//                       </AnimatePresence>
//                     </div>
//                   );
//                 }

//                 // Поступления для ТАС
//                 return (
//                   <div key={idx}>
//                     <div 
//                       className="compact-row compact-clickable"
//                       style={{ fontWeight: 'bold', cursor: 'pointer' }}
//                       onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
//                     >
//                       <span className="col-time">{item.time}</span>
//                       <span className="col-fact">{displayFact}</span>
//                       <span className="col-material-header" style={{ fontSize: '13px' }}>{item.material}</span>
//                       <span className="col-supplier" style={{ fontSize: '12px' }}>{item.consignee}</span>
//                       <span className="col-factory">
//                         <div className="factory-badges-group">
//                           {item.factories.map((factory, i) => (
//                             <div key={i} className={getFactoryBadgeClass(factory)}>
//                               {factory}
//                             </div>
//                           ))}
//                         </div>
//                       </span>
//                       <span className="col-trucks">{item.truckCount}</span>
//                     </div>
                    
//                     <AnimatePresence>
//                       {isExpanded && (
//                         <motion.div
//                           className="compact-details"
//                           initial={{ opacity: 0, height: 0 }}
//                           animate={{ opacity: 1, height: 'auto' }}
//                           exit={{ opacity: 0, height: 0 }}
//                           transition={{ duration: 0.2 }}
//                         >
//                           <div className="detail-row">
//                             <span className="detail-label">📦 Материал:</span>
//                             <span className="detail-value">{item.material}</span>
//                           </div>
//                           <div className="detail-row">
//                             <span className="detail-label">🏭 Завод:</span>
//                             <span className="detail-value">{item.factories.join(', ')}</span>
//                           </div>
//                           <div className="detail-row">
//                             <span className="detail-label">🚛 Машин:</span>
//                             <span className="detail-value">{item.truckCount}</span>
//                           </div>
//                           {item.vehicles.length > 0 && (
//                             <div className="vehicles-list">
//                               <div className="vehicles-title">🚛 Транспорт:</div>
//                               {item.vehicles.map((vehicle, i) => {
//                                 const vehicleQty = vehicle.quantity;
//                                 return (
//                                   <div key={i} className="vehicle-item">
//                                     <span className="vehicle-time">{vehicle.time}</span>
//                                     <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                     <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                     <span className="vehicle-quantity">{Math.round(vehicleQty)} т</span>
//                                   </div>
//                                 );
//                               })}
//                             </div>
//                           )}
//                         </motion.div>
//                       )}
//                     </AnimatePresence>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         );
//       })}
//     </div>
//   );
// }














// // app/components/CompactView.tsx

// 'use client';

// import { IncomingItem, ShipmentItem } from '@/app/page';
// import { useState, useEffect, useRef } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import ActivityChart from './ActivityChart';
// import LoadingSpinner from './LoadingSpinner';
// import { 
//   isConcreteMaterial, 
//   isSpecialMaterial,
//   parseRussianDate,
//   formatTime,
//   getDateKey,
//   getFactoryBadgeClass,
//   formatWithUnit,
//   formatFullDateTime,
//   getIncomingDateKey,
//   formatIncomingDateLabel,
//   isIncomingDateToday
// } from '@/lib/utils';

// type UnifiedDataItem = IncomingItem | ShipmentItem;

// interface CombinedRequest {
//   requestNumber: string;
//   requestDate: string;
//   material: string;
//   planQuantity: number;
//   factQuantity: number;
//   consignee: string;
//   division: string;
//   closed: boolean | null;
//   delivery_date: string | null;
//   lastShipmentTime: string | null;
//   lastShipmentFullDate?: string | null;
//   truckCount: number;
//   unit?: string;
//   vehicles: Array<{
//     time: string;
//     fullDateTime?: string;
//     licensePlate: string;
//     driver: string;
//     quantity: number;
//   }>;
// }

// interface CompactViewProps {
//   data: UnifiedDataItem[];
//   mainTab: 'incoming' | 'shipment' | 'shipmentConcrete';
//   outgoingRequests?: Array<{
//     number: string;
//     date: string;
//     division: string;
//     quantity: number;
//     consignee: string;
//     material: string;
//     closed?: boolean | null;
//   }>;
//   allShipments?: ShipmentItem[];
//   allShipmentsForChart?: ShipmentItem[];
//   selectedFactory?: string;
//   mode?: 'tas' | 'iceberg';
// }

// interface VehicleItem {
//   licensePlate: string;
//   factory: string;
//   quantity: number;
//   time: string;
//   fullDateTime?: string;
//   driver?: string;
//   material?: string;
//   supplier?: string;
// }

// interface GroupedItem {
//   time: string;
//   lastFullDateTime?: string;
//   factQuantity: number;
//   planQuantity: number;
//   consignee: string;
//   factories: string[];
//   truckCount: number;
//   material: string;
//   requestNumber: string;
//   requestDate: string;
//   closed: boolean | null;
//   supplier?: string;
//   unit?: string;
//   vehicles: VehicleItem[];
//   vehiclesMap?: Map<string, VehicleItem>;
// }

// // ============================================
// // ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ
// // ============================================

// const formatDateLabel = (dateStr: string): string => {
//   const date = parseRussianDate(dateStr);
//   if (isNaN(date.getTime())) return dateStr;
  
//   const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
//   const day = date.getDate();
//   const month = months[date.getMonth()];
  
//   return `${day} ${month}`;
// };

// const isDateToday = (dateStr: string): boolean => {
//   const date = parseRussianDate(dateStr);
//   if (isNaN(date.getTime())) return false;
  
//   const today = new Date();
//   return date.getDate() === today.getDate() &&
//          date.getMonth() === today.getMonth() &&
//          date.getFullYear() === today.getFullYear();
// };

// const compareDatesDesc = (dateA: string, dateB: string): number => {
//   const a = parseRussianDate(dateA);
//   const b = parseRussianDate(dateB);
//   return b.getTime() - a.getTime();
// };

// const detectFactory = (item: IncomingItem | ShipmentItem, type: 'incoming' | 'shipment'): string => {
//   if (type === 'incoming') {
//     const incoming = item as IncomingItem;
//     if (incoming.division === 'ЛХ') return 'ЛХ';
//     if (incoming.division === 'ЛЮ') return 'ЛЮ';
//     if (incoming.division === 'СП') return 'СП';
//     if (incoming.division === 'Щ') return 'Щ';
//     if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
//     if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
//     if (incoming.number?.startsWith('СП')) return 'СП';
//     if (incoming.number?.startsWith('Щ')) return 'Щ';
//   } else if (type === 'shipment') {
//     const shipment = item as ShipmentItem;
//     if (shipment.division === 'ЛХ') return 'ЛХ';
//     if (shipment.division === 'ЛЮ') return 'ЛЮ';
//     if (shipment.division === 'СП') return 'СП';
//     if (shipment.division === 'Щ') return 'Щ';
//   }
//   return 'Другой';
// };

// const hasTodayShipments = (shipments: ShipmentItem[], requestNumber: string): boolean => {
//   const today = new Date();
//   return shipments.some(ship => {
//     const shipDate = parseRussianDate(ship.date);
//     const isToday = shipDate.getDate() === today.getDate() &&
//                     shipDate.getMonth() === today.getMonth() &&
//                     shipDate.getFullYear() === today.getFullYear();
//     return ship.clientRequestNumber === requestNumber && isToday;
//   });
// };

// // ============================================
// // ОСНОВНОЙ КОМПОНЕНТ
// // ============================================

// export default function CompactView({ 
//   data, 
//   mainTab, 
//   outgoingRequests = [], 
//   allShipments = [],
//   allShipmentsForChart = [],
//   selectedFactory = 'all',
//   mode = 'tas'
// }: CompactViewProps) {

//   const [expandedId, setExpandedId] = useState<string | null>(null);
//   const [combinedData, setCombinedData] = useState<CombinedRequest[]>([]);
//   const [combinedLoading, setCombinedLoading] = useState(false);
//   const isMountedRef = useRef(true);
  
//   const isShipment = mainTab === 'shipment' || mainTab === 'shipmentConcrete';
//   const isConcreteOnly = mainTab === 'shipmentConcrete';
//   const shouldUseCombined = mode === 'iceberg' && isShipment;
//   const effectiveData = shouldUseCombined ? [] : data;
  
//   // Загрузка объединённых данных для Айсберг
//   useEffect(() => {
//     isMountedRef.current = true;
    
//     const fetchCombinedData = async () => {
//       if (!shouldUseCombined) {
//         if (isMountedRef.current) {
//           setCombinedData([]);
//           setCombinedLoading(false);
//         }
//         return;
//       }
      
//       if (isMountedRef.current) {
//         setCombinedLoading(true);
//       }
      
//       try {
//         let factoriesToLoad: string[] = [];
//         if (selectedFactory === 'all') {
//           factoriesToLoad = ['СП', 'Щ'];
//         } else {
//           factoriesToLoad = [selectedFactory];
//         }
        
//         const allResults: CombinedRequest[] = [];
        
//         for (const factory of factoriesToLoad) {
//           const encodedFactory = encodeURIComponent(factory);
//           const response = await fetch(`/api/combined-requests?factory=${encodedFactory}`);
//           const result = await response.json();
          
//           if (isMountedRef.current && !result.error && Array.isArray(result)) {
//             allResults.push(...result);
//           }
//         }
        
//         let filteredResults = allResults;
//         if (isConcreteOnly) {
//           filteredResults = allResults.filter(item => isConcreteMaterial(item.material));
//         } else if (mainTab === 'shipment') {
//           filteredResults = allResults.filter(item => {
//             return !isConcreteMaterial(item.material) && !isSpecialMaterial(item.material);
//           });
//         }
        
//         if (isMountedRef.current) {
//           setCombinedData(filteredResults);
//           setCombinedLoading(false);
//         }
//       } catch (err) {
//         console.error('Error loading combined data:', err);
//         if (isMountedRef.current) {
//           setCombinedData([]);
//           setCombinedLoading(false);
//         }
//       }
//     };
    
//     fetchCombinedData();
    
//     return () => {
//       isMountedRef.current = false;
//     };
//   }, [shouldUseCombined, selectedFactory, isConcreteOnly, mainTab]);
  
//   // ============================================
//   // ЛОГИКА ДЛЯ ТАС (ЛХ, ЛЮ)
//   // ============================================
  
//   const requestsMap = new Map<string, { quantity: number; closed: boolean | null }>();
//   outgoingRequests.forEach(req => {
//     // const key = `${req.number}_${req.date}_${req.division}`;
//     const key = req.number;
//     requestsMap.set(key, { quantity: req.quantity, closed: req.closed || false });
//   });
  
//   const groupedByDateAndRequest = !shouldUseCombined ? data.reduce((acc, item) => {
//     const dateKey = getDateKey(item.date);
    
//     if (mainTab === 'incoming') {
//       const incoming = item as IncomingItem;
      
//       let factory = '—';
//       if (incoming.number?.startsWith('ЛХ')) factory = 'ЛХ';
//       else if (incoming.number?.startsWith('ЛЮ')) factory = 'ЛЮ';
//       else if (incoming.number?.startsWith('СП')) factory = 'СП';
//       else if (incoming.number?.startsWith('Щ')) factory = 'Щ';
//       else if (incoming.division === 'ЛХ') factory = 'ЛХ';
//       else if (incoming.division === 'ЛЮ') factory = 'ЛЮ';
//       else if (incoming.division === 'СП') factory = 'СП';
//       else if (incoming.division === 'Щ') factory = 'Щ';
      
//       const documentNumber = incoming.number || 'unknown';
//       const vehicleId = incoming.licensePlate || incoming.driver || 'unknown';
//       const groupKey = `${dateKey}_${factory}_${incoming.material}_${incoming.supplier}_${documentNumber}_${vehicleId}`;
      
//       if (!acc[dateKey]) {
//         acc[dateKey] = new Map<string, GroupedItem>();
//       }
      
//       const itemTime = formatTime(incoming.date);
//       const itemUnit = 'т';
      
//       if (!acc[dateKey].has(groupKey)) {
//         acc[dateKey].set(groupKey, {
//           time: itemTime,
//           factQuantity: incoming.quantity,
//           planQuantity: 0,
//           consignee: incoming.supplier,
//           factories: [factory],
//           truckCount: 1,
//           material: incoming.material,
//           requestNumber: '',
//           requestDate: '',
//           closed: false,
//           supplier: incoming.supplier,
//           unit: itemUnit,
//           vehicles: [{
//             licensePlate: incoming.licensePlate || '—',
//             factory: factory,
//             quantity: incoming.quantity,
//             time: itemTime,
//             driver: incoming.driver || '—',
//             material: incoming.material,
//             supplier: incoming.supplier,
//           }],
//         });
//       } else {
//         const existing = acc[dateKey].get(groupKey)!;
//         existing.factQuantity += incoming.quantity;
//         existing.truckCount += 1;
//         if (!existing.factories.includes(factory) && factory !== '—') {
//           existing.factories.push(factory);
//         }
//         existing.vehicles.push({
//           licensePlate: incoming.licensePlate || '—',
//           factory: factory,
//           quantity: incoming.quantity,
//           time: itemTime,
//           driver: incoming.driver || '—',
//           material: incoming.material,
//           supplier: incoming.supplier,
//         });
//         if (itemTime > existing.time) {
//           existing.time = itemTime;
//         }
//       }
//     } else {
//       const shipment = item as ShipmentItem;
      
//       if (isConcreteOnly && !isConcreteMaterial(shipment.material)) return acc;
//       if (mainTab === 'shipment' && isConcreteMaterial(shipment.material)) return acc;
      
//       const requestNumber = shipment.clientRequestNumber || '';
//       const requestDate = shipment.clientRequestDate || '';
//       const division = shipment.division || '';
//       // const requestKey = `${requestNumber}_${requestDate}_${division}`;
      
//       let factory = '—';
//       if (shipment.division === 'ЛХ') factory = 'ЛХ';
//       else if (shipment.division === 'ЛЮ') factory = 'ЛЮ';
//       else if (shipment.division === 'СП') factory = 'СП';
//       else if (shipment.division === 'Щ') factory = 'Щ';

//       const consigneeKey = shipment.consignee || shipment.customer || '—';
//       // const groupKey = `${dateKey}_${requestKey}_${consigneeKey}_${shipment.material}`;
//       const groupKey = `${dateKey}_${requestNumber}_${consigneeKey}_${shipment.material}`;

      
//       let planQuantity = 0;
//       let requestClosed = false;
//       // const request = requestsMap.get(requestKey);
//       const request = requestsMap.get(requestNumber);
//       if (request) {
//         planQuantity = request.quantity;
//         requestClosed = request.closed || false;
//       }
      
//       if (!acc[dateKey]) {
//         acc[dateKey] = new Map<string, GroupedItem>();
//       }
      
//       const itemTime = formatTime(shipment.date);
//       const itemUnit = isConcreteMaterial(shipment.material) ? 'м³' : 'т';
      
//       if (!acc[dateKey].has(groupKey)) {
//         acc[dateKey].set(groupKey, {
//           time: itemTime,
//           factQuantity: shipment.quantity,
//           planQuantity: planQuantity,
//           consignee: consigneeKey,
//           factories: [factory],
//           truckCount: 1,
//           material: shipment.material,
//           closed: requestClosed,
//           requestNumber: requestNumber,
//           requestDate: requestDate,
//           unit: itemUnit,
//           vehicles: [{
//             licensePlate: shipment.licensePlate || '—',
//             factory: factory,
//             quantity: shipment.quantity,
//             time: itemTime,
//             driver: shipment.driver || '—',
//           }],
//         });
//       } else {
//         const existing = acc[dateKey].get(groupKey)!;
//         existing.factQuantity += shipment.quantity;
//         existing.truckCount += 1;
//         if (planQuantity > existing.planQuantity) {
//           existing.planQuantity = planQuantity;
//         }
//         if (!existing.factories.includes(factory) && factory !== '—') {
//           existing.factories.push(factory);
//         }
//         existing.vehicles.push({
//           licensePlate: shipment.licensePlate || '—',
//           factory: factory,
//           quantity: shipment.quantity,
//           time: itemTime,
//           driver: shipment.driver || '—',
//         });
//         if (itemTime > existing.time) {
//           existing.time = itemTime;
//         }
//       }
//     }
    
//     return acc;
//   }, {} as Record<string, Map<string, GroupedItem>>) : {};
  
//   const sortedDates = !shouldUseCombined 
//     ? Object.keys(groupedByDateAndRequest).sort(compareDatesDesc)
//     : [];
  
//   if (!shouldUseCombined && effectiveData.length === 0) {
//     return (
//       <div className="empty">
//         <p>Нет данных</p>
//       </div>
//     );
//   }
  
//   if (shouldUseCombined && combinedLoading) {
//     return (
//       <div className="compact-view">
//         <ActivityChart shipments={[]} selectedFactory={selectedFactory} mode={mode} materialType={isConcreteOnly ? 'concrete' : 'asphalt'} />
//         <LoadingSpinner message="Загрузка отгрузок..." size="medium" />
//       </div>
//     );
//   }
  
//   if (shouldUseCombined && combinedData.length === 0) {
//     return (
//       <div className="empty">
//         <p>Нет данных по заявкам</p>
//       </div>
//     );
//   }
  
//   // ============================================
//   // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ) - ОТГРУЗКИ
//   // ============================================
  
//   if (shouldUseCombined && isShipment) {
//     const groupedByDate = combinedData.reduce((acc, item) => {
//       if (!item.delivery_date) return acc;
//       const dateKey = getDateKey(item.delivery_date);
//       if (!acc[dateKey]) {
//         acc[dateKey] = [];
//       }
//       acc[dateKey].push(item);
//       return acc;
//     }, {} as Record<string, CombinedRequest[]>);
    
//     const combinedSortedDates = Object.keys(groupedByDate).sort(compareDatesDesc);
    
//     return (
//       <div className="compact-view">
//         {allShipmentsForChart && allShipmentsForChart.length > 0 && (
//           <ActivityChart 
//             shipments={allShipmentsForChart} 
//             selectedFactory={selectedFactory}
//             mode={mode}
//             materialType={isConcreteOnly ? 'concrete' : 'asphalt'}
//           />
//         )}
        
//         {combinedSortedDates.map(date => {
//           const items = groupedByDate[date];
//           const sortedItems = [...items].sort((a, b) => {
//             const timeA = a.lastShipmentTime || '00:00';
//             const timeB = b.lastShipmentTime || '00:00';
//             const getMinutes = (time: string) => {
//               const parts = time.split(':');
//               const hours = parseInt(parts[0], 10);
//               const minutes = parseInt(parts[1], 10);
//               return hours * 60 + minutes;
//             };
//             return getMinutes(timeB) - getMinutes(timeA);
//           });
          
//           const dayTotal = sortedItems.reduce((sum, item) => sum + item.factQuantity, 0);
//           const dayLabel = formatDateLabel(date);
//           const isToday = isDateToday(date);
          
//           const firstItem = sortedItems[0];
//           const unitLabel = firstItem?.unit === 'м³' ? '(м³)' : '(т)';
          
//           return (
//             <div key={date} className="compact-date-group">
//               <div className="compact-date-header">
//                 <div className="date-wrapper">
//                   <span className="date-text" style={{ fontWeight: 'bold' }}>{dayLabel}</span>
//                   {isToday && <span className="today-badge">СЕГОДНЯ</span>}
//                 </div>
//                 <span className="date-total" style={{ fontWeight: 'bold' }}>{dayTotal.toFixed(0)} т</span>
//               </div>
              
//               <div className="compact-table">
//                 <div className="compact-header" style={{ fontWeight: 'bold' }}>
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-slash"></span>
//                   <span className="col-plan">Заяв {unitLabel}</span>
//                   <span className="col-consignee">Грузополучатель</span>
//                   <span className="col-factory">🏭</span>
//                   <span className="col-trucks">🚛</span>
//                 </div>
                
                
                
                

//                       {sortedItems.map((item, idx) => {
//   const itemKey = `${date}_${idx}`;
//   const isExpanded = expandedId === itemKey;
//   const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
//   const isWarning = percentComplete < 90 && percentComplete > 0;
//   const isCompleted = percentComplete >= 90 && item.planQuantity > 0;
//   const displayTime = item.lastShipmentTime || '—';
//   const isSpecial = isSpecialMaterial(item.material);
  
//   const { value: factValue } = formatWithUnit(
//     item.factQuantity,
//     item.unit ?? null,
//     item.material
//   );
//   const { value: planValue } = formatWithUnit(
//     item.planQuantity,
//     item.unit ?? null,
//     item.material
//   );
  
//   const displayFact = Math.round(factValue);
//   const displayPlan = Math.round(planValue);
  
//   return (
//     <div key={idx}>
//       <div 
//         className={`compact-row compact-clickable ${isCompleted ? 'completed-row' : ''}`}
//         style={{ fontWeight: 'bold', cursor: 'pointer' }}
//         onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
//       >
//         <span className="col-time">{displayTime}</span>
//         <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
//           {displayFact}
//         </span>
//         <span className="col-slash">/</span>
//         <span className="col-plan">
//           {displayPlan > 0 ? (
//             <span style={{ whiteSpace: 'nowrap' }}>
//               {displayPlan}
//               {item.closed ? (
//                 <span className="closed-lock"> 🔒</span>
//               ) : (
//                 !isCompleted && item.factQuantity > 0 && percentComplete < 90 && (
//                   <span className="active-dot" title="Идут отгрузки"></span>
//                 )
//               )}
//             </span>
//           ) : '—'}
//         </span>
//         <span className="col-consignee" style={{ fontSize: '12px' }}>
//           {item.consignee}
//           {isSpecial && <span className="special-badge">ИНЕРТНЫЕ</span>}
//         </span>
//         <span className="col-factory">
//           <div className="factory-badges-group">
//             <div className={getFactoryBadgeClass(item.division)}>{item.division}</div>
//           </div>
//         </span>
//         <span className="col-trucks">{item.truckCount}</span>
//       </div>















//                       <AnimatePresence>
//                         {isExpanded && (
//                           <motion.div
//                             className="compact-details"
//                             initial={{ opacity: 0, height: 0 }}
//                             animate={{ opacity: 1, height: 'auto' }}
//                             exit={{ opacity: 0, height: 0 }}
//                             transition={{ duration: 0.2 }}
//                           >
//                             <div className="detail-row">
//                               <span className="detail-label"><Package size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Материал:</span>
//                               <span className="detail-value">{item.material}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label"><Factory size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Завод:</span>
//                               <span className="detail-value">{item.division}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label">🚛 Машин:</span>
//                               <span className="detail-value">{item.truckCount}</span>
//                             </div>
//                             {item.vehicles.length > 0 && (
//                               <div className="vehicles-list">
//                                 <div className="vehicles-title">🚛 Транспорт:</div>
//                                 {item.vehicles.map((vehicle, vIdx) => {
//                                   const vehicleQty = vehicle.quantity;
//                                   return (
//                                     <div key={vIdx} className="vehicle-item">
//                                       <span className="vehicle-time">{vehicle.fullDateTime || vehicle.time}</span>
//                                       <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                       <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                       <span className="vehicle-quantity">
//                                         {/* {Math.round(vehicleQty)} {item.unit === 'м³' ? 'м³' : 'т'} */}
//                                         {vehicleQty.toFixed(1)} {item.unit === 'м³' ? 'м³' : 'т'}
//                                       </span>
//                                     </div>
//                                   );
//                                 })}
//                               </div>
//                             )}
//                           </motion.div>
//                         )}
//                       </AnimatePresence>
//                     </div>
//                   );
//                 })}










//               </div>
//             </div>
//           );
//         })}
//       </div>
//     );
//   }
  
//   // ============================================
//   // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ) - ПОСТУПЛЕНИЯ
//   // ============================================
  
//   if (mode === 'iceberg' && mainTab === 'incoming') {
//     const groupedIncoming = data.reduce((acc, item) => {
//       const incoming = item as IncomingItem;
//       const dateKey = getIncomingDateKey(incoming.date);
//       const factory = detectFactory(incoming, 'incoming');
      
//       // Пропускаем не Айсберг заводы (только СП и Щ)
//       if (factory !== 'СП' && factory !== 'Щ') return acc;
      
//       // ГРУППИРУЕМ ПО НОМЕРУ ЗАКАЗА (clientRequestNumber) или номеру документа
//       const orderNumber = incoming.clientRequestNumber || incoming.number || 'unknown';
//       const groupKey = `${dateKey}_${orderNumber}`;
      
//       if (!acc[dateKey]) {
//         acc[dateKey] = new Map();
//       }
      
//       const itemTime = formatTime(incoming.date);
//       const fullDateTime = formatFullDateTime(incoming.date);
      
//       if (!acc[dateKey].has(groupKey)) {
//         // Новая группа
//         const newGroup: GroupedItem = {
//           time: itemTime,
//           lastFullDateTime: fullDateTime,
//           factQuantity: incoming.quantity,
//           planQuantity: 0,
//           consignee: incoming.supplier,
//           factories: [factory],
//           truckCount: 1,
//           material: incoming.material,
//           requestNumber: orderNumber,
//           requestDate: incoming.date,
//           closed: false,
//           supplier: incoming.supplier,
//           vehicles: [],
//           vehiclesMap: new Map(),
//         };
        
//         const vehicleKey = `${incoming.licensePlate || '—'}_${fullDateTime}`;
//         newGroup.vehiclesMap!.set(vehicleKey, {  // ✅ используем ! (non-null assertion)
//           licensePlate: incoming.licensePlate || '—',
//           factory: factory,
//           quantity: incoming.quantity,
//           time: itemTime,
//           fullDateTime: fullDateTime,
//           driver: incoming.driver || '—',
//           material: incoming.material,
//           supplier: incoming.supplier,
//         });
        
//         acc[dateKey].set(groupKey, newGroup);
//       } else {
//         // Существующая группа - суммируем
//         const existing = acc[dateKey].get(groupKey)!;
//         existing.factQuantity += incoming.quantity;
//         existing.truckCount += 1;
//         if (!existing.factories.includes(factory)) {
//           existing.factories.push(factory);
//         }


//           // ✅ ДОБАВЬТЕ ЭТОТ console.log ЗДЕСЬ
//   console.log('Vehicles before dedup:', { 
//     mapSize: existing.vehiclesMap?.size, 
//     arrayLength: existing.vehicles.length,
//     vehicleKey: `${incoming.licensePlate || '—'}_${fullDateTime}`
//   });

//         // ✅ Убеждаемся, что vehiclesMap существует
//         if (!existing.vehiclesMap) {
//           existing.vehiclesMap = new Map();
//         }
        
//         // ДЕДУПЛИКАЦИЯ ТРАНСПОРТА через Map
//         const vehicleKey = `${incoming.licensePlate || '—'}_${fullDateTime}`;
//         const existingVehicle = existing.vehiclesMap?.get(vehicleKey);
        
//         if (existingVehicle) {
//               console.log('✅ Found duplicate, summing quantity:', existingVehicle.quantity, '+', incoming.quantity);
//           existingVehicle.quantity += incoming.quantity;
//         } else {
//           if (!existing.vehiclesMap) {
//             existing.vehiclesMap = new Map();
//           }
//           existing.vehiclesMap.set(vehicleKey, {
//             licensePlate: incoming.licensePlate || '—',
//             factory: factory,
//             quantity: incoming.quantity,
//             time: itemTime,
//             fullDateTime: fullDateTime,
//             driver: incoming.driver || '—',
//             material: incoming.material,
//             supplier: incoming.supplier,
//           });
//         }
        
//         // Обновляем время на самое позднее
//         if (fullDateTime > (existing.lastFullDateTime || existing.time)) {
//           existing.lastFullDateTime = fullDateTime;
//           existing.time = itemTime;
//         }
//       }
      
//       return acc;
//     }, {} as Record<string, Map<string, GroupedItem>>);
    
//     // Преобразуем Map в массив для каждого dateKey
//     for (const dateKey of Object.keys(groupedIncoming)) {
//       for (const [groupKey, group] of groupedIncoming[dateKey]) {
//         if (group.vehiclesMap) {
//           group.vehicles = Array.from(group.vehiclesMap.values());
//           console.log('After conversion:', group.vehicles.length); // ← добавить
//           delete group.vehiclesMap;
//         }
//       }
//     }
    
//     const incomingSortedDates = Object.keys(groupedIncoming).sort(compareDatesDesc);
    



    
//     return (
//       <div className="compact-view">
//         {incomingSortedDates.map(dateKey => {
//           const items = Array.from(groupedIncoming[dateKey].values());
//           // Сортируем по полной дате (новые сверху)
//           const sortedItems = [...items].sort((a, b) => {
//             const dateTimeA = a.lastFullDateTime || (a.vehicles[0]?.fullDateTime) || a.time;
//             const dateTimeB = b.lastFullDateTime || (b.vehicles[0]?.fullDateTime) || b.time;
//             return dateTimeB.localeCompare(dateTimeA);
//           });
//           const isToday = isIncomingDateToday(dateKey);
          
//           return (
//             <div key={dateKey} className="compact-date-group">
//               <div className="compact-date-header">
//                 <div className="date-wrapper">
//                   <span className="date-text" style={{ fontWeight: 'bold' }}>{formatIncomingDateLabel(dateKey)}</span>
//                   {isToday && <span className="today-badge">СЕГОДНЯ</span>}
//                 </div>
//               </div>
              
//               <div className="compact-table">
//                 <div className="compact-header" style={{ fontWeight: 'bold' }}>
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-material-header">Материал</span>
//                   <span className="col-supplier">Контрагент</span>
//                   <span className="col-factory">🏭</span>
//                   <span className="col-trucks">🚛</span>
//                 </div>
                
//                 {sortedItems.map((item, idx) => {
//                   const itemKey = `${dateKey}_${idx}`;
//                   const isExpanded = expandedId === itemKey;
                  
//                   const { value: factValue } = formatWithUnit(
//                     item.factQuantity,
//                     item.unit ?? null,
//                     item.material
//                   );
//                   const displayFact = Math.round(factValue);
                  
//                   // Сортируем транспорт по полной дате (новые сверху)
//                   const sortedVehicles = [...item.vehicles].sort((a, b) => {
//                     const dateA = a.fullDateTime || a.time;
//                     const dateB = b.fullDateTime || b.time;
//                     return dateB.localeCompare(dateA);
//                   });
                  
//                   return (
//                     <div key={idx}>
//                       <div 
//                         className="compact-row compact-clickable"
//                         style={{ fontWeight: 'bold', cursor: 'pointer' }}
//                         onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
//                       >
//                         <span className="col-time">{item.time}</span>
//                         <span className="col-fact">{displayFact}</span>
//                         <span className="col-material-header" style={{ fontSize: '13px' }}>{item.material}</span>
//                         <span className="col-supplier" style={{ fontSize: '12px' }}>{item.consignee}</span>
//                         <span className="col-factory">
//                           <div className="factory-badges-group">
//                             {item.factories.map((factory, i) => (
//                               <div key={i} className={getFactoryBadgeClass(factory)}>
//                                 {factory}
//                               </div>
//                             ))}
//                           </div>
//                         </span>
//                         <span className="col-trucks">{item.truckCount}</span>
//                       </div>
                      
                      
//                       <AnimatePresence>
//                         {isExpanded && (
//                           <motion.div
//                             className="compact-details"
//                             initial={{ opacity: 0, height: 0 }}
//                             animate={{ opacity: 1, height: 'auto' }}
//                             exit={{ opacity: 0, height: 0 }}
//                             transition={{ duration: 0.2 }}
//                           >
//                             <div className="detail-row">
//                               <span className="detail-label"><Package size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Материал:</span>
//                               <span className="detail-value">{item.material}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label"><Factory size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Завод:</span>
//                               <span className="detail-value">{item.factories.join(', ')}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label">🚛 Машин:</span>
//                               <span className="detail-value">{item.truckCount}</span>
//                             </div>
//                             {sortedVehicles.length > 0 && (
//                               <div className="vehicles-list">
//                                 <div className="vehicles-title">🚛 Транспорт:</div>
//                                 {sortedVehicles.map((vehicle, i) => (
//                                   <div key={i} className="vehicle-item">
//                                     <span className="vehicle-time">{vehicle.fullDateTime || vehicle.time}</span>
//                                     <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                     <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                     <span className="vehicle-quantity">
//                                       {Math.round(vehicle.quantity)} т
//                                     </span>
//                                   </div>
//                                 ))}
//                               </div>
//                             )}
//                           </motion.div>
//                         )}
//                       </AnimatePresence>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     );
//   }
  
//   // ============================================
//   // РЕНДЕР ДЛЯ ТАС (ЛХ, ЛЮ) - ПОСТУПЛЕНИЯ И ОТГРУЗКИ
//   // ============================================
  
//   return (
//     <div className="compact-view">
//       {isShipment && allShipmentsForChart && allShipmentsForChart.length > 0 && (
//         <ActivityChart 
//           shipments={allShipmentsForChart} 
//           selectedFactory={selectedFactory}
//           mode={mode}
//           materialType="asphalt"
//         />
//       )}
      
//       {sortedDates.map(date => {
//         const items = Array.from(groupedByDateAndRequest[date].values());
//         const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
//         const isToday = isDateToday(date);
        
//         return (
//           <div key={date} className="compact-date-group">
//             <div className="compact-date-header">
//               <div className="date-wrapper">
//                 <span className="date-text" style={{ fontWeight: 'bold' }}>{formatDateLabel(date)}</span>
//                 {isToday && <span className="today-badge">СЕГОДНЯ</span>}
//               </div>
//               {isShipment && <span className="date-total" style={{ fontWeight: 'bold' }}>{Math.round(dayTotal)} т</span>}
//             </div>
            
//             <div className="compact-table">
//               {isShipment && (
//                 <div className="compact-header" style={{ fontWeight: 'bold' }}>
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-slash"></span>
//                   <span className="col-plan">Заяв (т)</span>
//                   <span className="col-consignee">Грузополучатель</span>
//                   <span className="col-factory">🏭</span>
//                   <span className="col-trucks">🚛</span>
//                 </div>
//               )}
              
//               {!isShipment && (
//                 <div className="compact-header" style={{ fontWeight: 'bold' }}>
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-material-header">Материал</span>
//                   <span className="col-supplier">Контрагент</span>
//                   <span className="col-factory">🏭</span>
//                   <span className="col-trucks">🚛</span>
//                 </div>
//               )}
              


// {[...items].sort((a, b) => {
//   const timeA = a.time.split(':').map(Number);
//   const timeB = b.time.split(':').map(Number);
//   const minutesA = timeA[0] * 60 + timeA[1];
//   const minutesB = timeB[0] * 60 + timeB[1];
//   return minutesB - minutesA;
// }).map((item, idx) => {
//   const itemKey = `${date}_${idx}`;
//   const isExpanded = expandedId === itemKey;
//   const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
//   const isWarning = percentComplete < 90;
//   const isCompleted = percentComplete >= 90 && item.planQuantity > 0; // ✅ ДОБАВИТЬ

//   const { value: factValue } = formatWithUnit(
//     item.factQuantity,
//     item.unit ?? null,
//     item.material
//   );
//   const displayFact = Math.round(factValue);
  
//   if (isShipment) {
//     return (
//       <div key={idx}>
//         <div 
//           className={`compact-row compact-clickable ${isCompleted ? 'completed-row' : ''}`} // ✅ ДОБАВИТЬ КЛАСС
//           style={{ fontWeight: 'bold', cursor: 'pointer' }}
//           onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
//         >
//           <span className="col-time">{item.time}</span>
//           <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
//             {displayFact}
//           </span>
//           <span className="col-slash">/</span>
//           <span className="col-plan">
//             {item.planQuantity > 0 ? (
//               <span style={{ whiteSpace: 'nowrap' }}>
//                 {Math.round(item.planQuantity)}
//                 {item.closed ? (
//                   <span className="closed-lock"> 🔒</span>
//                 ) : (
//                   // ✅ ТОЧКА НЕ МИГАЕТ, ЕСЛИ ЗАВЕРШЕНО
//                   !isCompleted && hasTodayShipments(allShipments, item.requestNumber) && percentComplete < 90 && (
//                     <span className="active-dot" title="Идут отгрузки"></span>
//                   )
//                 )}
//               </span>
//             ) : '—'}
//           </span>
//           <span className="col-consignee" style={{ fontSize: '12px' }}>{item.consignee}</span>
//           <span className="col-factory">
//             <div className="factory-badges-group">
//               {item.factories.map((factory, i) => (
//                 <div key={i} className={getFactoryBadgeClass(factory)}>
//                   {factory}
//                 </div>
//               ))}
//             </div>
//           </span>
//           <span className="col-trucks">{item.truckCount}</span>
//         </div>
        
        
        
        
        
        
        
        
        
        
//         {/* <AnimatePresence>
//           {isExpanded && (
//             <motion.div
//               className="compact-details"
//               initial={{ opacity: 0, height: 0 }}
//               animate={{ opacity: 1, height: 'auto' }}
//               exit={{ opacity: 0, height: 0 }}
//               transition={{ duration: 0.2 }}
//             >
//               <div className="detail-row">
//                 <span className="detail-label">📦 Материал:</span>
//                 <span className="detail-value">{item.material}</span>
//               </div>
//               <div className="detail-row">
//                 <span className="detail-label">🏭 Завод:</span>
//                 <span className="detail-value">{item.factories.join(', ')}</span>
//               </div>
//               <div className="detail-row">
//                 <span className="detail-label">🚛 Машин:</span>
//                 <span className="detail-value">{item.truckCount}</span>
//               </div>
//               {item.vehicles.length > 0 && (
//                 <div className="vehicles-list">
//                   <div className="vehicles-title">🚛 Транспорт:</div>
//                   {item.vehicles.map((vehicle, i) => {
//                     const vehicleQty = vehicle.quantity;
//                     return (
//                       <div key={i} className="vehicle-item">
//                         <span className="vehicle-time">{vehicle.time}</span>
//                         <span className="vehicle-license">{vehicle.licensePlate}</span>
//                         <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                         <span className="vehicle-quantity">{Math.round(vehicleQty)} т</span>
//                       </div>
//                     );
//                   })}
//                 </div>
//               )}
//             </motion.div>
//           )}
//         </AnimatePresence> */}





// <AnimatePresence>
//   {isExpanded && (
//     <motion.div
//       className="compact-details"
//       initial={{ opacity: 0, height: 0 }}
//       animate={{ opacity: 1, height: 'auto' }}
//       exit={{ opacity: 0, height: 0 }}
//       transition={{ duration: 0.2 }}
//     >
//       <div className="detail-row">
//         <span className="detail-label">📦 Материал:</span>
//         <span className="detail-value">{item.material}</span>
//       </div>
//       <div className="detail-row">
//         <span className="detail-label">🏭 Завод:</span>
//         <span className="detail-value">
//           {item.factories?.join(', ') || '—'}
//         </span>
//       </div>
//       <div className="detail-row">
//         <span className="detail-label">🚛 Машин:</span>
//         <span className="detail-value">{item.truckCount}</span>
//       </div>
//       {item.vehicles.length > 0 && (
//         <div className="vehicles-list">
//           <div className="vehicles-title">🚛 Транспорт:</div>
//           {[...item.vehicles]
//             .sort((a, b) => {
//               const dateA = a.fullDateTime || a.time;
//               const dateB = b.fullDateTime || b.time;
//               return dateB.localeCompare(dateA);
//             })
//             .map((vehicle, i) => {
//               const vehicleQty = vehicle.quantity;
//               const dateTime = vehicle.fullDateTime || vehicle.time;
//               return (
//                 <div key={i} className="vehicle-item">
//                   <span className="vehicle-time">{dateTime}</span>
//                   <span className="vehicle-license">{vehicle.licensePlate}</span>
//                   <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                   <span className="vehicle-quantity">
//                     {/* {Math.round(vehicleQty)} {item.unit === 'м³' ? 'м³' : 'т'} */}
//                     {vehicleQty.toFixed(1)} {item.unit === 'м³' ? 'м³' : 'т'}

//                   </span>
//                 </div>
//               );
//             })}
//         </div>
//       )}
//     </motion.div>
//   )}
// </AnimatePresence>













//       </div>
//     );
//   }

  
  



                
//                 // Поступления для ТАС
//                 return (
//                   <div key={idx}>
//                     <div 
//                       className="compact-row compact-clickable"
//                       style={{ fontWeight: 'bold', cursor: 'pointer' }}
//                       onClick={() => { tapHaptic(); setExpandedId(isExpanded ? null : itemKey); }}
//                     >
//                       <span className="col-time">{item.time}</span>
//                       <span className="col-fact">{displayFact}</span>
//                       <span className="col-material-header" style={{ fontSize: '13px' }}>{item.material}</span>
//                       <span className="col-supplier" style={{ fontSize: '12px' }}>{item.consignee}</span>
//                       <span className="col-factory">
//                         <div className="factory-badges-group">
//                           {item.factories.map((factory, i) => (
//                             <div key={i} className={getFactoryBadgeClass(factory)}>
//                               {factory}
//                             </div>
//                           ))}
//                         </div>
//                       </span>
//                       <span className="col-trucks">{item.truckCount}</span>
//                     </div>
                    
//                     <AnimatePresence>
//                       {isExpanded && (
//                         <motion.div
//                           className="compact-details"
//                           initial={{ opacity: 0, height: 0 }}
//                           animate={{ opacity: 1, height: 'auto' }}
//                           exit={{ opacity: 0, height: 0 }}
//                           transition={{ duration: 0.2 }}
//                         >
//                           <div className="detail-row">
//                             <span className="detail-label">📦 Материал:</span>
//                             <span className="detail-value">{item.material}</span>
//                           </div>
//                           <div className="detail-row">
//                             <span className="detail-label">🏭 Завод:</span>
//                             <span className="detail-value">{item.factories.join(', ')}</span>
//                           </div>
//                           <div className="detail-row">
//                             <span className="detail-label">🚛 Машин:</span>
//                             <span className="detail-value">{item.truckCount}</span>
//                           </div>
//                           {item.vehicles.length > 0 && (
//                             <div className="vehicles-list">
//                               <div className="vehicles-title">🚛 Транспорт:</div>
//                               {item.vehicles.map((vehicle, i) => {
//                                 const vehicleQty = vehicle.quantity;
//                                 return (
//                                   <div key={i} className="vehicle-item">
//                                     <span className="vehicle-time">{vehicle.time}</span>
//                                     <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                     <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                     <span className="vehicle-quantity">{Math.round(vehicleQty)} т</span>
//                                   </div>
//                                 );
//                               })}
//                             </div>
//                           )}
//                         </motion.div>
//                       )}
//                     </AnimatePresence>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         );
//       })}
//     </div>
//   );
// }
