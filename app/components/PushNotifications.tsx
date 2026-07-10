// app/components/PushNotifications.tsx

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { initNativePush } from '@/lib/native-push';

export default function PushNotifications() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);
  const checkDone = useRef(false);
  const nativeInitDone = useRef(false);

  // В нативном iOS-приложении (Capacitor) Web Push API недоступен —
  // регистрируемся на APNs напрямую, как только известен пользователь.
  // Кнопка-колокольчик ниже в этом случае не показывается (isSupported
  // будет false в WKWebView), это отдельный, полностью автоматический путь.
  useEffect(() => {
    if (!user || nativeInitDone.current) return;
    nativeInitDone.current = true;
    void initNativePush();
  }, [user]);

  // Проверка поддержки один раз при монтировании
  const isSupported = typeof window !== 'undefined' && 
                      'Notification' in window && 
                      'serviceWorker' in navigator && 
                      'PushManager' in window;

  const checkSubscription = useCallback(async () => {
    if (!isSupported) return;
    try {
      const sw = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.getSubscription();
      if (isMounted.current) {
        setIsSubscribed(!!sub);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }, [isSupported]);

  // Эффект для проверки подписки — только один раз
  useEffect(() => {
    if (!isSupported || checkDone.current) return;
    checkDone.current = true;
    
    // Небольшая задержка, чтобы service worker успел зарегистрироваться
    const timer = setTimeout(() => {
      checkSubscription();
    }, 500);
    
    return () => {
      clearTimeout(timer);
      isMounted.current = false;
    };
  }, [isSupported, checkSubscription]);

  const subscribe = async () => {
    if (!user) {
      alert('Пожалуйста, войдите в систему');
      return;
    }

    if (!isSupported) {
      alert('Ваш браузер не поддерживает уведомления');
      return;
    }

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Разрешение на уведомления не получено');
        return;
      }

      // Проверяем, зарегистрирован ли Service Worker
      let sw = await navigator.serviceWorker.getRegistration();
      if (!sw) {
        sw = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
      }
      await navigator.serviceWorker.ready;

      const subscription = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        alert('✅ Уведомления включены!');
      } else {
        throw new Error('Failed to save subscription');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert('❌ Ошибка при включении уведомлений');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const sw = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: sub.endpoint,
          }),
        });
        
        setIsSubscribed(false);
        alert('❌ Уведомления отключены');
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={loading}
      title={isSubscribed ? 'Уведомления включены' : 'Включить уведомления'}
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        border: 'none',
        background: isSubscribed ? 'rgba(74, 222, 128, 0.15)' : 'transparent',
        color: isSubscribed ? '#4ade80' : '#94a3b8',
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        fontSize: 16,
        fontWeight: 500,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.background = isSubscribed 
            ? 'rgba(74, 222, 128, 0.25)' 
            : 'rgba(255,255,255,0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!loading) {
          e.currentTarget.style.background = isSubscribed 
            ? 'rgba(74, 222, 128, 0.15)' 
            : 'transparent';
        }
      }}
    >
      {loading ? (
        <Loader2 size={14} strokeWidth={2.2} className="spin" />
      ) : isSubscribed ? (
        <Bell size={16} strokeWidth={2.2} />
      ) : (
        <BellOff size={16} strokeWidth={2.2} style={{ opacity: 0.5 }} />
      )}
      {isSubscribed && (
        <span style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#4ade80',
          animation: 'pulse-dot 2s infinite',
        }} />
      )}
    </button>
  );
}













// 'use client';

// import { useEffect, useState } from 'react';
// import { useAuth } from '@/hooks/useAuth';

// export default function PushNotifications() {
//   const { user } = useAuth();
//   const [isSupported, setIsSupported] = useState(false);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
//       setIsSupported(true);
//       checkSubscription();
//     }
//   }, []);

//   const checkSubscription = async () => {
//     try {
//       const sw = await navigator.serviceWorker.ready;
//       const sub = await sw.pushManager.getSubscription();
//       setIsSubscribed(!!sub);
//     } catch (error) {
//       console.error('Error checking subscription:', error);
//     }
//   };

//   const subscribe = async () => {
//     if (!user) {
//       alert('Пожалуйста, войдите в систему');
//       return;
//     }

//     setLoading(true);
//     try {
//       const permission = await Notification.requestPermission();
//       if (permission !== 'granted') {
//         alert('Разрешение на уведомления не получено');
//         return;
//       }

//       const sw = await navigator.serviceWorker.register('/sw.js', {
//         scope: '/',
//       });
//       await navigator.serviceWorker.ready;

//       const subscription = await sw.pushManager.subscribe({
//         userVisibleOnly: true,
//         applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
//       });

//       const response = await fetch('/api/push/subscribe', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           subscription: subscription.toJSON(),
//         }),
//       });

//       if (response.ok) {
//         setIsSubscribed(true);
//         alert('✅ Уведомления включены!');
//       } else {
//         throw new Error('Failed to save subscription');
//       }
//     } catch (error) {
//       console.error('Subscription error:', error);
//       alert('❌ Ошибка при включении уведомлений');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const unsubscribe = async () => {
//     setLoading(true);
//     try {
//       const sw = await navigator.serviceWorker.ready;
//       const sub = await sw.pushManager.getSubscription();
//       if (sub) {
//         await sub.unsubscribe();
        
//         await fetch('/api/push/unsubscribe', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({
//             endpoint: sub.endpoint,
//           }),
//         });
        
//         setIsSubscribed(false);
//         alert('❌ Уведомления отключены');
//       }
//     } catch (error) {
//       console.error('Unsubscribe error:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!isSupported) {
//     return null;
//   }

//   return (
//     <button
//       onClick={isSubscribed ? unsubscribe : subscribe}
//       disabled={loading}
//       style={{
//         padding: '6px 14px',
//         borderRadius: 8,
//         border: 'none',
//         background: isSubscribed ? '#ef4444' : '#22c55e',
//         color: '#fff',
//         cursor: loading ? 'default' : 'pointer',
//         opacity: loading ? 0.6 : 1,
//         fontSize: 13,
//         fontWeight: 500,
//         transition: 'all 0.2s',
//         whiteSpace: 'nowrap',
//       }}
//       onMouseEnter={(e) => {
//         if (!loading) {
//           e.currentTarget.style.transform = 'scale(1.02)';
//         }
//       }}
//       onMouseLeave={(e) => {
//         e.currentTarget.style.transform = 'scale(1)';
//       }}
//     >
//       {loading ? '⏳...' : isSubscribed ? '🔔 ВКЛ' : '🔕 ВКЛЮЧИТЬ'}
//     </button>
//   );
// }
