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
  
  // ❌ Исключения — то, что точно НЕ бетон
  const excludeMarkers = ['асфальт', 'а/б', 'щма', 'пбв', 'гранит', 'щебень', 'песок', 'битум', 'эмульсия'];
  for (const marker of excludeMarkers) {
    if (lower.includes(marker)) return false;
  }
  
  // ✅ Маркеры бетона (добавляем новые)
  const concreteMarkers = [
    'бст',      // бетонная смесь тяжелая
    'бсм',      // бетонная смесь мелкозернистая
    'бетон',    // бетон
    'раствор',  // раствор
    'в25',      // класс бетона В25
    'в30',      // класс бетона В30
    'в35',      // класс бетона В35
    'f200',     // морозостойкость
    'f300',     // морозостойкость
    'w6',       // водонепроницаемость
    'w8',       // водонепроницаемость
    'w10',      // водонепроницаемость
    'п4',       // подвижность
    'п5',       // подвижность
  ];
  
  for (const marker of concreteMarkers) {
    if (lower.includes(marker)) return true;
  }
  
  return false;
};



// export const isConcreteMaterial = (material: string): boolean => {
//   if (!material) return false;
//   const lower = material.toLowerCase();
  
//   // Исключения — то, что точно НЕ бетон
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
// };








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








export function getMaterialType(material: string): 'asphalt' | 'concrete' | 'other' {
  if (!material) return 'other';
  const lower = material.toLowerCase();
  
  if (lower.includes('асфальт') || lower.includes('а/б') || lower.includes('щма')) {
    return 'asphalt';
  }
  if (lower.includes('бст') || lower.includes('бетон') || lower.includes('бсм')) {
    return 'concrete';
  }
  return 'other';
}



export interface FormattedValue {
  value: number;
  unit: string;
}






// export function formatWithUnit(
//   quantity: number,
//   unit: string | null | undefined,
//   material: string
// ): { value: number; unit: string } {
//   let effectiveUnit = unit || null;
//   let value = quantity;
  
//   // Если unit не указан или указан как 'т', но значение огромное — это килограммы
//   if ((!effectiveUnit || effectiveUnit === 'т') && quantity > 10000) {
//     effectiveUnit = 'кг';
//   }
  
//   // Если всё ещё нет unit — определяем по материалу
//   if (!effectiveUnit) {
//     effectiveUnit = detectUnitByMaterial(material);
//   }
  
//   let displayUnit = effectiveUnit;

//   // Конвертация кг → тонны (для асфальта и инертных)
//   if (effectiveUnit === 'кг') {
//     value = quantity / 1000;
//     displayUnit = 'т';
//   }
  
//   // Для бетона: если пришли тонны — переводим в м³
//   if (effectiveUnit === 'т' && getMaterialType(material) === 'concrete') {
//     value = quantity / 2.4;
//     displayUnit = 'м³';
//   }

//   return { value, unit: displayUnit };
// }


export function formatWithUnit(
  quantity: number,
  unit: string | null | undefined,
  material: string
): { value: number; unit: string } {
  let effectiveUnit = unit || null;
  let value = quantity;
  
  // ✅ Если единица 'т', но значение > 10000 — это килограммы
  if (effectiveUnit === 'т' && quantity > 10000) {
    effectiveUnit = 'кг';
  }
  
  // Если unit не указан, но значение очень большое — это килограммы
  if (!effectiveUnit && quantity > 10000) {
    effectiveUnit = 'кг';
  }
  
  // Если всё ещё нет unit — определяем по материалу
  if (!effectiveUnit) {
    effectiveUnit = detectUnitByMaterial(material);
  }
  
  let displayUnit = effectiveUnit;

  // Конвертация кг → тонны
  if (effectiveUnit === 'кг') {
    value = quantity / 1000;
    displayUnit = 'т';
  }

  return { value, unit: displayUnit };
}






