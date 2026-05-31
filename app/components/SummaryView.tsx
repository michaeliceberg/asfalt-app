'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface FutureRequest {
  number: string;
  date: string;
  division: string;
  customer: string;
  consignee: string;
  material: string;
  quantity: number;
  delivery_date: string;
  clientRequestNumber: string;
  clientRequestDate: string;
  closed?: boolean;
}

export default function SummaryView() {
  const [futureRequests, setFutureRequests] = useState<FutureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFutureRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/outgoing-requests');
      const allRequests = await response.json();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const future = allRequests.filter((req: FutureRequest) => {
        if (req.closed) return false;
        if (!req.delivery_date) return false;
        const deliveryDate = new Date(req.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);
        return deliveryDate >= today;
      });
      
      future.sort((a: FutureRequest, b: FutureRequest) => {
        return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
      });
      
      setFutureRequests(future);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      await fetchFutureRequests();
      setLoading(false);
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [fetchFutureRequests]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const getDayLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'СЕГОДНЯ';
    if (date.toDateString() === tomorrow.toDateString()) return 'ЗАВТРА';
    return formatDate(dateStr);
  };

  const getTimeFromDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const isTodayRequest = (deliveryDate: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reqDate = new Date(deliveryDate);
    reqDate.setHours(0, 0, 0, 0);
    return reqDate.getTime() === today.getTime();
  };

  if (loading) return <div className="loading"><div className="spinner"></div><p>Загрузка...</p></div>;

  return (
    <div className="future-requests-view">
      {futureRequests.length === 0 ? (
        <div className="empty">
          <p>📭 Нет запланированных заявок на будущее</p>
        </div>
      ) : (
        <div className="future-requests-compact-list">
          {futureRequests.map((req) => {
            const isToday = isTodayRequest(req.delivery_date);
            
            return (
              <div key={req.number} className={`future-request-compact-item ${isToday ? 'today-item' : ''}`}>
                <div className="future-item-date">
                  <span className="future-item-day">{getDayLabel(req.delivery_date)}</span>
                  <span className="future-item-time">⏰ {getTimeFromDate(req.delivery_date)}</span>
                </div>
                <div className="future-item-info">
                  <div className="future-item-number">№{req.number}</div>
                  <div className="future-item-consignee">{req.consignee || req.customer}</div>
                  <div className="future-item-details">
                    <span className="future-item-material">{req.material}</span>
                    <span className="future-item-quantity">{Math.round(req.quantity)} т</span>
                  </div>
                </div>
                <div className="future-item-badge">
                  {req.division === 'Люберцы' ? '🏭 ЛЮ' : '🏭 ЛХ'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}









// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { motion } from 'framer-motion';

// interface SummaryItem {
//   request: {
//     number: string;
//     date: string;
//     division: string;
//     customer: string;
//     consignee: string;
//     material: string;
//     planQuantity: number;
//     clientRequestNumber: string;
//     clientRequestDate: string;
//     delivery_date?: string | null;  // ← добавить эту строку
//   };
//   factQuantity: number;
//   remaining: number;
//   percentCompleted: number;
//   shipments: Array<{
//     number: string;
//     date: string;
//     quantity: number;
//     driver: string;
//     licensePlate: string;
//   }>;
// }

// interface FutureRequest {
//   number: string;
//   date: string;
//   division: string;
//   customer: string;
//   consignee: string;
//   material: string;
//   quantity: number;
//   delivery_date: string;
//   clientRequestNumber: string;
//   clientRequestDate: string;
//   closed?: boolean;
// }

// export default function SummaryView() {
//   const [summary, setSummary] = useState<SummaryItem[]>([]);
//   const [futureRequests, setFutureRequests] = useState<FutureRequest[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [expandedId, setExpandedId] = useState<string | null>(null);
//   const [activeSubTab, setActiveSubTab] = useState<'current' | 'future'>('current');

//   const fetchSummary = useCallback(async () => {
//     try {
//       const response = await fetch('/api/summary');
//       const data = await response.json();
      
//       const mergedMap = new Map();
      
//       for (const item of data) {
//         const key = `${item.request.clientRequestNumber}_${item.request.consignee}`;
        
//         if (mergedMap.has(key)) {
//           const existing = mergedMap.get(key);
//           existing.factQuantity += item.factQuantity;
//           existing.remaining = existing.request.planQuantity - existing.factQuantity;
//           existing.percentCompleted = Math.round((existing.factQuantity / existing.request.planQuantity) * 100);
//           existing.shipments.push(...item.shipments);
//         } else {
//           mergedMap.set(key, { 
//             ...item,
//             percentCompleted: Math.round(item.percentCompleted)
//           });
//         }
//       }
      
//       const merged = Array.from(mergedMap.values());
      
//       const sorted = merged.sort((a: SummaryItem, b: SummaryItem) => {
//         const lastDateA = a.shipments.length > 0 
//           ? new Date(a.shipments[a.shipments.length - 1].date) 
//           : new Date(0);
//         const lastDateB = b.shipments.length > 0 
//           ? new Date(b.shipments[b.shipments.length - 1].date) 
//           : new Date(0);
//         return lastDateB.getTime() - lastDateA.getTime();
//       });
      
//       setSummary(sorted);
//     } catch (err) {
//       console.error(err);
//     }
//   }, []);

//   const fetchFutureRequests = useCallback(async () => {
//     try {
//       const response = await fetch('/api/outgoing-requests');
//       const allRequests = await response.json();
      
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
      
//       const future = allRequests.filter((req: FutureRequest) => {
//         if (req.closed) return false;
//         if (!req.delivery_date) return false;
//         const deliveryDate = new Date(req.delivery_date);
//         deliveryDate.setHours(0, 0, 0, 0);
//         return deliveryDate >= today;
//       });
      
//       future.sort((a: FutureRequest, b: FutureRequest) => {
//         return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
//       });
      
//       setFutureRequests(future);
//     } catch (err) {
//       console.error(err);
//     }
//   }, []);

//   useEffect(() => {
//     let isMounted = true;
    
//     const loadData = async () => {
//       if (!isMounted) return;
//       await Promise.all([fetchSummary(), fetchFutureRequests()]);
//       setLoading(false);
//     };
    
//     loadData();
    
//     return () => {
//       isMounted = false;
//     };
//   }, [fetchSummary, fetchFutureRequests]);

//   // Функция для проверки, является ли заявка сегодняшней
//   const isTodayRequest = (deliveryDate: string): boolean => {
//     if (!deliveryDate) return false;
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const reqDate = new Date(deliveryDate);
//     reqDate.setHours(0, 0, 0, 0);
//     return reqDate.getTime() === today.getTime();
//   };

//   const formatWeight = (weight: number) => `${Math.round(weight)}`;
//   const formatDate = (dateStr: string) => {
//     const date = new Date(dateStr);
//     return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
//   };
  
//   const formatDateTime = (dateStr: string) => {
//     const date = new Date(dateStr);
//     return `${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('ru-RU')}`;
//   };

//   const getLastShipmentDate = (shipments: SummaryItem['shipments']): string => {
//     if (shipments.length === 0) return '—';
//     const lastShipment = shipments.reduce((latest, current) => 
//       new Date(current.date) > new Date(latest.date) ? current : latest
//     );
//     return formatDateTime(lastShipment.date);
//   };

//   const getRemainingClass = (remaining: number): string => {
//     if (remaining > 0) return 'remaining-negative';
//     if (remaining < 0) return 'remaining-positive';
//     return 'remaining-zero';
//   };

//   const getRemainingText = (remaining: number): string => {
//     const rounded = Math.round(Math.abs(remaining));
//     if (remaining > 0) return `−${rounded}`;
//     if (remaining < 0) return `+${rounded}`;
//     return '0';
//   };

//   const getDayLabel = (dateStr: string): string => {
//     const date = new Date(dateStr);
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today);
//     tomorrow.setDate(tomorrow.getDate() + 1);
    
//     if (date.toDateString() === today.toDateString()) return 'СЕГОДНЯ';
//     if (date.toDateString() === tomorrow.toDateString()) return 'ЗАВТРА';
//     return formatDate(dateStr);
//   };

//   const getTimeFromDate = (dateStr: string): string => {
//     const date = new Date(dateStr);
//     return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
//   };

//   if (loading) return <div className="loading"><div className="spinner"></div><p>Загрузка...</p></div>;

//   return (
//     <div className="summary-view">
//       <div className="summary-subtabs">
//         <button 
//           className={`summary-subtab ${activeSubTab === 'current' ? 'active' : ''}`}
//           onClick={() => setActiveSubTab('current')}
//         >
//           📊 Текущие заявки
//         </button>
//         <button 
//           className={`summary-subtab ${activeSubTab === 'future' ? 'active' : ''}`}
//           onClick={() => setActiveSubTab('future')}
//         >
//           📅 План на будущее ({futureRequests.length})
//         </button>
//       </div>

//       {activeSubTab === 'current' && (
//         <div className="summary-view-compact">
//           {summary.length === 0 ? (
//             <div className="empty">
//               <p>Нет активных заявок</p>
//             </div>
//           ) : (
//             summary.map((item) => {
//               // Проверяем, есть ли у заявки дата отгрузки
//               const deliveryDate = item.request.delivery_date;
//               const isToday = deliveryDate ? isTodayRequest(deliveryDate) : false;
              
//               return (
//                 <div key={item.request.number} className={`summary-card-compact ${isToday ? 'today-card' : ''}`}>
//                   <div 
//                     className="summary-header-compact" 
//                     onClick={() => setExpandedId(expandedId === item.request.number ? null : item.request.number)}
//                   >
//                     <div className="summary-row">
//                       <div className="summary-consignee-wrap">
//                         <span className="summary-consignee">{item.request.consignee || item.request.customer}</span>
//                         {isToday && <span className="today-badge-summary">СЕГОДНЯ</span>}
//                       </div>
//                       <span className="summary-last-shipment">{getLastShipmentDate(item.shipments)}</span>
//                     </div>
//                     <div className="summary-row">
//                       <div className="summary-numbers">
//                         <span className="summary-fact">{formatWeight(item.factQuantity)}</span>
//                         <span className="summary-slash">/</span>
//                         <span className="summary-plan">{formatWeight(item.request.planQuantity)}</span>
//                         <span className={`summary-remaining ${getRemainingClass(item.remaining)}`}>
//                           {getRemainingText(item.remaining)}
//                         </span>
//                       </div>
//                       <div className="summary-percent">
//                         <div className="summary-percent-bar">
//                           <div 
//                             className="summary-percent-fill" 
//                             style={{ 
//                               width: `${Math.min(Math.max(item.percentCompleted, 0), 100)}%`,
//                               background: item.percentCompleted >= 100 
//                                 ? 'linear-gradient(90deg, #28a745, #20c997)' 
//                                 : item.percentCompleted >= 70 
//                                   ? 'linear-gradient(90deg, #ffc107, #ffb347)' 
//                                   : 'linear-gradient(90deg, #dc3545, #fd7e14)'
//                             }}
//                           />
//                         </div>
//                         <span className={`summary-percent-text ${item.percentCompleted >= 100 ? 'completed' : item.percentCompleted >= 70 ? 'good' : 'bad'}`}>
//                           {item.percentCompleted}%
//                         </span>
//                       </div>
//                       <span className="summary-expand">{expandedId === item.request.number ? '▲' : '▼'}</span>
//                     </div>
//                   </div>
                  
//                   {expandedId === item.request.number && (
//                     <motion.div 
//                       className="summary-details-compact" 
//                       initial={{ opacity: 0, height: 0 }}
//                       animate={{ opacity: 1, height: 'auto' }}
//                       transition={{ duration: 0.2 }}
//                     >
//                       <div className="detail-row">
//                         <span className="label">Материал:</span>
//                         <span className="value">{item.request.material}</span>
//                       </div>
//                       <div className="detail-row">
//                         <span className="label">Грузополучатель:</span>
//                         <span className="value">{item.request.consignee || '—'}</span>
//                       </div>
//                       {item.shipments.length > 0 && (
//                         <div className="shipments-list-compact">
//                           <div className="shipments-title">Отгрузки:</div>
//                           {item.shipments.map((ship) => (
//                             <div key={ship.number} className="shipment-item-compact">
//                               <span className="shipment-time">{formatDateTime(ship.date)}</span>
//                               <span className="shipment-quantity">{formatWeight(ship.quantity)}</span>
//                               <span className="shipment-license">{ship.licensePlate}</span>
//                             </div>
//                           ))}
//                         </div>
//                       )}
//                     </motion.div>
//                   )}
//                 </div>
//               );
//             })
//           )}
//         </div>
//       )}



//       {/* {activeSubTab === 'future' && (
//         <div className="future-requests-view">
//           {futureRequests.length === 0 ? (
//             <div className="empty">
//               <p>📭 Нет запланированных заявок на будущее</p>
//             </div>
//           ) : (
//             <div className="future-requests-list">
//               {futureRequests.map((req) => {
//                 const isToday = isTodayRequest(req.delivery_date);
                
//                 return (
//                   <div key={req.number} className={`future-request-card ${isToday ? 'today-card' : ''}`}>
//                     <div className="future-request-header">
//                       <div className="future-request-date-wrap">
//                         <span className="future-request-date">{getDayLabel(req.delivery_date)}</span>
//                         <span className="future-request-time">⏰ {getTimeFromDate(req.delivery_date)}</span>
//                         {isToday && <span className="today-badge-summary today-badge-small">СЕГОДНЯ</span>}
//                       </div>
//                       <span className="future-request-badge">{req.division === 'Люберцы' ? '🏭 ЛЮ' : '🏭 ЛХ'}</span>
//                     </div>
//                     <div className="future-request-body">
//                       <div className="future-request-consignee">{req.consignee || req.customer}</div>
//                       <div className="future-request-details">
//                         <span className="future-request-material">{req.material}</span>
//                         <span className="future-request-quantity">{Math.round(req.quantity)} т</span>
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       )} */}
// {/* План на будущее с временем и номером заявки */}
// {activeSubTab === 'future' && (
//   <div className="future-requests-view">
//     {futureRequests.length === 0 ? (
//       <div className="empty">
//         <p>📭 Нет запланированных заявок на будущее</p>
//       </div>
//     ) : (
//       <div className="future-requests-list">
//         {futureRequests.map((req) => {
//           const isToday = isTodayRequest(req.delivery_date);
          
//           return (
//             <div key={req.number} className={`future-request-card ${isToday ? 'today-card' : ''}`}>
//               <div className="future-request-header">
//                 <div className="future-request-date-wrap">
//                   <span className="future-request-date">{getDayLabel(req.delivery_date)}</span>
//                   <span className="future-request-time">⏰ {getTimeFromDate(req.delivery_date)}</span>
//                   {isToday && <span className="today-badge-summary today-badge-small">СЕГОДНЯ</span>}
//                 </div>
//                 <span className="future-request-badge">{req.division === 'Люберцы' ? '🏭 ЛЮ' : '🏭 ЛХ'}</span>
//               </div>
//               <div className="future-request-body">
//                 <div className="future-request-number">
//                   №{req.number}
//                 </div>
//                 <div className="future-request-consignee">{req.consignee || req.customer}</div>
//                 <div className="future-request-details">
//                   <span className="future-request-material">{req.material}</span>
//                   <span className="future-request-quantity">{Math.round(req.quantity)} т</span>
//                 </div>
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     )}
//   </div>
// )}




//     </div>
//   );
// }





// // app/components/SummaryViews.tsx

// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { motion } from 'framer-motion';

// interface SummaryItem {
//   request: {
//     number: string;
//     date: string;
//     division: string;
//     customer: string;
//     consignee: string;
//     material: string;
//     planQuantity: number;
//     clientRequestNumber: string;
//     clientRequestDate: string;
//   };
//   factQuantity: number;
//   remaining: number;
//   percentCompleted: number;
//   shipments: Array<{
//     number: string;
//     date: string;
//     quantity: number;
//     driver: string;
//     licensePlate: string;
//   }>;
// }

// interface FutureRequest {
//   number: string;
//   date: string;
//   division: string;
//   customer: string;
//   consignee: string;
//   material: string;
//   quantity: number;
//   delivery_date: string;
//   clientRequestNumber: string;
//   clientRequestDate: string;
//   closed?: boolean;
// }

// export default function SummaryView() {
//   const [summary, setSummary] = useState<SummaryItem[]>([]);
//   const [futureRequests, setFutureRequests] = useState<FutureRequest[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [expandedId, setExpandedId] = useState<string | null>(null);
//   const [activeSubTab, setActiveSubTab] = useState<'current' | 'future'>('current');

//   const fetchSummary = useCallback(async () => {
//     try {
//       const response = await fetch('/api/summary');
//       const data = await response.json();
      
//       const mergedMap = new Map();
      
//       for (const item of data) {
//         const key = `${item.request.clientRequestNumber}_${item.request.consignee}`;
        
//         if (mergedMap.has(key)) {
//           const existing = mergedMap.get(key);
//           existing.factQuantity += item.factQuantity;
//           existing.remaining = existing.request.planQuantity - existing.factQuantity;
//           existing.percentCompleted = Math.round((existing.factQuantity / existing.request.planQuantity) * 100);
//           existing.shipments.push(...item.shipments);
//         } else {
//           mergedMap.set(key, { 
//             ...item,
//             percentCompleted: Math.round(item.percentCompleted)
//           });
//         }
//       }
      
//       const merged = Array.from(mergedMap.values());
      
//       const sorted = merged.sort((a: SummaryItem, b: SummaryItem) => {
//         const lastDateA = a.shipments.length > 0 
//           ? new Date(a.shipments[a.shipments.length - 1].date) 
//           : new Date(0);
//         const lastDateB = b.shipments.length > 0 
//           ? new Date(b.shipments[b.shipments.length - 1].date) 
//           : new Date(0);
//         return lastDateB.getTime() - lastDateA.getTime();
//       });
      
//       setSummary(sorted);
//     } catch (err) {
//       console.error(err);
//     }
//   }, []);

//   const fetchFutureRequests = useCallback(async () => {
//     try {
//       const response = await fetch('/api/outgoing-requests');
//       const allRequests = await response.json();
      
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
      
//       const future = allRequests.filter((req: FutureRequest) => {
//         if (req.closed) return false;
//         if (!req.delivery_date) return false;
//         const deliveryDate = new Date(req.delivery_date);
//         deliveryDate.setHours(0, 0, 0, 0);
//         return deliveryDate >= today;
//       });
      
//       future.sort((a: FutureRequest, b: FutureRequest) => {
//         return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
//       });
      
//       setFutureRequests(future);
//     } catch (err) {
//       console.error(err);
//     }
//   }, []);

//   useEffect(() => {
//     let isMounted = true;
    
//     const loadData = async () => {
//       if (!isMounted) return;
//       await Promise.all([fetchSummary(), fetchFutureRequests()]);
//       setLoading(false);
//     };
    
//     loadData();
    
//     return () => {
//       isMounted = false;
//     };
//   }, [fetchSummary, fetchFutureRequests]);

//   const formatWeight = (weight: number) => `${Math.round(weight)}`;
//   const formatDate = (dateStr: string) => {
//     const date = new Date(dateStr);
//     return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
//   };
  
//   const formatDateTime = (dateStr: string) => {
//     const date = new Date(dateStr);
//     return `${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('ru-RU')}`;
//   };

//   const getLastShipmentDate = (shipments: SummaryItem['shipments']): string => {
//     if (shipments.length === 0) return '—';
//     const lastShipment = shipments.reduce((latest, current) => 
//       new Date(current.date) > new Date(latest.date) ? current : latest
//     );
//     return formatDateTime(lastShipment.date);
//   };

//   const getRemainingClass = (remaining: number): string => {
//     if (remaining > 0) return 'remaining-negative';
//     if (remaining < 0) return 'remaining-positive';
//     return 'remaining-zero';
//   };

//   const getRemainingText = (remaining: number): string => {
//     const rounded = Math.round(Math.abs(remaining));
//     if (remaining > 0) return `−${rounded}`;
//     if (remaining < 0) return `+${rounded}`;
//     return '0';
//   };

//   const getDayLabel = (dateStr: string): string => {
//     const date = new Date(dateStr);
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today);
//     tomorrow.setDate(tomorrow.getDate() + 1);
    
