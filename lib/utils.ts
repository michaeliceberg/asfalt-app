// lib/utils.ts

// ============================================
// ДАТЫ
// ============================================

export const parseRussianDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  
  if (dateString.includes('T') && !dateString.includes('.')) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
  }
  
  const parts = dateString.split(' ');
  const dateParts = parts[0].split('.');
  
  let hour = 0, minute = 0, second = 0;
  if (parts[1]) {
    const timeParts = parts[1].split(':');
    hour = parseInt(timeParts[0], 10);
    minute = parseInt(timeParts[1], 10);
    second = parseInt(timeParts[2], 10);
  }
  
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  
  return new Date(year, month, day, hour, minute, second);
};

export const formatTime = (dateStr: string): string => {
  const date = parseRussianDate(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export const getDateKey = (dateString: string): string => {
  const date = parseRussianDate(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// ============================================
// МАТЕРИАЛЫ
// ============================================

export const isConcreteMaterial = (material: string): boolean => {
  if (!material) return false;
  const lower = material.toLowerCase();
  
  // Исключения — то, что точно НЕ бетон
  const excludeMarkers = ['асфальт', 'а/б', 'щма', 'пбв', 'гранит', 'щебень', 'песок', 'битум', 'эмульсия'];
  
  for (const marker of excludeMarkers) {
    if (lower.includes(marker)) return false;
  }
  
  // Маркеры бетона
  const concreteMarkers = ['бст', 'бсм', 'бетон', 'раствор'];
  
  for (const marker of concreteMarkers) {
    if (lower.includes(marker)) return true;
  }
  
  return false;
};

export const isSpecialMaterial = (material: string): boolean => {
  if (!material) return false;
  const lower = material.toLowerCase();
  
  // Асфальт — не инертный
  if (lower.includes('асфальт') || lower.includes('а/б') || lower.includes('щма')) {
    return false;
  }
  
  // Бетон — не инертный
  if (lower.includes('бст') || lower.includes('бсм') || lower.includes('бетон')) {
    return false;
  }
  
  // Инертные материалы
  const specialMarkers = ['пбв', 'гранит', 'пыль', 'песок', 'щебень', 'битум', 'эмульсия'];
  
  for (const marker of specialMarkers) {
    if (lower.includes(marker)) return true;
  }
  
  return false;
};

// ============================================
// ЗАВОДЫ
// ============================================

export type FactoryCode = 'ЛХ' | 'ЛЮ' | 'СП' | 'Щ';
export type Mode = 'tas' | 'iceberg';

export const TAS_FACTORIES: FactoryCode[] = ['ЛХ', 'ЛЮ'];
export const ICEBERG_FACTORIES: FactoryCode[] = ['СП', 'Щ'];

export const getFactoryBadgeClass = (factory: string): string => {
  switch (factory) {
    case 'ЛХ': return 'factory-badge-small ЛХ';
    case 'ЛЮ': return 'factory-badge-small ЛЮ';
    case 'СП': return 'factory-badge-small СП';
    case 'Щ': return 'factory-badge-small Щ';
    default: return 'factory-badge-small Другой';
  }
};

export const getFactoryName = (code: string): string => {
  switch (code) {
    case 'ЛХ': return '🏭 Луховицкий';
    case 'ЛЮ': return '🏭 Люберецкий';
    case 'СП': return '🏭 Сергиев Посад';
    case 'Щ': return '🏭 Щёлково';
    default: return '📦 Все заводы';
  }
};

export const detectFactory = (
  item: { division?: string; number?: string },
  type: 'incoming' | 'shipment'
): string => {
  if (type === 'incoming') {
    if (item.division === 'ЛХ') return 'ЛХ';
    if (item.division === 'ЛЮ') return 'ЛЮ';
    if (item.division === 'СП') return 'СП';
    if (item.division === 'Щ') return 'Щ';
    if (item.number?.startsWith('ЛХ')) return 'ЛХ';
    if (item.number?.startsWith('ЛЮ')) return 'ЛЮ';
    if (item.number?.startsWith('СП')) return 'СП';
    if (item.number?.startsWith('Щ')) return 'Щ';
  } else if (type === 'shipment') {
    if (item.division === 'ЛХ') return 'ЛХ';
    if (item.division === 'ЛЮ') return 'ЛЮ';
    if (item.division === 'СП') return 'СП';
    if (item.division === 'Щ') return 'Щ';
  }
  return 'Другой';
};








// lib/utils.ts

export interface ShipmentForCount {
  date: string;
  clientRequestNumber: string | null;
  quantity: number;
  division: string;
  material: string;
}

export interface RequestForCount {
  number: string;
  closed: boolean | null;
  quantity: number;
  division: string;
  material: string;
}




export function countActiveRequests(
  requests: RequestForCount[],
  shipments: ShipmentForCount[],
  mode: Mode,
  materialType: 'asphalt' | 'concrete'
): number {
  // Фильтруем по типу материала
  const isConcrete = materialType === 'concrete';
  const filteredRequests = requests.filter(r => isConcreteMaterial(r.material) === isConcrete);
  const filteredShipments = shipments.filter(s => isConcreteMaterial(s.material) === isConcrete);
  
  // Фильтруем по заводам режима
  const validFactories = mode === 'tas' ? TAS_FACTORIES : ICEBERG_FACTORIES;
  const filteredRequestsByFactory = filteredRequests.filter(r => validFactories.includes(r.division as FactoryCode));
  const filteredShipmentsByFactory = filteredShipments.filter(s => validFactories.includes(s.division as FactoryCode));
  
  // Сегодня и вчера
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Карта планов
  const planMap = new Map<string, number>();
  for (const req of filteredRequestsByFactory) {
    planMap.set(req.number, req.quantity);
  }
  
  // Карта закрытых заявок
  const closedMap = new Map<string, boolean>();
  for (const req of filteredRequestsByFactory) {
    if (req.closed) {
      closedMap.set(req.number, true);
    }
  }
  
  // Группируем отгрузки за сегодня и вчера по заявкам
  const factByRequest = new Map<string, number>();
  for (const shipment of filteredShipmentsByFactory) {
    const shipmentDate = parseRussianDate(shipment.date);
    shipmentDate.setHours(0, 0, 0, 0);
    
    const isToday = shipmentDate.getTime() === today.getTime();
    const isYesterday = shipmentDate.getTime() === yesterday.getTime();
    
    if (!isToday && !isYesterday) continue;
    
    const requestNumber = shipment.clientRequestNumber;
    if (requestNumber) {
      const current = factByRequest.get(requestNumber) || 0;
      factByRequest.set(requestNumber, current + shipment.quantity);
    }
  }
  
  // Считаем активные заявки (мигающие точки)
  let activeCount = 0;
  for (const [requestNumber, factQuantity] of factByRequest) {
    const planQuantity = planMap.get(requestNumber) || 0;
    const isClosed = closedMap.get(requestNumber) || false;
    
    if (isClosed) continue;
    if (planQuantity === 0) continue;
    
    const percent = (factQuantity / planQuantity) * 100;
    if (percent > 0 && percent < 90) {
      activeCount++;
    }
  }
  
  return activeCount;
}



// // lib/utils.ts
// export function isConcreteMaterial(material: string): boolean {
//   if (!material) return false;
  
//   const lower = material.toLowerCase();
  
//   // Исключения — то, что точно НЕ бетон (даже если есть маркеры бетона)
//   const excludeMarkers = ['асфальт', 'а/б', 'щма', 'пбв', 'гранит', 'щебень', 'песок', 'битум', 'эмульсия'];
  
//   for (const marker of excludeMarkers) {
//     if (lower.includes(marker)) return false;
//   }
  
//   // Маркеры бетона
//   const concreteMarkers = ['бст', 'бсм', 'бетон', 'раствор'];
  
//   for (const marker of concreteMarkers) {
//     if (lower.includes(marker)) return true;
//   }
  
//   return false;
// }



// export const parseRussianDate = (dateString: string): Date => {
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