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
  getFactoryBadgeClass 
} from '@/lib/utils';

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
  unit?: string;
  vehicles: Array<{
    licensePlate: string;
    factory: string;
    quantity: number;
    time: string;
    fullDateTime?: string;
    driver?: string;
    material?: string;
    supplier?: string;
  }>;
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
  }
  return 'Другой';
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
      
      const documentNumber = incoming.number || 'unknown';
      const vehicleId = incoming.licensePlate || incoming.driver || 'unknown';
      const groupKey = `${dateKey}_${factory}_${incoming.material}_${incoming.supplier}_${documentNumber}_${vehicleId}`;
      
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
  // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ)
  // ============================================
  
  if (shouldUseCombined) {
    // Для отгрузок — используем combinedData
    if (isShipment) {
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
          
          {combinedSortedDates.map(date => {
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
            
            const firstItem = sortedItems[0];
            const unitLabel = firstItem?.unit === 'м³' ? '(м³)' : '(т)';
            
            return (
              <div key={date} className="compact-date-group">
                <div className="compact-date-header">
                  <div className="date-wrapper">
                    <span className="date-text">{dayLabel}</span>
                    {isToday && <span className="today-badge">СЕГОДНЯ</span>}
                  </div>
                  <span className="date-total">{dayTotal.toFixed(0)} т</span>
                </div>
                
                <div className="compact-table">
                  <div className="compact-header">
                    <span className="col-time">Время</span>
                    <span className="col-fact">Вып</span>
                    <span className="col-slash"></span>
                    <span className="col-plan">Заяв {unitLabel}</span>
                    <span className="col-consignee">Грузополучатель</span>
                    <span className="col-factory">Завод</span>
                    <span className="col-trucks">Машин</span>
                    <span className="col-expand"></span>
                  </div>
                  
                  {sortedItems.map((item, idx) => {
                    const itemKey = `${date}_${idx}`;
                    const isExpanded = expandedId === itemKey;
                    const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
                    const isWarning = percentComplete < 90 && percentComplete > 0;
                    const displayTime = item.lastShipmentTime || '—';
                    const isSpecial = isSpecialMaterial(item.material);
                    
                    // Форматирование Вып (факт) - округляем до целых
                    let displayFact = item.factQuantity;
                    // if (isSpecial) {
                      // displayFact = displayFact / 1000; // кг → тонны
                    // }
                    displayFact = Math.round(displayFact);
                    
                    // Форматирование Заяв (план) - для инертных кг → тонны
                    let displayPlan = item.planQuantity;
                    if (isSpecial && displayPlan > 0) {
                      displayPlan = displayPlan / 1000;
                    }
                    
                    return (
                      <div key={idx}>
                        <div 
                          className={`compact-row compact-clickable ${isSpecial ? 'special-row' : ''}`}
                          onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                        >
                          <span className="col-time">{displayTime}</span>
                          <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
                            {displayFact}
                          </span>
                          <span className="col-slash">/</span>
                          <span className="col-plan">
                            {displayPlan > 0 ? (
                              <span style={{ whiteSpace: 'nowrap' }}>
                                {Math.round(displayPlan)}
                                {item.closed ? (
                                  <span className="closed-lock"> 🔒</span>
                                ) : (
                                  item.factQuantity > 0 && percentComplete < 90 && (
                                    <span className="active-dot" title="Идут отгрузки"></span>
                                  )
                                )}
                              </span>
                            ) : '—'}
                          </span>
                          <span className="col-consignee">
                            {item.consignee}
                            {isSpecial && <span className="special-badge">ИНЕРТНЫЕ</span>}
                          </span>
                          <span className="col-factory">
                            <div className="factory-badges-group">
                              <div className={getFactoryBadgeClass(item.division)}>{item.division}</div>
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
                                  {item.vehicles.map((vehicle, vIdx) => {
                                    // Для инертных материалов переводим кг → тонны
                                    let vehicleQty = vehicle.quantity;
                                    if (isSpecial) {
                                      vehicleQty = vehicleQty / 1000;
                                    }
                                    return (
                                      <div key={vIdx} className="vehicle-item">
                                        <span className="vehicle-time">{vehicle.fullDateTime || vehicle.time}</span>
                                        <span className="vehicle-license">{vehicle.licensePlate}</span>
                                        <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
                                        <span className="vehicle-quantity">
                                          {Math.round(vehicleQty)} {item.unit === 'м³' ? 'м³' : 'т'}
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
              </div>
            );
          })}
        </div>
      );
    }
    
    // ========== ПОСТУПЛЕНИЯ ДЛЯ АЙСБЕРГ ==========
    const groupedIncoming = data.reduce((acc, item) => {
      const incoming = item as IncomingItem;
      const dateKey = getDateKey(incoming.date);
      const factory = detectFactory(incoming, 'incoming');
      
      // Пропускаем не Айсберг заводы (только СП и Щ)
      if (factory !== 'СП' && factory !== 'Щ') return acc;
      
      // Группируем по: дата + поставщик + материал
      const supplierKey = (incoming.supplier || 'unknown').trim();
      const materialKey = incoming.material.trim();
      const groupKey = `${dateKey}_${supplierKey}_${materialKey}`;
      
      if (!acc[dateKey]) {
        acc[dateKey] = new Map();
      }
      
      const itemTime = formatTime(incoming.date);
      
      if (!acc[dateKey].has(groupKey)) {
        acc[dateKey].set(groupKey, {
          time: itemTime,
          factQuantity: incoming.quantity,
          planQuantity: 0,
          consignee: incoming.supplier,
          factories: [factory],
          truckCount: 1,
          material: incoming.material,
          requestNumber: incoming.number,
          requestDate: incoming.date,
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
        const existing = acc[dateKey].get(groupKey)!;
        existing.factQuantity += incoming.quantity;
        existing.truckCount += 1;
        if (!existing.factories.includes(factory)) {
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
      
      return acc;
    }, {} as Record<string, Map<string, GroupedItem>>);
    
    const incomingSortedDates = Object.keys(groupedIncoming).sort(compareDatesDesc);
    
    return (
      <div className="compact-view">
        {incomingSortedDates.map(date => {
          const items = Array.from(groupedIncoming[date].values());
          const sortedItems = [...items].sort((a, b) => {
            const timeA = a.time.split(':').map(Number);
            const timeB = b.time.split(':').map(Number);
            const minutesA = timeA[0] * 60 + timeA[1];
            const minutesB = timeB[0] * 60 + timeB[1];
            return minutesB - minutesA;
          });
          const dayTotal = sortedItems.reduce((sum, item) => sum + item.factQuantity, 0);
          const isToday = isDateToday(date);
          
          return (
            <div key={date} className="compact-date-group">
              <div className="compact-date-header">
                <div className="date-wrapper">
                  <span className="date-text">{formatDateLabel(date)}</span>
                  {isToday && <span className="today-badge">СЕГОДНЯ</span>}
                </div>
                <span className="date-total">{dayTotal.toFixed(0)} т</span>
              </div>
              
              <div className="compact-table">
                <div className="compact-header">
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-material-header">Материал</span>
                  <span className="col-factory">Завод</span>
                  <span className="col-trucks">Машин</span>
                  <span className="col-expand"></span>
                </div>
                
                {sortedItems.map((item, idx) => {
                  const itemKey = `${date}_${idx}`;
                  const isExpanded = expandedId === itemKey;
                  const isSpecial = isSpecialMaterial(item.material);
                  
                  // Округляем до целых
                  let displayFact = item.factQuantity;
                  if (isSpecial) {
                    displayFact = displayFact / 1000; // кг → тонны
                  }
                  displayFact = Math.round(displayFact);
                  
                  return (
                    <div key={idx}>
                      <div 
                        className={`compact-row compact-clickable ${isSpecial ? 'special-row' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                      >
                        <span className="col-time">{item.time}</span>
                        <span className="col-fact">{displayFact}</span>
                        <span className="col-material-header">{item.material}</span>
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
                                {item.vehicles.map((vehicle, i) => {
                                  let vehicleQty = vehicle.quantity;
                                  if (isSpecial) {
                                    vehicleQty = vehicleQty / 1000;
                                  }
                                  return (
                                    <div key={i} className="vehicle-item">
                                      <span className="vehicle-time">{vehicle.time}</span>
                                      <span className="vehicle-license">{vehicle.licensePlate}</span>
                                      <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
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
          materialType="asphalt"
        />
      )}
      
      {sortedDates.map(date => {
        const items = Array.from(groupedByDateAndRequest[date].values());
        const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
        
        return (
          <div key={date} className="compact-date-group">
            <div className="compact-date-header">
              <div className="date-wrapper">
                <span className="date-text">{formatDateLabel(date)}</span>
                {isDateToday(date) && <span className="today-badge">СЕГОДНЯ</span>}
              </div>
              {isShipment && <span className="date-total">{dayTotal.toFixed(0)} т</span>}
            </div>
            
            <div className="compact-table">
              {isShipment && (
                <div className="compact-header">
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-slash"></span>
                  <span className="col-plan">Заяв (т)</span>
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
                const isWarning = percentComplete < 90;
                const isSpecial = isSpecialMaterial(item.material);
                
                // Округляем факт до целых
                let displayFact = item.factQuantity;
                if (isSpecial) {
                  displayFact = displayFact / 1000;
                }
                displayFact = Math.round(displayFact);
                
                if (isShipment) {
                  return (
                    <div key={idx}>
                      <div 
                        className={`compact-row compact-clickable ${isSpecial ? 'special-row' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : itemKey)}
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
                                <span className="closed-lock"> 🔒</span>
                              ) : (
                                hasTodayShipments(allShipments, item.requestNumber) && percentComplete < 90 && (
                                  <span className="active-dot" title="Идут отгрузки"></span>
                                )
                              )}
                            </span>
                          ) : '—'}
                        </span>
                        <span className="col-consignee">
                          {item.consignee}
                          {isSpecial && <span className="special-badge">ИНЕРТНЫЕ</span>}
                        </span>
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
                                {item.vehicles.map((vehicle, i) => {
                                  let vehicleQty = vehicle.quantity;
                                  if (isSpecial) {
                                    vehicleQty = vehicleQty / 1000;
                                  }
                                  return (
                                    <div key={i} className="vehicle-item">
                                      <span className="vehicle-time">{vehicle.time}</span>
                                      <span className="vehicle-license">{vehicle.licensePlate}</span>
                                      <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
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
                }
                
                // Поступления
                return (
                  <div key={idx}>
                    <div 
                      className={`compact-row compact-clickable ${isSpecial ? 'special-row' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : itemKey)}
                    >
                      <span className="col-time">{item.time}</span>
                      <span className="col-fact">{displayFact}</span>
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
                              {item.vehicles.map((vehicle, i) => {
                                let vehicleQty = vehicle.quantity;
                                if (isSpecial) {
                                  vehicleQty = vehicleQty / 1000;
                                }
                                return (
                                  <div key={i} className="vehicle-item">
                                    <span className="vehicle-time">{vehicle.time}</span>
                                    <span className="vehicle-license">{vehicle.licensePlate}</span>
                                    <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
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
// import { formatTime, getDateKey, getFactoryBadgeClass, isConcreteMaterial, isSpecialMaterial, parseRussianDate } from '@/lib/utils';

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
//   unit?: string;
//   vehicles: Array<{
//     licensePlate: string;
//     factory: string;
//     quantity: number;
//     time: string;
//     fullDateTime?: string;
//     driver?: string;
//     material?: string;
//     supplier?: string;
//   }>;
// }



// // const formatTime = (dateString: string): string => {
// //   const date = parseRussianDate(dateString);
// //   if (isNaN(date.getTime())) return '—';
// //   return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
// // };

// // const getDateKey = (dateString: string): string => {
// //   const date = parseRussianDate(dateString);
// //   if (isNaN(date.getTime())) return dateString;
  
// //   const day = date.getDate().toString().padStart(2, '0');
// //   const month = (date.getMonth() + 1).toString().padStart(2, '0');
// //   const year = date.getFullYear();
  
// //   return `${day}.${month}.${year}`;
// // };

// const compareDatesDesc = (dateA: string, dateB: string): number => {
//   const a = parseRussianDate(dateA);
//   const b = parseRussianDate(dateB);
//   return b.getTime() - a.getTime();
// };

// const getDayLabel = (dateStr: string): string => {
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
//           filteredResults = allResults.filter(item => !isConcreteMaterial(item.material));
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
//   // РЕНДЕР ДЛЯ АЙСБЕРГ (СП, Щ)
//   // ============================================
  
//   if (shouldUseCombined) {
//     // Для отгрузок — используем combinedData
//     if (isShipment) {
//       const groupedByDate = combinedData.reduce((acc, item) => {
//         if (!item.delivery_date) return acc;
//         const dateKey = getDateKey(item.delivery_date);
//         if (!acc[dateKey]) {
//           acc[dateKey] = [];
//         }
//         acc[dateKey].push(item);
//         return acc;
//       }, {} as Record<string, CombinedRequest[]>);
      
//       const combinedSortedDates = Object.keys(groupedByDate).sort(compareDatesDesc);
      
//       return (
//         <div className="compact-view">
//           {allShipmentsForChart && allShipmentsForChart.length > 0 && (
//             <ActivityChart 
//               shipments={allShipmentsForChart} 
//               selectedFactory={selectedFactory}
//               mode={mode}
//               materialType={isConcreteOnly ? 'concrete' : 'asphalt'}
//             />
//           )}
          
//           {combinedSortedDates.map(date => {
//             const items = groupedByDate[date];
//             const sortedItems = [...items].sort((a, b) => {
//               const timeA = a.lastShipmentTime || '00:00';
//               const timeB = b.lastShipmentTime || '00:00';
//               const getMinutes = (time: string) => {
//                 const parts = time.split(':');
//                 const hours = parseInt(parts[0], 10);
//                 const minutes = parseInt(parts[1], 10);
//                 return hours * 60 + minutes;
//               };
//               return getMinutes(timeB) - getMinutes(timeA);
//             });
            
//             const dayTotal = sortedItems.reduce((sum, item) => sum + item.factQuantity, 0);
//             const dayLabel = getDayLabel(date);
//             const isToday = isDateToday(date);
            
//             const firstItem = sortedItems[0];
//             const unitLabel = firstItem?.unit === 'м³' ? '(м³)' : '(т)';
            
//             return (
//               <div key={date} className="compact-date-group">
//                 <div className="compact-date-header">
//                   <div className="date-wrapper">
//                     <span className="date-text">{dayLabel}</span>
//                     {isToday && <span className="today-badge">СЕГОДНЯ</span>}
//                   </div>
//                   <span className="date-total">{dayTotal.toFixed(0)} т</span>
//                 </div>
                
//                 <div className="compact-table">
//                   <div className="compact-header">
//                     <span className="col-time">Время</span>
//                     <span className="col-fact">Вып</span>
//                     <span className="col-slash"></span>
//                     <span className="col-plan">Заяв {unitLabel}</span>
//                     <span className="col-consignee">Грузополучатель</span>
//                     <span className="col-factory">Завод</span>
//                     <span className="col-trucks">Машин</span>
//                     <span className="col-expand"></span>
//                   </div>
                  
//                   {sortedItems.map((item, idx) => {
//                     const itemKey = `${date}_${idx}`;
//                     const isExpanded = expandedId === itemKey;
//                     const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
//                     const isWarning = percentComplete < 94 && percentComplete > 0;
//                     const displayTime = item.lastShipmentTime || '—';
//                     const isSpecial = isSpecialMaterial(item.material);
                    
//                     return (
//                       <div key={idx}>
//                         <div 
//                           className={`compact-row compact-clickable ${isSpecial ? 'special-row' : ''}`}
//                           onClick={() => setExpandedId(isExpanded ? null : itemKey)}
//                         >
//                           <span className="col-time">{displayTime}</span>
//                           <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
//                             {item.factQuantity.toFixed(1)}
//                           </span>
//                           <span className="col-slash">/</span>
//                           <span className="col-plan">
//                             {item.planQuantity > 0 ? (
//                               <span style={{ whiteSpace: 'nowrap' }}>
//                                 {item.planQuantity.toFixed(0)}
//                                 {item.closed ? (
//                                   <span className="closed-lock"> 🔒</span>
//                                 ) : (
//                                   item.factQuantity > 0 && percentComplete < 94 && (
//                                     <span className="active-dot" title="Идут отгрузки"></span>
//                                   )
//                                 )}
//                               </span>
//                             ) : '—'}
//                           </span>
//                           <span className="col-consignee">
//                             {item.consignee}
//                             {isSpecial && <span className="special-badge">ИНЕРТНЫЕ</span>}
//                           </span>
//                           <span className="col-factory">
//                             <div className="factory-badges-group">
//                               <div className={getFactoryBadgeClass(item.division)}>{item.division}</div>
//                             </div>
//                           </span>
//                           <span className="col-trucks">{item.truckCount}</span>
//                           <span className="col-expand">{isExpanded ? '▲' : '▼'}</span>
//                         </div>
                        
//                         <AnimatePresence>
//                           {isExpanded && (
//                             <motion.div
//                               className="compact-details"
//                               initial={{ opacity: 0, height: 0 }}
//                               animate={{ opacity: 1, height: 'auto' }}
//                               exit={{ opacity: 0, height: 0 }}
//                               transition={{ duration: 0.2 }}
//                             >
//                               <div className="detail-row">
//                                 <span className="detail-label">📦 Материал:</span>
//                                 <span className="detail-value">{item.material}</span>
//                               </div>
//                               <div className="detail-row">
//                                 <span className="detail-label">🏭 Завод:</span>
//                                 <span className="detail-value">{item.division}</span>
//                               </div>
//                               <div className="detail-row">
//                                 <span className="detail-label">🚛 Машин:</span>
//                                 <span className="detail-value">{item.truckCount}</span>
//                               </div>
//                               {item.vehicles.length > 0 && (
//                                 <div className="vehicles-list">
//                                   <div className="vehicles-title">🚛 Транспорт:</div>
//                                   {item.vehicles.map((vehicle, vIdx) => (
//                                     <div key={vIdx} className="vehicle-item">
//                                       <span className="vehicle-time">{vehicle.fullDateTime || vehicle.time}</span>
//                                       <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                       <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                       <span className="vehicle-quantity">
//                                         {vehicle.quantity.toFixed(1)} {item.unit === 'м³' ? 'м³' : 'т'}
//                                       </span>
//                                     </div>
//                                   ))}
//                                 </div>
//                               )}
//                             </motion.div>
//                           )}
//                         </AnimatePresence>
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       );
//     }
    
//     // ========== ПОСТУПЛЕНИЯ ДЛЯ АЙСБЕРГ ==========
//  // ========== ПОСТУПЛЕНИЯ ДЛЯ АЙСБЕРГ ==========
// // ========== ПОСТУПЛЕНИЯ ДЛЯ АЙСБЕРГ ==========
// // Группируем данные по: дата + поставщик + материал
// const groupedIncoming = data.reduce((acc, item) => {
//   const incoming = item as IncomingItem;
//   const dateKey = getDateKey(incoming.date);
//   const factory = detectFactory(incoming, 'incoming');
  
//   // Пропускаем не Айсберг заводы (только СП и Щ)
//   if (factory !== 'СП' && factory !== 'Щ') return acc;
  
//   // Группируем по: дата + поставщик + материал
//   const supplierKey = (incoming.supplier || 'unknown').trim();
//   const materialKey = incoming.material.trim();
//   const groupKey = `${dateKey}_${supplierKey}_${materialKey}`;
  
//   if (!acc[dateKey]) {
//     acc[dateKey] = new Map();
//   }
  
//   const itemTime = formatTime(incoming.date);
  
//   if (!acc[dateKey].has(groupKey)) {
//     // Новая группа
//     acc[dateKey].set(groupKey, {
//       time: itemTime,
//       factQuantity: incoming.quantity,
//       planQuantity: 0,
//       consignee: incoming.supplier,
//       factories: [factory],
//       truckCount: 1,
//       material: incoming.material,
//       requestNumber: incoming.number,
//       requestDate: incoming.date,
//       closed: false,
//       supplier: incoming.supplier,
//       vehicles: [{
//         licensePlate: incoming.licensePlate || '—',
//         factory: factory,
//         quantity: incoming.quantity,
//         time: itemTime,
//         driver: incoming.driver || '—',
//         material: incoming.material,
//         supplier: incoming.supplier,
//       }],
//     });
//   } else {
//     // Существующая группа - суммируем
//     const existing = acc[dateKey].get(groupKey)!;
//     existing.factQuantity += incoming.quantity;
//     existing.truckCount += 1;
//     if (!existing.factories.includes(factory)) {
//       existing.factories.push(factory);
//     }
//     existing.vehicles.push({
//       licensePlate: incoming.licensePlate || '—',
//       factory: factory,
//       quantity: incoming.quantity,
//       time: itemTime,
//       driver: incoming.driver || '—',
//       material: incoming.material,
//       supplier: incoming.supplier,
//     });
//     // Обновляем время на самое позднее
//     if (itemTime > existing.time) {
//       existing.time = itemTime;
//     }
//   }
  
//   return acc;
// }, {} as Record<string, Map<string, GroupedItem>>);

// const incomingSortedDates = Object.keys(groupedIncoming).sort(compareDatesDesc);

// return (
//   <div className="compact-view">
//     {incomingSortedDates.map(date => {
//       const items = Array.from(groupedIncoming[date].values());
//       const sortedItems = [...items].sort((a, b) => {
//         const timeA = a.time.split(':').map(Number);
//         const timeB = b.time.split(':').map(Number);
//         const minutesA = timeA[0] * 60 + timeA[1];
//         const minutesB = timeB[0] * 60 + timeB[1];
//         return minutesB - minutesA;
//       });
//       const dayTotal = sortedItems.reduce((sum, item) => sum + item.factQuantity, 0);
//       const isToday = isDateToday(date);
      
//       return (
//         <div key={date} className="compact-date-group">
//           <div className="compact-date-header">
//             <div className="date-wrapper">
//               <span className="date-text">{getDayLabel(date)}</span>
//               {isToday && <span className="today-badge">СЕГОДНЯ</span>}
//             </div>
//             <span className="date-total">{dayTotal.toFixed(0)} т</span>
//           </div>
          
//           <div className="compact-table">
//             <div className="compact-header">
//               <span className="col-time">Время</span>
//               <span className="col-fact">Вып</span>
//               <span className="col-material-header">Материал</span>
//               <span className="col-factory">Завод</span>
//               <span className="col-trucks">Машин</span>
//               <span className="col-expand"></span>
//             </div>
            
//             {sortedItems.map((item, idx) => {
//               const itemKey = `${date}_${idx}`;
//               const isExpanded = expandedId === itemKey;
              
//               return (
//                 <div key={idx}>
//                   <div 
//                     className="compact-row compact-clickable"
//                     onClick={() => setExpandedId(isExpanded ? null : itemKey)}
//                   >
//                     <span className="col-time">{item.time}</span>
//                     <span className="col-fact">{item.factQuantity.toFixed(1)}</span>
//                     <span className="col-material-header">{item.material}</span>
//                     <span className="col-factory">
//                       <div className="factory-badges-group">
//                         {item.factories.map((factory, i) => (
//                           <div key={i} className={getFactoryBadgeClass(factory)}>
//                             {factory}
//                           </div>
//                         ))}
//                       </div>
//                     </span>
//                     <span className="col-trucks">{item.truckCount}</span>
//                     <span className="col-expand">{isExpanded ? '▲' : '▼'}</span>
//                   </div>
                  
//                   <AnimatePresence>
//                     {isExpanded && (
//                       <motion.div
//                         className="compact-details"
//                         initial={{ opacity: 0, height: 0 }}
//                         animate={{ opacity: 1, height: 'auto' }}
//                         exit={{ opacity: 0, height: 0 }}
//                         transition={{ duration: 0.2 }}
//                       >
//                         <div className="detail-row">
//                           <span className="detail-label">📦 Материал:</span>
//                           <span className="detail-value">{item.material}</span>
//                         </div>
//                         <div className="detail-row">
//                           <span className="detail-label">🏭 Завод:</span>
//                           <span className="detail-value">{item.factories.join(', ')}</span>
//                         </div>
//                         <div className="detail-row">
//                           <span className="detail-label">🚛 Машин:</span>
//                           <span className="detail-value">{item.truckCount}</span>
//                         </div>
//                         {item.vehicles.length > 0 && (
//                           <div className="vehicles-list">
//                             <div className="vehicles-title">🚛 Транспорт:</div>
//                             {item.vehicles.map((vehicle, i) => (
//                               <div key={i} className="vehicle-item">
//                                 <span className="vehicle-time">{vehicle.time}</span>
//                                 <span className="vehicle-license">{vehicle.licensePlate}</span>
//                                 <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
//                                 <span className="vehicle-quantity">{vehicle.quantity.toFixed(1)} т</span>
//                               </div>
//                             ))}
//                           </div>
//                         )}
//                       </motion.div>
//                     )}
//                   </AnimatePresence>
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       );
//     })}
//   </div>
// );









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
//           mode={mode}
//           materialType="asphalt"
//         />
//       )}
      
//       {sortedDates.map(date => {
//         const items = Array.from(groupedByDateAndRequest[date].values());
//         const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
        
//         return (
//           <div key={date} className="compact-date-group">
//             <div className="compact-date-header">
//               <div className="date-wrapper">
//                 <span className="date-text">{getDayLabel(date)}</span>
//                 {isDateToday(date) && <span className="today-badge">СЕГОДНЯ</span>}
//               </div>
//               {isShipment && <span className="date-total">{dayTotal.toFixed(0)} т</span>}
//             </div>
            
//             <div className="compact-table">
//               {isShipment && (
//                 <div className="compact-header">
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-slash"></span>
//                   <span className="col-plan">Заяв (т)</span>
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
//                 const isSpecial = isSpecialMaterial(item.material);
                
//                 if (isShipment) {
//                   return (
//                     <div key={idx}>
//                       <div 
//                         className={`compact-row compact-clickable ${isSpecial ? 'special-row' : ''}`}
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
//                                 hasTodayShipments(allShipments, item.requestNumber) && percentComplete < 94 && (
//                                   <span className="active-dot" title="Идут отгрузки"></span>
//                                 )
//                               )}
//                             </span>
//                           ) : '—'}
//                         </span>
//                         <span className="col-consignee">
//                           {item.consignee}
//                           {isSpecial && <span className="special-badge">ИНЕРТНЫЕ</span>}
//                         </span>
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
                
//                 // Поступления
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

