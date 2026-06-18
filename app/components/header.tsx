'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface HeaderProps {
  refreshing: boolean;
  onRefresh: () => void;
  onSendPlan?: () => void;
  isDemoMode?: boolean;
  hideLogout?: boolean;
}

export default function Header({ 
  refreshing, 
  onRefresh, 
  onSendPlan, 
  isDemoMode = false, 
  hideLogout = false 
}: HeaderProps) {
  const [currentTime, setCurrentTime] = useState('');
  const { user, logout } = useAuth();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="header-top">
      <div className="logo-container">
        <div className="logo-icon">
          <span className="factory-emoji">🏭</span>
        </div>
        <div className="logo-text">
          <h1>АБЗ ⚡ Контроль</h1>
          <p className="logo-subtitle">
            <span className="status-dot"></span>
            {user?.username && <span className="user-name-header">{user.username} | </span>}
            Актуально на {currentTime}
            {isDemoMode && (
              <span className="demo-badge">🎯 ДЕМО</span>
            )}
          </p>
        </div>
      </div>
      <div className="header-buttons">
        {/* Кнопка GPS */}
        <Link href="/trucks">
          <button
            className="gps-btn"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#4a90d9',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 500,
              marginRight: 8,
            }}
          >
            🚛 GPS
          </button>
        </Link>

        {/* Кнопка "Выйти" — показываем ТОЛЬКО если не демо и не hideLogout */}
        {!isDemoMode && !hideLogout && (
          <button 
            className="logout-btn" 
            onClick={logout} 
            disabled={refreshing}
            title="Выйти из системы"
          >
            🚪 Выйти
          </button>
        )}
        {onSendPlan && (
          <button
            className="send-plan-btn"
            onClick={onSendPlan}
            disabled={refreshing}
          >
            📧 Отправить план
          </button>
        )}
        <motion.button
          className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
          onClick={onRefresh}
          disabled={refreshing}
          whileTap={{ scale: 0.95 }}
        >
          <motion.span
            className="refresh-icon"
            animate={{ rotate: refreshing ? 360 : 0 }}
            transition={{ duration: 0.5, repeat: refreshing ? Infinity : 0 }}
          >
            🔄
          </motion.span>
          {refreshing ? '...' : 'Обновить'}
        </motion.button>
      </div>
    </div>
  );
}




// 'use client';

// import { motion } from 'framer-motion';
// import { useEffect, useState } from 'react';
// import { useAuth } from '@/hooks/useAuth';

// interface HeaderProps {
//   refreshing: boolean;
//   onRefresh: () => void;
//   onSendPlan?: () => void;
//   isDemoMode?: boolean;
//   hideLogout?: boolean; // ← добавить
// }

// export default function Header({ refreshing, onRefresh, onSendPlan, isDemoMode, hideLogout }: HeaderProps) {
//   const [currentTime, setCurrentTime] = useState('');
//   const { user, logout } = useAuth();

//   useEffect(() => {
//     const updateTime = () => {
//       const now = new Date();
//       setCurrentTime(now.toLocaleTimeString('ru-RU', { 
//         hour: '2-digit', 
//         minute: '2-digit' 
//       }));
//     };
//     updateTime();
//     const interval = setInterval(updateTime, 60000);
//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <div className="header-top">
//       <div className="logo-container">
//         <div className="logo-icon">
//           <span className="factory-emoji">🏭</span>
//         </div>
//         <div className="logo-text">
//           <h1>АБЗ ⚡ Контроль</h1>
//           <p className="logo-subtitle">
//             <span className="status-dot"></span>
//             {user?.username && <span className="user-name-header">{user.username} | </span>}
//             Актуально на {currentTime}
//             {isDemoMode && (
//               <span className="demo-badge">🎯 ДЕМО</span>
//             )}
//           </p>
//         </div>
//       </div>
//       <div className="header-buttons">
//         {/* Кнопка "Выйти" — показываем ТОЛЬКО если не демо и не hideLogout */}
//         {!isDemoMode && !hideLogout && (
//           <button 
//             className="logout-btn" 
//             onClick={logout} 
//             disabled={refreshing}
//             title="Выйти из системы"
//           >
//             🚪 Выйти
//           </button>
//         )}
//         {onSendPlan && (
//           <button
//             className="send-plan-btn"
//             onClick={onSendPlan}
//             disabled={refreshing}
//           >
//             📧 Отправить план
//           </button>
//         )}
//         <motion.button
//           className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
//           onClick={onRefresh}
//           disabled={refreshing}
//           whileTap={{ scale: 0.95 }}
//         >
//           <motion.span
//             className="refresh-icon"
//             animate={{ rotate: refreshing ? 360 : 0 }}
//             transition={{ duration: 0.5, repeat: refreshing ? Infinity : 0 }}
//           >
//             🔄
//           </motion.span>
//           {refreshing ? '...' : 'Обновить'}
//         </motion.button>
//       </div>
//     </div>
//   );
// }






// // components/Header.tsx
// import { motion } from 'framer-motion';
// import { useEffect, useState } from 'react';
// import { useAuth } from '@/hooks/useAuth';

// interface HeaderProps {
//   refreshing: boolean;
//   onRefresh: () => void;
//   onSendPlan?: () => void;
//   isDemoMode?: boolean; // ← добавить
// }

// export default function Header({ refreshing, onRefresh, onSendPlan, isDemoMode }: HeaderProps) {
//   const [currentTime, setCurrentTime] = useState('');
//   const { user, logout } = useAuth();

//   useEffect(() => {
//     const updateTime = () => {
//       const now = new Date();
//       setCurrentTime(now.toLocaleTimeString('ru-RU', { 
//         hour: '2-digit', 
//         minute: '2-digit' 
//       }));
//     };
//     updateTime();
//     const interval = setInterval(updateTime, 60000);
//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <div className="header-top">
//       <div className="logo-container">
//         <div className="logo-icon">
//           <span className="factory-emoji">🏭</span>
//         </div>
//         <div className="logo-text">
//           <h1>АБЗ ⚡ Контроль</h1>
//           <p className="logo-subtitle">
//             <span className="status-dot"></span>
//             {user?.username && <span className="user-name-header">{user.username} | </span>}
//             Актуально на {currentTime}
//             {isDemoMode && (
//               <span className="demo-badge">🎯 ДЕМО</span>
//             )}
//           </p>
//         </div>
//       </div>
//       <div className="header-buttons">
//         {/* {onSendPlan && (
//           <button
//             className="send-plan-btn"
//             onClick={onSendPlan}
//             disabled={refreshing}
//           >
//             📧 Отправить план
//           </button>
//         )} */}
//         <button 
//           className="logout-btn" 
//           onClick={logout} 
//           disabled={refreshing}
//           title="Выйти из системы"
//         >
//           🚪 Выйти
//         </button>
//         <motion.button
//           className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
//           onClick={onRefresh}
//           disabled={refreshing}
//           whileTap={{ scale: 0.95 }}
//         >
//           <motion.span
//             className="refresh-icon"
//             animate={{ rotate: refreshing ? 360 : 0 }}
//             transition={{ duration: 0.5, repeat: refreshing ? Infinity : 0 }}
//           >
//             🔄
//           </motion.span>
//           {refreshing ? '...' : 'Обновить'}
//         </motion.button>
//       </div>
//     </div>
//   );
// }



