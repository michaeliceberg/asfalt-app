// components/ListView.tsx
'use client';

import { IncomingItem, ShipmentItem } from '@/app/page';

type UnifiedDataItem = IncomingItem | ShipmentItem;

interface ListViewProps {
  data: UnifiedDataItem[];
  mainTab: 'incoming' | 'shipment';
}

export default function ListView({ data, mainTab }: ListViewProps) {
  const isShipment = mainTab === 'shipment';
  
  // Группируем по дате
  const groupedByDate = data.reduce((acc, item) => {
    const date = new Date(item.date);
    const dateKey = date.toLocaleDateString('ru-RU');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, UnifiedDataItem[]>);
  
  // Сортируем даты (новые сверху)
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
    const dateA = new Date(a.split('.').reverse().join('-'));
    const dateB = new Date(b.split('.').reverse().join('-'));
    return dateB.getTime() - dateA.getTime();
  });
  
  const getDayLabel = (dateStr: string): string => {
    const today = new Date().toLocaleDateString('ru-RU');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
    if (dateStr === today) return 'СЕГОДНЯ';
    if (dateStr === yesterdayStr) return 'ВЧЕРА';
    return dateStr;
  };
  
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDateForRow = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`;
  };
  
  const getFactory = (item: UnifiedDataItem): string => {
    if ('number' in item && (item as IncomingItem).number?.startsWith('ЛХ')) return 'ЛХ';
    if ('number' in item && (item as IncomingItem).number?.startsWith('ЛЮ')) return 'ЛЮ';
    if ('division' in item && (item as ShipmentItem).division === 'Луховицы') return 'ЛХ';
    if ('division' in item && (item as ShipmentItem).division === 'Люберцы') return 'ЛЮ';
    return '—';
  };
  
  const getCustomer = (item: UnifiedDataItem): string => {
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
  
  const getFactoryBadgeClass = (factory: string): string => {
    switch (factory) {
      case 'ЛХ': return 'factory-badge-mini ЛХ';
      case 'ЛЮ': return 'factory-badge-mini ЛЮ';
      default: return 'factory-badge-mini Другой';
    }
  };
  
  if (data.length === 0) {
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
        const isDateToday = date === new Date().toLocaleDateString('ru-RU');
        
        return (
          <div key={date} className="compact-date-group">
            <div className={`compact-date-header ${isDateToday ? 'today-separator' : ''}`}>
              {getDayLabel(date)}
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
                {items.map((item, idx) => {
                  const factory = getFactory(item);
                  const time = formatTime(item.date);
                  const dayMonth = formatDateForRow(item.date);
                  // const displayTime = `${time} ${dayMonth}`;
                  const displayTime = time;
                  
                  return (
                    <div key={idx} className="list-row">
                      <span className="list-time">{displayTime}</span>
                      <span className="list-material" title={item.material}>{getMaterial(item)}</span>
                      <span className="list-quantity">{item.quantity.toFixed(1)}</span>
                      <span className="list-customer" title={getCustomer(item)}>{getCustomer(item)}</span>
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





// // components/ListView.tsx
// 'use client';

// import { IncomingItem, ShipmentItem } from '@/app/page';

// type UnifiedDataItem = IncomingItem | ShipmentItem;

// interface ListViewProps {
//   data: UnifiedDataItem[];
//   mainTab: 'incoming' | 'shipment';
// }

// export default function ListView({ data, mainTab }: ListViewProps) {
//   const isShipment = mainTab === 'shipment';
  
//   // Сортируем по дате (новые сверху)
//   const sortedData = [...data].sort((a, b) => {
//     const dateA = new Date(a.date);
//     const dateB = new Date(b.date);
//     return dateB.getTime() - dateA.getTime();
//   });
  
//   const formatDateTime = (dateStr: string) => {
//     const date = new Date(dateStr);
//     return `${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`;
//   };
  
//   const getFactory = (item: UnifiedDataItem): string => {
//     if ('number' in item && (item as IncomingItem).number?.startsWith('ЛХ')) return 'ЛХ';
//     if ('number' in item && (item as IncomingItem).number?.startsWith('ЛЮ')) return 'ЛЮ';
//     if ('division' in item && (item as ShipmentItem).division === 'Луховицы') return 'ЛХ';
//     if ('division' in item && (item as ShipmentItem).division === 'Люберцы') return 'ЛЮ';
//     return '—';
//   };
  
//   const getCustomer = (item: UnifiedDataItem): string => {
//     if (isShipment) {
//       const shipment = item as ShipmentItem;
//       return shipment.consignee || shipment.customer || '—';
//     } else {
//       return (item as IncomingItem).supplier || '—';
//     }
//   };
  
//   const getMaterial = (item: UnifiedDataItem): string => {
//     let material = item.material;
//     if (material.length > 25) {
//       material = material.substring(0, 22) + '...';
//     }
//     return material;
//   };
  
//   const getQuantity = (item: UnifiedDataItem): string => {
//     return item.quantity.toFixed(1);
//   };
  
//   const getLicensePlate = (item: UnifiedDataItem): string => {
//     const plate = item.licensePlate || '—';
//     return plate.length > 10 ? plate.substring(0, 10) : plate;
//   };
  
//   const getFactoryBadgeClass = (factory: string): string => {
//     switch (factory) {
//       case 'ЛХ': return 'factory-badge-mini ЛХ';
//       case 'ЛЮ': return 'factory-badge-mini ЛЮ';
//       default: return 'factory-badge-mini Другой';
//     }
//   };
  
//   if (data.length === 0) {
//     return (
//       <div className="empty">
//         <p>Нет данных</p>
//       </div>
//     );
//   }
  
//   return (
//     <div className="list-view">
//       <div className="list-header">
//         <span className="list-time">Время</span>
//         <span className="list-material">Материал</span>
//         <span className="list-quantity">т</span>
//         <span className="list-customer">Контрагент</span>
//         <span className="list-factory"></span>
//         <span className="list-license">Машина</span>
//       </div>
//       <div className="list-rows">
//         {sortedData.map((item, idx) => {
//           const factory = getFactory(item);
//           return (
//             <div key={idx} className="list-row">
//               <span className="list-time">{formatDateTime(item.date)}</span>
//               <span className="list-material" title={item.material}>{getMaterial(item)}</span>
//               <span className="list-quantity">{getQuantity(item)}</span>
//               <span className="list-customer" title={getCustomer(item)}>{getCustomer(item)}</span>
//               <span className="list-factory">
//                 <span className={getFactoryBadgeClass(factory)}>{factory}</span>
//               </span>
//               <span className="list-license" title={item.licensePlate || '—'}>{getLicensePlate(item)}</span>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }



// // // components/ListView.tsx
// // import { motion } from 'framer-motion';

// // // Импортируем типы из page или определяем заново
// // interface IncomingItem {
// //   id: number;
// //   number: string;
// //   date: string;
// //   supplier: string;
// //   material: string;
// //   gross: number | null;
// //   tara: number | null;
// //   quantity: number;
// //   driver: string | null;
// //   licensePlate: string | null;
// //   createdAt: number;
// // }

// // interface ShipmentItem {
// //   id: number;
// //   number: string;
// //   date: string;
// //   division: string;
// //   customer: string;
// //   consignee: string | null;
// //   material: string;
// //   gross: number | null;
// //   tara: number | null;
// //   quantity: number;
// //   driver: string | null;
// //   licensePlate: string | null;
// //   clientRequestNumber: string | null;
// //   clientRequestDate: string | null;
// //   createdAt: number;
// // }

// // type UnifiedDataItem = IncomingItem | ShipmentItem;

// // interface ListViewProps {
// //   data: UnifiedDataItem[];
// //   mainTab: 'incoming' | 'shipment';
// //   isToday: (date: string) => boolean;
// //   formatDate: (date: string) => string;
// //   formatWeight: (weight: number | null | undefined) => string;
// //   getFactoryBadge: (item: UnifiedDataItem) => string;
// // }

// // export default function ListView({ 
// //   data, 
// //   mainTab, 
// //   isToday, 
// //   formatDate, 
// //   formatWeight, 
// //   getFactoryBadge 
// // }: ListViewProps) {
// //   const isIncoming = mainTab === 'incoming';
// //   const isShipment = mainTab === 'shipment';

// //   if (data.length === 0) {
// //     return (
// //       <div className="empty">
// //         <p>Нет данных</p>
// //       </div>
// //     );
// //   }

// //   return (
// //     <div className="cards">
// //       {data.map((item) => (
// //         <div 
// //           key={item.id} 
// //           className={`card ${isToday(item.date) ? 'today-card' : ''}`}
// //         >
// //           <div className="card-header">
// //             <div className="header-left">
// //               <div className={`factory-badge ${getFactoryBadge(item)}`}>
// //                 {getFactoryBadge(item)}
// //               </div>
// //               <span className="number">
// //                 №{item.number}
// //               </span>
// //             </div>
// //             {isToday(item.date) && (
// //               <div className="header-center">
// //                 <span className="today-badge">СЕГОДНЯ</span>
// //               </div>
// //             )}
// //             <div className="header-right">
// //               <span className={`date ${isToday(item.date) ? 'today-date' : ''}`}>
// //                 {formatDate(item.date)}
// //               </span>
// //             </div>
// //           </div>
          
// //           <div className="card-content">
// //             <div className="supplier">
// //               <span className="label">{isIncoming ? 'Поставщик:' : 'Покупатель:'}</span>
// //               <span className="value">
// //                 {isIncoming ? (item as IncomingItem).supplier : (item as ShipmentItem).customer}
// //               </span>
// //             </div>
            
// //             {isShipment && (item as ShipmentItem).consignee && (
// //               <div className="consignee-line">
// //                 <span className="label">📦 Грузополучатель:</span>
// //                 <span className="value">{(item as ShipmentItem).consignee}</span>
// //               </div>
// //             )}
            
// //             <div className="material">
// //               <span className="label">Материал:</span>
// //               <span className="value material-name">{item.material}</span>
// //             </div>
            
// //             <div className="weight-row">
// //               <div className="weight-item">
// //                 <span className="label">Количество:</span>
// //                 <span className="value weight-value">{formatWeight(item.quantity)}</span>
// //               </div>
// //               <div className="weight-item">
// //                 <span className="label">Брутто:</span>
// //                 <span className="value">{formatWeight((item as IncomingItem | ShipmentItem).gross)}</span>
// //               </div>
// //             </div>
            
// //             <div className="driver-row">
// //               {item.driver && (
// //                 <div className="driver-item">
// //                   <span className="label">👨‍✈️ Водитель:</span>
// //                   <span className="value">{item.driver}</span>
// //                 </div>
// //               )}
// //               {item.licensePlate && (
// //                 <div className="plate-item">
// //                   <span className="label">🚛 Госномер:</span>
// //                   <span className="value">{item.licensePlate}</span>
// //                 </div>
// //               )}
// //             </div>
// //           </div>
// //         </div>
// //       ))}
// //     </div>
// //   );
// // }