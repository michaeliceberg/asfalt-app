'use client';

import { ShipmentItem } from '@/app/page';
import { useEffect, useState, useRef } from 'react';

interface ActivityChartProps {
  shipments: ShipmentItem[];
  selectedFactory: string;
}

export default function ActivityChart({ shipments, selectedFactory }: ActivityChartProps) {
  const [activityData, setActivityData] = useState<Array<{ 
    period: string; 
    startHour: number;
    totalTons: number;
    hasActivity: boolean;
    isCurrent: boolean;
  }>>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentBlockStart = Math.floor(currentHour / 2) * 2;
    
    // Создаём 12 периодов (последние 24 часа) от текущего блока назад
    const periods = [];
    for (let i = 11; i >= 0; i--) {
      let startHour = currentBlockStart - i * 2;
      if (startHour < 0) startHour += 24;
      const periodLabel = `${startHour.toString().padStart(2, '0')}-${startHour + 2}`;
      periods.push({
        startHour: startHour,
        period: periodLabel,
        isCurrent: false,
      });
    }
    
    // Определяем текущий блок (тот, в котором сейчас час)
    const currentBlockStartNow = Math.floor(currentHour / 2) * 2;
    periods.forEach(p => {
      p.isCurrent = (p.startHour === currentBlockStartNow);
    });
    
    // Фильтруем по заводу
    let filteredShipments = shipments;
    if (selectedFactory === 'ЛХ') {
      filteredShipments = shipments.filter(s => s.division === 'ЛХ');
    } else if (selectedFactory === 'ЛЮ') {
      filteredShipments = shipments.filter(s => s.division === 'ЛЮ');
    }
    
    // Считаем тонны по периодам
    const activity: { [key: number]: { tons: number } } = {};
    
    for (const shipment of filteredShipments) {
      const shipmentDate = new Date(shipment.date);
      const shipmentHour = shipmentDate.getHours();
      const blockStart = Math.floor(shipmentHour / 2) * 2;
      const hoursDiff = (now.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60);
      
      // Для текущего блока (последние 2 часа) — только отгрузки за последние 2 часа
      // Для остальных блоков — все отгрузки за последние 24 часа
      if (blockStart === currentBlockStartNow) {
        if (hoursDiff <= 2) {
          if (!activity[blockStart]) activity[blockStart] = { tons: 0 };
          activity[blockStart].tons += shipment.quantity;
        }
      } else {
        if (hoursDiff <= 24) {
          if (!activity[blockStart]) activity[blockStart] = { tons: 0 };
          activity[blockStart].tons += shipment.quantity;
        }
      }
    }
    
    // Формируем результат
    const result = periods.map(p => {
      const act = activity[p.startHour];
      const hasActivity = act && act.tons > 0;
      return {
        period: p.period,
        startHour: p.startHour,
        totalTons: act?.tons || 0,
        hasActivity: hasActivity || false,
        isCurrent: p.isCurrent,
      };
    });
    
    if (isMounted.current) {
      setActivityData(result);
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [shipments, selectedFactory]);

  const activeTons = activityData.filter(d => d.hasActivity).map(d => d.totalTons);
  const maxTons = activeTons.length > 0 ? Math.max(...activeTons) : 1;

  const getHeight = (tons: number, hasActivity: boolean) => {
    if (!hasActivity) return 2;
    return Math.max(6, (tons / maxTons) * 24);
  };

  const formatTons = (tons: number): string => {
    return Math.round(tons).toString();
  };

  if (activityData.length === 0) return null;

  return (
    <div className="activity-chart-wrapper">
      <div className="activity-chart-bars-row">
        {activityData.map((item, idx) => {
          const height = getHeight(item.totalTons, item.hasActivity);
          
          return (
            <div key={idx} className="activity-chart-bar-wrapper">
              {item.hasActivity && (
                <div className={`activity-chart-bar-value ${item.isCurrent ? 'current' : ''}`}>
                  {formatTons(item.totalTons)}
                </div>
              )}
              <div 
                className={`activity-chart-bar ${item.hasActivity ? 'active' : 'inactive'} ${item.isCurrent ? 'current-bar' : ''}`}
                style={{ height: `${height}px` }}
                title={`${item.period}: ${item.totalTons} т`}
              />
              <div className="activity-chart-label">
                {item.period}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}




// 'use client';

// import { ShipmentItem } from '@/app/page';
// import { useEffect, useState, useRef } from 'react';

// interface ActivityChartProps {
//   shipments: ShipmentItem[];
//   selectedFactory: string;
// }

// export default function ActivityChart({ shipments, selectedFactory }: ActivityChartProps) {
//   const [activityData, setActivityData] = useState<Array<{ 
//     period: string; 
//     startHour: number;
//     totalTons: number;
//     hasActivity: boolean;
//     isCurrent: boolean;
//   }>>([]);
//   const isMounted = useRef(true);

//   useEffect(() => {
//     isMounted.current = true;
    
//     const now = new Date();
//     const currentHour = now.getHours();
//     const currentBlockStart = Math.floor(currentHour / 2) * 2;
    
//     // Создаём 12 периодов (последние 24 часа) от текущего блока назад
//     const periods = [];
//     for (let i = 11; i >= 0; i--) {
//       let startHour = currentBlockStart - i * 2;
//       if (startHour < 0) startHour += 24;
//       const periodLabel = `${startHour.toString().padStart(2, '0')}-${startHour + 2}`;
//       periods.push({
//         startHour: startHour,
//         period: periodLabel,
//         isCurrent: false,
//       });
//     }
    
//     // Определяем текущий блок (тот, в котором сейчас час)
//     const currentBlockStartNow = Math.floor(currentHour / 2) * 2;
//     periods.forEach(p => {
//       p.isCurrent = (p.startHour === currentBlockStartNow);
//     });
    
//     // Фильтруем по заводу
//     let filteredShipments = shipments;
//     if (selectedFactory === 'ЛХ') {
//       filteredShipments = shipments.filter(s => s.division === 'ЛХ');
//     } else if (selectedFactory === 'ЛЮ') {
//       filteredShipments = shipments.filter(s => s.division === 'ЛЮ');
//     }
    
//     // Считаем тонны по периодам
//     const activity: { [key: number]: { tons: number } } = {};
    
//     for (const shipment of filteredShipments) {
//       const shipmentDate = new Date(shipment.date);
//       const shipmentHour = shipmentDate.getHours();
//       const blockStart = Math.floor(shipmentHour / 2) * 2;
//       const hoursDiff = (now.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60);
      
//       // Для текущего блока (последние 2 часа) — только отгрузки за последние 2 часа
//       // Для остальных блоков — все отгрузки за последние 24 часа
//       if (blockStart === currentBlockStartNow) {
//         if (hoursDiff <= 2) {
//           if (!activity[blockStart]) activity[blockStart] = { tons: 0 };
//           activity[blockStart].tons += shipment.quantity;
//         }
//       } else {
//         if (hoursDiff <= 24) {
//           if (!activity[blockStart]) activity[blockStart] = { tons: 0 };
//           activity[blockStart].tons += shipment.quantity;
//         }
//       }
//     }
    
//     // Формируем результат
//     const result = periods.map(p => {
//       const act = activity[p.startHour];
//       const hasActivity = act && act.tons > 0;
//       return {
//         period: p.period,
//         startHour: p.startHour,
//         totalTons: act?.tons || 0,
//         hasActivity: hasActivity || false,
//         isCurrent: p.isCurrent,
//       };
//     });
    
//     if (isMounted.current) {
//       setActivityData(result);
//     }
    
//     return () => {
//       isMounted.current = false;
//     };
//   }, [shipments, selectedFactory]);

//   const activeTons = activityData.filter(d => d.hasActivity).map(d => d.totalTons);
//   const maxTons = activeTons.length > 0 ? Math.max(...activeTons) : 1;

//   const getHeight = (tons: number, hasActivity: boolean) => {
//     if (!hasActivity) return 2;
//     return Math.max(6, (tons / maxTons) * 24);
//   };

//   const formatTons = (tons: number): string => {
//     return Math.round(tons).toString();
//   };

//   if (activityData.length === 0) return null;

//   return (
//     <div className="activity-chart-wrapper">
//       {/* Заголовок вынесен над гистограммой */}
//       <div className="activity-chart-title">Активность за 24 часа</div>
//       <div className="activity-chart-bars-row">
//         {activityData.map((item, idx) => {
//           const height = getHeight(item.totalTons, item.hasActivity);
          
//           return (
//             <div key={idx} className="activity-chart-bar-wrapper">
//               {item.hasActivity && (
//                 <div className={`activity-chart-bar-value ${item.isCurrent ? 'current' : ''}`}>
//                   {formatTons(item.totalTons)}
//                 </div>
//               )}
//               <div 
//                 className={`activity-chart-bar ${item.hasActivity ? 'active' : 'inactive'} ${item.isCurrent ? 'current-bar' : ''}`}
//                 style={{ height: `${height}px` }}
//                 title={`${item.period}: ${item.totalTons} т`}
//               />
//               <div className="activity-chart-label">
//                 {item.period}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }




// 'use client';

// import { ShipmentItem } from '@/app/page';
// import { useEffect, useState, useRef } from 'react';

// interface ActivityChartProps {
//   shipments: ShipmentItem[];
//   selectedFactory: string;
// }

// export default function ActivityChart({ shipments, selectedFactory }: ActivityChartProps) {
//   const [activityData, setActivityData] = useState<Array<{ 
//     period: string; 
//     startHour: number;
//     totalTons: number;
//     hasActivity: boolean;
//     isCurrent: boolean;
//   }>>([]);
//   const isMounted = useRef(true);

  
  


// useEffect(() => {
//   isMounted.current = true;
  
//   const now = new Date();
//   const currentHour = now.getHours();
//   const currentMinute = now.getMinutes();
//   const currentBlockStart = Math.floor(currentHour / 2) * 2;
  
//   // Создаём 12 периодов (последние 24 часа) от текущего блока назад
//   const periods = [];
//   for (let i = 11; i >= 0; i--) {
//     let startHour = currentBlockStart - i * 2;
//     if (startHour < 0) startHour += 24;
//     const periodLabel = `${startHour.toString().padStart(2, '0')}-${startHour + 2}`;
//     periods.push({
//       startHour: startHour,
//       period: periodLabel,
//       isCurrent: false,
//     });
//   }
  
//   // Определяем текущий блок (тот, в котором сейчас час)
//   const currentBlockStartNow = Math.floor(currentHour / 2) * 2;
//   periods.forEach(p => {
//     p.isCurrent = (p.startHour === currentBlockStartNow);
//   });
  
//   // Фильтруем по заводу
//   let filteredShipments = shipments;
//   if (selectedFactory === 'ЛХ') {
//     filteredShipments = shipments.filter(s => s.division === 'ЛХ');
//   } else if (selectedFactory === 'ЛЮ') {
//     filteredShipments = shipments.filter(s => s.division === 'ЛЮ');
//   }
  
//   // Считаем тонны по периодам
//   const activity: { [key: number]: { tons: number } } = {};
  
//   for (const shipment of filteredShipments) {
//     const shipmentDate = new Date(shipment.date);
//     const shipmentHour = shipmentDate.getHours();
//     const blockStart = Math.floor(shipmentHour / 2) * 2;
//     const hoursDiff = (now.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60);
    
//     // Для текущего блока (последние 2 часа) — только отгрузки за последние 2 часа
//     // Для остальных блоков — все отгрузки за последние 24 часа
//     if (blockStart === currentBlockStartNow) {
//       if (hoursDiff <= 2) {
//         if (!activity[blockStart]) activity[blockStart] = { tons: 0 };
//         activity[blockStart].tons += shipment.quantity;
//       }
//     } else {
//       if (hoursDiff <= 24) {
//         if (!activity[blockStart]) activity[blockStart] = { tons: 0 };
//         activity[blockStart].tons += shipment.quantity;
//       }
//     }
//   }
  
//   // Формируем результат
//   const result = periods.map(p => {
//     const act = activity[p.startHour];
//     const hasActivity = act && act.tons > 0;
//     return {
//       period: p.period,
//       startHour: p.startHour,
//       totalTons: act?.tons || 0,
//       hasActivity: hasActivity || false,
//       isCurrent: p.isCurrent,
//     };
//   });
  
//   if (isMounted.current) {
//     setActivityData(result);
//   }
  
//   return () => {
//     isMounted.current = false;
//   };
// }, [shipments, selectedFactory]);




//   const activeTons = activityData.filter(d => d.hasActivity).map(d => d.totalTons);
//   const maxTons = activeTons.length > 0 ? Math.max(...activeTons) : 1;

//   const getHeight = (tons: number, hasActivity: boolean) => {
//     if (!hasActivity) return 2;
//     return Math.max(6, (tons / maxTons) * 24);
//   };

//   const formatTons = (tons: number): string => {
//     return Math.round(tons).toString();
//   };

//   return (
//     <div className="activity-chart-wrapper">
//       <div className="activity-chart-title">Активность за 24 часа</div>
//       <div className="activity-chart-bars-row">
//         {activityData.map((item, idx) => {
//           const height = getHeight(item.totalTons, item.hasActivity);
          
//           return (
//             <div key={idx} className="activity-chart-bar-wrapper">
//               {item.hasActivity && (
//                 <div className={`activity-chart-bar-value ${item.isCurrent ? 'current' : ''}`}>
//                   {formatTons(item.totalTons)}
//                 </div>
//               )}
//               <div 
//                 className={`activity-chart-bar ${item.hasActivity ? 'active' : 'inactive'} ${item.isCurrent ? 'current-bar' : ''}`}
//                 style={{ height: `${height}px` }}
//                 title={`${item.period}: ${item.totalTons} т`}
//               />
//               <div className="activity-chart-label">
//                 {item.period}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }



// 'use client';

// import { ShipmentItem } from '@/app/page';
// import { useEffect, useState, useRef } from 'react';

// interface ActivityChartProps {
//   shipments: ShipmentItem[];
//   selectedFactory: string;
// }

// export default function ActivityChart({ shipments, selectedFactory }: ActivityChartProps) {
//   const [activityData, setActivityData] = useState<Array<{ 
//     period: string; 
//     startHour: number;
//     todayTons: number;
//     yesterdayTons: number;
//     hasActivity: boolean;
//   }>>([]);
//   const isMounted = useRef(true);

//   useEffect(() => {
//     isMounted.current = true;
    
//     const now = new Date();
//     const currentHour = now.getHours();
//     const currentBlockStart = Math.floor(currentHour / 2) * 2;
    
//     // Создаём периоды
//     const periods = [];
//     for (let i = 11; i >= 0; i--) {
//       let startHour = currentBlockStart - i * 2;
//       if (startHour < 0) startHour += 24;
//       const periodLabel = `${startHour.toString().padStart(2, '0')}-${startHour + 2}`;
//       periods.push({ startHour, period: periodLabel });
//     }
    
//     // Фильтруем по заводу
//     let filteredShipments = shipments;
//     if (selectedFactory === 'ЛХ') {
//       filteredShipments = shipments.filter(s => s.division === 'ЛХ');
//     } else if (selectedFactory === 'ЛЮ') {
//       filteredShipments = shipments.filter(s => s.division === 'ЛЮ');
//     }
    
//     // Определяем границы дней
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const yesterday = new Date(today);
//     yesterday.setDate(yesterday.getDate() - 1);
    
//     // Разделяем отгрузки на сегодня и вчера
//     const todayShipments = filteredShipments.filter(s => {
//       const shipmentDate = new Date(s.date);
//       shipmentDate.setHours(0, 0, 0, 0);
//       return shipmentDate.getTime() === today.getTime();
//     });
    
//     const yesterdayShipments = filteredShipments.filter(s => {
//       const shipmentDate = new Date(s.date);
//       shipmentDate.setHours(0, 0, 0, 0);
//       return shipmentDate.getTime() === yesterday.getTime();
//     });
    
//     // Считаем тонны по периодам для сегодня
//     const todayActivity: { [key: number]: { tons: number } } = {};
//     for (const shipment of todayShipments) {
//       const shipmentDate = new Date(shipment.date);
//       const shipmentHour = shipmentDate.getHours();
//       const blockStart = Math.floor(shipmentHour / 2) * 2;
//       if (!todayActivity[blockStart]) todayActivity[blockStart] = { tons: 0 };
//       todayActivity[blockStart].tons += shipment.quantity;
//     }
    
//     // Считаем тонны по периодам для вчера
//     const yesterdayActivity: { [key: number]: { tons: number } } = {};
//     for (const shipment of yesterdayShipments) {
//       const shipmentDate = new Date(shipment.date);
//       const shipmentHour = shipmentDate.getHours();
//       const blockStart = Math.floor(shipmentHour / 2) * 2;
//       if (!yesterdayActivity[blockStart]) yesterdayActivity[blockStart] = { tons: 0 };
//       yesterdayActivity[blockStart].tons += shipment.quantity;
//     }
    
//     // Формируем результат
//     const result = periods.map(p => {
//       const todayTons = todayActivity[p.startHour]?.tons || 0;
//       const yesterdayTons = yesterdayActivity[p.startHour]?.tons || 0;
//       const hasActivity = todayTons > 0 || yesterdayTons > 0;
//       return {
//         period: p.period,
//         startHour: p.startHour,
//         todayTons,
//         yesterdayTons,
//         hasActivity,
//       };
//     });
    
//     if (isMounted.current) {
//       setActivityData(result);
//     }
    
//     return () => {
//       isMounted.current = false;
//     };
//   }, [shipments, selectedFactory]);

//   const maxTons = Math.max(
//     ...activityData.flatMap(d => [d.todayTons, d.yesterdayTons]),
//     1
//   );

//   const getHeight = (tons: number) => {
//     if (tons === 0) return 0;
//     return Math.max(6, (tons / maxTons) * 24);
//   };

//   const formatTons = (tons: number): string => {
//     return Math.round(tons).toString();
//   };

//   return (
//     <div className="activity-chart-wrapper">
//       <div className="activity-chart-title">Активность за 24 часа (сегодня/вчера)</div>
//       <div className="activity-chart-bars-row">
//         {activityData.map((item, idx) => {
//           const todayHeight = getHeight(item.todayTons);
//           const yesterdayHeight = getHeight(item.yesterdayTons);
          
//           return (
//             <div key={idx} className="activity-chart-bar-wrapper">
//               <div className="activity-chart-bars-stack">
//                 {item.todayTons > 0 && (
//                   <div 
//                     className="activity-chart-bar today"
//                     style={{ height: `${todayHeight}px` }}
//                     title={`${item.period}: сегодня ${item.todayTons} т`}
//                   />
//                 )}
//                 {item.yesterdayTons > 0 && (
//                   <div 
//                     className="activity-chart-bar yesterday"
//                     style={{ height: `${yesterdayHeight}px` }}
//                     title={`${item.period}: вчера ${item.yesterdayTons} т`}
//                   />
//                 )}
//                 {!item.todayTons && !item.yesterdayTons && (
//                   <div className="activity-chart-bar empty" style={{ height: '2px' }} />
//                 )}
//               </div>
//               {item.todayTons > 0 && (
//                 <div className="activity-chart-bar-value today-value">
//                   {formatTons(item.todayTons)}
//                 </div>
//               )}
//               <div className="activity-chart-label">
//                 {item.period}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//       <div className="activity-chart-legend">
//         <span className="legend-today">■ Сегодня</span>
//         <span className="legend-yesterday">■ Вчера</span>
//       </div>
//     </div>
//   );
// }





// 'use client';

// import { ShipmentItem } from '@/app/page';
// import { useEffect, useState, useRef } from 'react';

// interface ActivityChartProps {
//   shipments: ShipmentItem[];
//   selectedFactory: string;
// }

// export default function ActivityChart({ shipments, selectedFactory }: ActivityChartProps) {
//   const [activityData, setActivityData] = useState<Array<{ 
//     period: string; 
//     startHour: number;
//     totalTons: number;
//     hasActivity: boolean;
//   }>>([]);
//   const isMounted = useRef(true);

//   useEffect(() => {
//     isMounted.current = true;
    
//     // Получаем текущее время
//     const now = new Date();
//     const currentHour = now.getHours();
    
//     // Определяем текущий 2-часовой блок
//     const currentBlockStart = Math.floor(currentHour / 2) * 2;
    
//     // Создаём 12 периодов (последние 24 часа) от текущего блока назад
//     const periods = [];
//     for (let i = 11; i >= 0; i--) {
//       let startHour = currentBlockStart - i * 2;
//       if (startHour < 0) startHour += 24;
//       const endHour = startHour + 2;
//       const periodLabel = `${startHour.toString().padStart(2, '0')}-${endHour.toString().padStart(2, '0')}`;
//       periods.push({
//         startHour: startHour,
//         endHour: endHour,
//         period: periodLabel,
//       });
//     }
    
//     // Фильтруем по заводу (используем короткие коды ЛХ/ЛЮ)
//     let filteredShipments = shipments;
//     if (selectedFactory === 'ЛХ') {
//       filteredShipments = shipments.filter(s => s.division === 'ЛХ');
//     } else if (selectedFactory === 'ЛЮ') {
//       filteredShipments = shipments.filter(s => s.division === 'ЛЮ');
//     }
    
//     // Фильтруем отгрузки за последние 24 часа от текущего момента
//     const last24Hours = filteredShipments.filter(s => {
//       const shipmentDate = new Date(s.date);
//       const diffHours = (now.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60);
//       return diffHours <= 24;
//     });
    
//     // Считаем тонны по периодам
//     const activity: { [key: number]: { tons: number } } = {};
    
//     for (const shipment of last24Hours) {
//       const shipmentDate = new Date(shipment.date);
//       const shipmentHour = shipmentDate.getHours();
//       const blockStart = Math.floor(shipmentHour / 2) * 2;
      
//       if (!activity[blockStart]) {
//         activity[blockStart] = { tons: 0 };
//       }
//       activity[blockStart].tons += shipment.quantity;
//     }
    
//     // Формируем результат
//     const result = periods.map(p => {
//       const act = activity[p.startHour];
//       const hasActivity = act && act.tons > 0;
//       return {
//         period: p.period,
//         startHour: p.startHour,
//         totalTons: act?.tons || 0,
//         hasActivity: hasActivity || false,
//       };
//     });
    
//     if (isMounted.current) {
//       setActivityData(result);
//     }
    
//     return () => {
//       isMounted.current = false;
//     };
//   }, [shipments, selectedFactory]);

//   const activeTons = activityData.filter(d => d.hasActivity).map(d => d.totalTons);
//   const maxTons = activeTons.length > 0 ? Math.max(...activeTons) : 1;

//   const getHeight = (tons: number, hasActivity: boolean) => {
//     if (!hasActivity) return 2;
//     return Math.max(6, (tons / maxTons) * 24);
//   };

//   const formatTons = (tons: number): string => {
//     return Math.round(tons).toString();
//   };

//   // Определяем, является ли период текущим
//   const isCurrentPeriod = (startHour: number): boolean => {
//     const now = new Date();
//     const currentHour = now.getHours();
//     const currentBlockStart = Math.floor(currentHour / 2) * 2;
//     return startHour === currentBlockStart;
//   };

//   return (
//     <div className="activity-chart-wrapper">
//       <div className="activity-chart-title">Активность за 24 часа</div>
//       <div className="activity-chart-bars-row">
//         {activityData.map((item, idx) => {
//           const height = getHeight(item.totalTons, item.hasActivity);
//           const isCurrent = isCurrentPeriod(item.startHour);
          
//           return (
//             <div key={idx} className="activity-chart-bar-wrapper">
//               {item.hasActivity && (
//                 <div className={`activity-chart-bar-value ${isCurrent ? 'current' : ''}`}>
//                   {formatTons(item.totalTons)}
//                 </div>
//               )}
//               <div 
//                 className={`activity-chart-bar ${item.hasActivity ? 'active' : 'inactive'} ${isCurrent ? 'current-bar' : ''}`}
//                 style={{ height: `${height}px` }}
//                 title={`${item.period}: ${item.totalTons} т`}
//               />
//             </div>
//           );
//         })}
//       </div>
//       <div className="activity-chart-labels-row">
//         {activityData.map((item, idx) => {
//           const isCurrent = isCurrentPeriod(item.startHour);
//           return (
//             <div key={idx} className="activity-chart-label-wrapper">
//               <span className={`activity-chart-label ${item.hasActivity ? 'active-label' : 'inactive-label'} ${isCurrent ? 'current-label' : ''}`}>
//                 {item.period}
//               </span>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }




// 'use client';

// import { ShipmentItem } from '@/app/page';
// import { useEffect, useState, useRef } from 'react';

// interface ActivityChartProps {
//   shipments: ShipmentItem[];
//   selectedFactory: string;
// }

// export default function ActivityChart({ shipments, selectedFactory }: ActivityChartProps) {

//   console.log('🎯 ActivityChart received shipments:', shipments.length);
//   console.log('🎯 ActivityChart sample:', shipments.slice(0, 3));

//   const [activityData, setActivityData] = useState<Array<{ 
//     period: string; 
//     startHour: number;
//     totalTons: number;
//     hasActivity: boolean;
//   }>>([]);
//   const isMounted = useRef(true);

//   useEffect(() => {
//     isMounted.current = true;
    
//     // Получаем текущее время
//     const now = new Date();
//     const currentHour = now.getHours();
//     const currentMinute = now.getMinutes();
    
//     // Определяем текущий 2-часовой блок
//     let currentBlockStart;
//     if (currentHour % 2 === 0) {
//       currentBlockStart = currentHour;
//     } else {
//       currentBlockStart = currentHour - 1;
//     }
    
//     // Создаём 12 периодов (последние 24 часа) от текущего блока назад
//     const periods = [];
//     for (let i = 11; i >= 0; i--) {
//       let startHour = currentBlockStart - i * 2;
//       if (startHour < 0) startHour += 24;
//       const endHour = startHour + 2;
//       const periodLabel = `${startHour.toString().padStart(2, '0')}-${endHour.toString().padStart(2, '0')}`;
//       periods.push({
//         startHour: startHour,
//         endHour: endHour,
//         period: periodLabel,
//       });
//     }
    
//     // Фильтруем по заводу
//     // let filteredShipments = shipments;
//     // if (selectedFactory === 'ЛХ') {
//     //   filteredShipments = shipments.filter(s => s.division === 'Луховицы');
//     // } else if (selectedFactory === 'ЛЮ') {
//     //   filteredShipments = shipments.filter(s => s.division === 'Люберцы');
//     // }
    

//     // В useEffect внутри ActivityChart
// let filteredShipments = shipments;
// if (selectedFactory === 'ЛХ') {
//   filteredShipments = shipments.filter(s => s.division === 'ЛХ');
//   console.log('Filtered for ЛХ:', filteredShipments.length);
// } else if (selectedFactory === 'ЛЮ') {
//   filteredShipments = shipments.filter(s => s.division === 'ЛЮ');
//   console.log('Filtered for ЛЮ:', filteredShipments.length);
// }



//     // Фильтруем отгрузки за последние 24 часа от текущего момента
//     const last24Hours = filteredShipments.filter(s => {
//       const shipmentDate = new Date(s.date);
//       const diffHours = (now.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60);
//       return diffHours <= 24;
//     });
    
//     // Считаем тонны по периодам
//     const activity: { [key: number]: { tons: number } } = {};
    
//     for (const shipment of last24Hours) {
//       const shipmentDate = new Date(shipment.date);
//       const shipmentHour = shipmentDate.getHours();
//       // Определяем начало 2-часового блока для отгрузки
//       const blockStart = Math.floor(shipmentHour / 2) * 2;
      
//       if (!activity[blockStart]) {
//         activity[blockStart] = { tons: 0 };
//       }
//       activity[blockStart].tons += shipment.quantity;
//     }
    
//     // Формируем результат
//     const result = periods.map(p => {
//       const act = activity[p.startHour];
//       const hasActivity = act && act.tons > 0;
//       return {
//         period: p.period,
//         startHour: p.startHour,
//         totalTons: act?.tons || 0,
//         hasActivity: hasActivity || false,
//       };
//     });
    
//     if (isMounted.current) {
//       setActivityData(result);
//     }
    
//     return () => {
//       isMounted.current = false;
//     };
//   }, [shipments, selectedFactory]);

//   const activeTons = activityData.filter(d => d.hasActivity).map(d => d.totalTons);
//   const maxTons = activeTons.length > 0 ? Math.max(...activeTons) : 1;

//   const getHeight = (tons: number, hasActivity: boolean) => {
//     if (!hasActivity) return 2;
//     return Math.max(6, (tons / maxTons) * 24);
//   };

//   const formatTons = (tons: number): string => {
//     return Math.round(tons).toString();
//   };

//   // Определяем, является ли период текущим
//   const isCurrentPeriod = (startHour: number): boolean => {
//     const now = new Date();
//     const currentHour = now.getHours();
//     const currentBlockStart = Math.floor(currentHour / 2) * 2;
//     return startHour === currentBlockStart;
//   };

//   return (
//     <div className="activity-chart-wrapper">
//       <div className="activity-chart-title">Активность за 24 часа</div>
//       <div className="activity-chart-bars-row">
//         {activityData.map((item, idx) => {
//           const height = getHeight(item.totalTons, item.hasActivity);
//           const isCurrent = isCurrentPeriod(item.startHour);
          
//           return (
//             <div key={idx} className="activity-chart-bar-wrapper">
//               {item.hasActivity && (
//                 <div className={`activity-chart-bar-value ${isCurrent ? 'current' : ''}`}>
//                   {formatTons(item.totalTons)}
//                 </div>
//               )}
//               <div 
//                 className={`activity-chart-bar ${item.hasActivity ? 'active' : 'inactive'} ${isCurrent ? 'current-bar' : ''}`}
//                 style={{ height: `${height}px` }}
//                 title={`${item.period}: ${item.totalTons} т`}
//               />
//             </div>
//           );
//         })}
//       </div>
//       <div className="activity-chart-labels-row">
//         {activityData.map((item, idx) => {
//           const isCurrent = isCurrentPeriod(item.startHour);
//           return (
//             <div key={idx} className="activity-chart-label-wrapper">
//               <span className={`activity-chart-label ${item.hasActivity ? 'active-label' : 'inactive-label'} ${isCurrent ? 'current-label' : ''}`}>
//                 {item.period}
//               </span>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

