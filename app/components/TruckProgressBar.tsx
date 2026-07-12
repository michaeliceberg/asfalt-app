// app/components/TruckProgressBar.tsx

'use client';

import { Truck, CheckCircle2, Clock, Phone } from 'lucide-react';

interface TruckProgressBarProps {
  licensePlate: string;
  driver: string;
  // Только в демо — в боевых данных телефона водителя сейчас нет.
  driverPhone?: string;
  quantity: number;
  time: string;
  distance: number | null;
  etaMinutes: number | null;
  totalDistance: number;
  isArrived: boolean;
  unit?: string;
  factoryCode: string;
}

const FACTORY_COLORS: Record<string, { line: string; bg: string }> = {
  'ЛХ': { line: '#22c55e', bg: 'rgba(34, 197, 94, 0.06)' },
  'ЛЮ': { line: '#3b82f6', bg: 'rgba(59, 130, 246, 0.06)' },
  'СП': { line: '#eab308', bg: 'rgba(234, 179, 8, 0.06)' },
  'Щ': { line: '#ef4444', bg: 'rgba(239, 68, 68, 0.06)' },
};

export default function TruckProgressBar({
  licensePlate,
  driver,
  driverPhone,
  quantity,
  time,
  distance,
  etaMinutes,
  totalDistance,
  isArrived,
  unit = 'т',
  factoryCode,
}: TruckProgressBarProps) {
  let progress = 0;
  let infoText = 'Нет данных';

  if (isArrived) {
    progress = 100;
    infoText = 'Прибыл';
  } else if (distance !== null && totalDistance > 0) {
    const rawProgress = ((totalDistance - distance) / totalDistance) * 100;
    progress = Math.max(0, Math.min(100, rawProgress));
    
    const kmText = Math.round(distance);
    const mins = etaMinutes ?? 0;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    let timeStr = '';
    if (hours > 0) timeStr += `${hours}ч `;
    if (minutes > 0 || hours === 0) timeStr += `${minutes}мин`;
    if (!timeStr) timeStr = '0мин';
    
    infoText = `${kmText} км · ${timeStr}`;
  }
  
  const colors = FACTORY_COLORS[factoryCode] || FACTORY_COLORS['ЛХ'];
  const driverLastName = driver.split(' ')[0] || driver;
  
  return (
    <div className="truck-card" style={{ background: colors.bg }}>
      {/* Строка 1: время + статус/ETA — короткая пара, всегда помещается
          в одну линию сама по себе. */}
      <div className="truck-row-top">
        <span className="truck-time-badge">{time}</span>
        <span className={`truck-info ${isArrived ? 'arrived' : ''}`}>
          {isArrived ? (
            <CheckCircle2 size={11} strokeWidth={2.4} style={{ marginRight: 3, verticalAlign: -1 }} />
          ) : distance !== null ? (
            <Clock size={11} strokeWidth={2.4} style={{ marginRight: 3, verticalAlign: -1 }} />
          ) : null}
          {infoText}
        </span>
      </div>

      {/* Строка 2: номер, тоннаж, водитель (+ телефон) — отдельная строка.
          Раньше всё это (плюс время) было в одном флекс-ряду с ETA справа:
          на узких экранах номер/ФИО переносились на вторую строку внутри
          того же ряда, а ETA-текст справа центрировался по всей высоте
          ряда и наезжал прямо на перенесённую строку. Теперь у времени/
          статуса и у номера/водителя — гарантированно разные строки. */}
      <div className="truck-row-bottom">
        <span className="truck-plate">{licensePlate}</span>
        <span className="truck-quantity">{quantity.toFixed(1)} {unit}</span>
        <span className="truck-driver">{driverLastName}</span>
        {driverPhone && (
          <a
            className="truck-phone"
            href={`tel:${driverPhone.replace(/[^\d+]/g, '')}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Phone size={10} strokeWidth={2.4} />
            {driverPhone}
          </a>
        )}
      </div>

      {/* Прогресс-бар */}
      <div className="progress-track">
        <div className="progress-bg" />
        
        <div 
          className="progress-fill"
          style={{ 
            width: `${Math.min(progress, 100)}%`,
            background: isArrived ? '#22c55e' : colors.line
          }}
        />
        
        <div 
          className="progress-dashed"
          style={{ 
            left: `${Math.min(progress, 100)}%`,
            width: `${100 - Math.min(progress, 100)}%`,
          }}
        />
        
        {/* 🚛 Машина (только если не прибыла) */}
        {!isArrived && progress < 100 && (
          <div className="truck-marker" style={{ left: `${Math.min(progress, 98)}%` }}>
            <Truck 
              size={14} 
              color={colors.line} 
              strokeWidth={2} 
              fill="#1a1a2e"
              style={{ display: 'block' }}
            />
          </div>
        )}
        
        {/* ✅ Прибыл — показываем только текст, галочку на баре убираем */}
      </div>
      
      <style jsx>{`
        .truck-card {
          padding: 6px 10px;
          border-radius: 6px;
          margin-bottom: 4px;
          border: 1px solid rgba(0,0,0,0.04);
        }
        
        .truck-row-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }

        .truck-row-bottom {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }

        .truck-time-badge {
          font-size: 10px;
          font-weight: 600;
          color: #1a1a2e;
          background: #ffffff;
          padding: 0 6px;
          border-radius: 3px;
          border: 1px solid rgba(0,0,0,0.06);
          line-height: 18px;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        
        .truck-plate {
          font-weight: 700;
          font-size: 11px;
          color: #1a1a2e;
          background: #ffffff;
          padding: 0 6px;
          border-radius: 3px;
          border: 1px solid rgba(0,0,0,0.06);
          line-height: 18px;
          white-space: nowrap;
          letter-spacing: 0.2px;
        }
        
        .truck-quantity {
          font-size: 11px;
          font-weight: 700;
          color: #1e293b;
          background: #ffffff;
          padding: 0 6px;
          border-radius: 3px;
          border: 1px solid rgba(0,0,0,0.06);
          line-height: 18px;
          white-space: nowrap;
        }
        
        .truck-driver {
          font-size: 10px;
          color: #64748b;
          white-space: nowrap;
        }

        .truck-phone {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10px;
          font-weight: 600;
          color: #2563eb;
          text-decoration: none;
          white-space: nowrap;
          background: #ffffff;
          padding: 0 6px;
          border-radius: 3px;
          border: 1px solid rgba(37,99,235,0.18);
          line-height: 18px;
        }

        .truck-phone:hover {
          background: #eff6ff;
        }

        .truck-info {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          min-width: 70px;
          text-align: right;
          white-space: nowrap;
        }
        
        .truck-info.arrived {
          color: #22c55e;
        }
        
        .progress-track {
          position: relative;
          height: 3px;
          border-radius: 2px;
          overflow: visible;
          background: #e2e8f0;
        }
        
        .progress-bg {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background: #e2e8f0;
          border-radius: 2px;
        }
        
        .progress-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 2px;
          transition: width 1s ease-in-out;
          z-index: 1;
        }
        
        .progress-dashed {
          position: absolute;
          top: 0;
          height: 100%;
          background: repeating-linear-gradient(
            90deg,
            #cbd5e1,
            #cbd5e1 2px,
            transparent 2px,
            transparent 5px
          );
          border-radius: 2px;
          transition: left 1s ease-in-out;
          z-index: 0;
        }
        
        .truck-marker {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 3;
          transition: left 1s ease-in-out;
        }
        
        /* Анимация для прибывшей машины (только текст, без галочки на баре) */
        @keyframes pulse-green {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
        
        .truck-info.arrived {
          animation: pulse-green 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}





// // app/components/TruckProgressBar.tsx

// 'use client';

// import { Truck } from 'lucide-react';

// interface TruckProgressBarProps {
//   licensePlate: string;
//   driver: string;
//   quantity: number;
//   time: string;
//   distance: number | null;
//   etaMinutes: number | null;
//   totalDistance: number;
//   isArrived: boolean;
//   unit?: string;
//   factoryCode: string;
// }

// const FACTORY_COLORS: Record<string, { line: string; bg: string }> = {
//   'ЛХ': { line: '#22c55e', bg: 'rgba(34, 197, 94, 0.06)' },
//   'ЛЮ': { line: '#3b82f6', bg: 'rgba(59, 130, 246, 0.06)' },
//   'СП': { line: '#eab308', bg: 'rgba(234, 179, 8, 0.06)' },
//   'Щ': { line: '#ef4444', bg: 'rgba(239, 68, 68, 0.06)' },
// };

// export default function TruckProgressBar({
//   licensePlate,
//   driver,
//   quantity,
//   time,
//   distance,
//   etaMinutes,
//   totalDistance,
//   isArrived,
//   unit = 'т',
//   factoryCode,
// }: TruckProgressBarProps) {
//   let progress = 0;
//   let infoText = '⏳ Нет данных';
  
//   if (isArrived) {
//     progress = 100;
//     infoText = '✅ Прибыл';
//   } else if (distance !== null && totalDistance > 0) {
//     const rawProgress = ((totalDistance - distance) / totalDistance) * 100;
//     progress = Math.max(0, Math.min(100, rawProgress));
    
//     // Округляем км до целых
//     const kmText = Math.round(distance);
    
//     // Форматируем время
//     const mins = etaMinutes ?? 0;
//     const hours = Math.floor(mins / 60);
//     const minutes = mins % 60;
//     let timeStr = '';
//     if (hours > 0) timeStr += `${hours}ч `;
//     if (minutes > 0 || hours === 0) timeStr += `${minutes}мин`;
//     if (!timeStr) timeStr = '0мин';
    
//     infoText = `${kmText} км · ${timeStr}`;
//   }
  
//   const colors = FACTORY_COLORS[factoryCode] || FACTORY_COLORS['ЛХ'];
  
//   // Извлекаем фамилию (без инициалов)
//   const driverLastName = driver.split(' ')[0] || driver;
  
//   return (
//     <div className="truck-card" style={{ background: colors.bg }}>
//       <div className="truck-row">
//         <div className="truck-left">
//           <span className="truck-time">{time}</span>
//           <span className="truck-plate">{licensePlate}</span>
//           <span className="truck-quantity">{quantity.toFixed(1)} {unit}</span>
//           <span className="truck-driver">{driverLastName}</span>
//         </div>
//         <div className="truck-right">
//           <span className={`truck-info ${isArrived ? 'arrived' : ''}`}>
//             {infoText}
//           </span>
//         </div>
//       </div>
      
//       <div className="progress-track">
//         <div className="progress-bg" />
        
//         <div 
//           className="progress-fill"
//           style={{ 
//             width: `${Math.min(progress, 100)}%`,
//             background: isArrived ? '#22c55e' : colors.line
//           }}
//         />
        
//         <div 
//           className="progress-dashed"
//           style={{ 
//             left: `${Math.min(progress, 100)}%`,
//             width: `${100 - Math.min(progress, 100)}%`,
//           }}
//         />
        
//         {!isArrived && progress < 100 && (
//           <div className="truck-marker" style={{ left: `${Math.min(progress, 98)}%` }}>
//             <Truck 
//               size={14} 
//               color={colors.line} 
//               strokeWidth={2} 
//               fill="#1a1a2e"
//               style={{ display: 'block' }}
//             />
//           </div>
//         )}
        
//         {isArrived && (
//           <div className="truck-marker arrived" style={{ left: '98%' }}>
//             <span style={{ fontSize: 14 }}>✅</span>
//           </div>
//         )}
//       </div>
      
//       <style jsx>{`
//         .truck-card {
//           padding: 8px 10px;
//           border-radius: 6px;
//           margin-bottom: 6px;
//           border: 1px solid rgba(0,0,0,0.04);
//         }
        
//         .truck-row {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           flex-wrap: wrap;
//           gap: 2px 6px;
//           margin-bottom: 4px;
//         }
        
//         .truck-left {
//           display: flex;
//           align-items: center;
//           gap: 8px;
//           flex-wrap: wrap;
//         }
        
//         .truck-time {
//           font-size: 11px;
//           color: #64748b;
//           font-weight: 500;
//           white-space: nowrap;
//         }
        
//         .truck-plate {
//           font-weight: 700;
//           font-size: 12px;
//           color: #1a1a2e;
//           background: #ffffff;
//           padding: 0 6px;
//           border-radius: 3px;
//           letter-spacing: 0.2px;
//           border: 1px solid rgba(0,0,0,0.06);
//           line-height: 20px;
//           white-space: nowrap;
//         }
        
//         .truck-quantity {
//           font-size: 12px;
//           font-weight: 700;
//           color: #1e293b;
//           background: #ffffff;
//           padding: 0 6px;
//           border-radius: 3px;
//           border: 1px solid rgba(0,0,0,0.06);
//           line-height: 20px;
//           white-space: nowrap;
//         }
        
//         .truck-driver {
//           font-size: 11px;
//           color: #64748b;
//           white-space: nowrap;
//         }
        
//         .truck-right {
//           display: flex;
//           align-items: center;
//           gap: 8px;
//           flex-wrap: wrap;
//         }
        
//         .truck-info {
//           font-size: 11px;
//           font-weight: 600;
//           color: #94a3b8;
//           min-width: 80px;
//           text-align: right;
//           white-space: nowrap;
//         }
        
//         .truck-info.arrived {
//           color: #22c55e;
//         }
        
//         .progress-track {
//           position: relative;
//           height: 3px;
//           border-radius: 2px;
//           overflow: visible;
//           background: #e2e8f0;
//         }
        
//         .progress-bg {
//           position: absolute;
//           left: 0;
//           top: 0;
//           width: 100%;
//           height: 100%;
//           background: #e2e8f0;
//           border-radius: 2px;
//         }
        
//         .progress-fill {
//           position: absolute;
//           left: 0;
//           top: 0;
//           height: 100%;
//           border-radius: 2px;
//           transition: width 1s ease-in-out;
//           z-index: 1;
//         }
        
//         .progress-dashed {
//           position: absolute;
//           top: 0;
//           height: 100%;
//           background: repeating-linear-gradient(
//             90deg,
//             #cbd5e1,
//             #cbd5e1 2px,
//             transparent 2px,
//             transparent 5px
//           );
//           border-radius: 2px;
//           transition: left 1s ease-in-out;
//           z-index: 0;
//         }
        
//         .truck-marker {
//           position: absolute;
//           top: 50%;
//           transform: translate(-50%, -50%);
//           z-index: 3;
//           transition: left 1s ease-in-out;
//         }
        
//         .truck-marker.arrived {
//           transform: translate(-50%, -50%);
//         }
        
//         @keyframes pulse-green {
//           0% { transform: translate(-50%, -50%) scale(1); }
//           50% { transform: translate(-50%, -50%) scale(1.2); }
//           100% { transform: translate(-50%, -50%) scale(1); }
//         }
        
//         .truck-marker.arrived {
//           animation: pulse-green 1.5s ease-in-out infinite;
//         }
//       `}</style>
//     </div>
//   );
// }





// // app/components/TruckProgressBar.tsx

// 'use client';

// import { Truck } from 'lucide-react';

// interface TruckProgressBarProps {
//   licensePlate: string;
//   driver: string;
//   quantity: number;
//   time: string;
//   distance: number | null;
//   etaMinutes: number | null;
//   totalDistance: number;
//   isArrived: boolean;
//   unit?: string;
//   factoryCode: string;
// }

// const FACTORY_COLORS: Record<string, { line: string; bg: string }> = {
//   'ЛХ': { line: '#22c55e', bg: 'rgba(34, 197, 94, 0.06)' },
//   'ЛЮ': { line: '#3b82f6', bg: 'rgba(59, 130, 246, 0.06)' },
//   'СП': { line: '#eab308', bg: 'rgba(234, 179, 8, 0.06)' },
//   'Щ': { line: '#ef4444', bg: 'rgba(239, 68, 68, 0.06)' },
// };

// export default function TruckProgressBar({
//   licensePlate,
//   driver,
//   quantity,
//   time,
//   distance,
//   etaMinutes,
//   totalDistance,
//   isArrived,
//   unit = 'т',
//   factoryCode,
// }: TruckProgressBarProps) {
//   let progress = 0;
//   let infoText = '⏳ Нет данных';
  
//   if (isArrived) {
//     progress = 100;
//     infoText = '✅ Прибыл';
//   } else if (distance !== null && totalDistance > 0) {
//     const rawProgress = ((totalDistance - distance) / totalDistance) * 100;
//     progress = Math.max(0, Math.min(100, rawProgress));
    
//     // Форматируем время
//     const mins = etaMinutes ?? 0;
//     const hours = Math.floor(mins / 60);
//     const minutes = mins % 60;
//     let timeStr = '';
//     if (hours > 0) timeStr += `${hours}ч `;
//     if (minutes > 0 || hours === 0) timeStr += `${minutes}м`;
//     if (!timeStr) timeStr = '0м';
    
//     infoText = `${distance.toFixed(1)} км · ${timeStr}`;
//   }
  
//   const colors = FACTORY_COLORS[factoryCode] || FACTORY_COLORS['ЛХ'];
  
//   return (
//     <div className="truck-card" style={{ background: colors.bg }}>
//       {/* Верхняя строка — вся информация */}
//       <div className="truck-row">
//         <div className="truck-left">
//           <span className="truck-plate">{licensePlate}</span>
//           <span className="truck-time">{time}</span>
//           <span className="truck-driver">👤 {driver}</span>
//         </div>
//         <div className="truck-right">
//           <span className="truck-quantity">{quantity.toFixed(1)} {unit}</span>
//           <span className={`truck-info ${isArrived ? 'arrived' : ''}`}>
//             {infoText}
//           </span>
//         </div>
//       </div>
      
//       {/* Прогресс-бар */}
//       <div className="progress-track">
//         <div className="progress-bg" />
        
//         <div 
//           className="progress-fill"
//           style={{ 
//             width: `${Math.min(progress, 100)}%`,
//             background: isArrived ? '#22c55e' : colors.line
//           }}
//         />
        
//         <div 
//           className="progress-dashed"
//           style={{ 
//             left: `${Math.min(progress, 100)}%`,
//             width: `${100 - Math.min(progress, 100)}%`,
//           }}
//         />
        
//         {!isArrived && progress < 100 && (
//           <div className="truck-marker" style={{ left: `${Math.min(progress, 98)}%` }}>
//             <Truck 
//               size={14} 
//               color={colors.line} 
//               strokeWidth={2} 
//               fill="#1a1a2e"
//               style={{ display: 'block' }}
//             />
//           </div>
//         )}
        
//         {isArrived && (
//           <div className="truck-marker arrived" style={{ left: '98%' }}>
//             <span style={{ fontSize: 14 }}>✅</span>
//           </div>
//         )}
//       </div>
      
//       <style jsx>{`
//         .truck-card {
//           padding: 8px 10px;
//           border-radius: 6px;
//           margin-bottom: 6px;
//           border: 1px solid rgba(0,0,0,0.04);
//         }
        
//         .truck-row {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           flex-wrap: wrap;
//           gap: 2px 6px;
//           margin-bottom: 4px;
//         }
        
//         .truck-left {
//           display: flex;
//           align-items: center;
//           gap: 8px;
//           flex-wrap: wrap;
//         }
        
//         .truck-plate {
//           font-weight: 700;
//           font-size: 12px;
//           color: #1a1a2e;
//           background: #ffffff;
//           padding: 0 6px;
//           border-radius: 3px;
//           letter-spacing: 0.2px;
//           border: 1px solid rgba(0,0,0,0.06);
//           line-height: 20px;
//           white-space: nowrap;
//         }
        
//         .truck-time {
//           font-size: 11px;
//           color: #64748b;
//           font-weight: 500;
//           white-space: nowrap;
//         }
        
//         .truck-driver {
//           font-size: 11px;
//           color: #64748b;
//           white-space: nowrap;
//         }
        
//         .truck-right {
//           display: flex;
//           align-items: center;
//           gap: 8px;
//           flex-wrap: wrap;
//         }
        
//         .truck-quantity {
//           font-size: 12px;
//           font-weight: 700;
//           color: #1e293b;
//           background: #ffffff;
//           padding: 0 6px;
//           border-radius: 3px;
//           border: 1px solid rgba(0,0,0,0.06);
//           line-height: 20px;
//           white-space: nowrap;
//         }
        
//         .truck-info {
//           font-size: 11px;
//           font-weight: 600;
//           color: #94a3b8;
//           min-width: 80px;
//           text-align: right;
//           white-space: nowrap;
//         }
        
//         .truck-info.arrived {
//           color: #22c55e;
//         }
        
//         .progress-track {
//           position: relative;
//           height: 3px;
//           border-radius: 2px;
//           overflow: visible;
//           background: #e2e8f0;
//         }
        
//         .progress-bg {
//           position: absolute;
//           left: 0;
//           top: 0;
//           width: 100%;
//           height: 100%;
//           background: #e2e8f0;
//           border-radius: 2px;
//         }
        
//         .progress-fill {
//           position: absolute;
//           left: 0;
//           top: 0;
//           height: 100%;
//           border-radius: 2px;
//           transition: width 1s ease-in-out;
//           z-index: 1;
//         }
        
//         .progress-dashed {
//           position: absolute;
//           top: 0;
//           height: 100%;
//           background: repeating-linear-gradient(
//             90deg,
//             #cbd5e1,
//             #cbd5e1 2px,
//             transparent 2px,
//             transparent 5px
//           );
//           border-radius: 2px;
//           transition: left 1s ease-in-out;
//           z-index: 0;
//         }
        
//         .truck-marker {
//           position: absolute;
//           top: 50%;
//           transform: translate(-50%, -50%);
//           z-index: 3;
//           transition: left 1s ease-in-out;
//         }
        
//         .truck-marker.arrived {
//           transform: translate(-50%, -50%);
//         }
        
//         @keyframes pulse-green {
//           0% { transform: translate(-50%, -50%) scale(1); }
//           50% { transform: translate(-50%, -50%) scale(1.2); }
//           100% { transform: translate(-50%, -50%) scale(1); }
//         }
        
//         .truck-marker.arrived {
//           animation: pulse-green 1.5s ease-in-out infinite;
//         }
//       `}</style>
//     </div>
//   );
// }






// // app/components/TruckProgressBar.tsx

// 'use client';

// import { Truck } from 'lucide-react';

// interface TruckProgressBarProps {
//   licensePlate: string;
//   driver: string;
//   quantity: number;
//   time: string;
//   distance: number | null;
//   totalDistance: number;
//   isArrived: boolean;
//   unit?: string;
//   factoryCode: string;
// }

// const FACTORY_COLORS: Record<string, { line: string; dot: string; bg: string }> = {
//   'ЛХ': { line: '#22c55e', dot: '#22c55e', bg: 'rgba(34, 197, 94, 0.06)' },
//   'ЛЮ': { line: '#3b82f6', dot: '#3b82f6', bg: 'rgba(59, 130, 246, 0.06)' },
//   'СП': { line: '#eab308', dot: '#eab308', bg: 'rgba(234, 179, 8, 0.06)' },
//   'Щ': { line: '#ef4444', dot: '#ef4444', bg: 'rgba(239, 68, 68, 0.06)' },
// };

// export default function TruckProgressBar({
//   licensePlate,
//   driver,
//   quantity,
//   time,
//   distance,
//   totalDistance,
//   isArrived,
//   unit = 'т',
//   factoryCode,
// }: TruckProgressBarProps) {
//   let progress = 0;
//   let distanceText = '⏳ Нет данных';
  
//   if (isArrived) {
//     progress = 100;
//     distanceText = '✅ Прибыл';
//   } else if (distance !== null && totalDistance > 0) {
//     const rawProgress = ((totalDistance - distance) / totalDistance) * 100;
//     progress = Math.max(0, Math.min(100, rawProgress));
//     distanceText = `${distance.toFixed(1)} км`;
//   }
  
//   const colors = FACTORY_COLORS[factoryCode] || FACTORY_COLORS['ЛХ'];
  
//   return (
//     <div className="truck-card" style={{ background: colors.bg }}>
//       {/* Верхняя строка — вся информация */}
//       <div className="truck-row">
//         <div className="truck-left">
//           <span className="truck-plate">{licensePlate}</span>
//           <span className="truck-time">{time}</span>
//           <span className="truck-driver">👤 {driver}</span>
//         </div>
//         <div className="truck-right">
//           <span className="truck-quantity">{quantity.toFixed(1)} {unit}</span>
//           <span className={`truck-distance ${isArrived ? 'arrived' : ''}`}>
//             {distanceText}
//           </span>
//         </div>
//       </div>
      
//       {/* Прогресс-бар */}
//       <div className="progress-track">
//         <div className="progress-bg" />
        
//         <div 
//           className="progress-fill"
//           style={{ 
//             width: `${Math.min(progress, 100)}%`,
//             background: isArrived ? '#22c55e' : colors.line
//           }}
//         />
        
//         <div 
//           className="progress-dashed"
//           style={{ 
//             left: `${Math.min(progress, 100)}%`,
//             width: `${100 - Math.min(progress, 100)}%`,
//           }}
//         />
        
//         {!isArrived && progress < 100 && (
//           <div className="truck-marker" style={{ left: `${Math.min(progress, 98)}%` }}>
//             <Truck size={16} color={colors.line} strokeWidth={2.5} fill="#1a1a2e" />
//             <span className="progress-percent">{Math.round(progress)}%</span>
//           </div>
//         )}
        
//         {isArrived && (
//           <div className="truck-marker arrived" style={{ left: '98%' }}>
//             <span style={{ fontSize: 16 }}>✅</span>
//           </div>
//         )}
//       </div>
      
//       <style jsx>{`
//         .truck-card {
//           padding: 10px 12px;
//           border-radius: 8px;
//           margin-bottom: 8px;
//           border: 1px solid rgba(0,0,0,0.04);
//           transition: background 0.2s;
//         }
        
//         .truck-card:hover {
//           background: ${colors.bg.replace('0.06', '0.10')};
//         }
        
//         .truck-row {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           flex-wrap: wrap;
//           gap: 4px 8px;
//           margin-bottom: 6px;
//         }
        
//         .truck-left {
//           display: flex;
//           align-items: center;
//           gap: 10px;
//           flex-wrap: wrap;
//         }
        
//         .truck-plate {
//           font-weight: 700;
//           font-size: 13px;
//           color: #1a1a2e;
//           background: #ffffff;
//           padding: 0 8px;
//           border-radius: 4px;
//           letter-spacing: 0.3px;
//           border: 1px solid rgba(0,0,0,0.06);
//           line-height: 22px;
//           white-space: nowrap;
//         }
        
//         .truck-time {
//           font-size: 12px;
//           color: #64748b;
//           font-weight: 500;
//           white-space: nowrap;
//         }
        
//         .truck-driver {
//           font-size: 12px;
//           color: #64748b;
//           white-space: nowrap;
//         }
        
//         .truck-right {
//           display: flex;
//           align-items: center;
//           gap: 10px;
//           flex-wrap: wrap;
//         }
        
//         .truck-quantity {
//           font-size: 13px;
//           font-weight: 700;
//           color: #1e293b;
//           background: #ffffff;
//           padding: 0 8px;
//           border-radius: 4px;
//           border: 1px solid rgba(0,0,0,0.06);
//           line-height: 22px;
//           white-space: nowrap;
//         }
        
//         .truck-distance {
//           font-size: 12px;
//           font-weight: 600;
//           color: #94a3b8;
//           min-width: 50px;
//           text-align: right;
//           white-space: nowrap;
//         }
        
//         .truck-distance.arrived {
//           color: #22c55e;
//         }
        
//         .progress-track {
//           position: relative;
//           height: 4px;
//           border-radius: 2px;
//           overflow: visible;
//           background: #e2e8f0;
//         }
        
//         .progress-bg {
//           position: absolute;
//           left: 0;
//           top: 0;
//           width: 100%;
//           height: 100%;
//           background: #e2e8f0;
//           border-radius: 2px;
//         }
        
//         .progress-fill {
//           position: absolute;
//           left: 0;
//           top: 0;
//           height: 100%;
//           border-radius: 2px;
//           transition: width 1s ease-in-out;
//           z-index: 1;
//         }
        
//         .progress-dashed {
//           position: absolute;
//           top: 0;
//           height: 100%;
//           background: repeating-linear-gradient(
//             90deg,
//             #cbd5e1,
//             #cbd5e1 2px,
//             transparent 2px,
//             transparent 6px
//           );
//           border-radius: 2px;
//           transition: left 1s ease-in-out;
//           z-index: 0;
//         }
        
//         .truck-marker {
//           position: absolute;
//           top: 50%;
//           transform: translate(-50%, -50%);
//           z-index: 3;
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           transition: left 1s ease-in-out;
//         }
        
//         .truck-marker.arrived {
//           transform: translate(-50%, -50%);
//         }
        
//         .progress-percent {
//           font-size: 7px;
//           font-weight: 700;
//           color: #94a3b8;
//           margin-top: 3px;
//           white-space: nowrap;
//         }
        
//         @keyframes pulse-green {
//           0% { transform: translate(-50%, -50%) scale(1); }
//           50% { transform: translate(-50%, -50%) scale(1.2); }
//           100% { transform: translate(-50%, -50%) scale(1); }
//         }
        
//         .truck-marker.arrived {
//           animation: pulse-green 1.5s ease-in-out infinite;
//         }
//       `}</style>
//     </div>
//   );
// }




// // app/components/TruckProgressBar.tsx

// 'use client';

// import { Truck } from 'lucide-react';

// interface TruckProgressBarProps {
//   licensePlate: string;
//   driver: string;
//   quantity: number;
//   time: string;
//   distance: number | null;
//   totalDistance: number;
//   isArrived: boolean;
//   unit?: string;
//   factoryCode: string;
// }

// // Цвета для заводов (более приятные)
// const FACTORY_COLORS: Record<string, { line: string; dot: string }> = {
//   'ЛХ': { line: '#22c55e', dot: '#22c55e' },
//   'ЛЮ': { line: '#3b82f6', dot: '#3b82f6' },
//   'СП': { line: '#eab308', dot: '#eab308' },
//   'Щ': { line: '#ef4444', dot: '#ef4444' },
// };

// export default function TruckProgressBar({
//   licensePlate,
//   driver,
//   quantity,
//   time,
//   distance,
//   totalDistance,
//   isArrived,
//   unit = 'т',
//   factoryCode,
// }: TruckProgressBarProps) {
//   let progress = 0;
//   let distanceText = '⏳ Нет данных';
  
//   if (isArrived) {
//     progress = 100;
//     distanceText = '✅ Прибыл';
//   } else if (distance !== null && totalDistance > 0) {
//     const rawProgress = ((totalDistance - distance) / totalDistance) * 100;
//     progress = Math.max(0, Math.min(100, rawProgress));
//     distanceText = `${distance.toFixed(1)} км`;
//   }
  
//   const colors = FACTORY_COLORS[factoryCode] || FACTORY_COLORS['ЛХ'];
  
//   return (
//     <div className="truck-progress-wrapper">
//       {/* Верхняя строка */}
//       <div className="truck-progress-header">
//         <div className="truck-info-left">
//           <span className="truck-plate">{licensePlate}</span>
//           <span className="truck-time">{time}</span>
//           <span className="truck-driver">👤 {driver}</span>
//         </div>
//         <div className="truck-info-right">
//           <span className="truck-quantity">{quantity.toFixed(1)} {unit}</span>
//           <span className={`truck-distance ${isArrived ? 'arrived' : ''}`}>
//             {distanceText}
//           </span>
//         </div>
//       </div>
      
//       {/* Прогресс-бар */}
//       <div className="progress-track">
//         {/* Фон (путь) - серый пунктир */}
//         <div className="progress-bg" />
        
//         {/* Заполненная часть - цветная сплошная */}
//         <div 
//           className="progress-fill"
//           style={{ 
//             width: `${Math.min(progress, 100)}%`,
//             background: isArrived 
//               ? '#22c55e'
//               : colors.line
//           }}
//         />
        
//         {/* Остаток пути - серый пунктир (начинается там где закончилась цветная часть) */}
//         <div 
//           className="progress-dashed"
//           style={{ 
//             left: `${Math.min(progress, 100)}%`,
//             width: `${100 - Math.min(progress, 100)}%`,
//           }}
//         />
        
//         {/* 🚛 Машина (lucide-react) */}
//         {!isArrived && progress < 100 && (
//           <div 
//             className="truck-marker"
//             style={{ 
//               left: `${Math.min(progress, 98)}%`,
//             }}
//           >
//             <Truck 
//               size={18} 
//               color={colors.line}
//               strokeWidth={2.5}
//               style={{ 
//                 fill: '#1a1a2e',
//                 display: 'block',
//               }}
//             />
//             <span className="progress-percent">{Math.round(progress)}%</span>
//           </div>
//         )}
        
//         {/* ✅ Прибыл */}
//         {isArrived && (
//           <div className="truck-marker arrived" style={{ left: '98%' }}>
//             <span style={{ fontSize: 18 }}>✅</span>
//           </div>
//         )}
//       </div>
      
//       <style jsx>{`
//         .truck-progress-wrapper {
//           padding: 6px 0;
//           border-bottom: 1px solid rgba(0,0,0,0.04);
//         }
        
//         .truck-progress-header {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           flex-wrap: wrap;
//           gap: 4px 8px;
//           margin-bottom: 4px;
//         }
        
//         .truck-info-left {
//           display: flex;
//           align-items: center;
//           gap: 10px;
//           flex-wrap: wrap;
//         }
        
//         .truck-plate {
//           font-weight: 700;
//           color: #1a1a2e;
//           font-size: 14px;
//           background: #f1f5f9;
//           padding: 0 8px;
//           border-radius: 4px;
//           letter-spacing: 0.5px;
//           white-space: nowrap;
//         }
        
//         .truck-time {
//           color: #64748b;
//           font-size: 11px;
//           font-weight: 500;
//           white-space: nowrap;
//         }
        
//         .truck-driver {
//           color: #64748b;
//           font-size: 11px;
//           white-space: nowrap;
//         }
        
//         .truck-info-right {
//           display: flex;
//           align-items: center;
//           gap: 10px;
//           flex-wrap: wrap;
//         }
        
//         .truck-quantity {
//           color: #1e293b;
//           font-weight: 700;
//           font-size: 13px;
//           background: #f8fafc;
//           padding: 0 8px;
//           border-radius: 4px;
//           white-space: nowrap;
//         }
        
//         .truck-distance {
//           color: #64748b;
//           font-size: 11px;
//           font-weight: 600;
//           min-width: 50px;
//           text-align: right;
//           white-space: nowrap;
//         }
        
//         .truck-distance.arrived {
//           color: #22c55e;
//           font-weight: 700;
//         }
        
//         .progress-track {
//           position: relative;
//           height: 4px;
//           border-radius: 2px;
//           overflow: visible;
//           margin: 6px 0 2px 0;
//           background: #e2e8f0;
//         }
        
//         .progress-bg {
//           position: absolute;
//           left: 0;
//           top: 0;
//           width: 100%;
//           height: 100%;
//           background: #e2e8f0;
//           border-radius: 2px;
//         }
        
//         .progress-fill {
//           position: absolute;
//           left: 0;
//           top: 0;
//           height: 100%;
//           border-radius: 2px;
//           transition: width 1s ease-in-out;
//           z-index: 1;
//         }
        
//         .progress-dashed {
//           position: absolute;
//           top: 0;
//           height: 100%;
//           background: repeating-linear-gradient(
//             90deg,
//             #94a3b8,
//             #94a3b8 2px,
//             transparent 2px,
//             transparent 6px
//           );
//           border-radius: 2px;
//           transition: left 1s ease-in-out;
//           z-index: 0;
//         }
        
//         .truck-marker {
//           position: absolute;
//           top: 50%;
//           transform: translate(-50%, -50%);
//           z-index: 3;
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           transition: left 1s ease-in-out;
//         }
        
//         .truck-marker.arrived {
//           transform: translate(-50%, -50%);
//         }
        
//         .progress-percent {
//           font-size: 8px;
//           font-weight: 700;
//           color: #94a3b8;
//           margin-top: 4px;
//           white-space: nowrap;
//         }
        
//         @keyframes pulse-green {
//           0% { transform: translate(-50%, -50%) scale(1); }
//           50% { transform: translate(-50%, -50%) scale(1.2); }
//           100% { transform: translate(-50%, -50%) scale(1); }
//         }
        
//         .truck-marker.arrived {
//           animation: pulse-green 1.5s ease-in-out infinite;
//         }
//       `}</style>
//     </div>
//   );
// }





// // app/components/TruckProgressBar.tsx

// 'use client';

// interface TruckProgressBarProps {
//   licensePlate: string;
//   driver: string;
//   quantity: number;
//   time: string;
//   distance: number | null;
//   totalDistance: number;
//   isArrived: boolean;
//   unit?: string;
//   factoryCode: string;
// }

// // Цвета для заводов (только для линии прогресса)
// const FACTORY_COLORS: Record<string, string> = {
//   'ЛХ': '#4ade80',
//   'ЛЮ': '#3b82f6',
//   'СП': '#eab308',
//   'Щ': '#ef4444',
// };

// export default function TruckProgressBar({
//   licensePlate,
//   driver,
//   quantity,
//   time,
//   distance,
//   totalDistance,
//   isArrived,
//   unit = 'т',
//   factoryCode,
// }: TruckProgressBarProps) {
//   let progress = 0;
//   let distanceText = '⏳ Нет данных';
  
//   if (isArrived) {
//     progress = 100;
//     distanceText = '✅ Прибыл';
//   } else if (distance !== null && totalDistance > 0) {
//     const rawProgress = ((totalDistance - distance) / totalDistance) * 100;
//     progress = Math.max(0, Math.min(100, rawProgress));
//     distanceText = `${distance.toFixed(1)} км`;
//   }
  
//   const color = FACTORY_COLORS[factoryCode] || '#4ade80';
  
//   return (
//     <div className="truck-progress-wrapper">
//       {/* Верхняя строка: номер, время, водитель, тоннаж, расстояние */}
//       <div className="truck-progress-header">
//         <div className="truck-info-left">
//           <span className="truck-plate">{licensePlate}</span>
//           <span className="truck-time">{time}</span>
//           <span className="truck-driver">👤 {driver}</span>
//         </div>
//         <div className="truck-info-right">
//           <span className="truck-quantity">{quantity.toFixed(1)} {unit}</span>
//           <span className={`truck-distance ${isArrived ? 'arrived' : ''}`}>
//             {distanceText}
//           </span>
//         </div>
//       </div>
      
//       {/* Прогресс-бар */}
//       <div className="progress-track">
//         {/* Линия прогресса */}
//         <div 
//           className="progress-fill"
//           style={{ 
//             width: `${Math.min(progress, 100)}%`,
//             background: isArrived 
//               ? 'linear-gradient(90deg, #4ade80, #22c55e)'
//               : `linear-gradient(90deg, ${color}40, ${color})`
//           }}
//         />
        
//         {/* 🚛 Машина (если не прибыла) */}
//         {!isArrived && progress < 100 && (
//           <div 
//             className="truck-marker"
//             style={{ 
//               left: `${Math.min(progress, 98)}%`,
//             }}
//           >
//             <svg 
//               width="20" 
//               height="20" 
//               viewBox="0 0 24 24" 
//               fill="none" 
//               stroke={color} 
//               strokeWidth="2.5" 
//               strokeLinecap="round" 
//               strokeLinejoin="round"
//               style={{ display: 'block' }}
//             >
//               <path d="M5 17h14M5 17a2 2 0 0 1-2-2v-3h16v3a2 2 0 0 1-2 2M5 17H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2l3-4h7l3 4h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
//               <circle cx="7" cy="17" r="2" fill="#1a1a2e" stroke={color} />
//               <circle cx="17" cy="17" r="2" fill="#1a1a2e" stroke={color} />
//             </svg>
//             <span className="progress-percent">{Math.round(progress)}%</span>
//           </div>
//         )}
        
//         {/* ✅ Машина прибыла */}
//         {isArrived && (
//           <div 
//             className="truck-marker arrived"
//             style={{ left: '98%' }}
//           >
//             <span style={{ fontSize: 20 }}>✅</span>
//           </div>
//         )}
//       </div>
      
//       <style jsx>{`
//         .truck-progress-wrapper {
//           padding: 6px 0;
//           border-bottom: 1px solid rgba(255,255,255,0.04);
//         }
        
//         .truck-progress-header {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           flex-wrap: wrap;
//           gap: 4px 8px;
//           margin-bottom: 4px;
//         }
        
//         .truck-info-left {
//           display: flex;
//           align-items: center;
//           gap: 12px;
//           flex-wrap: wrap;
//         }
        
//         .truck-plate {
//           font-weight: 700;
//           color: #1a1a2e;
//           font-size: 14px;
//           background: #fff;
//           padding: 1px 8px;
//           border-radius: 4px;
//           letter-spacing: 0.5px;
//         }
        
//         .truck-time {
//           color: #94a3b8;
//           font-size: 11px;
//           font-weight: 500;
//         }
        
//         .truck-driver {
//           color: #94a3b8;
//           font-size: 11px;
//         }
        
//         .truck-info-right {
//           display: flex;
//           align-items: center;
//           gap: 12px;
//         }
        
//         .truck-quantity {
//           color: #1a1a2e;
//           font-weight: 700;
//           font-size: 14px;
//           background: rgba(255,255,255,0.08);
//           padding: 1px 8px;
//           border-radius: 4px;
//         }
        
//         .truck-distance {
//           color: #94a3b8;
//           font-size: 11px;
//           font-weight: 600;
//           min-width: 60px;
//           text-align: right;
//         }
        
//         .truck-distance.arrived {
//           color: #4ade80;
//           font-weight: 700;
//         }
        
//         .progress-track {
//           position: relative;
//           height: 4px;
//           background: rgba(255,255,255,0.08);
//           border-radius: 2px;
//           overflow: visible;
//           margin: 4px 0 2px 0;
//         }
        
//         .progress-fill {
//           position: absolute;
//           left: 0;
//           top: 0;
//           height: 100%;
//           border-radius: 2px;
//           transition: width 1s ease-in-out;
//         }
        
//         .truck-marker {
//           position: absolute;
//           top: 50%;
//           transform: translate(-50%, -50%);
//           z-index: 3;
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           transition: left 1s ease-in-out;
//         }
        
//         .truck-marker.arrived {
//           transform: translate(-50%, -50%);
//         }
        
//         .progress-percent {
//           font-size: 8px;
//           font-weight: 700;
//           color: #94a3b8;
//           margin-top: 6px;
//           white-space: nowrap;
//         }
        
//         /* Анимация для прибывшей машины */
//         @keyframes pulse-green {
//           0% { transform: translate(-50%, -50%) scale(1); }
//           50% { transform: translate(-50%, -50%) scale(1.2); }
//           100% { transform: translate(-50%, -50%) scale(1); }
//         }
        
//         .truck-marker.arrived {
//           animation: pulse-green 1.5s ease-in-out infinite;
//         }
//       `}</style>
//     </div>
//   );
// }






// // app/components/TruckProgressBar.tsx

// 'use client';

// interface TruckProgressBarProps {
//   licensePlate: string;
//   driver: string;
//   quantity: number;
//   time: string;
//   distance: number | null; // расстояние до ПК в км
//   totalDistance: number; // общее расстояние от завода до ПК
//   isArrived: boolean;
//   unit?: string;
//   factoryCode: string; // 'ЛХ', 'ЛЮ', 'СП', 'Щ'
// }

// // Цвета для заводов
// const FACTORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
//   'ЛХ': { bg: '#166534', border: '#4ade80', text: '#4ade80' },
//   'ЛЮ': { bg: '#1e3a5f', border: '#3b82f6', text: '#3b82f6' },
//   'СП': { bg: '#713f12', border: '#eab308', text: '#eab308' },
//   'Щ': { bg: '#7f1d1d', border: '#ef4444', text: '#ef4444' },
// };

// export default function TruckProgressBar({
//   licensePlate,
//   driver,
//   quantity,
//   time,
//   distance,
//   totalDistance,
//   isArrived,
//   unit = 'т',
//   factoryCode,
// }: TruckProgressBarProps) {
//   // Вычисляем прогресс (0-100%)
//   let progress = 0;
//   let distanceText = '⏳ Нет данных';
  
//   if (isArrived) {
//     progress = 100;
//     distanceText = '✅ Прибыл';
//   } else if (distance !== null && totalDistance > 0) {
//     // Прогресс: сколько процентов пути уже пройдено
//     const rawProgress = ((totalDistance - distance) / totalDistance) * 100;
//     progress = Math.max(0, Math.min(100, rawProgress));
//     distanceText = `${distance.toFixed(1)} км до цели`;
//   }
  
//   const colors = FACTORY_COLORS[factoryCode] || FACTORY_COLORS['ЛХ'];
  
//   return (
//     <div className="truck-progress-wrapper">
//       {/* Информация о машине */}
//       <div className="truck-progress-header">
//         <div className="truck-info-left">
//           <span className="truck-plate">{licensePlate}</span>
//           <span className="truck-time">{time}</span>
//           <span className="truck-driver">👤 {driver}</span>
//         </div>
//         <div className="truck-info-right">
//           <span className="truck-quantity">{quantity.toFixed(1)} {unit}</span>
//           <span className={`truck-distance ${isArrived ? 'arrived' : ''}`}>
//             {distanceText}
//           </span>
//         </div>
//       </div>
      
//       {/* Прогресс-бар */}
//       <div className="truck-progress-bar">
//         {/* Линия пути */}
//         <div className="progress-track">
//           {/* Заполненная часть */}
//           <div 
//             className="progress-fill"
//             style={{ 
//               width: `${progress}%`,
//               background: isArrived 
//                 ? 'linear-gradient(90deg, #4ade80, #22c55e)'
//                 : `linear-gradient(90deg, ${colors.text}80, ${colors.text})`
//             }}
//           />
          
//           {/* 🏭 Завод (старт) */}
//           <div className="progress-start" style={{ borderColor: colors.border }}>
//             <span className="progress-label start-label">🏭</span>
//           </div>
          
//           {/* 🚛 Машина (текущая позиция) */}
//           <div 
//             className="progress-truck"
//             style={{ 
//               left: `${Math.min(progress, 98)}%`,
//               transform: 'translateX(-50%)',
//             }}
//           >
//             <div className="truck-icon">
//               {isArrived ? '✅' : '🚛'}
//             </div>
//             {!isArrived && progress > 5 && (
//               <div 
//                 className="truck-progress-percent"
//                 style={{ color: colors.text }}
//               >
//                 {Math.round(progress)}%
//               </div>
//             )}
//           </div>
          
//           {/* 🎯 Пункт назначения (финиш) */}
//           <div className="progress-end" style={{ borderColor: colors.border }}>
//             <span className="progress-label end-label">🎯</span>
//           </div>
//         </div>
//       </div>
      
//       <style jsx>{`
//         .truck-progress-wrapper {
//           padding: 6px 0;
//           border-bottom: 1px solid rgba(255,255,255,0.04);
//         }
        
//         .truck-progress-header {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           flex-wrap: wrap;
//           gap: 4px 8px;
//           margin-bottom: 4px;
//         }
        
//         .truck-info-left {
//           display: flex;
//           align-items: center;
//           gap: 10px;
//           flex-wrap: wrap;
//         }
        
//         .truck-plate {
//           font-weight: 600;
//           color: #fff;
//           font-size: 13px;
//           min-width: 60px;
//         }
        
//         .truck-time {
//           color: #94a3b8;
//           font-size: 11px;
//         }
        
//         .truck-driver {
//           color: #94a3b8;
//           font-size: 11px;
//         }
        
//         .truck-info-right {
//           display: flex;
//           align-items: center;
//           gap: 12px;
//         }
        
//         .truck-quantity {
//           color: #ffd93d;
//           font-weight: 600;
//           font-size: 12px;
//         }
        
//         .truck-distance {
//           color: #94a3b8;
//           font-size: 11px;
//           font-weight: 500;
//           min-width: 100px;
//           text-align: right;
//         }
        
//         .truck-distance.arrived {
//           color: #4ade80;
//           font-weight: 600;
//         }
        
//         .truck-progress-bar {
//           padding: 2px 0;
//         }
        
//         .progress-track {
//           position: relative;
//           height: 6px;
//           background: rgba(255,255,255,0.06);
//           border-radius: 4px;
//           overflow: visible;
//         }
        
//         .progress-fill {
//           position: absolute;
//           left: 0;
//           top: 0;
//           height: 100%;
//           border-radius: 4px;
//           transition: width 1s ease-in-out;
//           min-width: 2px;
//         }
        
//         .progress-start {
//           position: absolute;
//           left: 0;
//           top: 50%;
//           transform: translate(-50%, -50%);
//           width: 20px;
//           height: 20px;
//           border-radius: 50%;
//           background: #1a1a2e;
//           border: 2px solid;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           z-index: 2;
//         }
        
//         .progress-end {
//           position: absolute;
//           right: 0;
//           top: 50%;
//           transform: translate(50%, -50%);
//           width: 20px;
//           height: 20px;
//           border-radius: 50%;
//           background: #1a1a2e;
//           border: 2px solid;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           z-index: 2;
//         }
        
//         .progress-label {
//           font-size: 10px;
//           line-height: 1;
//         }
        
//         .progress-truck {
//           position: absolute;
//           top: 50%;
//           transform: translateY(-50%);
//           z-index: 3;
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           transition: left 1s ease-in-out;
//         }
        
//         .truck-icon {
//           font-size: 18px;
//           line-height: 1;
//           filter: drop-shadow(0 0 8px rgba(255,255,255,0.15));
//         }
        
//         .truck-progress-percent {
//           font-size: 8px;
//           font-weight: 700;
//           margin-top: 2px;
//           text-shadow: 0 0 8px rgba(0,0,0,0.8);
//           opacity: 0.7;
//           white-space: nowrap;
//         }
        
//         /* Анимация для прибывшей машины */
//         .truck-icon:has(:not(.arrived)) {
//           animation: none;
//         }
        
//         @keyframes pulse-green {
//           0% { transform: scale(1); }
//           50% { transform: scale(1.15); }
//           100% { transform: scale(1); }
//         }
        
//         .truck-icon.arrived {
//           animation: pulse-green 1.5s ease-in-out infinite;
//         }
//       `}</style>
//     </div>
//   );
// }