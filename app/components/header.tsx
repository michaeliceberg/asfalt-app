// app/components/header.tsx

'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Satellite, LogOut, RefreshCw, User, Sparkles } from 'lucide-react';
import PushNotifications from './PushNotifications';

interface HeaderProps {
  refreshing: boolean;
  onRefresh: () => void;
  isDemoMode?: boolean;
  hideLogout?: boolean;
  // В демо кнопка GPS раньше вела на /trucks — боевую страницу за
  // авторизацией, гостя демо просто перекидывало на /login. В демо
  // вместо перехода переключаем вкладку GPS прямо на /demo.
  onGpsClick?: () => void;
  // Колокольчик демо push-уведомлений (см. PushNotifications.tsx).
  demoPushEnabled?: boolean;
  onToggleDemoPush?: () => void;
}

export default function Header({
  refreshing,
  onRefresh,
  isDemoMode = false,
  hideLogout = false,
  onGpsClick,
  demoPushEnabled,
  onToggleDemoPush,
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
    <div className="app-header-row" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 0 4px 0',
      background: 'transparent',
      flexWrap: 'nowrap',
      gap: '8px',
    }}>
      {/* Логотип */}
      {/* Раньше весь этот блок был flexShrink:0 наравне с кнопками справа —
          при недостатке ширины (длинное имя пользователя + бейдж ДЕМО +
          несколько иконок) строка целиком не помещалась в экран, и
          единственным спасением был горизontal-scroll на .app-header-row,
          который не все замечают. Теперь блок сам может сжиматься
          (minWidth:0), а внутри — не бренд-пилюля (важно, не трогаем), а
          именно пилюля пользователя первой уступает место через обрезку
          текста многоточием, оставляя кнопки справа всегда полностью
          видимыми. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flex: '1 1 auto',
        minWidth: 0,
        paddingLeft: 0,
      }}>
        <div className="app-header-brand-pill" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(0,0,0,0.3)',
          padding: '4px 12px 4px 8px',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <span style={{
            background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
            color: '#1a1a2e',
            fontSize: '13px',
            fontWeight: 800,
            padding: '0 10px',
            borderRadius: '12px',
            lineHeight: '22px',
            letterSpacing: '0.5px',
          }}>
            АБЗ
          </span>
          <span className="app-header-brand-divider" style={{
            fontSize: '13px',
            color: '#94a3b8',
            fontWeight: 300,
          }}>⚡</span>
          <span className="app-header-brand-name" style={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#e2e8f0',
            letterSpacing: '0.3px',
          }}>
            Контроль
          </span>
        </div>

        {/* 👤 Пользователь — сжимается и обрезает текст первым, если не
            хватает места (см. комментарий выше про overflow шапки). */}
        <div id="onboarding-guest-badge" className="app-header-user-pill" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 10px 2px 6px',
          borderRadius: '16px',
          background: 'transparent',
          border: 'none',
          transition: 'all 0.2s',
          minWidth: 0,
          overflow: 'hidden',
        }}>
          <User size={13} color="#ffffff" strokeWidth={2} style={{ flexShrink: 0 }} />
          <span className="app-header-user-pill-text" style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#ffffff',
            letterSpacing: '0.3px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}>
            {user?.username || 'Гость'}
          </span>
        </div>

        {isDemoMode && (
          <span className="demo-badge" style={{ marginLeft: '2px', flexShrink: 0 }}>
            <Sparkles size={11} strokeWidth={2.4} />
            ДЕМО
          </span>
        )}
      </div>

      {/* Кнопки */}
      <div className="app-header-buttons-group" style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        paddingRight: 0,
      }}>
        <PushNotifications
          demoMode={isDemoMode}
          demoEnabled={demoPushEnabled}
          onToggleDemo={onToggleDemoPush}
        />
        {/* В демо кнопка-спутник дублировала вкладку GPS в ViewTabs —
            убрали её здесь, GPS открывается только через вкладку.
            В боевом приложении это по-прежнему единственный путь
            на отдельную страницу /trucks — оставляем. */}
        {!onGpsClick && (
          <Link href="/trucks">
            <button
              className={`header-btn ${isTrucksPage ? 'active' : ''}`}
              title="GPS-мониторинг"
              style={{
                borderRadius: 6,
                border: 'none',
                background: isTrucksPage ? '#ffd93d' : 'transparent',
                color: isTrucksPage ? '#1a1a2e' : '#fff',
                cursor: 'pointer',
              }}
            >
              <Satellite size={18} strokeWidth={2} />
            </button>
          </Link>
        )}
        {!isDemoMode && !hideLogout && (
          <button
            className="header-btn"
            onClick={logout}
            disabled={refreshing}
            title="Выйти"
            style={{
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: '#fff',
              cursor: 'pointer',
              opacity: refreshing ? 0.5 : 1,
            }}
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        )}
        <motion.button
          className={`header-btn ${refreshing ? 'refreshing' : ''}`}
          onClick={onRefresh}
          disabled={refreshing}
          title="Обновить"
          style={{
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: '#fff',
            cursor: 'pointer',
            opacity: refreshing ? 0.5 : 1,
          }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div
            animate={{ rotate: refreshing ? 360 : 0 }}
            transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
          >
            <RefreshCw size={18} strokeWidth={2.5} />
          </motion.div>
        </motion.button>
      </div>
    </div>
  );
}




