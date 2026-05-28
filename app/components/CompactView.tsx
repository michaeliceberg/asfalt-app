// components/CompactView.tsx
'use client';

import { IncomingItem, ShipmentItem } from '@/app/page';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type UnifiedDataItem = IncomingItem | ShipmentItem;

interface CompactViewProps {
  data: UnifiedDataItem[];
  mainTab: 'incoming' | 'shipment';
  outgoingRequests?: Array<{
    number: string;
    date: string;
    division: string;
    quantity: number;
    consignee: string;
    material: string;
  }>;
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
  shipments: Array<{
    licensePlate: string;
    factory: string;
    quantity: number;
    time: string;
  }>;
}

export default function CompactView({ data, mainTab, outgoingRequests = [] }: CompactViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isShipment = mainTab === 'shipment';
  
  // Создаём карту заявок с уникальным ключом: номер + дата + подразделение
  const requestsMap = new Map<string, { quantity: number }>();
  outgoingRequests.forEach(req => {
    const key = `${req.number}_${req.date}_${req.division}`;
    requestsMap.set(key, { quantity: req.quantity });
  });
  
  const groupedByDateAndRequest = data.reduce((acc, item) => {
    const date = new Date(item.date).toLocaleDateString('ru-RU');
    
    if (mainTab === 'incoming') {
      // ========== ПОСТУПЛЕНИЯ ==========
      const incoming = item as IncomingItem;
      
      let factory = '—';
      if (incoming.number?.startsWith('ЛХ')) factory = 'ЛХ';
      else if (incoming.number?.startsWith('ЛЮ')) factory = 'ЛЮ';
      
      const groupKey = `${date}_${factory}_${incoming.material}_${incoming.supplier}`;
      
      if (!acc[date]) {
        acc[date] = new Map<string, GroupedItem>();
      }
      
      if (!acc[date].has(groupKey)) {
        acc[date].set(groupKey, {
          time: new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          factQuantity: incoming.quantity,
          planQuantity: 0,
          consignee: incoming.supplier,
          factories: [factory],
          truckCount: 1,
          material: incoming.material,
          requestNumber: '',
          requestDate: '',
          shipments: [],
        });
      } else {
        const existing = acc[date].get(groupKey)!;
        existing.factQuantity += incoming.quantity;
        existing.truckCount += 1;
        if (!existing.factories.includes(factory) && factory !== '—') {
          existing.factories.push(factory);
        }
        const currentTime = new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (currentTime > existing.time) {
          existing.time = currentTime;
        }
      }
      
    } else {
      // ========== ОТГРУЗКИ ==========
      const shipment = item as ShipmentItem;
      
      // Поля для связи с заявкой
      const requestNumber = shipment.clientRequestNumber || '';
      const requestDate = shipment.clientRequestDate || '';
      const division = shipment.division || '';
      
      const requestKey = `${requestNumber}_${requestDate}_${division}`;
      
      let factory = '—';
      if (shipment.division === 'Луховицы') factory = 'ЛХ';
      else if (shipment.division === 'Люберцы') factory = 'ЛЮ';
      
      const consigneeKey = shipment.consignee || shipment.customer || '—';
      const groupKey = `${date}_${requestKey}_${consigneeKey}_${shipment.material}`;
      
      let planQuantity = 0;
      const request = requestsMap.get(requestKey);
      if (request) {
        planQuantity = request.quantity;
      }
      
      if (!acc[date]) {
        acc[date] = new Map<string, GroupedItem>();
      }
      
      if (!acc[date].has(groupKey)) {
        acc[date].set(groupKey, {
          time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          factQuantity: shipment.quantity,
          planQuantity: planQuantity,
          consignee: consigneeKey,
          factories: [factory],
          truckCount: 1,
          material: shipment.material,
          requestNumber: requestNumber,
          requestDate: requestDate,
          shipments: [{
            licensePlate: shipment.licensePlate || '—',
            factory: factory,
            quantity: shipment.quantity,
            time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          }],
        });
      } else {
        const existing = acc[date].get(groupKey)!;
        existing.factQuantity += shipment.quantity;
        existing.truckCount += 1;
        if (planQuantity > existing.planQuantity) {
          existing.planQuantity = planQuantity;
        }
        if (!existing.factories.includes(factory) && factory !== '—') {
          existing.factories.push(factory);
        }
        existing.shipments.push({
          licensePlate: shipment.licensePlate || '—',
          factory: factory,
          quantity: shipment.quantity,
          time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        });
        const currentTime = new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (currentTime > existing.time) {
          existing.time = currentTime;
        }
      }
    }
    
    return acc;
  }, {} as Record<string, Map<string, GroupedItem>>);

  const sortedDates = Object.keys(groupedByDateAndRequest).sort((a, b) => {
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

  const getFactoryBadgeClass = (factory: string): string => {
    switch (factory) {
      case 'ЛХ': return 'factory-badge-small ЛХ';
      case 'ЛЮ': return 'factory-badge-small ЛЮ';
      default: return 'factory-badge-small Другой';
    }
  };

  const formatDateTime = (dateStr: string): string => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        const items = Array.from(groupedByDateAndRequest[date].values());
        
        return (
          <div key={date} className="compact-date-group">
            <div className="compact-date-header">
              {getDayLabel(date)}
            </div>
            <div className="compact-table">
              {/* Заголовки для ОТГРУЗОК */}
              {isShipment && (
                <div className="compact-header">
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-slash"></span>
                  <span className="col-plan">Заяв</span>
                  <span className="col-consignee">Грузополучатель</span>
                  <span className="col-factory">Завод</span>
                  <span className="col-trucks">Машин</span>
                  <span className="col-material">Материал</span>
                  <span className="col-expand"></span>
                </div>
              )}
              
              {/* Заголовки для ПОСТУПЛЕНИЙ */}
              {!isShipment && (
                <div className="compact-header">
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-material-header">Материал</span>
                  <span className="col-factory">Завод</span>
                  <span className="col-trucks">Машин</span>
                  <span className="col-supplier">Поставщик</span>
                </div>
              )}
              
              {items.map((item, idx) => {
                const itemKey = `${date}_${idx}`;
                const isExpanded = expandedId === itemKey;
                const isWarning = item.factQuantity < item.planQuantity;
                
                // ОТГРУЗКИ
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
                          {item.planQuantity > 0 ? item.planQuantity.toFixed(0) : '—'}
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
                        <span className="col-material">{item.material?.substring(0, 25)}</span>
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
                            {item.requestNumber && item.requestDate && (
                              <div className="detail-row">
                                <span className="detail-label">📅 Заявка №{item.requestNumber}:</span>
                                <span className="detail-value">{formatDateTime(item.requestDate)}</span>
                              </div>
                            )}
                            <div className="detail-row">
                              <span className="detail-label">🚛 Отгрузки:</span>
                              <span className="detail-label-right">Тонны</span>
                            </div>
                            {item.shipments.map((ship, i) => (
                              <div key={i} className="detail-shipment">
                                <span className="ship-time">{ship.time}</span>
                                <span className="ship-license">{ship.licensePlate}</span>
                                <span className="ship-factory-badge">
                                  <span className={`factory-badge-mini ${ship.factory}`}>
                                    {ship.factory}
                                  </span>
                                </span>
                                <span className="ship-quantity">{ship.quantity.toFixed(1)} т</span>
                              </div>
                            ))}
                            <div className="detail-total">
                              <span>Итого:</span>
                              <span>{item.factQuantity.toFixed(1)} / {item.planQuantity > 0 ? item.planQuantity.toFixed(0) : '—'} т</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }
                
                // ПОСТУПЛЕНИЯ
                return (
                  <div key={idx} className="compact-row">
                    <span className="col-time">{item.time}</span>
                    <span className="col-fact">{item.factQuantity.toFixed(1)}</span>
                    <span className="col-material">{item.material?.substring(0, 25)}</span>
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
                    <span className="col-supplier">{item.consignee}</span>
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



// // components/CompactView.tsx
// 'use client';

// import { IncomingItem, ShipmentItem } from '@/app/page';
// import { useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';

// type UnifiedDataItem = IncomingItem | ShipmentItem;

// interface CompactViewProps {
//   data: UnifiedDataItem[];
//   mainTab: 'incoming' | 'shipment';
//   outgoingRequests?: Array<{
//     number: string;
//     date: string;
//     division: string;
//     quantity: number;
//     consignee: string;
//     material: string;
//   }>;
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
//   shipments: Array<{
//     licensePlate: string;
//     factory: string;
//     quantity: number;
//     time: string;
//   }>;
// }

// export default function CompactView({ data, mainTab, outgoingRequests = [] }: CompactViewProps) {
//   const [expandedId, setExpandedId] = useState<string | null>(null);
//   const isShipment = mainTab === 'shipment';
  
//   // Создаём карту заявок с уникальным ключом: номер + дата + подразделение
//   const requestsMap = new Map<string, { quantity: number }>();
//   outgoingRequests.forEach(req => {
//     // Уникальный ключ заявки: номер + дата + подразделение
//     const key = `${req.number}_${req.date}_${req.division}`;
//     requestsMap.set(key, { quantity: req.quantity });
//   });
  
//   const groupedByDateAndRequest = data.reduce((acc, item) => {
//     const date = new Date(item.date).toLocaleDateString('ru-RU');
    
//     if (mainTab === 'incoming') {
//       // ========== ПОСТУПЛЕНИЯ ==========
//       const incoming = item as IncomingItem;
      
//       let factory = '—';
//       if (incoming.number?.startsWith('ЛХ')) factory = 'ЛХ';
//       else if (incoming.number?.startsWith('ЛЮ')) factory = 'ЛЮ';
      
//       const groupKey = `${date}_${factory}_${incoming.material}_${incoming.supplier}`;
      
//       if (!acc[date]) {
//         acc[date] = new Map<string, GroupedItem>();
//       }
      
//       if (!acc[date].has(groupKey)) {
//         acc[date].set(groupKey, {
//           time: new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
//           factQuantity: incoming.quantity,
//           planQuantity: 0,
//           consignee: incoming.supplier,
//           factories: [factory],
//           truckCount: 1,
//           material: incoming.material,
//           requestNumber: '',
//           requestDate: '',
//           shipments: [],
//         });
//       } else {
//         const existing = acc[date].get(groupKey)!;
//         existing.factQuantity += incoming.quantity;
//         existing.truckCount += 1;
//         if (!existing.factories.includes(factory) && factory !== '—') {
//           existing.factories.push(factory);
//         }
//         const currentTime = new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
//         if (currentTime > existing.time) {
//           existing.time = currentTime;
//         }
//       }
      
//     } else {
//       // ========== ОТГРУЗКИ ==========
//       const shipment = item as ShipmentItem;
      
//       // Поля для связи с заявкой
//       const requestNumber = shipment.clientRequestNumber || '';
//       const requestDate = shipment.clientRequestDate || '';
//       const division = shipment.division || '';
      
//       // УНИКАЛЬНЫЙ КЛЮЧ: номер заявки + дата заявки + подразделение (завод)
//       const requestKey = `${requestNumber}_${requestDate}_${division}`;
      
//       let factory = '—';
//       if (shipment.division === 'Луховицы') factory = 'ЛХ';
//       else if (shipment.division === 'Люберцы') factory = 'ЛЮ';
      
//       // Группировка по заявке + грузополучатель + материал
//       const consigneeKey = shipment.consignee || shipment.customer || '—';
//       const groupKey = `${date}_${requestKey}_${consigneeKey}_${shipment.material}`;
      
//       // Получаем план из заявки по уникальному ключу
//       let planQuantity = 0;
//       const request = requestsMap.get(requestKey);
//       if (request) {
//         planQuantity = request.quantity;
//       }
      
//       if (!acc[date]) {
//         acc[date] = new Map<string, GroupedItem>();
//       }
      
//       if (!acc[date].has(groupKey)) {
//         acc[date].set(groupKey, {
//           time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
//           factQuantity: shipment.quantity,
//           planQuantity: planQuantity,
//           consignee: consigneeKey,
//           factories: [factory],
//           truckCount: 1,
//           material: shipment.material,
//           requestNumber: requestNumber,
//           requestDate: requestDate,
//           shipments: [{
//             licensePlate: shipment.licensePlate || '—',
//             factory: factory,
//             quantity: shipment.quantity,
//             time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
//           }],
//         });
//       } else {
//         const existing = acc[date].get(groupKey)!;
//         existing.factQuantity += shipment.quantity;
//         existing.truckCount += 1;
//         if (planQuantity > existing.planQuantity) {
//           existing.planQuantity = planQuantity;
//         }
//         if (!existing.factories.includes(factory) && factory !== '—') {
//           existing.factories.push(factory);
//         }
//         existing.shipments.push({
//           licensePlate: shipment.licensePlate || '—',
//           factory: factory,
//           quantity: shipment.quantity,
//           time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
//         });
//         const currentTime = new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
//         if (currentTime > existing.time) {
//           existing.time = currentTime;
//         }
//       }
//     }
    
//     return acc;
//   }, {} as Record<string, Map<string, GroupedItem>>);

//   const sortedDates = Object.keys(groupedByDateAndRequest).sort((a, b) => {
//     const dateA = new Date(a.split('.').reverse().join('-'));
//     const dateB = new Date(b.split('.').reverse().join('-'));
//     return dateB.getTime() - dateA.getTime();
//   });

//   const getDayLabel = (dateStr: string): string => {
//     const today = new Date().toLocaleDateString('ru-RU');
//     const yesterday = new Date();
//     yesterday.setDate(yesterday.getDate() - 1);
//     const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
//     if (dateStr === today) return 'СЕГОДНЯ';
//     if (dateStr === yesterdayStr) return 'ВЧЕРА';
//     return dateStr;
//   };

//   const getFactoryBadgeClass = (factory: string): string => {
//     switch (factory) {
//       case 'ЛХ': return 'factory-badge-small ЛХ';
//       case 'ЛЮ': return 'factory-badge-small ЛЮ';
//       default: return 'factory-badge-small Другой';
//     }
//   };

//   const formatDateTime = (dateStr: string): string => {
//     if (!dateStr) return '—';
//     const date = new Date(dateStr);
//     return date.toLocaleString('ru-RU', {
//       day: '2-digit',
//       month: '2-digit',
//       hour: '2-digit',
//       minute: '2-digit'
//     });
//   };

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
//         const items = Array.from(groupedByDateAndRequest[date].values());
        
//         return (
//           <div key={date} className="compact-date-group">
//             <div className="compact-date-header">
//               {getDayLabel(date)}
//             </div>
//             <div className="compact-table">
//               <div className="compact-header">
//                 <span className="col-time">Время</span>
//                 <span className="col-fact">Вып</span>
//                 <span className="col-slash"></span>
//                 <span className="col-plan">Заяв</span>
//                 <span className="col-consignee">Грузополучатель</span>
//                 <span className="col-factory">Завод</span>
//                 <span className="col-trucks">Машин</span>
//                 <span className="col-material">Материал</span>
//                 <span className="col-expand"></span>
//               </div>
              
//               {items.map((item, idx) => {
//                 const itemKey = `${date}_${idx}`;
//                 const isExpanded = expandedId === itemKey;
//                 const isWarning = item.factQuantity < item.planQuantity;
                
//                 return (
//                   <div key={idx}>
//                     <div 
//                       className="compact-row compact-clickable"
//                       onClick={() => setExpandedId(isExpanded ? null : itemKey)}
//                     >
//                       <span className="col-time">{item.time}</span>
//                       <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
//                         {item.factQuantity.toFixed(1)}
//                       </span>
//                       <span className="col-slash">/</span>
//                       <span className="col-plan">
//                         {item.planQuantity > 0 ? item.planQuantity.toFixed(0) : '—'}
//                       </span>
//                       <span className="col-consignee">{item.consignee}</span>
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
//                       <span className="col-material">{item.material?.substring(0, 25)}</span>
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
//                           {item.requestNumber && item.requestDate && (
//                             <div className="detail-row">
//                               <span className="detail-label">📅 Заявка №{item.requestNumber}:</span>
//                               <span className="detail-value">{formatDateTime(item.requestDate)}</span>
//                             </div>
//                           )}
//                           <div className="detail-row">
//                             <span className="detail-label">🚛 Отгрузки:</span>
//                             <span className="detail-label-right">Тонны</span>
//                           </div>
//                           {item.shipments.map((ship, i) => (
//                             <div key={i} className="detail-shipment">
//                               <span className="ship-time">{ship.time}</span>
//                               <span className="ship-license">{ship.licensePlate}</span>
//                               <span className="ship-factory-badge">
//                                 <span className={`factory-badge-mini ${ship.factory}`}>
//                                   {ship.factory}
//                                 </span>
//                               </span>
//                               <span className="ship-quantity">{ship.quantity.toFixed(1)} т</span>
//                             </div>
//                           ))}
//                           <div className="detail-total">
//                             <span>Итого:</span>
//                             <span>{item.factQuantity.toFixed(1)} / {item.planQuantity > 0 ? item.planQuantity.toFixed(0) : '—'} т</span>
//                           </div>
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











// // components/CompactView.tsx
// 'use client';

// import { IncomingItem, ShipmentItem } from '@/app/page';
// import { useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';

// type UnifiedDataItem = IncomingItem | ShipmentItem;

// interface CompactViewProps {
//   data: UnifiedDataItem[];
//   mainTab: 'incoming' | 'shipment';
//   outgoingRequests?: Array<{
//     number: string;
//     date: string;
//     quantity: number;
//     consignee: string;
//     material: string;
//   }>;
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
//   shipments: Array<{
//     licensePlate: string;
//     factory: string;
//     quantity: number;
//     time: string;
//   }>;
// }

// export default function CompactView({ data, mainTab, outgoingRequests = [] }: CompactViewProps) {


//   // console.log('CompactView - outgoingRequests:', outgoingRequests?.length);


//   const [expandedId, setExpandedId] = useState<string | null>(null);
//   const isShipment = mainTab === 'shipment';
  
//   // Создаём карту заявок для быстрого доступа по Номеру + Дате
//   const requestsMap = new Map<string, { quantity: number }>();
//   outgoingRequests.forEach(req => {
//     const key = `${req.number}_${req.date}`;
//     requestsMap.set(key, { quantity: req.quantity });
//   });
  
//   const groupedByDateAndRequest = data.reduce((acc, item) => {
//     const date = new Date(item.date).toLocaleDateString('ru-RU');
    
//     if (mainTab === 'incoming') {
//       // ========== ПОСТУПЛЕНИЯ (без изменений) ==========
//       const incoming = item as IncomingItem;
      
//       let factory = '—';
//       if (incoming.number?.startsWith('ЛХ')) factory = 'ЛХ';
//       else if (incoming.number?.startsWith('ЛЮ')) factory = 'ЛЮ';
      
//       const groupKey = `${date}_${factory}_${incoming.material}_${incoming.supplier}`;
      
//       if (!acc[date]) {
//         acc[date] = new Map<string, GroupedItem>();
//       }
      
//       if (!acc[date].has(groupKey)) {
//         acc[date].set(groupKey, {
//           time: new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
//           factQuantity: incoming.quantity,
//           planQuantity: 0,
//           consignee: incoming.supplier,
//           factories: [factory],
//           truckCount: 1,
//           material: incoming.material,
//           requestNumber: '',
//           requestDate: '',
//           shipments: [],
//         });
//       } else {
//         const existing = acc[date].get(groupKey)!;
//         existing.factQuantity += incoming.quantity;
//         existing.truckCount += 1;
//         if (!existing.factories.includes(factory) && factory !== '—') {
//           existing.factories.push(factory);
//         }
//         const currentTime = new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
//         if (currentTime > existing.time) {
//           existing.time = currentTime;
//         }
//       }
      
//     } else {
//       // ========== ОТГРУЗКИ ==========
//       const shipment = item as ShipmentItem;
      
//       // Поля для связи с заявкой



//       const requestNumber = shipment.clientRequestNumber || '';
//       const requestDate = shipment.clientRequestDate || '';
//       const requestKey = `${requestNumber}_${requestDate}`;
      

//       console.log('Отладка отгрузки:', {
//   requestNumber,
//   requestDate,
//   requestKey,
//   foundRequest: requestsMap.get(requestKey)
// });


//       let factory = '—';
//       if (shipment.division === 'Луховицы') factory = 'ЛХ';
//       else if (shipment.division === 'Люберцы') factory = 'ЛЮ';
      
//       // Группировка по заявке (Номер + Дата) + грузополучатель + материал
//       const consigneeKey = shipment.consignee || shipment.customer || '—';
//       const groupKey = `${date}_${requestKey}_${consigneeKey}_${shipment.material}`;
      
//       // Получаем план из заявки
//       let planQuantity = 0;
//       const request = requestsMap.get(requestKey);
//       if (request) {
//         planQuantity = request.quantity;
//       }
      
//       if (!acc[date]) {
//         acc[date] = new Map<string, GroupedItem>();
//       }
      
//       if (!acc[date].has(groupKey)) {
//         acc[date].set(groupKey, {
//           time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
//           factQuantity: shipment.quantity,
//           planQuantity: planQuantity,
//           consignee: consigneeKey,
//           factories: [factory],
//           truckCount: 1,
//           material: shipment.material,
//           requestNumber: requestNumber,
//           requestDate: requestDate,
//           shipments: [{
//             licensePlate: shipment.licensePlate || '—',
//             factory: factory,
//             quantity: shipment.quantity,
//             time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
//           }],
//         });
//       } else {
//         const existing = acc[date].get(groupKey)!;
//         existing.factQuantity += shipment.quantity;
//         existing.truckCount += 1;
//         if (planQuantity > existing.planQuantity) {
//           existing.planQuantity = planQuantity;
//         }
//         if (!existing.factories.includes(factory) && factory !== '—') {
//           existing.factories.push(factory);
//         }
//         existing.shipments.push({
//           licensePlate: shipment.licensePlate || '—',
//           factory: factory,
//           quantity: shipment.quantity,
//           time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
//         });
//         const currentTime = new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
//         if (currentTime > existing.time) {
//           existing.time = currentTime;
//         }
//       }
//     }
    
//     return acc;
//   }, {} as Record<string, Map<string, GroupedItem>>);

//   const sortedDates = Object.keys(groupedByDateAndRequest).sort((a, b) => {
//     const dateA = new Date(a.split('.').reverse().join('-'));
//     const dateB = new Date(b.split('.').reverse().join('-'));
//     return dateB.getTime() - dateA.getTime();
//   });

//   const getDayLabel = (dateStr: string): string => {
//     const today = new Date().toLocaleDateString('ru-RU');
//     const yesterday = new Date();
//     yesterday.setDate(yesterday.getDate() - 1);
//     const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
//     if (dateStr === today) return 'СЕГОДНЯ';
//     if (dateStr === yesterdayStr) return 'ВЧЕРА';
//     return dateStr;
//   };

//   const getFactoryBadgeClass = (factory: string): string => {
//     switch (factory) {
//       case 'ЛХ': return 'factory-badge-small ЛХ';
//       case 'ЛЮ': return 'factory-badge-small ЛЮ';
//       default: return 'factory-badge-small Другой';
//     }
//   };

//   const formatDateTime = (dateStr: string): string => {
//     if (!dateStr) return '—';
//     const date = new Date(dateStr);
//     return date.toLocaleString('ru-RU', {
//       day: '2-digit',
//       month: '2-digit',
//       hour: '2-digit',
//       minute: '2-digit'
//     });
//   };

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
//         const items = Array.from(groupedByDateAndRequest[date].values());
        
//         return (
//           <div key={date} className="compact-date-group">
//             <div className="compact-date-header">
//               {getDayLabel(date)}
//             </div>
//             <div className="compact-table">
//               {/* Заголовки для ОТГРУЗОК */}
//               {isShipment && (
//                 <div className="compact-header">
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-slash"></span>
//                   <span className="col-plan">Заяв</span>
//                   <span className="col-consignee">Грузополучатель</span>
//                   <span className="col-factory">Завод</span>
//                   <span className="col-trucks">Машин</span>
//                   <span className="col-material">Материал</span>
//                   <span className="col-expand"></span>
//                 </div>
//               )}
              
//               {/* Заголовки для ПОСТУПЛЕНИЙ */}
//               {!isShipment && (
//                 <div className="compact-header">
//                   <span className="col-time">Время</span>
//                   <span className="col-fact">Вып</span>
//                   <span className="col-material-header">Материал</span>
//                   <span className="col-factory">Завод</span>
//                   <span className="col-trucks">Машин</span>
//                   <span className="col-supplier">Поставщик</span>
//                 </div>
//               )}
              
//               {items.map((item, idx) => {
//                 const itemKey = `${date}_${idx}`;
//                 const isExpanded = expandedId === itemKey;
                
//                 // ОТГРУЗКИ
//                 if (isShipment) {
//                   return (
//                     <div key={idx}>
//                       <div 
//                         className="compact-row compact-clickable"
//                         onClick={() => setExpandedId(isExpanded ? null : itemKey)}
//                       >
//                         <span className="col-time">{item.time}</span>
//                         {/* <span className="col-fact">{item.factQuantity.toFixed(1)}</span> */}
//                         <span className={`col-fact ${item.factQuantity < item.planQuantity ? 'warning' : ''}`}>
//                           {item.factQuantity.toFixed(1)}
//                         </span>
                        
//                         <span className="col-slash">/</span>
//                         <span className="col-plan">
//                           {item.planQuantity > 0 ? item.planQuantity.toFixed(0) : '—'}
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
//                         <span className="col-material">{item.material?.substring(0, 25)}</span>
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
//                             {item.requestNumber && (
//                               <div className="detail-row">
//                                 <span className="detail-label">📅 Дата заявки:</span>
//                                 <span className="detail-value">{formatDateTime(item.requestDate)}</span>
//                               </div>
//                             )}
//                             <div className="detail-row">
//                               <span className="detail-label">🏭 Отгрузки по заявке:</span>
//                             </div>
//                             {item.shipments.map((ship, i) => (
//                               <div key={i} className="detail-shipment">
//                                 <span className="ship-time">{ship.time}</span>
//                                 <span className="ship-quantity">{ship.quantity.toFixed(1)} т</span>
//                                 <span className="ship-license">{ship.licensePlate}</span>
//                                 <span className="ship-factory">{ship.factory}</span>
//                               </div>
//                             ))}
//                           </motion.div>
//                         )}
//                       </AnimatePresence>
//                     </div>
//                   );
//                 }
                
//                 // ПОСТУПЛЕНИЯ
//                 return (
//                   <div key={idx} className="compact-row">
//                     <span className="col-time">{item.time}</span>
//                     <span className="col-fact">{item.factQuantity.toFixed(1)}</span>
//                     <span className="col-material">{item.material?.substring(0, 25)}</span>
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
//                     <span className="col-supplier">{item.consignee}</span>
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



// // // components/CompactView.tsx
// // 'use client';

// // import { IncomingItem, ShipmentItem } from '@/app/page';

// // type UnifiedDataItem = IncomingItem | ShipmentItem;

// // interface CompactViewProps {
// //   data: UnifiedDataItem[];
// //   mainTab: 'incoming' | 'shipment';
// //   getRequestCompletion?: (clientRequestNumber: string | null) => { plan: number; fact: number; percent: number; requestNumber: string } | null;
// // }

// // interface GroupedItem {
// //   time: string;
// //   factQuantity: number;
// //   planQuantity: number;
// //   consignee: string;      // Для отгрузок - грузополучатель, для поступлений - поставщик
// //   factories: string[];
// //   truckCount: number;
// //   material: string;
// // }

// // export default function CompactView({ data, mainTab, getRequestCompletion }: CompactViewProps) {
// //   const isShipment = mainTab === 'shipment';
  
// //   const groupedByDateAndRequest = data.reduce((acc, item) => {
// //     const date = new Date(item.date).toLocaleDateString('ru-RU');
    
// //     if (mainTab === 'incoming') {
// //       // ========== ПОСТУПЛЕНИЯ ==========
// //       const incoming = item as IncomingItem;
      
// //       let factory = '—';
// //       if (incoming.number?.startsWith('ЛХ')) factory = 'ЛХ';
// //       else if (incoming.number?.startsWith('ЛЮ')) factory = 'ЛЮ';
      
// //       // Группируем по дате + заводу + материалу + поставщику
// //       const groupKey = `${date}_${factory}_${incoming.material}_${incoming.supplier}`;
      
// //       if (!acc[date]) {
// //         acc[date] = new Map<string, GroupedItem>();
// //       }
      
// //       if (!acc[date].has(groupKey)) {
// //         acc[date].set(groupKey, {
// //           time: new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
// //           factQuantity: incoming.quantity,
// //           planQuantity: 0,
// //           consignee: incoming.supplier,
// //           factories: [factory],
// //           truckCount: 1,
// //           material: incoming.material,
// //         });
// //       } else {
// //         const existing = acc[date].get(groupKey)!;
// //         existing.factQuantity += incoming.quantity;
// //         existing.truckCount += 1;
// //         if (!existing.factories.includes(factory) && factory !== '—') {
// //           existing.factories.push(factory);
// //         }
// //         const currentTime = new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
// //         if (currentTime > existing.time) {
// //           existing.time = currentTime;
// //         }
// //       }
      
// //    // components/CompactView.tsx - исправленный блок для отгрузок
// // } else {
// //   // ========== ОТГРУЗКИ ==========
// //   const shipment = item as ShipmentItem;
  
// //   let factory = '—';
// //   if (shipment.division === 'Луховицы') factory = 'ЛХ';
// //   else if (shipment.division === 'Люберцы') factory = 'ЛЮ';
  
// //   // Группировка по грузополучателю + материалу
// //   const consigneeKey = shipment.consignee || shipment.customer || '—';
// //   const groupKey = `${date}_${consigneeKey}_${shipment.material}`;
  
// //   let planQuantity = 0;
// //   if (getRequestCompletion && shipment.clientRequestNumber) {
// //     const completion = getRequestCompletion(shipment.clientRequestNumber);
// //     if (completion && completion.plan > 0) {
// //       planQuantity = completion.plan;
// //     }
// //   }
  
// //   if (!acc[date]) {
// //     acc[date] = new Map<string, GroupedItem>();
// //   }
  
// //   if (!acc[date].has(groupKey)) {
// //     acc[date].set(groupKey, {
// //       time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
// //       factQuantity: shipment.quantity,
// //       planQuantity: planQuantity,
// //       consignee: consigneeKey,
// //       factories: [factory],
// //       truckCount: 1,
// //       material: shipment.material,
// //     });
// //   } else {
// //     const existing = acc[date].get(groupKey)!;
// //     existing.factQuantity += shipment.quantity;
// //     existing.truckCount += 1;
// //     if (planQuantity > existing.planQuantity) {
// //       existing.planQuantity = planQuantity;
// //     }
// //     if (!existing.factories.includes(factory) && factory !== '—') {
// //       existing.factories.push(factory);
// //     }
// //     const currentTime = new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
// //     if (currentTime > existing.time) {
// //       existing.time = currentTime;
// //     }
// //   }
// // }






    
// //     return acc;
// //   }, {} as Record<string, Map<string, GroupedItem>>);

// //   const sortedDates = Object.keys(groupedByDateAndRequest).sort((a, b) => {
// //     const dateA = new Date(a.split('.').reverse().join('-'));
// //     const dateB = new Date(b.split('.').reverse().join('-'));
// //     return dateB.getTime() - dateA.getTime();
// //   });

// //   const getDayLabel = (dateStr: string): string => {
// //     const today = new Date().toLocaleDateString('ru-RU');
// //     const yesterday = new Date();
// //     yesterday.setDate(yesterday.getDate() - 1);
// //     const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
    
// //     if (dateStr === today) return 'СЕГОДНЯ';
// //     if (dateStr === yesterdayStr) return 'ВЧЕРА';
// //     return dateStr;
// //   };

// //   const getFactoryBadgeClass = (factory: string): string => {
// //     switch (factory) {
// //       case 'ЛХ': return 'factory-badge-small ЛХ';
// //       case 'ЛЮ': return 'factory-badge-small ЛЮ';
// //       default: return 'factory-badge-small Другой';
// //     }
// //   };

// //   if (data.length === 0) {
// //     return (
// //       <div className="empty">
// //         <p>Нет данных</p>
// //       </div>
// //     );
// //   }

// //   return (
// //     <div className="compact-view">
// //       {sortedDates.map(date => {
// //         const items = Array.from(groupedByDateAndRequest[date].values());
        
// //         return (
// //           <div key={date} className="compact-date-group">
// //             <div className="compact-date-header">
// //               {getDayLabel(date)}
// //             </div>
// //             <div className="compact-table">
// //               {/* Заголовки для ОТГРУЗОК */}
// //               {isShipment && (
// //                 <div className="compact-header">
// //                   <span className="col-time">Время</span>
// //                   <span className="col-fact">Вып</span>
// //                   <span className="col-slash"></span>
// //                   <span className="col-plan">Заяв</span>
// //                   <span className="col-consignee">Грузополучатель</span>
// //                   <span className="col-factory">Завод</span>
// //                   <span className="col-trucks">Машин</span>
// //                   <span className="col-material">Материал</span>
// //                 </div>
// //               )}
              
// //               {/* Заголовки для ПОСТУПЛЕНИЙ */}
// //               {!isShipment && (
// //                 <div className="compact-header">
// //                   <span className="col-time">Время</span>
// //                   <span className="col-fact">Вып</span>
// //                   <span className="col-material-header">Материал</span>
// //                   <span className="col-factory">Завод</span>
// //                   <span className="col-trucks">Машин</span>
// //                   <span className="col-supplier">Поставщик</span>
// //                 </div>
// //               )}
              
// //               {items.map((item, idx) => (
// //                 // ОТГРУЗКИ
// //                 isShipment ? (
// //                   <div key={idx} className="compact-row">
// //                     <span className="col-time">{item.time}</span>
// //                     <span className="col-fact">{item.factQuantity.toFixed(1)}</span>
// //                     <span className="col-slash">/</span>
// //                     <span className="col-plan">
// //                       {item.planQuantity > 0 ? item.planQuantity.toFixed(0) : '—'}
// //                     </span>
// //                     <span className="col-consignee">{item.consignee}</span>
// //                     <span className="col-factory">
// //                       <div className="factory-badges-group">
// //                         {item.factories.map((factory, i) => (
// //                           <div key={i} className={getFactoryBadgeClass(factory)}>
// //                             {factory}
// //                           </div>
// //                         ))}
// //                       </div>
// //                     </span>
// //                     <span className="col-trucks">{item.truckCount}</span>
// //                     <span className="col-material">{item.material?.substring(0, 25)}</span>
// //                   </div>
// //                 ) : (
// //                   // ПОСТУПЛЕНИЯ - другой порядок колонок
// //                   <div key={idx} className="compact-row">
// //                     <span className="col-time">{item.time}</span>
// //                     <span className="col-fact">{item.factQuantity.toFixed(1)}</span>
// //                     <span className="col-material">{item.material?.substring(0, 25)}</span>
// //                     <span className="col-factory">
// //                       <div className="factory-badges-group">
// //                         {item.factories.map((factory, i) => (
// //                           <div key={i} className={getFactoryBadgeClass(factory)}>
// //                             {factory}
// //                           </div>
// //                         ))}
// //                       </div>
// //                     </span>
// //                     <span className="col-trucks">{item.truckCount}</span>
// //                     <span className="col-supplier">{item.consignee}</span>
// //                   </div>
// //                 )
// //               ))}
// //             </div>
// //           </div>
// //         );
// //       })}
// //     </div>
// //   );
// // }