//     if (date.toDateString() === today.toDateString()) return 'СЕГОДНЯ';
//     if (date.toDateString() === tomorrow.toDateString()) return 'ЗАВТРА';
//     return formatDate(dateStr);
//   };

//   // Получить время из даты
//   const getTimeFromDate = (dateStr: string): string => {
//     const date = new Date(dateStr);
//     return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
//   };

//   if (loading) return <div className="loading"><div className="spinner"></div><p>Загрузка...</p></div>;

//   return (
//     <div className="summary-view">
//       {/* Подвкладки */}
//       <div className="summary-subtabs">
//         <button 
//           className={`summary-subtab ${activeSubTab === 'current' ? 'active' : ''}`}
//           onClick={() => setActiveSubTab('current')}
//         >
//           📊 Текущие заявки
//         </button>
//         <button 
//           className={`summary-subtab ${activeSubTab === 'future' ? 'active' : ''}`}
//           onClick={() => setActiveSubTab('future')}
//         >
//           📅 План на будущее ({futureRequests.length})
//         </button>
//       </div>

//       {/* Текущие заявки (план-факт) */}
//       {activeSubTab === 'current' && (
//         <div className="summary-view-compact">
//           {summary.length === 0 ? (
//             <div className="empty">
//               <p>Нет активных заявок</p>
//             </div>
//           ) : (
//             summary.map((item) => (
//               <div key={item.request.number} className="summary-card-compact">
//                 <div 
//                   className="summary-header-compact" 
//                   onClick={() => setExpandedId(expandedId === item.request.number ? null : item.request.number)}
//                 >
//                   <div className="summary-row">
//                     <span className="summary-consignee">{item.request.consignee || item.request.customer}</span>
//                     <span className="summary-last-shipment">{getLastShipmentDate(item.shipments)}</span>
//                   </div>
//                   <div className="summary-row">
//                     <div className="summary-numbers">
//                       <span className="summary-fact">{formatWeight(item.factQuantity)}</span>
//                       <span className="summary-slash">/</span>
//                       <span className="summary-plan">{formatWeight(item.request.planQuantity)}</span>
//                       <span className={`summary-remaining ${getRemainingClass(item.remaining)}`}>
//                         {getRemainingText(item.remaining)}
//                       </span>
//                     </div>
//                     <div className="summary-percent">
//                       <div className="summary-percent-bar">
//                         <div 
//                           className="summary-percent-fill" 
//                           style={{ 
//                             width: `${Math.min(Math.max(item.percentCompleted, 0), 100)}%`,
//                             background: item.percentCompleted >= 100 
//                               ? 'linear-gradient(90deg, #28a745, #20c997)' 
//                               : item.percentCompleted >= 70 
//                                 ? 'linear-gradient(90deg, #ffc107, #ffb347)' 
//                                 : 'linear-gradient(90deg, #dc3545, #fd7e14)'
//                           }}
//                         />
//                       </div>
//                       <span className={`summary-percent-text ${item.percentCompleted >= 100 ? 'completed' : item.percentCompleted >= 70 ? 'good' : 'bad'}`}>
//                         {item.percentCompleted}%
//                       </span>
//                     </div>
//                     <span className="summary-expand">{expandedId === item.request.number ? '▲' : '▼'}</span>
//                   </div>
//                 </div>
                
