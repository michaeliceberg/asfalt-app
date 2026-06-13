'use client';

import { motion } from 'framer-motion';

interface ModeSwitchProps {
  mode: 'tas' | 'iceberg';
  onToggle: () => void;
  tasSyncTime?: string | null;
  icebergSyncTime?: string | null;
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

export default function ModeSwitch({ mode, onToggle, tasSyncTime, icebergSyncTime }: ModeSwitchProps) {
  const tasSync = getSyncBadgeStyle(tasSyncTime);
  const icebergSync = getSyncBadgeStyle(icebergSyncTime);

  const handleToggle = () => {
    onToggle();
  };

  return (
    <div className="mode-switch-wrapper">
      <div className="mode-switch-container">
        {/* Анимированный бегунок */}
        <motion.div
          className="mode-switch-slider"
          animate={{ x: mode === 'tas' ? 0 : '100%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
        
        {/* Кнопка ТАС */}
        <button
          className={`mode-option ${mode === 'tas' ? 'active' : ''}`}
          onClick={handleToggle}
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
        
        {/* Кнопка Айсберг */}
        <button
          className={`mode-option ${mode === 'iceberg' ? 'active' : ''}`}
          onClick={handleToggle}
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




// 'use client';

// import { motion } from 'framer-motion';

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
//     return { text: formatSyncShort(syncTime), color: '#155724', bgColor: '#d4edda' }; // зелёный
//   } else {
//     return { text: formatSyncShort(syncTime), color: '#721c24', bgColor: '#f8d7da' }; // красный
//   }
// };

// export default function ModeSwitch({ mode, onToggle, tasSyncTime, icebergSyncTime }: ModeSwitchProps) {
//   const tasSync = getSyncBadgeStyle(tasSyncTime);
//   const icebergSync = getSyncBadgeStyle(icebergSyncTime);

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
//           <span className="mode-icon">☀️</span>
//           <span className="mode-label">ТАС</span>
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
//           <span className="mode-icon">🏔️</span>
//           <span className="mode-label">Айсберг</span>
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








// 'use client';

// import { motion } from 'framer-motion';

// interface ModeSwitchProps {
//   mode: 'tas' | 'iceberg';
//   onToggle: () => void;
// }

// export default function ModeSwitch({ mode, onToggle }: ModeSwitchProps) {
//   const handleToggle = () => {
//     onToggle();
//   };

//   return (
//     <div className="mode-switch-wrapper">
//       <div className="mode-switch-container">
//         {/* Анимированный бегунок - движется слева направо и обратно */}
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
//           <span className="mode-icon">☀️</span>
//           <span className="mode-label">ТАС</span>
//           <span className="mode-location">Транс-Авто-Сервис</span>
//         </button>
        
//         {/* Кнопка Айсберг */}
//         <button
//           className={`mode-option ${mode === 'iceberg' ? 'active' : ''}`}
//           onClick={handleToggle}
//         >
//           <span className="mode-icon">🏔️</span>
//           <span className="mode-label">Айсберг</span>
//           <span className="mode-location">Щёлково • Сергиев Посад</span>
//         </button>
//       </div>
//     </div>
//   );
// }