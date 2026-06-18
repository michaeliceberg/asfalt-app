// app/components/CompactView/index.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { IncomingItem, ShipmentItem } from '@/app/page';
import { 
  isConcreteMaterial, 
  isSpecialMaterial,
  formatTime,
  getDateKey,
  getIncomingDateKey,
  formatIncomingDateLabel,
  isIncomingDateToday,
  formatFullDateTime,
  getFactoryBadgeClass,
  formatWithUnit,
  parseRussianDate
} from '@/lib/utils';
import ActivityChart from '../ActivityChart';
import LoadingSpinner from '../LoadingSpinner';
// import { DateGroup } from './DateGroup';
// import { CombinedRequest, GroupedItem, VehicleItem } from './types';
import { compareDatesDesc } from '../compact/utils';
// import { compareDatesDesc } from './utils';
import { DateGroup } from '../compact/DateGroup';
import { CombinedRequest, GroupedItem, VehicleItem } from '../compact/types';
// import { compareDatesDesc } from '../compact/utils';


interface CompactViewProps {
  data: (IncomingItem | ShipmentItem)[];
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
            <DateGroup
              key={date}
              dateKey={date}
              items={sortedItems}
              isShipment={true}
              isToday={isToday}
              unitLabel={unitLabel}
              dateLabel={dayLabel}
              dayTotal={dayTotal}
              allShipments={allShipments}
              expandedId={expandedId}
              onToggle={setExpandedId}
            />
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
      
      if (factory !== 'СП' && factory !== 'Щ') return acc;
      
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
        const existingVehicle = existing.vehiclesMap.get(vehicleKey);
        
        if (existingVehicle) {
          existingVehicle.quantity += incoming.quantity;
        } else {
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
    
    // Преобразуем Map в массив
    for (const dateKey of Object.keys(groupedIncoming)) {
      for (const group of groupedIncoming[dateKey].values()) {
        if (group.vehiclesMap) {
          group.vehicles = Array.from(group.vehiclesMap.values());
          delete group.vehiclesMap;
        }
      }
    }
    
    const incomingSortedDates = Object.keys(groupedIncoming).sort(compareDatesDesc);
    
    return (
      <div className="compact-view">
        {incomingSortedDates.map(dateKey => {
          const items = Array.from(groupedIncoming[dateKey].values());
          const sortedItems = [...items].sort((a, b) => {
            const dateTimeA = a.lastFullDateTime || (a.vehicles[0]?.fullDateTime) || a.time;
            const dateTimeB = b.lastFullDateTime || (b.vehicles[0]?.fullDateTime) || b.time;
            return dateTimeB.localeCompare(dateTimeA);
          });
          const isToday = isIncomingDateToday(dateKey);
          
          return (
            <DateGroup
              key={dateKey}
              dateKey={dateKey}
              items={sortedItems}
              isShipment={false}
              isToday={isToday}
              unitLabel={''}
              dateLabel={formatIncomingDateLabel(dateKey)}
              allShipments={allShipments}
              expandedId={expandedId}
              onToggle={setExpandedId}
            />
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
      
      {sortedDates.map(date => {
        const items = Array.from(groupedByDateAndRequest[date].values());
        const dayTotal = items.reduce((sum, item) => sum + item.factQuantity, 0);
        const isToday = isDateToday(date);
        const dateLabel = formatDateLabel(date);
        
        return (
          <DateGroup
            key={date}
            dateKey={date}
            items={items}
            isShipment={isShipment}
            isToday={isToday}
            unitLabel={isShipment ? '(т)' : ''}
            dateLabel={dateLabel}
            dayTotal={isShipment ? dayTotal : undefined}
            allShipments={allShipments}
            expandedId={expandedId}
            onToggle={setExpandedId}
          />
        );
      })}
    </div>
  );
}