//                 {expandedId === item.request.number && (
//                   <motion.div 
//                     className="summary-details-compact" 
//                     initial={{ opacity: 0, height: 0 }}
//                     animate={{ opacity: 1, height: 'auto' }}
//                     transition={{ duration: 0.2 }}
//                   >
//                     <div className="detail-row">
//                       <span className="label">Материал:</span>
//                       <span className="value">{item.request.material}</span>
//                     </div>
//                     <div className="detail-row">
//                       <span className="label">Грузополучатель:</span>
//                       <span className="value">{item.request.consignee || '—'}</span>
//                     </div>
//                     {item.shipments.length > 0 && (
//                       <div className="shipments-list-compact">
//                         <div className="shipments-title">Отгрузки:</div>
//                         {item.shipments.map((ship) => (
//                           <div key={ship.number} className="shipment-item-compact">
//                             <span className="shipment-time">{formatDateTime(ship.date)}</span>
//                             <span className="shipment-quantity">{formatWeight(ship.quantity)}</span>
//                             <span className="shipment-license">{ship.licensePlate}</span>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </motion.div>
//                 )}
//               </div>
//             ))
//           )}
//         </div>
//       )}

//       {/* План на будущее с временем */}
//       {activeSubTab === 'future' && (
//         <div className="future-requests-view">
//           {futureRequests.length === 0 ? (
//             <div className="empty">
//               <p>📭 Нет запланированных заявок на будущее</p>
//             </div>
//           ) : (
//             <div className="future-requests-list">
//               {futureRequests.map((req) => (
//                 <div key={req.number} className="future-request-card">
//                   <div className="future-request-header">
//                     <div className="future-request-date-wrap">
//                       <span className="future-request-date">{getDayLabel(req.delivery_date)}</span>
//                       <span className="future-request-time">⏰ {getTimeFromDate(req.delivery_date)}</span>
//                     </div>
//                     <span className="future-request-badge">{req.division === 'Люберцы' ? '🏭 ЛЮ' : '🏭 ЛХ'}</span>
//                   </div>
//                   <div className="future-request-body">
//                     <div className="future-request-consignee">{req.consignee || req.customer}</div>
//                     <div className="future-request-details">
//                       <span className="future-request-material">{req.material}</span>
//                       <span className="future-request-quantity">{Math.round(req.quantity)} т</span>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }




// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { motion } from 'framer-motion';

// interface SummaryItem {
//   request: {
//     number: string;
//     date: string;
//     division: string;
//     customer: string;
//     consignee: string;
//     material: string;
//     planQuantity: number;
//     clientRequestNumber: string;
//     clientRequestDate: string;
//   };
//   factQuantity: number;
//   remaining: number;
//   percentCompleted: number;
//   shipments: Array<{
//     number: string;
//     date: string;
//     quantity: number;
//     driver: string;
//     licensePlate: string;
//   }>;
// }

// interface FutureRequest {
//   number: string;
//   date: string;
//   division: string;
//   customer: string;
//   consignee: string;
//   material: string;
//   quantity: number;
//   delivery_date: string;  // ← исправлено: delivery_date вместо deliveryDate
//   clientRequestNumber: string;
//   clientRequestDate: string;
//   closed?: boolean;
// }


// export default function SummaryView() {
//   const [summary, setSummary] = useState<SummaryItem[]>([]);
//   const [futureRequests, setFutureRequests] = useState<FutureRequest[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [expandedId, setExpandedId] = useState<string | null>(null);
//   const [activeSubTab, setActiveSubTab] = useState<'current' | 'future'>('current');

//   const fetchSummary = useCallback(async () => {
//     try {
//       const response = await fetch('/api/summary');
//       const data = await response.json();
      
