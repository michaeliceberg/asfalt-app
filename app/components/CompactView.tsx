'use client';

import { IncomingItem, ShipmentItem } from '@/app/page';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ActivityChart from './ActivityChart';
import LoadingSpinner from './LoadingSpinner';

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
  truckCount: number;
  vehicles: Array<{
    time: string;
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
}

interface GroupedItem {
  time: string;
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
  vehicles: Array<{
    licensePlate: string;
    factory: string;
    quantity: number;
    time: string;
    driver?: string;
    material?: string;
    supplier?: string;
  }>;
}

// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ И МАТЕРИАЛАМИ
// ============================================

const parseRussianDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  
  if (dateString.includes('T') && !dateString.includes('.')) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
  }
  
  const parts = dateString.split(' ');
  const dateParts = parts[0].split('.');
  
  let hour = 0, minute = 0;
  if (parts[1]) {
    const timeParts = parts[1].split(':');
    hour = parseInt(timeParts[0], 10);
    minute = parseInt(timeParts[1], 10);
  }
  
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  
  return new Date(year, month, day, hour, minute);
};

const formatTime = (dateString: string): string => {
  const date = parseRussianDate(dateString);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const getDateKey = (dateString: string): string => {
  const date = parseRussianDate(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

const compareDatesDesc = (dateA: string, dateB: string): number => {
  const a = parseRussianDate(dateA);
  const b = parseRussianDate(dateB);
  return b.getTime() - a.getTime();
};

const getDayLabel = (dateStr: string): string => {
  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getDate().toString().padStart(2, '0')}.${(yesterday.getMonth() + 1).toString().padStart(2, '0')}.${yesterday.getFullYear()}`;
  
  if (dateStr === todayStr) return 'СЕГОДНЯ';
  if (dateStr === yesterdayStr) return 'ВЧЕРА';
  return dateStr;
};

const getFactoryBadgeClass = (factory: string): string => {
  switch (factory) {
    case 'ЛХ': return 'factory-badge-small ЛХ';
    case 'ЛЮ': return 'factory-badge-small ЛЮ';
    case 'СП': return 'factory-badge-small СП';
    case 'Щ': return 'factory-badge-small Щ';
    default: return 'factory-badge-small Другой';
  }
};

const isConcreteMaterial = (material: string): boolean => {
  if (!material) return false;
  const lower = material.toLowerCase();
  
  // Чёткие маркеры бетона
  const concreteMarkers = [
    'бст',      // бетонная смесь тяжелая
    'бсм',      // бетонная смесь мелкозернистая
    'бетон',
    'раствор'
  ];
  
  // Исключения — что точно НЕ бетон
  const notConcreteMarkers = [
    'пбв',      // полимерно-битумное вяжущее
    'гранит',
    'асфальт',
    'щебень',
    'песок',
    'битум',
    'эмульсия'
  ];
  
  // Сначала проверяем исключения
  for (const marker of notConcreteMarkers) {
    if (lower.includes(marker)) return false;
  }
  
  // Потом проверяем маркеры бетона
  for (const marker of concreteMarkers) {
    if (lower.includes(marker)) return true;
  }
  
  return false;
};

export default function CompactView({ 
  data, 
  mainTab, 
  outgoingRequests = [], 
  allShipments = [],
  allShipmentsForChart = [],
  selectedFactory = 'all',
  mode = 'tas'
}: CompactViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [combinedData, setCombinedData] = useState<CombinedRequest[]>([]);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const isMountedRef = useRef(true);
  
  const isShipment = mainTab === 'shipment' || mainTab === 'shipmentConcrete';
  const isConcreteOnly = mainTab === 'shipmentConcrete';
  const shouldUseCombined = mode === 'iceberg' && isShipment;
  const effectiveData = shouldUseCombined ? [] : data;
  
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
        
        // Фильтруем по типу материала (асфальт/бетон)
        let filteredResults = allResults;
        if (isConcreteOnly) {
          filteredResults = allResults.filter(item => isConcreteMaterial(item.material));
        } else if (mainTab === 'shipment') {
          filteredResults = allResults.filter(item => !isConcreteMaterial(item.material));
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
    const key = `${req.number}_${req.date}_${req.division}`;
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
  
  // ✅ УНИКАЛЬНЫЙ КЛЮЧ: номер документа + машина
  // Это предотвратит дублирование одной и той же машины с одним документом
  const documentNumber = incoming.number || 'unknown';
  const vehicleId = incoming.licensePlate || incoming.driver || 'unknown';
  const groupKey = `${dateKey}_${factory}_${incoming.material}_${incoming.supplier}_${documentNumber}_${vehicleId}`;
  
  if (!acc[dateKey]) {
    acc[dateKey] = new Map<string, GroupedItem>();
  }
  
  const itemTime = formatTime(incoming.date);
  
  if (!acc[dateKey].has(groupKey)) {
    // Создаём новую группу
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
    // Добавляем в существующую группу
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
}
    
    
    
    
    
    else {
      const shipment = item as ShipmentItem;
      
      // Фильтрация по типу материала для ТАС
      if (isConcreteOnly && !isConcreteMaterial(shipment.material)) return acc;
      if (mainTab === 'shipment' && isConcreteMaterial(shipment.material)) return acc;
      
      const requestNumber = shipment.clientRequestNumber || '';
      const requestDate = shipment.clientRequestDate || '';
      const division = shipment.division || '';
      const requestKey = `${requestNumber}_${requestDate}_${division}`;
      
      let factory = '—';
      if (shipment.division === 'ЛХ') factory = 'ЛХ';
      else if (shipment.division === 'ЛЮ') factory = 'ЛЮ';
      else if (shipment.division === 'СП') factory = 'СП';
      else if (shipment.division === 'Щ') factory = 'Щ';

      const consigneeKey = shipment.consignee || shipment.customer || '—';
      const groupKey = `${dateKey}_${requestKey}_${consigneeKey}_${shipment.material}`;
      
      let planQuantity = 0;
      let requestClosed = false;
      const request = requestsMap.get(requestKey);
      if (request) {
        planQuantity = request.quantity;
        requestClosed = request.closed || false;
      }
      
      if (!acc[dateKey]) {
        acc[dateKey] = new Map<string, GroupedItem>();
      }
      
      const itemTime = formatTime(shipment.date);
      
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
          vehicles: [{
            licensePlate: shipment.licensePlate || '—',
            factory: factory,
            quantity: shipment.quantity,
            time: itemTime,
            driver: shipment.driver || '—',
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
  
  // if (shouldUseCombined && combinedLoading) {
  //   return <LoadingSpinner message="Загрузка отгрузок..." size="large" />;
  // }

if (shouldUseCombined && combinedLoading) {
  return (
    <div className="compact-view">
      <ActivityChart 
        shipments={[]} 
        selectedFactory={selectedFactory} 
        mode={mode}
      />
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
  // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ)
  // ============================================
  
  if (shouldUseCombined) {
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
          />
        )}
        
        {combinedSortedDates.map(date => {
          const items = groupedByDate[date];
          const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
          
          return (
            <div key={date} className="compact-date-group">
              <div className="compact-date-header">
                <span className="date-text">{getDayLabel(date)}</span>
                <span className="date-total">{dayTotal.toFixed(0)} т</span>
              </div>
              
              <div className="compact-table">
                <div className="compact-header">
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-slash"></span>
                  <span className="col-plan">Заяв</span>
                  <span className="col-consignee">Грузополучатель</span>
                  <span className="col-factory">Завод</span>
                  <span className="col-trucks">Машин</span>
                  <span className="col-expand"></span>
                </div>
                
                {items.map((item, idx) => {
                  const itemKey = `${date}_${idx}`;
                  const isExpanded = expandedId === itemKey;
                  const percentComplete = item.planQuantity > 0 
                    ? (item.factQuantity / item.planQuantity) * 100 
                    : 0;
                  const isWarning = percentComplete < 94 && percentComplete > 0;
                  const displayTime = item.lastShipmentTime || '—';
                  
                  return (
                    <div key={idx}>
                      <div 
                        className="compact-row compact-clickable"
                        onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                      >
                        <span className="col-time">{displayTime}</span>
                        <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
                          {item.factQuantity.toFixed(1)}
                        </span>
                        <span className="col-slash">/</span>
                        <span className="col-plan">
                          {item.planQuantity > 0 ? (
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {item.planQuantity.toFixed(0)}
                              {item.closed ? (
                                <span className="closed-lock"> 🔒</span>
                              ) : (
                                item.factQuantity > 0 && percentComplete < 94 && (
                                  <span className="active-dot" title="Идут отгрузки"></span>
                                )
                              )}
                            </span>
                          ) : '—'}
                        </span>
                        <span className="col-consignee">{item.consignee}</span>
                        <span className="col-factory">
                          <div className="factory-badges-group">
                            <div className={getFactoryBadgeClass(item.division)}>
                              {item.division}
                            </div>
                          </div>
                        </span>
                        <span className="col-trucks">{item.truckCount}</span>
                        <span className="col-expand">{isExpanded ? '▲' : '▼'}</span>
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
                              <span className="detail-label">📦 Материал:</span>
                              <span className="detail-value">{item.material}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">🏭 Завод:</span>
                              <span className="detail-value">{item.division}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">🚛 Машин:</span>
                              <span className="detail-value">{item.truckCount}</span>
                            </div>
                            {item.vehicles.length > 0 && (
                              <div className="vehicles-list">
                                <div className="vehicles-title">🚛 Транспорт:</div>
                                {item.vehicles.map((vehicle, i) => (
                                  <div key={i} className="vehicle-item">
                                    <span className="vehicle-time">{vehicle.time}</span>
                                    <span className="vehicle-license">{vehicle.licensePlate}</span>
                                    <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
                                    <span className="vehicle-quantity">{vehicle.quantity.toFixed(1)} т</span>
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
            </div>
          );
        })}
      </div>
    );
  }
  
  // ============================================
  // РЕНДЕР ДЛЯ ТАС (ЛХ, ЛЮ)
  // ============================================
  
  return (
    <div className="compact-view">
      {isShipment && allShipmentsForChart && allShipmentsForChart.length > 0 && (
        <ActivityChart 
          shipments={allShipmentsForChart} 
          selectedFactory={selectedFactory}
          mode={mode}
        />
      )}
      
      {sortedDates.map(date => {
        const items = Array.from(groupedByDateAndRequest[date].values());
        const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
        
        return (
          <div key={date} className="compact-date-group">
            <div className="compact-date-header">
              <span className="date-text">{getDayLabel(date)}</span>
              {isShipment && (
                <span className="date-total">{dayTotal.toFixed(0)} т</span>
              )}
            </div>
            
            <div className="compact-table">
              {isShipment && (
                <div className="compact-header">
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-slash"></span>
                  <span className="col-plan">Заяв</span>
                  <span className="col-consignee">Грузополучатель</span>
                  <span className="col-factory">Завод</span>
                  <span className="col-trucks">Машин</span>
                  <span className="col-expand"></span>
                </div>
              )}
              
              {!isShipment && (
                <div className="compact-header">
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-material-header">Материал</span>
                  <span className="col-factory">Завод</span>
                  <span className="col-trucks">Машин</span>
                  <span className="col-expand"></span>
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
                const isWarning = percentComplete < 94;
                
                if (isShipment) {
                  return (
                    <div key={idx}>
                      <div 
                        className="compact-row compact-clickable"
                        onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                      >
                        <span className="col-time">{item.time}</span>
                        <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
                          {item.factQuantity.toFixed(1)}
                        </span>
                        <span className="col-slash">/</span>
                        <span className="col-plan">
                          {item.planQuantity > 0 ? (
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {item.planQuantity.toFixed(0)}
                              {item.closed ? (
                                <span className="closed-lock"> 🔒</span>
                              ) : (
                                (() => {
                                  const hasTodayShipments = allShipments.some(ship => {
                                    const shipDateKey = getDateKey(ship.date);
                                    const todayKey = getDateKey(new Date().toISOString());
                                    return ship.clientRequestNumber === item.requestNumber && shipDateKey === todayKey;
                                  });
                                  
                                  // const showActiveDot = hasTodayShipments && percentComplete < 94;
                                  
                                  
                                  const showActiveDot = (() => {
  // Проверяем, были ли отгрузки по этой заявке сегодня
  const hasTodayShipments = allShipments.some(ship => {
    const shipDate = parseRussianDate(ship.date);
    const today = new Date();
    const isToday = shipDate.getDate() === today.getDate() &&
                    shipDate.getMonth() === today.getMonth() &&
                    shipDate.getFullYear() === today.getFullYear();
    return ship.clientRequestNumber === item.requestNumber && isToday;
  });
  
  // Показываем точку только если:
  // 1. Есть отгрузки сегодня
  // 2. Процент выполнения < 94%
  // 3. Заявка не закрыта (для Айсберг всегда false, что означает "не закрыта")
  return hasTodayShipments && percentComplete < 94 && !item.closed;
})();
                                  
                                  
                                  
                                  return showActiveDot ? <span className="active-dot" title="Идут отгрузки"></span> : null;
                                })()
                              )}
                            </span>
                          ) : '—'}
                        </span>
                        <span className="col-consignee">{item.consignee}</span>
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
                        <span className="col-expand">{isExpanded ? '▲' : '▼'}</span>
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
                              <span className="detail-label">📦 Материал:</span>
                              <span className="detail-value">{item.material}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">🏭 Завод:</span>
                              <span className="detail-value">{item.factories.join(', ')}</span>
                            </div>
                            <div className="detail-row">
                              <span className="detail-label">🚛 Машин:</span>
                              <span className="detail-value">{item.truckCount}</span>
                            </div>
                            {item.vehicles.length > 0 && (
                              <div className="vehicles-list">
                                <div className="vehicles-title">🚛 Транспорт:</div>
                                {item.vehicles.map((vehicle, i) => (
                                  <div key={i} className="vehicle-item">
                                    <span className="vehicle-time">{vehicle.time}</span>
                                    <span className="vehicle-license">{vehicle.licensePlate}</span>
                                    <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
                                    <span className="vehicle-quantity">{vehicle.quantity.toFixed(1)} т</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }
                
                return (
                  <div key={idx}>
                    <div 
                      className="compact-row compact-clickable"
                      onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                    >
                      <span className="col-time">{item.time}</span>
                      <span className="col-fact">{item.factQuantity.toFixed(1)}</span>
                      <span className="col-material-header">{item.material?.substring(0, 20)}</span>
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
                      <span className="col-expand">{isExpanded ? '▲' : '▼'}</span>
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
                            <span className="detail-label">📦 Поставщик:</span>
                            <span className="detail-value">{item.consignee}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">🏭 Завод:</span>
                            <span className="detail-value">{item.factories.join(', ')}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">🚛 Машин:</span>
                            <span className="detail-value">{item.truckCount}</span>
                          </div>
                          {item.vehicles.length > 0 && (
                            <div className="vehicles-list">
                              <div className="vehicles-title">🚛 Транспорт:</div>
                              {item.vehicles.map((vehicle, i) => (
                                <div key={i} className="vehicle-item">
                                  <span className="vehicle-time">{vehicle.time}</span>
                                  <span className="vehicle-license">{vehicle.licensePlate}</span>
                                  <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
                                  <span className="vehicle-quantity">{vehicle.quantity.toFixed(1)} т</span>
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
          </div>
        );
      })}
    </div>
  );
}



// 'use client';

// import { IncomingItem, ShipmentItem } from '@/app/page';
// import { useState, useEffect, useRef } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import ActivityChart from './ActivityChart';
// import LoadingSpinner from './LoadingSpinner';

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
//   truckCount: number;
//   vehicles: Array<{
//     time: string;
//     licensePlate: string;
//     driver: string;
//     quantity: number;
//   }>;
// }

// interface CompactViewProps {
//   data: UnifiedDataItem[];
//   // mainTab: 'incoming' | 'shipment';
//   mainTab: 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary';
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

// interface GroupedItem {
//   time: string;
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
//   vehicles: Array<{
//     licensePlate: string;
//     factory: string;
//     quantity: number;
//     time: string;
//     driver?: string;
//     material?: string;
//     supplier?: string;
//   }>;
// }

// // ============================================
// // ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ
// // ============================================

// const parseRussianDate = (dateString: string): Date => {
//   if (!dateString) return new Date();
  
//   if (dateString.includes('T') && !dateString.includes('.')) {
//     const date = new Date(dateString);
//     if (!isNaN(date.getTime())) return date;
//   }
  
//   const parts = dateString.split(' ');
//   const dateParts = parts[0].split('.');
  
//   let hour = 0, minute = 0;
//   if (parts[1]) {
//     const timeParts = parts[1].split(':');
//     hour = parseInt(timeParts[0], 10);
//     minute = parseInt(timeParts[1], 10);
//   }
  
//   const day = parseInt(dateParts[0], 10);
//   const month = parseInt(dateParts[1], 10) - 1;
//   const year = parseInt(dateParts[2], 10);
  
//   return new Date(year, month, day, hour, minute);
// };

// const formatTime = (dateString: string): string => {
//   const date = parseRussianDate(dateString);
//   if (isNaN(date.getTime())) return '—';
//   return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
// };

// const getDateKey = (dateString: string): string => {
//   const date = parseRussianDate(dateString);
//   if (isNaN(date.getTime())) return dateString;
  
//   const day = date.getDate().toString().padStart(2, '0');
//   const month = (date.getMonth() + 1).toString().padStart(2, '0');
//   const year = date.getFullYear();
  
//   return `${day}.${month}.${year}`;
// };

// const compareDatesDesc = (dateA: string, dateB: string): number => {
//   const a = parseRussianDate(dateA);
//   const b = parseRussianDate(dateB);
//   return b.getTime() - a.getTime();
// };

// const getDayLabel = (dateStr: string): string => {
//   const today = new Date();
//   const todayStr = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
  
//   const yesterday = new Date(today);
//   yesterday.setDate(yesterday.getDate() - 1);
//   const yesterdayStr = `${yesterday.getDate().toString().padStart(2, '0')}.${(yesterday.getMonth() + 1).toString().padStart(2, '0')}.${yesterday.getFullYear()}`;
  
//   if (dateStr === todayStr) return 'СЕГОДНЯ';
//   if (dateStr === yesterdayStr) return 'ВЧЕРА';
//   return dateStr;
// };

// const getFactoryBadgeClass = (factory: string): string => {
//   switch (factory) {
//     case 'ЛХ': return 'factory-badge-small ЛХ';
//     case 'ЛЮ': return 'factory-badge-small ЛЮ';
//     case 'СП': return 'factory-badge-small СП';
//     case 'Щ': return 'factory-badge-small Щ';
//     default: return 'factory-badge-small Другой';
//   }
// };

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
//   const isShipment = mainTab === 'shipment';
//   const isMountedRef = useRef(true);
  
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
//         // Определяем, какие заводы загружать
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
        
//         if (isMountedRef.current) {
//           setCombinedData(allResults);
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
//   }, [shouldUseCombined, selectedFactory]);
  
//   // ============================================
//   // ЛОГИКА ДЛЯ ТАС (ЛХ, ЛЮ) - старая группировка
//   // ============================================
  
//   const requestsMap = new Map<string, { quantity: number; closed: boolean | null }>();
//   outgoingRequests.forEach(req => {
//     const key = `${req.number}_${req.date}_${req.division}`;
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
      
//       const groupKey = `${dateKey}_${factory}_${incoming.material}_${incoming.supplier}`;
      
//       if (!acc[dateKey]) {
//         acc[dateKey] = new Map<string, GroupedItem>();
//       }
      
//       const itemTime = formatTime(incoming.date);
      
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
      
//       const requestNumber = shipment.clientRequestNumber || '';
//       const requestDate = shipment.clientRequestDate || '';
//       const division = shipment.division || '';
//       const requestKey = `${requestNumber}_${requestDate}_${division}`;
      
//       let factory = '—';
//       if (shipment.division === 'ЛХ') factory = 'ЛХ';
//       else if (shipment.division === 'ЛЮ') factory = 'ЛЮ';
//       else if (shipment.division === 'СП') factory = 'СП';
//       else if (shipment.division === 'Щ') factory = 'Щ';

//       const consigneeKey = shipment.consignee || shipment.customer || '—';
//       const groupKey = `${dateKey}_${requestKey}_${consigneeKey}_${shipment.material}`;
      
//       let planQuantity = 0;
//       let requestClosed = false;
//       const request = requestsMap.get(requestKey);
//       if (request) {
//         planQuantity = request.quantity;
//         requestClosed = request.closed || false;
//       }
      
//       if (!acc[dateKey]) {
//         acc[dateKey] = new Map<string, GroupedItem>();
//       }
      
//       const itemTime = formatTime(shipment.date);
      
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
  
  
  
  
  
  
//   // const sortedDates = !shouldUseCombined 
//   //   ? Object.keys(groupedByDateAndRequest).sort(compareDatesDesc)
//   //   : [];
  
//   // if (!shouldUseCombined && effectiveData.length === 0) {
//   //   return (
//   //     <div className="empty">
//   //       <p>Нет данных</p>
//   //     </div>
//   //   );
//   // }
  
//   // if (shouldUseCombined && combinedLoading) {
//   //   return (
//   //     <div className="loading">
//   //       <div className="spinner"></div>
//   //       <p>Загрузка данных...</p>
//   //     </div>
//   //   );
//   // }
  
//   // if (shouldUseCombined && combinedData.length === 0) {
//   //   return (
//   //     <div className="empty">
//   //       <p>Нет данных по заявкам</p>
//   //     </div>
//   //   );
//   // }
  


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
//     return <LoadingSpinner message="Загрузка отгрузок..." size="large" />;
//   }
  
//   if (shouldUseCombined && combinedData.length === 0) {
//     return (
//       <div className="empty">
//         <p>Нет данных по заявкам</p>
//       </div>
//     );
//   }




//   // ============================================
//   // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ)
//   // ============================================
  
//   if (shouldUseCombined) {
//     // Группируем по дате доставки
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
//           />
//         )}
        
//         {combinedSortedDates.map(date => {
//           const items = groupedByDate[date];
//           const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
          
//           return (
//             <div key={date} className="compact-date-group">
//               <div className="compact-date-header">
//                 <span className="date-text">{getDayLabel(date)}</span>
//                 <span className="date-total">{dayTotal.toFixed(0)} т</span>
//               </div>
              
//               <div className="compact-table">
//                 <div className="compact-header">
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-slash"></span>
//                   <span className="col-plan">Заяв</span>
//                   <span className="col-consignee">Грузополучатель</span>
//                   <span className="col-factory">Завод</span>
//                   <span className="col-trucks">Машин</span>
//                   <span className="col-expand"></span>
//                 </div>
                
//                 {items.map((item, idx) => {
//                   const itemKey = `${date}_${idx}`;
//                   const isExpanded = expandedId === itemKey;
//                   const percentComplete = item.planQuantity > 0 
//                     ? (item.factQuantity / item.planQuantity) * 100 
//                     : 0;
//                   const isWarning = percentComplete < 94 && percentComplete > 0;
//                   const displayTime = item.lastShipmentTime || '—';
                  
//                   return (
//                     <div key={idx}>
//                       <div 
//                         className="compact-row compact-clickable"
//                         onClick={() => setExpandedId(isExpanded ? null : itemKey)}
//                       >
//                         <span className="col-time">{displayTime}</span>
//                         <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
//                           {item.factQuantity.toFixed(1)}
//                         </span>
//                         <span className="col-slash">/</span>
//                         <span className="col-plan">
//                           {item.planQuantity > 0 ? (
//                             <span style={{ whiteSpace: 'nowrap' }}>
//                               {item.planQuantity.toFixed(0)}
//                               {item.closed ? (
//                                 <span className="closed-lock"> 🔒</span>
//                               ) : (
//                                 item.factQuantity > 0 && percentComplete < 94 && (
//                                   <span className="active-dot" title="Идут отгрузки"></span>
//                                 )
//                               )}
//                             </span>
//                           ) : '—'}
//                         </span>
//                         <span className="col-consignee">{item.consignee}</span>
//                         <span className="col-factory">
//                           <div className="factory-badges-group">
//                             <div className={getFactoryBadgeClass(item.division)}>
//                               {item.division}
//                             </div>
//                           </div>
//                         </span>
//                         <span className="col-trucks">{item.truckCount}</span>
//                         <span className="col-expand">{isExpanded ? '▲' : '▼'}</span>
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
//                               <span className="detail-label">📦 Материал:</span>
//                               <span className="detail-value">{item.material}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label">🏭 Завод:</span>
//                               <span className="detail-value">{item.division}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label">🚛 Машин:</span>
//                               <span className="detail-value">{item.truckCount}</span>
//                             </div>
//                             {item.vehicles.length > 0 && (
//                               <div className="vehicles-list">
//                                 <div className="vehicles-title">🚛 Транспорт:</div>
//                                 {item.vehicles.map((vehicle, i) => (
//                                   <div key={i} className="vehicle-item">
//                                     <span className="vehicle-time">{vehicle.time}</span>
//                                     <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                     <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                     <span className="vehicle-quantity">{vehicle.quantity.toFixed(1)} т</span>
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
//   // РЕНДЕР ДЛЯ ТАС (ЛХ, ЛЮ)
//   // ============================================
  
//   return (
//     <div className="compact-view">
//       {isShipment && allShipmentsForChart && allShipmentsForChart.length > 0 && (
//         <ActivityChart 
//           shipments={allShipmentsForChart} 
//           selectedFactory={selectedFactory}
//         />
//       )}
      
//       {sortedDates.map(date => {
//         const items = Array.from(groupedByDateAndRequest[date].values());
//         const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
        
//         return (
//           <div key={date} className="compact-date-group">
//             <div className="compact-date-header">
//               <span className="date-text">{getDayLabel(date)}</span>
//               {isShipment && (
//                 <span className="date-total">{dayTotal.toFixed(0)} т</span>
//               )}
//             </div>
            
//             <div className="compact-table">
//               {isShipment && (
//                 <div className="compact-header">
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-slash"></span>
//                   <span className="col-plan">Заяв</span>
//                   <span className="col-consignee">Грузополучатель</span>
//                   <span className="col-factory">Завод</span>
//                   <span className="col-trucks">Машин</span>
//                   <span className="col-expand"></span>
//                 </div>
//               )}
              
//               {!isShipment && (
//                 <div className="compact-header">
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-material-header">Материал</span>
//                   <span className="col-factory">Завод</span>
//                   <span className="col-trucks">Машин</span>
//                   <span className="col-expand"></span>
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
//                 const isWarning = percentComplete < 94;
                
//                 if (isShipment) {
//                   return (
//                     <div key={idx}>
//                       <div 
//                         className="compact-row compact-clickable"
//                         onClick={() => setExpandedId(isExpanded ? null : itemKey)}
//                       >
//                         <span className="col-time">{item.time}</span>
//                         <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
//                           {item.factQuantity.toFixed(1)}
//                         </span>
//                         <span className="col-slash">/</span>
//                         <span className="col-plan">
//                           {item.planQuantity > 0 ? (
//                             <span style={{ whiteSpace: 'nowrap' }}>
//                               {item.planQuantity.toFixed(0)}
//                               {item.closed ? (
//                                 <span className="closed-lock"> 🔒</span>
//                               ) : (
//                                 (() => {
//                                   const hasTodayShipments = allShipments.some(ship => {
//                                     const shipDateKey = getDateKey(ship.date);
//                                     const todayKey = getDateKey(new Date().toISOString());
//                                     return ship.clientRequestNumber === item.requestNumber && shipDateKey === todayKey;
//                                   });
//                                   const showActiveDot = hasTodayShipments && percentComplete < 94;
//                                   return showActiveDot ? <span className="active-dot" title="Идут отгрузки"></span> : null;
//                                 })()
//                               )}
//                             </span>
//                           ) : '—'}
//                         </span>
//                         <span className="col-consignee">{item.consignee}</span>
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
//                         <span className="col-expand">{isExpanded ? '▲' : '▼'}</span>
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
//                               <span className="detail-label">📦 Материал:</span>
//                               <span className="detail-value">{item.material}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label">🏭 Завод:</span>
//                               <span className="detail-value">{item.factories.join(', ')}</span>
//                             </div>
//                             <div className="detail-row">
//                               <span className="detail-label">🚛 Машин:</span>
//                               <span className="detail-value">{item.truckCount}</span>
//                             </div>
//                             {item.vehicles.length > 0 && (
//                               <div className="vehicles-list">
//                                 <div className="vehicles-title">🚛 Транспорт:</div>
//                                 {item.vehicles.map((vehicle, i) => (
//                                   <div key={i} className="vehicle-item">
//                                     <span className="vehicle-time">{vehicle.time}</span>
//                                     <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                     <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                     <span className="vehicle-quantity">{vehicle.quantity.toFixed(1)} т</span>
//                                   </div>
//                                 ))}
//                               </div>
//                             )}
//                           </motion.div>
//                         )}
//                       </AnimatePresence>
//                     </div>
//                   );
//                 }
                
//                 return (
//                   <div key={idx}>
//                     <div 
//                       className="compact-row compact-clickable"
//                       onClick={() => setExpandedId(isExpanded ? null : itemKey)}
//                     >
//                       <span className="col-time">{item.time}</span>
//                       <span className="col-fact">{item.factQuantity.toFixed(1)}</span>
//                       <span className="col-material-header">{item.material?.substring(0, 20)}</span>
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
//                       <span className="col-expand">{isExpanded ? '▲' : '▼'}</span>
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
//                             <span className="detail-label">📦 Поставщик:</span>
//                             <span className="detail-value">{item.consignee}</span>
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
//                               {item.vehicles.map((vehicle, i) => (
//                                 <div key={i} className="vehicle-item">
//                                   <span className="vehicle-time">{vehicle.time}</span>
//                                   <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                   <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                   <span className="vehicle-quantity">{vehicle.quantity.toFixed(1)} т</span>
//                                 </div>
//                               ))}
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

