'use client';

import { IncomingItem, ShipmentItem } from '@/app/page';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ActivityChart from './ActivityChart';

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
    closed?: boolean | null;
  }>;
  allShipments?: ShipmentItem[];
  allShipmentsForChart?: ShipmentItem[];
  selectedFactory?: string;
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

export default function CompactView({ 
  data, 
  mainTab, 
  outgoingRequests = [], 
  allShipments = [],
  allShipmentsForChart = [],
  selectedFactory = 'all'
}: CompactViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isShipment = mainTab === 'shipment';
  
  const requestsMap = new Map<string, { quantity: number; closed: boolean | null }>();
  outgoingRequests.forEach(req => {
    const key = `${req.number}_${req.date}_${req.division}`;
    requestsMap.set(key, { quantity: req.quantity, closed: req.closed || false });
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
          closed: false,
          supplier: incoming.supplier,
          vehicles: [{
            licensePlate: incoming.licensePlate || '—',
            factory: factory,
            quantity: incoming.quantity,
            time: new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            driver: incoming.driver || '—',
            material: incoming.material,
            supplier: incoming.supplier,
          }],
        });
      } else {
        const existing = acc[date].get(groupKey)!;
        existing.factQuantity += incoming.quantity;
        existing.truckCount += 1;
        if (!existing.factories.includes(factory) && factory !== '—') {
          existing.factories.push(factory);
        }
        existing.vehicles.push({
          licensePlate: incoming.licensePlate || '—',
          factory: factory,
          quantity: incoming.quantity,
          time: new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          driver: incoming.driver || '—',
          material: incoming.material,
          supplier: incoming.supplier,
        });
        const currentTime = new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (currentTime > existing.time) {
          existing.time = currentTime;
        }
      }
      
    } else {
      // ========== ОТГРУЗКИ ==========
      const shipment = item as ShipmentItem;
      
      const requestNumber = shipment.clientRequestNumber || '';
      const requestDate = shipment.clientRequestDate || '';
      const division = shipment.division || '';
      const requestKey = `${requestNumber}_${requestDate}_${division}`;
      
      // let factory = '—';
      // if (shipment.division === 'Луховицы') factory = 'ЛХ';
      // else if (shipment.division === 'Люберцы') factory = 'ЛЮ';
      
      let factory = '—';
      if (shipment.division === 'ЛХ') factory = 'ЛХ';
      else if (shipment.division === 'ЛЮ') factory = 'ЛЮ';


      const consigneeKey = shipment.consignee || shipment.customer || '—';
      const groupKey = `${date}_${requestKey}_${consigneeKey}_${shipment.material}`;
      
      let planQuantity = 0;
      let requestClosed = false;
      const request = requestsMap.get(requestKey);
      if (request) {
        planQuantity = request.quantity;
        requestClosed = request.closed || false;
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
          closed: requestClosed,
          requestNumber: requestNumber,
          requestDate: requestDate,
          vehicles: [{
            licensePlate: shipment.licensePlate || '—',
            factory: factory,
            quantity: shipment.quantity,
            time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            driver: shipment.driver || '—',
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
        existing.vehicles.push({
          licensePlate: shipment.licensePlate || '—',
          factory: factory,
          quantity: shipment.quantity,
          time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          driver: shipment.driver || '—',
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
    return `${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`;
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
      {/* Гистограмма */}
      {isShipment && allShipmentsForChart && allShipmentsForChart.length > 0 && (
        <ActivityChart 
          shipments={allShipmentsForChart} 
          selectedFactory={selectedFactory}
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
                  <span className="col-expand"></span>
                </div>
              )}
              
              {/* {items.map((item, idx) => { TODO: */}

{[...items].sort((a, b) => {
  // Сравниваем время
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
                        {/* <span className="col-plan">
                          {item.planQuantity > 0 ? (
                            <>
                              {item.planQuantity.toFixed(0)}
                              {item.closed ? (
                                <span className="closed-lock"> 🔒</span>
                              ) : (
                                (() => {
                                  const hasTodayShipments = allShipments.some(ship => {
                                    const shipDate = new Date(ship.date).toLocaleDateString('ru-RU');
                                    const today = new Date().toLocaleDateString('ru-RU');
                                    return ship.clientRequestNumber === item.requestNumber && shipDate === today;
                                  });
                                  const showActiveDot = hasTodayShipments && percentComplete < 94;
                                  return showActiveDot ? <span className="active-dot" title="Идут отгрузки"></span> : null;
                                })()
                              )}
                            </>
                          ) : '—'}
                        </span> */}

                        <span className="col-plan">
                          {item.planQuantity > 0 ? (
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {item.planQuantity.toFixed(0)}
                              {item.closed ? (
                                <span className="closed-lock"> 🔒</span>
                              ) : (
                                (() => {
                                  const hasTodayShipments = allShipments.some(ship => {
                                    const shipDate = new Date(ship.date).toLocaleDateString('ru-RU');
                                    const today = new Date().toLocaleDateString('ru-RU');
                                    return ship.clientRequestNumber === item.requestNumber && shipDate === today;
                                  });
                                  const showActiveDot = hasTodayShipments && percentComplete < 94;
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
                            {/* Транспорт */}
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
                
                // ПОСТУПЛЕНИЯ
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
                          {/* Транспорт */}
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
// import { useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import ActivityChart from './ActivityChart';

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
//     closed?: boolean | null;
//   }>;
//   allShipments?: ShipmentItem[];
//   allShipmentsForChart?: ShipmentItem[];
//   selectedFactory?: string;  // ← добавить
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
//   shipments: Array<{
//     licensePlate: string;
//     factory: string;
//     quantity: number;
//     time: string;
//   }>;
// }

// export default function CompactView({ 
//   data, 
//   mainTab, 
//   outgoingRequests = [], 
//   allShipments = [],
//   allShipmentsForChart = [],
//   selectedFactory = 'all'  // ← добавить с значением по умолчанию

// }: CompactViewProps) {
//   const [expandedId, setExpandedId] = useState<string | null>(null);
//   const isShipment = mainTab === 'shipment';
  
//   // Создаём карту заявок с количеством и статусом closed
//   const requestsMap = new Map<string, { quantity: number; closed: boolean | null }>();
//   outgoingRequests.forEach(req => {
//     const key = `${req.number}_${req.date}_${req.division}`;
//     requestsMap.set(key, { quantity: req.quantity, closed: req.closed || false });
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
//           closed: false,
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
      
//       const requestKey = `${requestNumber}_${requestDate}_${division}`;
      
//       let factory = '—';
//       if (shipment.division === 'Луховицы') factory = 'ЛХ';
//       else if (shipment.division === 'Люберцы') factory = 'ЛЮ';
      
//       const consigneeKey = shipment.consignee || shipment.customer || '—';
//       const groupKey = `${date}_${requestKey}_${consigneeKey}_${shipment.material}`;
      
//       let planQuantity = 0;
//       let requestClosed = false;
//       const request = requestsMap.get(requestKey);
//       if (request) {
//         planQuantity = request.quantity;
//         requestClosed = request.closed || false;
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
//           closed: requestClosed,
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



//     {/* Гистограмма над всеми датами */}
//     {isShipment && allShipmentsForChart && allShipmentsForChart.length > 0 && (
//       <ActivityChart 
//         shipments={allShipmentsForChart} 
//         selectedFactory={selectedFactory || 'all'}
//       />
//     )}


      
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
            
//             {/* Гистограмма активности - только для отгрузок и для даты "СЕГОДНЯ" */}
//             {/* {isShipment && getDayLabel(date) === 'СЕГОДНЯ' && allShipmentsForChart.length > 0 && (
//             <ActivityChart 
//               shipments={allShipmentsForChart} 
//               selectedFactory={selectedFactory || 'all'}
//             />
//             )} */}
            
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
//                 const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
//                 const isWarning = percentComplete < 94;
                
//                 // ОТГРУЗКИ
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
//                             <>
//                               {item.planQuantity.toFixed(0)}
//                               {item.closed ? (
//                                 <span className="closed-lock"> 🔒</span>
//                               ) : (
//                                 (() => {
//                                   // Проверяем, есть ли сегодня отгрузки и процент выполнения < 94%
//                                   const hasTodayShipments = allShipments.some(ship => {
//                                     const shipDate = new Date(ship.date).toLocaleDateString('ru-RU');
//                                     const today = new Date().toLocaleDateString('ru-RU');
//                                     return ship.clientRequestNumber === item.requestNumber && shipDate === today;
//                                   });
//                                   // Точка только если есть отгрузки И процент выполнения < 94%
//                                   const showActiveDot = hasTodayShipments && percentComplete < 94;
//                                   return showActiveDot ? <span className="active-dot" title="Идут отгрузки"></span> : null;
//                                 })()
//                               )}
//                             </>
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
//                             {item.requestNumber && item.requestDate && (
//                               <div className="detail-row">
//                                 <span className="detail-label">📅 Заявка №{item.requestNumber}:</span>
//                                 <span className="detail-value">{formatDateTime(item.requestDate)}</span>
//                               </div>
//                             )}
//                             <div className="detail-row">
//                               <span className="detail-label">🚛 Отгрузки:</span>
//                               <span className="detail-label-right">Тонны</span>
//                             </div>
//                             {item.shipments.map((ship, i) => (
//                               <div key={i} className="detail-shipment">
//                                 <span className="ship-time">{ship.time}</span>
//                                 <span className="ship-license">{ship.licensePlate}</span>
//                                 <span className="ship-factory-badge">
//                                   <span className={`factory-badge-mini ${ship.factory}`}>
//                                     {ship.factory}
//                                   </span>
//                                 </span>
//                                 <span className="ship-quantity">{ship.quantity.toFixed(1)} т</span>
//                               </div>
//                             ))}
//                             <div className="detail-total">
//                               <span>Итого:</span>
//                               <span>{item.factQuantity.toFixed(1)} / {item.planQuantity > 0 ? item.planQuantity.toFixed(0) : '—'} т</span>
//                             </div>
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