//       // Объединяем одинаковые заявки (по clientRequestNumber и consignee)
//       const mergedMap = new Map();
      
//       for (const item of data) {
//         const key = `${item.request.clientRequestNumber}_${item.request.consignee}`;
        
//         if (mergedMap.has(key)) {
//           const existing = mergedMap.get(key);
//           existing.factQuantity += item.factQuantity;
//           existing.remaining = existing.request.planQuantity - existing.factQuantity;
//           existing.percentCompleted = Math.round((existing.factQuantity / existing.request.planQuantity) * 100);
//           existing.shipments.push(...item.shipments);
//         } else {
//           mergedMap.set(key, { 
//             ...item,
//             percentCompleted: Math.round(item.percentCompleted)
//           });
//         }
//       }
      
//       const merged = Array.from(mergedMap.values());
      
//       const sorted = merged.sort((a: SummaryItem, b: SummaryItem) => {
//         const lastDateA = a.shipments.length > 0 
//           ? new Date(a.shipments[a.shipments.length - 1].date) 
//           : new Date(0);
//         const lastDateB = b.shipments.length > 0 
//           ? new Date(b.shipments[b.shipments.length - 1].date) 
//           : new Date(0);
//         return lastDateB.getTime() - lastDateA.getTime();
//       });
      