function detectUnitByMaterial(material: string): string {
  const lower = material.toLowerCase();
  if (lower.includes('асфальт') || lower.includes('а/б') || lower.includes('щма')) {
    return 'т';
  }
  if (lower.includes('бст') || lower.includes('бетон') || lower.includes('бсм')) {
    return 'м³';
  }
  return 'т';
}












/**
 * Возвращает ключ даты для группировки поступлений
 * Окно: с 08:00 текущего дня до 08:00 следующего дня
 */
export function getIncomingDateKey(dateString: string): string {
  const date = parseRussianDate(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  // Если время меньше 8 часов - относим к предыдущему дню
  if (date.getHours() < 8) {
    date.setDate(date.getDate() - 1);
  }
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
}

/**
 * Форматирует дату для отображения с учётом окна 08:00
 */
// export function formatIncomingDateLabel(dateStr: string): string {
//   const date = parseRussianDate(dateStr);
//   if (isNaN(date.getTime())) return dateStr;
  
//   // Если время меньше 8 часов - относим к предыдущему дню
//   if (date.getHours() < 8) {
//     date.setDate(date.getDate() - 1);
//   }
  
//   const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
//   const day = date.getDate();
//   const month = months[date.getMonth()];
  
//   return `${day} ${month}`;
// }


/**
 * Форматирует дату для отображения с учётом окна 08:00
 * Принимает ключ даты в формате DD.MM.YYYY
 */


// СУПЕР РАБОТАЕТ 
// export function formatIncomingDateLabel(dateKey: string): string {
//   const parts = dateKey.split('.');
//   if (parts.length !== 3) return dateKey;
  
//   const day = parseInt(parts[0], 10);
//   const month = parseInt(parts[1], 10) - 1;
//   const year = parseInt(parts[2], 10);
  
//   const date = new Date(year, month, day);
//   const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  
//   return `${day} ${months[month]}`;
// }



/**
 * Форматирует дату для отображения с учётом окна 08:00
 * Возвращает "13 июня 8:00 → 14 июня 8:00"
 */
export function formatIncomingDateLabel(dateKey: string): string {
  const parts = dateKey.split('.');
  if (parts.length !== 3) return dateKey;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  
  const startDate = new Date(year, month, day, 8, 0);
  const endDate = new Date(year, month, day + 1, 8, 0);
  
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  
  const startDay = startDate.getDate();
  const startMonth = months[startDate.getMonth()];
  const endDay = endDate.getDate();
  const endMonth = months[endDate.getMonth()];
  
  // Если месяц не меняется
  if (startMonth === endMonth) {
    return `${startDay} ${startMonth} 8:00 → ${endDay} ${endMonth} 8:00`;
  }
  
  // Если месяц меняется
  return `${startDay} ${startMonth} 8:00 → ${endDay} ${endMonth} 8:00`;
}





/**
 * Проверяет, относится ли дата к сегодняшнему окну (с 08:00)
 * Принимает ключ даты в формате DD.MM.YYYY
 */
export function isIncomingDateToday(dateKey: string): boolean {
  const today = new Date();
  const todayKey = getIncomingDateKey(today.toISOString());
  return dateKey === todayKey;
}

/**
 * Проверяет, относится ли дата к сегодняшнему окну (с 08:00)
//  */
// export function isIncomingDateToday(dateStr: string): boolean {
//   const date = parseRussianDate(dateStr);
//   if (isNaN(date.getTime())) return false;
  
//   // Если время меньше 8 часов - относим к предыдущему дню
//   let dateForCheck = new Date(date);
//   if (date.getHours() < 8) {
//     dateForCheck = new Date(date);
//     dateForCheck.setDate(date.getDate() - 1);
//   }
  
//   const today = new Date();
//   const todayForCheck = new Date(today);
//   if (today.getHours() < 8) {
//     todayForCheck.setDate(today.getDate() - 1);
//   }
  
//   return dateForCheck.getDate() === todayForCheck.getDate() &&
//          dateForCheck.getMonth() === todayForCheck.getMonth() &&
//          dateForCheck.getFullYear() === todayForCheck.getFullYear();
// }




/**
 * Форматирует дату и время для отображения в деталях
 * Возвращает "ДД.ММ.ГГГГ ЧЧ:ММ"
 */
export function formatFullDateTime(dateString: string): string {
  const date = parseRussianDate(dateString);
  if (isNaN(date.getTime())) return '—';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}





// lib/utils.ts

/**
 * Парсит строку "ПунктНазначения" вида:
 * "а/д Аладьино-Воскресенки-Труфаново км 0,000 - км 6,664 54.808136, 38.214683"
 * Возвращает { lat: number; lng: number; address: string } или null
 */
export function parseDestinationPoint(destinationPoint: string | null): {
  lat: number;
  lng: number;
  address: string;
} | null {
  if (!destinationPoint) return null;
  
  // Ищем координаты в конце строки
  const coordMatch = destinationPoint.match(/(\d+\.\d+),\s*(\d+\.\d+)\s*$/);
  if (!coordMatch) return null;
  
  const lat = parseFloat(coordMatch[1]);
  const lng = parseFloat(coordMatch[2]);
  const address = destinationPoint.replace(/\s*\d+\.\d+,\s*\d+\.\d+\s*$/, '').trim();
  
  return { lat, lng, address };
}






// lib/utils.ts (добавить в конец файла)

// ============================================
// КООРДИНАТЫ ЗАВОДОВ
// ============================================

export const FACTORIES: Record<string, { lat: number; lng: number }> = {
  'ЛХ': { lat: 54.961524, lng: 38.839336 },
  'ЛЮ': { lat: 55.702066, lng: 37.995442 },
  'СП': { lat: 56.363355, lng: 38.175478 },
  'Щ': { lat: 55.917957, lng: 38.027629 },
};

export function getFactoryCoords(factoryCode: string): { lat: number; lng: number } | null {
  return FACTORIES[factoryCode] || null;
}

// ============================================
// РАСЧЕТ РАССТОЯНИЯ И ВРЕМЕНИ
// ============================================

/**
 * Расчёт расстояния между двумя точками по формуле Гаверсинуса
 * Возвращает расстояние в километрах
 */
export function calculateDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Расчет ETA (время до прибытия)
 * @param distance - расстояние в километрах
 * @param avgSpeed - средняя скорость (км/ч), по умолчанию 50
 */
export function calculateETA(
  distance: number, 
  avgSpeed: number = 50
): { hours: number; minutes: number; totalMinutes: number } {
  // Учитываем пробки: на дальние расстояния добавляем коэффициент
  const speedWithTraffic = avgSpeed * (distance > 50 ? 0.7 : 0.85);
  const totalMinutes = Math.round((distance / speedWithTraffic) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes, totalMinutes };
}

/**
 * Форматирует ETA в читаемый вид
 */
export function formatETA(distance: number): string {
  if (distance < 2) return '✅ Прибыл';
  const eta = calculateETA(distance);
  if (eta.totalMinutes === 0) return '📍 У цели';
  return `⏱️ ${eta.hours > 0 ? eta.hours + 'ч ' : ''}${eta.minutes}м (${distance.toFixed(1)} км)`;
}

/**
 * Получает статус машины на основе расстояния до цели
 */
export function getTruckStatusByDistance(distance: number | null): 'arrived' | 'near' | 'en_route' | 'unknown' {
  if (distance === null) return 'unknown';
  if (distance < 2) return 'arrived';
  if (distance < 10) return 'near';
  return 'en_route';
}

/**
 * Получает цвет статуса для машины
 */
export function getTruckStatusColor(distance: number | null): string {
  const status = getTruckStatusByDistance(distance);
  switch (status) {
    case 'arrived': return '#4ade80';
    case 'near': return '#60a5fa';
    case 'en_route': return '#facc15';
    default: return '#94a3b8';
  }
}