// // app/components/header.tsx

// 'use client';

// import { motion } from 'framer-motion';
// import { useEffect, useState } from 'react';
// import { useAuth } from '@/hooks/useAuth';
// import Link from 'next/link';
// import { usePathname } from 'next/navigation';
// import { MapPin, LogOut, RefreshCw } from 'lucide-react';
// import PushNotifications from './PushNotifications';

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
//     <div style={{
//       display: 'flex',
//       justifyContent: 'space-between',
//       alignItems: 'center',
//       padding: '8px 12px',
//       background: 'transparent',
//       flexWrap: 'nowrap',
//       gap: '8px',
//     }}>
//       {/* Логотип — прижат к левому краю */}
//       <div style={{
//         display: 'flex',
//         alignItems: 'center',
//         gap: '6px',
//         flexShrink: 0,
//       }}>
//         <div style={{
//           display: 'flex',
//           alignItems: 'center',
//           gap: '4px',
//           background: 'rgba(0,0,0,0.3)',
//           padding: '4px 12px 4px 8px',
//           borderRadius: '20px',
//           border: '1px solid rgba(255,255,255,0.08)',
//         }}>
//           <span style={{
//             background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
//             color: '#1a1a2e',
//             fontSize: '13px',
//             fontWeight: 800,
//             padding: '0 10px',
//             borderRadius: '12px',
//             lineHeight: '22px',
//             letterSpacing: '0.5px',
//           }}>
//             АБЗ
//           </span>
//           <span style={{
//             fontSize: '13px',
//             color: '#94a3b8',
//             fontWeight: 300,
//           }}>⚡</span>
//           <span style={{
//             fontSize: '13px',
//             fontWeight: 500,
//             color: '#e2e8f0',
//             letterSpacing: '0.3px',
//           }}>
//             Контроль
//           </span>
//         </div>
//         <p style={{
//           fontSize: '10px',
//           color: '#94a3b8',
//           margin: 0,
//           whiteSpace: 'nowrap',
//           overflow: 'hidden',
//           textOverflow: 'ellipsis',
//         }}>
//           <span className="status-dot"></span>
//           {user?.username && (
//             <span style={{ color: '#94a3b8' }}>{user.username} | </span>
//           )}
//           {currentTime}
//           {isDemoMode && <span className="demo-badge">🎯 ДЕМО</span>}
//         </p>
//       </div>

//       {/* Кнопки — прижаты к правому краю */}
//       <div style={{
//         display: 'flex',
//         alignItems: 'center',
//         gap: '4px',
//         flexShrink: 0,
//       }}>
//         <PushNotifications />
//         <Link href="/trucks">
//           <button
//             className={`header-btn ${isTrucksPage ? 'active' : ''}`}
//             title="GPS-мониторинг"
//             style={{
//               width: 32,
//               height: 32,
//               borderRadius: 6,
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
//             <Satellite size={18} strokeWidth={2} />
//           </button>
//         </Link>
//         {!isDemoMode && !hideLogout && (
//           <button
//             className="header-btn"
//             onClick={logout}
//             disabled={refreshing}
//             title="Выйти"
//             style={{
//               width: 32,
//               height: 32,
//               borderRadius: 6,
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
//             <LogOut size={18} strokeWidth={2} />
//           </button>
//         )}
//         <motion.button
//           className={`header-btn ${refreshing ? 'refreshing' : ''}`}
//           onClick={onRefresh}
//           disabled={refreshing}
//           title="Обновить"
//           style={{
//             width: 32,
//             height: 32,
//             borderRadius: 6,
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
//             <RefreshCw size={18} strokeWidth={2.5} />
//           </motion.div>
//         </motion.button>
//       </div>
//     </div>
//   );
// }




// // app/components/header.tsx

// 'use client';

// import { motion } from 'framer-motion';
// import { useEffect, useState } from 'react';
// import { useAuth } from '@/hooks/useAuth';
// import Link from 'next/link';
// import { usePathname } from 'next/navigation';
// import { MapPin, LogOut, RefreshCw } from 'lucide-react';
// import PushNotifications from './PushNotifications';

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

//         {/* ✅ Push уведомления */}
//         <PushNotifications />

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