//       setSummary(sorted);
//     } catch (err) {
//       console.error(err);
//     }
//   }, []);

//   const fetchFutureRequests = useCallback(async () => {
//     try {
//       const response = await fetch('/api/outgoing-requests');
//       const allRequests = await response.json();
      
//       // Фильтруем только открытые заявки (closed = false)
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
      
//       const future = allRequests.filter((req: FutureRequest) => {
//         if (req.closed) return false;
//         if (!req.delivery_date) return false;
//         const deliveryDate = new Date(req.delivery_date);
//         deliveryDate.setHours(0, 0, 0, 0);
//         return deliveryDate >= today;
//       });
      
//       // Сортируем по дате отгрузки
//       future.sort((a: FutureRequest, b: FutureRequest) => {
//         return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
//       });
      
//       setFutureRequests(future);
//     } catch (err) {
//       console.error(err);
//     }
//   }, []);

//   useEffect(() => {
//     let isMounted = true;
    
//     const loadData = async () => {
//       if (!isMounted) return;
//       await Promise.all([fetchSummary(), fetchFutureRequests()]);
//       setLoading(false);
//     };
    
//     loadData();
    
//     return () => {
//       isMounted = false;
//     };
//   }, [fetchSummary, fetchFutureRequests]);

//   const formatWeight = (weight: number) => `${Math.round(weight)}`;
//   const formatDate = (dateStr: string) => {
//     const date = new Date(dateStr);
//     return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
//   };
  
