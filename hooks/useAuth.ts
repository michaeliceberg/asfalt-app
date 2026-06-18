// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // ← Добавляем usePathname

interface User {
  id: number;
  username: string;
  groupId: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname(); // ← Получаем текущий путь

  useEffect(() => {
    const checkAuth = async () => {
      // ============================================
      // 🔥 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: пропускаем проверку на демо-странице
      // ============================================
      if (pathname === '/demo' || pathname?.startsWith('/demo')) {
        console.log('🔵 Демо-режим, пропускаем проверку авторизации');
        setLoading(false);
        return;
      }

      // ============================================
      // Обычная проверка для всех остальных страниц
      // ============================================
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (!token) {
        router.push('/login');
        setLoading(false);
        return;
      }
      
      if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch (e) {
          console.error('Failed to parse user data');
        }
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, [router, pathname]); // ← Добавляем pathname в зависимости

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  return { user, loading, logout };
}



// // hooks/useAuth.ts
// import { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';

// interface User {
//   id: number;
//   username: string;
//   groupId: number;
// }

// export function useAuth() {
//   const [user, setUser] = useState<User | null>(null);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();

//   useEffect(() => {
//     const checkAuth = async () => {
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
//   }, [router]);

//   const logout = () => {
//     localStorage.removeItem('token');
//     localStorage.removeItem('user');
//     document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
//     router.push('/login');
//   };

//   return { user, loading, logout };
// }