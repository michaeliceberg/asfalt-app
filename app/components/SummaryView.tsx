// components/SummaryView.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface SummaryItem {
  request: {
    number: string;
    date: string;
    division: string;
    customer: string;
    consignee: string;
    material: string;
    planQuantity: number;
    clientRequestNumber: string;
    clientRequestDate: string;
  };
  factQuantity: number;
  remaining: number;
  percentCompleted: number;
  shipments: Array<{
    number: string;
    date: string;
    quantity: number;
    driver: string;
    licensePlate: string;
  }>;
}

export default function SummaryView() {
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/summary');
      const data = await response.json();
      const sorted = data.sort((a: SummaryItem, b: SummaryItem) => {
        const lastDateA = a.shipments.length > 0 
          ? new Date(a.shipments[a.shipments.length - 1].date) 
          : new Date(0);
        const lastDateB = b.shipments.length > 0 
          ? new Date(b.shipments[b.shipments.length - 1].date) 
          : new Date(0);
        return lastDateB.getTime() - lastDateA.getTime();
      });
      setSummary(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      await fetchSummary();
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [fetchSummary]);




  const formatWeight = (weight: number) => `${Math.round(weight)}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU');
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('ru-RU')}`;
  };

  const getLastShipmentDate = (shipments: SummaryItem['shipments']): string => {
    if (shipments.length === 0) return '—';
    const lastShipment = shipments.reduce((latest, current) => 
      new Date(current.date) > new Date(latest.date) ? current : latest
    );
    return formatDateTime(lastShipment.date);
  };

  const getRemainingClass = (remaining: number): string => {
    if (remaining > 0) return 'remaining-negative';
    if (remaining < 0) return 'remaining-positive';
    return 'remaining-zero';
  };

  const getRemainingText = (remaining: number): string => {
    const rounded = Math.round(Math.abs(remaining));
    if (remaining > 0) return `−${rounded}`;
    if (remaining < 0) return `+${rounded}`;
    return '0';
  };

  if (loading) return <div className="loading"><div className="spinner"></div><p>Загрузка...</p></div>;

  if (summary.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных по заявкам</p>
      </div>
    );
  }

  return (
    <div className="summary-view-compact">
      {summary.map((item) => (
        <div key={item.request.number} className="summary-card-compact">
          <div 
            className="summary-header-compact" 
            onClick={() => setExpandedId(expandedId === item.request.number ? null : item.request.number)}
          >
            <div className="summary-row">
              <span className="summary-consignee">{item.request.consignee || item.request.customer}</span>
              <span className="summary-last-shipment">{getLastShipmentDate(item.shipments)}</span>
            </div>
            <div className="summary-row">
              <div className="summary-numbers">
                <span className="summary-fact">{formatWeight(item.factQuantity)}</span>
                <span className="summary-slash">/</span>
                <span className="summary-plan">{formatWeight(item.request.planQuantity)}</span>
                <span className={`summary-remaining ${getRemainingClass(item.remaining)}`}>
                  {getRemainingText(item.remaining)}
                </span>
              </div>
              <div className="summary-percent">
                <div className="summary-percent-bar">
                  <div 
                    className="summary-percent-fill" 
                    style={{ 
                      width: `${Math.min(Math.max(item.percentCompleted, 0), 100)}%`,
                      background: item.percentCompleted >= 100 
                        ? 'linear-gradient(90deg, #28a745, #20c997)' 
                        : item.percentCompleted >= 70 
                          ? 'linear-gradient(90deg, #ffc107, #ffb347)' 
                          : 'linear-gradient(90deg, #dc3545, #fd7e14)'
                    }}
                  />
                </div>
                <span className={`summary-percent-text ${item.percentCompleted >= 100 ? 'completed' : item.percentCompleted >= 70 ? 'good' : 'bad'}`}>
                  {item.percentCompleted}%
                </span>
              </div>
              <span className="summary-expand">{expandedId === item.request.number ? '▲' : '▼'}</span>
            </div>
          </div>
          
          {expandedId === item.request.number && (
            <motion.div 
              className="summary-details-compact" 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              <div className="detail-row">
                <span className="label">Материал:</span>
                <span className="value">{item.request.material}</span>
              </div>
              <div className="detail-row">
                <span className="label">Грузополучатель:</span>
                <span className="value">{item.request.consignee || '—'}</span>
              </div>
              {item.shipments.length > 0 && (
                <div className="shipments-list-compact">
                  <div className="shipments-title">Отгрузки:</div>
                  {item.shipments.map((ship) => (
                    <div key={ship.number} className="shipment-item-compact">
                      <span className="shipment-time">{formatDateTime(ship.date)}</span>
                      <span className="shipment-quantity">{formatWeight(ship.quantity)}</span>
                      <span className="shipment-license">{ship.licensePlate}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}


// // components/SummaryView.tsx
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

// export default function SummaryView() {
//   const [summary, setSummary] = useState<SummaryItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [expandedId, setExpandedId] = useState<string | null>(null);

//   const fetchSummary = useCallback(async () => {
//     try {
//       const response = await fetch('/api/summary');
//       const data = await response.json();
//       // Сортируем по дате последней отгрузки (новые сверху)
//       const sorted = data.sort((a: SummaryItem, b: SummaryItem) => {
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
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   // useEffect(() => {
//   //   fetchSummary();
//   // }, [fetchSummary]);








//   useEffect(() => {
//     let isMounted = true;
    
//     const loadData = async () => {
//       if (!isMounted) return;
//       await fetchSummary();
//     };
    
//     loadData();
    
//     return () => {
//       isMounted = false;
//     };
//   }, [fetchSummary]);








//   const formatWeight = (weight: number) => `${weight.toFixed(2)} т`;
//   const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU');
//   const formatDateTime = (dateStr: string) => {
//     const date = new Date(dateStr);
//     return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
//   };

//   const getLastShipmentDate = (shipments: SummaryItem['shipments']): string => {
//     if (shipments.length === 0) return 'Нет отгрузок';
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
//     if (remaining > 0) return `−${remaining.toFixed(2)}`;
//     if (remaining < 0) return `+${Math.abs(remaining).toFixed(2)}`;
//     return '0';
//   };

//   if (loading) return <div className="loading"><div className="spinner"></div><p>Загрузка...</p></div>;

//   if (summary.length === 0) {
//     return (
//       <div className="empty">
//         <p>Нет данных по заявкам</p>
//       </div>
//     );
//   }

//   return (
//     <div className="summary-view">
//       {summary.map((item) => (
//         <div key={item.request.number} className={`summary-card ${item.percentCompleted >= 100 ? 'completed-card' : ''}`}>
//           <div 
//             className="summary-header" 
//             onClick={() => setExpandedId(expandedId === item.request.number ? null : item.request.number)}
//           >
//             <div className="summary-title">
//               <span className="request-number">№{item.request.clientRequestNumber}</span>
//               <span className="request-consignee">{item.request.consignee || item.request.customer}</span>
//               <span className="request-last-shipment">
//                 📅 {getLastShipmentDate(item.shipments)}
//               </span>
//             </div>
//             <div className="summary-stats">
//               <div className="plan-fact">
//                 <span className="plan">📋 {formatWeight(item.request.planQuantity)}</span>
//                 <span className="fact">✅ {formatWeight(item.factQuantity)}</span>
//                 <span className={`remaining ${getRemainingClass(item.remaining)}`}>
//                   {getRemainingText(item.remaining)}
//                 </span>
//               </div>


//               {/* <div className="percent">
//                 <div className="percent-bar">
//   <div 
//     className="percent-fill" 
//     style={{ width: `${Math.min(Math.max(item.percentCompleted, 0), 100)}%` }}
//   />
// </div>
//                 <span className={`percent-text ${item.percentCompleted >= 100 ? 'completed' : item.percentCompleted >= 70 ? 'good' : 'bad'}`}>
//                   {item.percentCompleted}%
//                 </span>
//               </div> */}

// <div className="percent">
//   <div className="percent-bar">
//     <div 
//       className="percent-fill" 
//       style={{ 
//         width: `${Math.min(Math.max(item.percentCompleted, 0), 100)}%`,
//         background: item.percentCompleted >= 100 
//           ? 'linear-gradient(90deg, #28a745, #20c997)' 
//           : item.percentCompleted >= 70 
//             ? 'linear-gradient(90deg, #ffc107, #ffb347)' 
//             : 'linear-gradient(90deg, #dc3545, #fd7e14)'
//       }}
//     />
//   </div>
//   <span className={`percent-text ${item.percentCompleted >= 100 ? 'completed' : item.percentCompleted >= 70 ? 'good' : 'bad'}`}>
//     {item.percentCompleted}%
//   </span>
// </div>





//             </div>
//             <div className="expand-icon">{expandedId === item.request.number ? '▲' : '▼'}</div>
//           </div>
          
//           {expandedId === item.request.number && (
//             <motion.div 
//               className="summary-details" 
//               initial={{ opacity: 0, height: 0 }}
//               animate={{ opacity: 1, height: 'auto' }}
//               transition={{ duration: 0.2 }}
//             >
//               <div className="detail-row">
//                 <span className="label">Материал:</span>
//                 <span className="value">{item.request.material}</span>
//               </div>
//               <div className="detail-row">
//                 <span className="label">Грузополучатель:</span>
//                 <span className="value">{item.request.consignee || '—'}</span>
//               </div>
//               <div className="detail-row">
//                 <span className="label">Дата заявки:</span>
//                 <span className="value">{formatDate(item.request.clientRequestDate)}</span>
//               </div>
//               {item.shipments.length > 0 && (
//                 <div className="shipments-list">
//                   <div className="shipments-title">✅ Выполненные отгрузки:</div>
//                   {item.shipments.map((ship) => (
//                     <div key={ship.number} className="shipment-item">
//                       <span>№{ship.number}</span>
//                       <span>{formatDateTime(ship.date)}</span>
//                       <span>{formatWeight(ship.quantity)}</span>
//                       <span className="shipment-driver">{ship.driver} ({ship.licensePlate})</span>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </motion.div>
//           )}
//         </div>
//       ))}
//     </div>
//   );
// }




// // // app/components/SummaryView.tsx
// // 'use client';

// // import { useState, useEffect, useCallback } from 'react';
// // import { motion } from 'framer-motion';

// // interface SummaryItem {
// //   request: {
// //     number: string;
// //     date: string;
// //     division: string;
// //     customer: string;
// //     consignee: string;
// //     material: string;
// //     planQuantity: number;
// //     clientRequestNumber: string;
// //     clientRequestDate: string;
// //   };
// //   factQuantity: number;
// //   remaining: number;
// //   percentCompleted: number;
// //   shipments: Array<{
// //     number: string;
// //     date: string;
// //     quantity: number;
// //     driver: string;
// //     licensePlate: string;
// //   }>;
// // }

// // export default function SummaryView() {
// //   const [summary, setSummary] = useState<SummaryItem[]>([]);
// //   const [loading, setLoading] = useState(true);
// //   const [expandedId, setExpandedId] = useState<string | null>(null);

// //   const fetchSummary = useCallback(async () => {
// //     try {
// //       const response = await fetch('/api/summary');
// //       const data = await response.json();
// //       setSummary(data);
// //     } catch (err) {
// //       console.error('Error fetching summary:', err);
// //     } finally {
// //       setLoading(false);
// //     }
// //   }, []);

// //   useEffect(() => {
// //     let isMounted = true;
    
// //     const loadData = async () => {
// //       if (!isMounted) return;
// //       await fetchSummary();
// //     };
    
// //     loadData();
    
// //     return () => {
// //       isMounted = false;
// //     };
// //   }, [fetchSummary]);

// //   const formatWeight = (weight: number) => `${weight.toFixed(2)} т`;
// //   const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU');

// //   if (loading) {
// //     return (
// //       <div className="loading">
// //         <div className="spinner"></div>
// //         <p>Загрузка данных...</p>
// //       </div>
// //     );
// //   }

// //   if (summary.length === 0) {
// //     return (
// //       <div className="empty">
// //         <p>Нет данных по заявкам</p>
// //       </div>
// //     );
// //   }

// //   return (
// //     <div className="summary-view">
// //       {summary.map((item) => (
// //         <div key={item.request.number} className="summary-card">
// //           <div 
// //             className="summary-header" 
// //             onClick={() => setExpandedId(expandedId === item.request.number ? null : item.request.number)}
// //           >
// //             <div className="summary-title">
// //               <span className="request-number">№{item.request.clientRequestNumber}</span>
// //               <span className="request-consignee">{item.request.consignee || item.request.customer}</span>
// //             </div>
// //             <div className="summary-stats">
// //               <div className="plan-fact">
// //                 <span className="plan">📋 {formatWeight(item.request.planQuantity)}</span>
// //                 <span className="fact">✅ {formatWeight(item.factQuantity)}</span>
// //                 <span className="remaining">⏳ {formatWeight(item.remaining)}</span>
// //               </div>
// //               <div className="percent">
// //                 <div className="percent-bar">
// //                   <div className="percent-fill" style={{ width: `${Math.min(item.percentCompleted, 100)}%` }} />
// //                 </div>
// //                 <span className="percent-text">{item.percentCompleted}%</span>
// //               </div>
// //             </div>
// //             <div className="expand-icon">{expandedId === item.request.number ? '▲' : '▼'}</div>
// //           </div>
          
// //           {expandedId === item.request.number && (
// //             <motion.div 
// //               className="summary-details" 
// //               initial={{ opacity: 0, height: 0 }}
// //               animate={{ opacity: 1, height: 'auto' }}
// //               transition={{ duration: 0.2 }}
// //             >
// //               <div className="detail-row">
// //                 <span className="label">Материал:</span>
// //                 <span className="value">{item.request.material}</span>
// //               </div>
// //               <div className="detail-row">
// //                 <span className="label">Грузополучатель:</span>
// //                 <span className="value">{item.request.consignee || '—'}</span>
// //               </div>
// //               <div className="detail-row">
// //                 <span className="label">Дата заявки:</span>
// //                 <span className="value">{formatDate(item.request.clientRequestDate)}</span>
// //               </div>
// //               {item.shipments.length > 0 && (
// //                 <div className="shipments-list">
// //                   <div className="shipments-title">✅ Выполненные отгрузки:</div>
// //                   {item.shipments.map((ship) => (
// //                     <div key={ship.number} className="shipment-item">
// //                       <span>№{ship.number} от {formatDate(ship.date)}</span>
// //                       <span>{formatWeight(ship.quantity)}</span>
// //                       <span className="shipment-driver">{ship.driver} ({ship.licensePlate})</span>
// //                     </div>
// //                   ))}
// //                 </div>
// //               )}
// //             </motion.div>
// //           )}
// //         </div>
// //       ))}
// //     </div>
// //   );
// // }