//   const formatDateTime = (dateStr: string) => {
//     const date = new Date(dateStr);
//     return `${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('ru-RU')}`;
//   };

//   const getLastShipmentDate = (shipments: SummaryItem['shipments']): string => {
//     if (shipments.length === 0) return '—';
//     const lastShipment = shipments.reduce((latest, current) => 
//       new Date(current.date) > new Date(latest.date) ? current : latest
//     );
//     return formatDateTime(lastShipment.date);
//   };

//   const getRemainingClass = (remaining: number): string => {
//     if (remaining > 0) return 'remaining-negative';
//     if (remaining < 0) return 'remaining-positive';
//     return 'remaining-zero';
//   };

//   const getRemainingText = (remaining: number): string => {
//     const rounded = Math.round(Math.abs(remaining));
//     if (remaining > 0) return `−${rounded}`;
//     if (remaining < 0) return `+${rounded}`;
//     return '0';
//   };

//   const getDayLabel = (dateStr: string): string => {
//     const date = new Date(dateStr);
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today);
//     tomorrow.setDate(tomorrow.getDate() + 1);
    
//     if (date.toDateString() === today.toDateString()) return 'СЕГОДНЯ';
//     if (date.toDateString() === tomorrow.toDateString()) return 'ЗАВТРА';
//     return formatDate(dateStr);
//   };

//   if (loading) return <div className="loading"><div className="spinner"></div><p>Загрузка...</p></div>;

//   return (
//     <div className="summary-view">
//       {/* Подвкладки */}
//       <div className="summary-subtabs">
//         <button 
//           className={`summary-subtab ${activeSubTab === 'current' ? 'active' : ''}`}
//           onClick={() => setActiveSubTab('current')}
//         >
//           📊 Текущие заявки
//         </button>
//         <button 
//           className={`summary-subtab ${activeSubTab === 'future' ? 'active' : ''}`}
//           onClick={() => setActiveSubTab('future')}
//         >
//           📅 План на будущее ({futureRequests.length})
//         </button>
//       </div>

