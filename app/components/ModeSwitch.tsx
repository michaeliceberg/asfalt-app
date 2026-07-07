'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ModeSwitchProps {
  mode: 'tas' | 'iceberg';
  onToggle: () => void;
  tasSyncTime?: string | null;
  icebergSyncTime?: string | null;
  accessibleFactories?: string[]; // ✅ Добавляем пропс
}

// Функция для форматирования короткого времени
const formatSyncShort = (timestamp: string | null): string => {
  if (!timestamp) return 'никогда';
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}`;
};

// Функция для получения стиля бейджа
const getSyncBadgeStyle = (syncTime: string | null | undefined): { text: string; color: string; bgColor: string } => {
  if (!syncTime) {
    return { text: 'никогда', color: '#ffffff', bgColor: '#dc3545' };
  }
  
  const now = new Date();
  const syncDate = new Date(syncTime);
  const diffMinutes = (now.getTime() - syncDate.getTime()) / (1000 * 60);
  
  if (diffMinutes < 25) {
    return { text: formatSyncShort(syncTime), color: '#155724', bgColor: '#d4edda' };
  } else {
    return { text: formatSyncShort(syncTime), color: '#721c24', bgColor: '#f8d7da' };
  }
};

export default function ModeSwitch({ 
  mode, 
  onToggle, 
  tasSyncTime, 
  icebergSyncTime,
  accessibleFactories = [] // ✅ По умолчанию пустой массив
}: ModeSwitchProps) {
  const [currentIcebergTime, setCurrentIcebergTime] = useState(icebergSyncTime);
  const [currentTasTime, setCurrentTasTime] = useState(tasSyncTime);

  // ✅ Проверяем доступные заводы
  const hasTasAccess = accessibleFactories.some(f => f === 'ЛХ' || f === 'ЛЮ');
  const hasIcebergAccess = accessibleFactories.some(f => f === 'СП' || f === 'Щ');

  // Автообновление времени для Айсберг каждые 10 секунд
  useEffect(() => {
    const fetchIcebergTime = async () => {
      try {
        const response = await fetch('/api/last-import-info');
        const data = await response.json();
        if (data.lastImport) {
          setCurrentIcebergTime(data.lastImport);
        }
      } catch (err) {
        console.error('Failed to fetch iceberg sync time:', err);
      }
    };

    fetchIcebergTime();
    const interval = setInterval(fetchIcebergTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Автообновление для ТАС
  useEffect(() => {
    const fetchTasTime = async () => {
      try {
        const response = await fetch('/api/cron-info');
        const data = await response.json();
        if (data.lastSync) {
          setCurrentTasTime(data.lastSync);
        }
      } catch (err) {
        console.error('Failed to fetch TAS sync time:', err);
      }
    };

    fetchTasTime();
    const interval = setInterval(fetchTasTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const tasSync = getSyncBadgeStyle(currentTasTime);
  const icebergSync = getSyncBadgeStyle(currentIcebergTime);

  // ✅ Если доступ только к Айсберг — показываем только Айсберг
  if (!hasTasAccess && hasIcebergAccess) {
    return (
      <div className="mode-switch-wrapper">
        <div className="mode-switch-container" style={{ opacity: 0.7, cursor: 'default' }}>
          <div className="mode-option active" style={{ width: '100%', justifyContent: 'center' }}>
            <div className="mode-option-top">
              <span className="mode-icon">🏔️</span>
              <span className="mode-label">Айсберг</span>
            </div>
            <span className="mode-location">Щёлково • Сергиев Посад</span>
            <span 
              className="mode-sync-badge"
              style={{ backgroundColor: icebergSync.bgColor, color: icebergSync.color }}
            >
              🔄 {icebergSync.text}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Если доступ только к ТАС — показываем только ТАС
  if (hasTasAccess && !hasIcebergAccess) {
    return (
      <div className="mode-switch-wrapper">
        <div className="mode-switch-container" style={{ opacity: 0.7, cursor: 'default' }}>
          <div className="mode-option active" style={{ width: '100%', justifyContent: 'center' }}>
            <div className="mode-option-top">
              <span className="mode-icon">☀️</span>
              <span className="mode-label">ТАС</span>
            </div>
            <span className="mode-location">Транс-Авто-Сервис</span>
            <span 
              className="mode-sync-badge"
              style={{ backgroundColor: tasSync.bgColor, color: tasSync.color }}
            >
              🔄 {tasSync.text}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Если доступ к обоим — показываем переключатель
  return (
    <div className="mode-switch-wrapper">
      <div className="mode-switch-container">
        <motion.div
          className="mode-switch-slider"
          animate={{ x: mode === 'tas' ? 0 : '100%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
        <button
          className={`mode-option ${mode === 'tas' ? 'active' : ''}`}
          onClick={onToggle}
        >
          <div className="mode-option-top">
            <span className="mode-icon">☀️</span>
            <span className="mode-label">ТАС</span>
          </div>
          <span className="mode-location">Транс-Авто-Сервис</span>
          <span 
            className="mode-sync-badge"
            style={{ backgroundColor: tasSync.bgColor, color: tasSync.color }}
          >
            🔄 {tasSync.text}
          </span>
        </button>
        <button
          className={`mode-option ${mode === 'iceberg' ? 'active' : ''}`}
          onClick={onToggle}
        >
          <div className="mode-option-top">
            <span className="mode-icon">🏔️</span>
            <span className="mode-label">Айсберг</span>
          </div>
          <span className="mode-location">Щёлково • Сергиев Посад</span>
          <span 
            className="mode-sync-badge"
            style={{ backgroundColor: icebergSync.bgColor, color: icebergSync.color }}
          >
            🔄 {icebergSync.text}
          </span>
        </button>
      </div>
    </div>
  );
}





// // app/components/ModeSwitch.tsx
// 'use client';

// import { motion } from 'framer-motion';
// import { useEffect, useState } from 'react';

// interface ModeSwitchProps {
//   mode: 'tas' | 'iceberg';
//   onToggle: () => void;
//   tasSyncTime?: string | null;
//   icebergSyncTime?: string | null;
// }

// // Функция для форматирования короткого времени
// const formatSyncShort = (timestamp: string | null): string => {
//   if (!timestamp) return 'никогда';
//   const date = new Date(timestamp);
//   const day = date.getDate().toString().padStart(2, '0');
//   const month = (date.getMonth() + 1).toString().padStart(2, '0');
//   const hours = date.getHours().toString().padStart(2, '0');
//   const minutes = date.getMinutes().toString().padStart(2, '0');
//   return `${day}.${month} ${hours}:${minutes}`;
// };

// // Функция для получения стиля бейджа
// const getSyncBadgeStyle = (syncTime: string | null | undefined): { text: string; color: string; bgColor: string } => {
//   if (!syncTime) {
//     return { text: 'никогда', color: '#ffffff', bgColor: '#dc3545' };
//   }
  
//   const now = new Date();
//   const syncDate = new Date(syncTime);
//   const diffMinutes = (now.getTime() - syncDate.getTime()) / (1000 * 60);
  
//   if (diffMinutes < 25) {
//     return { text: formatSyncShort(syncTime), color: '#155724', bgColor: '#d4edda' };
//   } else {
//     return { text: formatSyncShort(syncTime), color: '#721c24', bgColor: '#f8d7da' };
//   }
// };

// export default function ModeSwitch({ mode, onToggle, tasSyncTime, icebergSyncTime }: ModeSwitchProps) {
//   const [currentIcebergTime, setCurrentIcebergTime] = useState(icebergSyncTime);
//   const [currentTasTime, setCurrentTasTime] = useState(tasSyncTime);

//   // Автообновление времени для Айсберг каждые 10 секунд
//   useEffect(() => {
//     const fetchIcebergTime = async () => {
//       try {
//         const response = await fetch('/api/last-import-info');
//         const data = await response.json();
//         if (data.lastImport) {
//           setCurrentIcebergTime(data.lastImport);
//         }
//       } catch (err) {
//         console.error('Failed to fetch iceberg sync time:', err);
//       }
//     };

//     // Обновляем сразу при монтировании
//     fetchIcebergTime();

//     // И каждые 10 секунд
//     const interval = setInterval(fetchIcebergTime, 10000);

//     return () => clearInterval(interval);
//   }, []);

//   // Автообновление для ТАС (если нужно)
//   useEffect(() => {
//     const fetchTasTime = async () => {
//       try {
//         const response = await fetch('/api/cron-info');
//         const data = await response.json();
//         if (data.lastSync) {
//           setCurrentTasTime(data.lastSync);
//         }
//       } catch (err) {
//         console.error('Failed to fetch TAS sync time:', err);
//       }
//     };

//     fetchTasTime();
//     const interval = setInterval(fetchTasTime, 10000);

//     return () => clearInterval(interval);
//   }, []);

//   const tasSync = getSyncBadgeStyle(currentTasTime);
//   const icebergSync = getSyncBadgeStyle(currentIcebergTime);

//   const handleToggle = () => {
//     onToggle();
//   };

//   return (
//     <div className="mode-switch-wrapper">
//       <div className="mode-switch-container">
//         {/* Анимированный бегунок */}
//         <motion.div
//           className="mode-switch-slider"
//           animate={{ x: mode === 'tas' ? 0 : '100%' }}
//           transition={{ type: 'spring', stiffness: 500, damping: 35 }}
//         />
        
//         {/* Кнопка ТАС */}
//         <button
//           className={`mode-option ${mode === 'tas' ? 'active' : ''}`}
//           onClick={handleToggle}
//         >
//           <div className="mode-option-top">
//             <span className="mode-icon">☀️</span>
//             <span className="mode-label">ТАС</span>
//           </div>
//           <span className="mode-location">Транс-Авто-Сервис</span>
//           <span 
//             className="mode-sync-badge"
//             style={{ backgroundColor: tasSync.bgColor, color: tasSync.color }}
//           >
//             🔄 {tasSync.text}
//           </span>
//         </button>
        
//         {/* Кнопка Айсберг */}
//         <button
//           className={`mode-option ${mode === 'iceberg' ? 'active' : ''}`}
//           onClick={handleToggle}
//         >
//           <div className="mode-option-top">
//             <span className="mode-icon">🏔️</span>
//             <span className="mode-label">Айсберг</span>
//           </div>
//           <span className="mode-location">Щёлково • Сергиев Посад</span>
//           <span 
//             className="mode-sync-badge"
//             style={{ backgroundColor: icebergSync.bgColor, color: icebergSync.color }}
//           >
//             🔄 {icebergSync.text}
//           </span>
//         </button>
//       </div>
//     </div>
//   );
// }


