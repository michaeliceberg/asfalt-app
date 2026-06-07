'use client';

import { IncomingItem, ShipmentItem } from '@/app/page';

type UnifiedDataItem = IncomingItem | ShipmentItem;

interface ListViewProps {
  data: UnifiedDataItem[];
  mainTab: 'incoming' | 'shipment' | 'shipmentConcrete';
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

const formatTime = (dateStr: string): string => {
  const date = parseRussianDate(dateStr);
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

const getFactory = (item: UnifiedDataItem): string => {
  if ('supplier' in item) {
    const incoming = item as IncomingItem;
    if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
    if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
    if (incoming.number?.startsWith('СП')) return 'СП';
    if (incoming.number?.startsWith('Щ')) return 'Щ';
    if (incoming.division === 'ЛХ') return 'ЛХ';
    if (incoming.division === 'ЛЮ') return 'ЛЮ';
    if (incoming.division === 'СП') return 'СП';
    if (incoming.division === 'Щ') return 'Щ';
  } else if ('division' in item) {
    const shipment = item as ShipmentItem;
    if (shipment.division === 'ЛХ') return 'ЛХ';
    if (shipment.division === 'ЛЮ') return 'ЛЮ';
    if (shipment.division === 'СП') return 'СП';
    if (shipment.division === 'Щ') return 'Щ';
  }
  return '—';
};

const getFactoryBadgeClass = (factory: string): string => {
  switch (factory) {
    case 'ЛХ': return 'factory-badge-mini ЛХ';
    case 'ЛЮ': return 'factory-badge-mini ЛЮ';
    case 'СП': return 'factory-badge-mini СП';
    case 'Щ': return 'factory-badge-mini Щ';
    default: return 'factory-badge-mini Другой';
  }
};

const getCustomer = (item: UnifiedDataItem, isShipment: boolean): string => {
  if (isShipment) {
    const shipment = item as ShipmentItem;
    return shipment.consignee || shipment.customer || '—';
  } else {
    return (item as IncomingItem).supplier || '—';
  }
};

const getMaterial = (item: UnifiedDataItem): string => {
  let material = item.material;
  if (material.length > 20) {
    material = material.substring(0, 17) + '...';
  }
  return material;
};

const getLicensePlate = (item: UnifiedDataItem): string => {
  const plate = item.licensePlate || '—';
  return plate.length > 10 ? plate.substring(0, 10) : plate;
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

export default function ListView({ data, mainTab }: ListViewProps) {
  const isShipment = mainTab === 'shipment' || mainTab === 'shipmentConcrete';
  const isConcreteOnly = mainTab === 'shipmentConcrete';
  
  // Фильтруем данные по типу материала
  const filteredData = data.filter(item => {
    if (mainTab === 'incoming') return true;
    if (isConcreteOnly) return isConcreteMaterial(item.material);
    return !isConcreteMaterial(item.material);
  });
  
  // Группируем по дате
  const groupedByDate = filteredData.reduce((acc, item) => {
    const dateKey = getDateKey(item.date);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, UnifiedDataItem[]>);
  
  // Сортируем даты (новые сверху)
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
    const dateA = parseRussianDate(a);
    const dateB = parseRussianDate(b);
    return dateB.getTime() - dateA.getTime();
  });
  
  if (filteredData.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных</p>
      </div>
    );
  }
  
  return (
    <div className="compact-view">
      {sortedDates.map(date => {
        const items = groupedByDate[date];
        const isDateToday = date === getDateKey(new Date().toISOString());
        
        return (
          <div key={date} className="compact-date-group">
            {/* <div className={`compact-date-header ${isDateToday ? 'today-separator' : ''}`}>
              {getDayLabel(date)}
            </div> */}

            <div className={`compact-date-header ${isDateToday ? 'today-separator' : ''}`}>
  <span className="date-text">
    {getDayLabel(date)}
    {getDayLabel(date) === 'СЕГОДНЯ' && <span className="today-badge">СЕГОДНЯ</span>}
  </span>
</div>
            <div className="list-table">
              <div className="list-header">
                <span className="list-time">Время</span>
                <span className="list-material">Материал</span>
                <span className="list-quantity">т</span>
                <span className="list-customer">Контрагент</span>
                <span className="list-factory"></span>
                <span className="list-license">Машина</span>
              </div>
              <div className="list-rows">
                {[...items].sort((a, b) => {
                  const dateA = parseRussianDate(a.date);
                  const dateB = parseRussianDate(b.date);
                  return dateB.getTime() - dateA.getTime();
                }).map((item, idx) => {
                  const factory = getFactory(item);
                  const time = formatTime(item.date);
                  const isConcrete = isConcreteMaterial(item.material);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`list-row ${isConcrete && isShipment ? 'concrete-row' : ''}`}
                    >
                      <span className="list-time">{time}</span>
                      <span className="list-material" title={item.material}>{getMaterial(item)}</span>
                      <span className="list-quantity">{item.quantity.toFixed(1)}</span>
                      <span className="list-customer" title={getCustomer(item, isShipment)}>
                        {getCustomer(item, isShipment)}
                        {isConcrete && isShipment && <span className="concrete-badge-row">БЕТОН</span>}
                      </span>
                      <span className="list-factory">
                        <span className={getFactoryBadgeClass(factory)}>{factory}</span>
                      </span>
                      <span className="list-license" title={item.licensePlate || '—'}>{getLicensePlate(item)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// 'use client';

// import { IncomingItem, ShipmentItem } from '@/app/page';

// type UnifiedDataItem = IncomingItem | ShipmentItem;

// interface ListViewProps {
//   data: UnifiedDataItem[];
//   mainTab: 'incoming' | 'shipment';
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
  
//   let hour = 0, minute = 0, second = 0;
//   if (parts[1]) {
//     const timeParts = parts[1].split(':');
//     hour = parseInt(timeParts[0], 10);
//     minute = parseInt(timeParts[1], 10);
//     second = parseInt(timeParts[2], 10);
//   }
  
//   const day = parseInt(dateParts[0], 10);
//   const month = parseInt(dateParts[1], 10) - 1;
//   const year = parseInt(dateParts[2], 10);
  
//   return new Date(year, month, day, hour, minute, second);
// };

// const formatTime = (dateStr: string): string => {
//   const date = parseRussianDate(dateStr);
//   if (isNaN(date.getTime())) return '—';
//   return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
// };

// const formatDateShort = (dateStr: string): string => {
//   const date = parseRussianDate(dateStr);
//   if (isNaN(date.getTime())) return '—';
//   return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
// };

// const getDateKey = (dateString: string): string => {
//   const date = parseRussianDate(dateString);
//   if (isNaN(date.getTime())) return dateString;
  
//   const day = date.getDate().toString().padStart(2, '0');
//   const month = (date.getMonth() + 1).toString().padStart(2, '0');
//   const year = date.getFullYear();
  
//   return `${day}.${month}.${year}`;
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

// const getFactory = (item: UnifiedDataItem): string => {
//   if ('supplier' in item) {
//     const incoming = item as IncomingItem;
//     if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
//     if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
//     if (incoming.number?.startsWith('СП')) return 'СП';
//     if (incoming.number?.startsWith('Щ')) return 'Щ';
//     if (incoming.division === 'ЛХ') return 'ЛХ';
//     if (incoming.division === 'ЛЮ') return 'ЛЮ';
//     if (incoming.division === 'СП') return 'СП';
//     if (incoming.division === 'Щ') return 'Щ';
//   } else if ('division' in item) {
//     const shipment = item as ShipmentItem;
//     if (shipment.division === 'ЛХ') return 'ЛХ';
//     if (shipment.division === 'ЛЮ') return 'ЛЮ';
//     if (shipment.division === 'СП') return 'СП';
//     if (shipment.division === 'Щ') return 'Щ';
//   }
//   return '—';
// };

// const getFactoryBadgeClass = (factory: string): string => {
//   switch (factory) {
//     case 'ЛХ': return 'factory-badge-mini ЛХ';
//     case 'ЛЮ': return 'factory-badge-mini ЛЮ';
//     case 'СП': return 'factory-badge-mini СП';
//     case 'Щ': return 'factory-badge-mini Щ';
//     default: return 'factory-badge-mini Другой';
//   }
// };

// const getCustomer = (item: UnifiedDataItem, isShipment: boolean): string => {
//   if (isShipment) {
//     const shipment = item as ShipmentItem;
//     return shipment.consignee || shipment.customer || '—';
//   } else {
//     return (item as IncomingItem).supplier || '—';
//   }
// };

// const getMaterial = (item: UnifiedDataItem): string => {
//   let material = item.material;
//   if (material.length > 20) {
//     material = material.substring(0, 17) + '...';
//   }
//   return material;
// };

// const getLicensePlate = (item: UnifiedDataItem): string => {
//   const plate = item.licensePlate || '—';
//   return plate.length > 10 ? plate.substring(0, 10) : plate;
// };

// export default function ListView({ data, mainTab }: ListViewProps) {
//   const isShipment = mainTab === 'shipment';
  
//   // Группируем по дате
//   const groupedByDate = data.reduce((acc, item) => {
//     const dateKey = getDateKey(item.date);
//     if (!acc[dateKey]) {
//       acc[dateKey] = [];
//     }
//     acc[dateKey].push(item);
//     return acc;
//   }, {} as Record<string, UnifiedDataItem[]>);
  
//   // Сортируем даты (новые сверху)
//   const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
//     const dateA = parseRussianDate(a);
//     const dateB = parseRussianDate(b);
//     return dateB.getTime() - dateA.getTime();
//   });
  
//   if (data.length === 0) {
//     return (
//       <div className="empty">
//         <p>Нет данных</p>
//       </div>
//     );
//   }
  
//   return (
//     <div className="compact-view">
//       {sortedDates.map(date => {
//         const items = groupedByDate[date];
//         const isDateToday = date === getDateKey(new Date().toISOString());
        
//         return (
//           <div key={date} className="compact-date-group">
//             <div className={`compact-date-header ${isDateToday ? 'today-separator' : ''}`}>
//               {getDayLabel(date)}
//             </div>
//             <div className="list-table">
//               <div className="list-header">
//                 <span className="list-time">Время</span>
//                 <span className="list-material">Материал</span>
//                 <span className="list-quantity">т</span>
//                 <span className="list-customer">Контрагент</span>
//                 <span className="list-factory"></span>
//                 <span className="list-license">Машина</span>
//               </div>
//               <div className="list-rows">
//                 {[...items].sort((a, b) => {
//                   const dateA = parseRussianDate(a.date);
//                   const dateB = parseRussianDate(b.date);
//                   return dateB.getTime() - dateA.getTime();
//                 }).map((item, idx) => {
//                   const factory = getFactory(item);
//                   const time = formatTime(item.date);
//                   const displayTime = time;
                  
//                   return (
//                     <div key={idx} className="list-row">
//                       <span className="list-time">{displayTime}</span>
//                       <span className="list-material" title={item.material}>{getMaterial(item)}</span>
//                       <span className="list-quantity">{item.quantity.toFixed(1)}</span>
//                       <span className="list-customer" title={getCustomer(item, isShipment)}>{getCustomer(item, isShipment)}</span>
//                       <span className="list-factory">
//                         <span className={getFactoryBadgeClass(factory)}>{factory}</span>
//                       </span>
//                       <span className="list-license" title={item.licensePlate || '—'}>{getLicensePlate(item)}</span>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           </div>
//         );
//       })}
//     </div>
//   );
// }