//       {/* Текущие заявки (план-факт) */}
//       {activeSubTab === 'current' && (
//         <div className="summary-view-compact">
//           {summary.length === 0 ? (
//             <div className="empty">
//               <p>Нет активных заявок</p>
//             </div>
//           ) : (
//             summary.map((item) => (
//               <div key={item.request.number} className="summary-card-compact">
//                 <div 
//                   className="summary-header-compact" 
//                   onClick={() => setExpandedId(expandedId === item.request.number ? null : item.request.number)}
//                 >
//                   <div className="summary-row">
//                     <span className="summary-consignee">{item.request.consignee || item.request.customer}</span>
//                     <span className="summary-last-shipment">{getLastShipmentDate(item.shipments)}</span>
//                   </div>
//                   <div className="summary-row">
//                     <div className="summary-numbers">
//                       <span className="summary-fact">{formatWeight(item.factQuantity)}</span>
//                       <span className="summary-slash">/</span>
//                       <span className="summary-plan">{formatWeight(item.request.planQuantity)}</span>
//                       <span className={`summary-remaining ${getRemainingClass(item.remaining)}`}>
//                         {getRemainingText(item.remaining)}
//                       </span>
//                     </div>
//                     <div className="summary-percent">
//                       <div className="summary-percent-bar">
//                         <div 
//                           className="summary-percent-fill" 
//                           style={{ 
//                             width: `${Math.min(Math.max(item.percentCompleted, 0), 100)}%`,
//                             background: item.percentCompleted >= 100 
//                               ? 'linear-gradient(90deg, #28a745, #20c997)' 
//                               : item.percentCompleted >= 70 
//                                 ? 'linear-gradient(90deg, #ffc107, #ffb347)' 
//                                 : 'linear-gradient(90deg, #dc3545, #fd7e14)'
//                           }}
//                         />
//                       </div>
//                       <span className={`summary-percent-text ${item.percentCompleted >= 100 ? 'completed' : item.percentCompleted >= 70 ? 'good' : 'bad'}`}>
//                         {item.percentCompleted}%
//                       </span>
//                     </div>
//                     <span className="summary-expand">{expandedId === item.request.number ? '▲' : '▼'}</span>
//                   </div>
//                 </div>
                
//                 {expandedId === item.request.number && (
//                   <motion.div 
//                     className="summary-details-compact" 
//                     initial={{ opacity: 0, height: 0 }}
//                     animate={{ opacity: 1, height: 'auto' }}
//                     transition={{ duration: 0.2 }}
//                   >
//                     <div className="detail-row">
//                       <span className="label">Материал:</span>
//                       <span className="value">{item.request.material}</span>
//                     </div>
//                     <div className="detail-row">
//                       <span className="label">Грузополучатель:</span>
//                       <span className="value">{item.request.consignee || '—'}</span>
//                     </div>
//                     {item.shipments.length > 0 && (
//                       <div className="shipments-list-compact">
//                         <div className="shipments-title">Отгрузки:</div>
//                         {item.shipments.map((ship) => (
//                           <div key={ship.number} className="shipment-item-compact">
//                             <span className="shipment-time">{formatDateTime(ship.date)}</span>
//                             <span className="shipment-quantity">{formatWeight(ship.quantity)}</span>
//                             <span className="shipment-license">{ship.licensePlate}</span>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </motion.div>
//                 )}
//               </div>
//             ))
//           )}
//         </div>
//       )}

//       {/* План на будущее */}
//       {activeSubTab === 'future' && (
//         <div className="future-requests-view">
//           {futureRequests.length === 0 ? (
//             <div className="empty">
//               <p>📭 Нет запланированных заявок на будущее</p>
//             </div>
//           ) : (
//             <div className="future-requests-list">
//               {futureRequests.map((req) => (
//                 <div key={req.number} className="future-request-card">
//                   <div className="future-request-header">
//                     <span className="future-request-date">{getDayLabel(req.delivery_date)}</span>
//                     <span className="future-request-badge">{req.division === 'Люберцы' ? '🏭 ЛЮ' : '🏭 ЛХ'}</span>
//                   </div>
//                   <div className="future-request-body">
//                     <div className="future-request-consignee">{req.consignee || req.customer}</div>
//                     <div className="future-request-details">
//                       <span className="future-request-material">{req.material}</span>
//                       <span className="future-request-quantity">{Math.round(req.quantity)} т</span>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }


