// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: number;
  username: string;
  groupId: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [accessibleFactories, setAccessibleFactories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      if (pathname === '/demo' || pathname?.startsWith('/demo')) {
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (!token) {
        router.push('/login');
        setLoading(false);
        return;
      }
      
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          setUser(parsed);
          
          // ✅ Определяем доступные заводы по groupId
          if (parsed.groupId === 1) {
            setAccessibleFactories(['ЛХ', 'ЛЮ', 'СП', 'Щ']);
          } else if (parsed.groupId === 2) {
            setAccessibleFactories(['СП', 'Щ']);
          } else if (parsed.groupId === 3) {
            setAccessibleFactories(['ЛХ', 'ЛЮ']);
          } else {
            setAccessibleFactories([]);
          }
        } catch (e) {
          console.error('Failed to parse user data');
        }
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, [router, pathname]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Cookie теперь httpOnly — стереть её может только сервер
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
  };

  return { user, loading, logout, accessibleFactories };
}





// // hooks/useAuth.ts
// import { useEffect, useState } from 'react';
// import { useRouter, usePathname } from 'next/navigation'; // ← Добавляем usePathname

// interface User {
//   id: number;
//   username: string;
//   groupId: number;
// }

// export function useAuth() {
//   const [user, setUser] = useState<User | null>(null);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();
//   const pathname = usePathname(); // ← Получаем текущий путь

//   useEffect(() => {
//     const checkAuth = async () => {
//       // ============================================
//       // 🔥 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: пропускаем проверку на демо-странице
//       // ============================================
//       if (pathname === '/demo' || pathname?.startsWith('/demo')) {
//         console.log('🔵 Демо-режим, пропускаем проверку авторизации');
//         setLoading(false);
//         return;
//       }

//       // ============================================
//       // Обычная проверка для всех остальных страниц
//       // ============================================
//       const token = localStorage.getItem('token');
//       const userData = localStorage.getItem('user');
      
//       if (!token) {
//         router.push('/login');
//         setLoading(false);
//         return;
//       }
      
//       if (userData) {
//         try {
//           setUser(JSON.parse(userData));
//         } catch (e) {
//           console.error('Failed to parse user data');
//         }
//       }
      
//       setLoading(false);
//     };
    
//     checkAuth();
//   }, [router, pathname]); // ← Добавляем pathname в зависимости

//   const logout = () => {
//     localStorage.removeItem('token');
//     localStorage.removeItem('user');
//     document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
//     router.push('/login');
//   };

//   return { user, loading, logout };
// }

