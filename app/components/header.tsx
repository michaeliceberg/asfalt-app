// app/components/header.tsx

'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, LogOut, RefreshCw } from 'lucide-react';
import PushNotifications from './PushNotifications';

interface HeaderProps {
  refreshing: boolean;
  onRefresh: () => void;
  isDemoMode?: boolean;
  hideLogout?: boolean;
}

export default function Header({
  refreshing,
  onRefresh,
  isDemoMode = false,
  hideLogout = false,
}: HeaderProps) {
  const [currentTime, setCurrentTime] = useState('');
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isTrucksPage = pathname === '/trucks';

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
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
            {user?.username && (
              <span className="user-name-header">{user.username} | </span>
            )}
            Актуально на {currentTime}
            {isDemoMode && <span className="demo-badge">🎯 ДЕМО</span>}
          </p>
        </div>
      </div>

      <div className="header-buttons">
        {/* GPS - MapPin */}
        <Link href="/trucks">
          <button
            className={`header-btn ${isTrucksPage ? 'active' : ''}`}
            title="GPS-мониторинг"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: isTrucksPage ? '#ffd93d' : 'transparent',
              color: isTrucksPage ? '#1a1a2e' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <MapPin size={20} strokeWidth={2} />
          </button>
        </Link>

        {/* ✅ Push уведомления */}
        <PushNotifications />

        {/* Выйти - LogOut */}
        {!isDemoMode && !hideLogout && (
          <button
            className="header-btn"
            onClick={logout}
            disabled={refreshing}
            title="Выйти из системы"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: refreshing ? 0.5 : 1,
            }}
          >
            <LogOut size={20} strokeWidth={2} />
          </button>
        )}

        {/* Обновить - RefreshCw */}
        <motion.button
          className={`header-btn ${refreshing ? 'refreshing' : ''}`}
          onClick={onRefresh}
          disabled={refreshing}
          title="Обновить"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            opacity: refreshing ? 0.5 : 1,
          }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div
            animate={{ rotate: refreshing ? 360 : 0 }}
            transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
          >
            <RefreshCw size={20} strokeWidth={2.5} />
          </motion.div>
        </motion.button>
      </div>
    </div>
  );
}





// 'use client';

// import { motion } from 'framer-motion';
// import { useEffect, useState } from 'react';
// import { useAuth } from '@/hooks/useAuth';
// import Link from 'next/link';
// import { usePathname } from 'next/navigation';
// import { MapPin, LogOut, RefreshCw } from 'lucide-react';

// interface HeaderProps {
//   refreshing: boolean;
//   onRefresh: () => void;
//   isDemoMode?: boolean;
//   hideLogout?: boolean;
// }

// export default function Header({
//   refreshing,
//   onRefresh,
//   isDemoMode = false,
//   hideLogout = false,
// }: HeaderProps) {
//   const [currentTime, setCurrentTime] = useState('');
//   const { user, logout } = useAuth();
//   const pathname = usePathname();
//   const isTrucksPage = pathname === '/trucks';

//   useEffect(() => {
//     const updateTime = () => {
//       const now = new Date();
//       setCurrentTime(
//         now.toLocaleTimeString('ru-RU', {
//           hour: '2-digit',
//           minute: '2-digit',
//         })
//       );
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
//             {user?.username && (
//               <span className="user-name-header">{user.username} | </span>
//             )}
//             Актуально на {currentTime}
//             {isDemoMode && <span className="demo-badge">🎯 ДЕМО</span>}
//           </p>
//         </div>
//       </div>

//       <div className="header-buttons">
//         {/* GPS - MapPin */}
//         <Link href="/trucks">
//           <button
//             className={`header-btn ${isTrucksPage ? 'active' : ''}`}
//             title="GPS-мониторинг"
//             style={{
//               width: 36,
//               height: 36,
//               borderRadius: 8,
//               border: 'none',
//               background: isTrucksPage ? '#ffd93d' : 'transparent',
//               color: isTrucksPage ? '#1a1a2e' : '#fff',
//               cursor: 'pointer',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               transition: 'all 0.2s',
//             }}
//           >
//             <MapPin size={20} strokeWidth={2} />
//           </button>
//         </Link>

//         {/* Выйти - LogOut */}
//         {!isDemoMode && !hideLogout && (
//           <button
//             className="header-btn"
//             onClick={logout}
//             disabled={refreshing}
//             title="Выйти из системы"
//             style={{
//               width: 36,
//               height: 36,
//               borderRadius: 8,
//               border: 'none',
//               background: 'transparent',
//               color: '#fff',
//               cursor: 'pointer',
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               transition: 'all 0.2s',
//               opacity: refreshing ? 0.5 : 1,
//             }}
//           >
//             <LogOut size={20} strokeWidth={2} />
//           </button>
//         )}

//         {/* Обновить - RefreshCw */}
//         <motion.button
//           className={`header-btn ${refreshing ? 'refreshing' : ''}`}
//           onClick={onRefresh}
//           disabled={refreshing}
//           title="Обновить"
//           style={{
//             width: 36,
//             height: 36,
//             borderRadius: 8,
//             border: 'none',
//             background: 'transparent',
//             color: '#fff',
//             cursor: 'pointer',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             transition: 'all 0.2s',
//             opacity: refreshing ? 0.5 : 1,
//           }}
//           whileTap={{ scale: 0.9 }}
//         >
//           <motion.div
//             animate={{ rotate: refreshing ? 360 : 0 }}
//             transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
//           >
//             <RefreshCw size={20} strokeWidth={2.5} />
//           </motion.div>
//         </motion.button>
//       </div>
//     </div>
//   );
// }


