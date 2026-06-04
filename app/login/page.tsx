// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  groupId: number;
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Сохраняем токен в cookie (для middleware)
        document.cookie = `token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
        // Сохраняем в localStorage (для клиента)
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/');
      } else {
        setError(data.error || 'Ошибка входа');
      }
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🏭 iCombinator</h1>
        <p className="subtitle">Вход в систему контроля отгрузок</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}








// // app/login/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';

// export default function LoginPage() {
//   const [login, setLogin] = useState('');
//   const [password, setPassword] = useState('');
//   const [rememberMe, setRememberMe] = useState(true);  // ← по умолчанию Да
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
//   const router = useRouter();

//   // Проверяем, есть ли сохранённая сессия
//   useEffect(() => {
//     const token = localStorage.getItem('token');
//     const tokenExpiry = localStorage.getItem('tokenExpiry');
    
//     if (token && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
//       // Сессия ещё жива → сразу пускаем
//       router.push('/');
//     }
//   }, []);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError('');
    
//     try {
//       const response = await fetch('/api/auth/login', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ login, password, rememberMe }),
//       });
      
//       const data = await response.json();
      
//       if (response.ok) {
//         // Сохраняем токен
//         localStorage.setItem('token', data.token);
        
//         // Сохраняем время истечения (30 дней если rememberMe, иначе 1 день)
//         const expiresIn = rememberMe ? 30 : 1;
//         const expiryDate = Date.now() + expiresIn * 24 * 60 * 60 * 1000;
//         localStorage.setItem('tokenExpiry', expiryDate.toString());
        
//         // Сохраняем информацию о пользователе
//         localStorage.setItem('user', JSON.stringify(data.user));
        
//         router.push('/');
//       } else {
//         setError(data.error || 'Ошибка входа');
//       }
//     } catch (err) {
//       setError('Ошибка соединения');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="login-container">
//       <div className="login-card">
//         <h1>🏭 iCombinator</h1>
//         <p className="subtitle">Вход в систему контроля отгрузок</p>
        
//         <form onSubmit={handleSubmit}>
//           <input
//             type="text"
//             placeholder="Логин"
//             value={login}
//             onChange={(e) => setLogin(e.target.value)}
//             required
//             autoFocus
//           />
//           <input
//             type="password"
//             placeholder="Пароль"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />
          
//           <label className="checkbox-label">
//             <input 
//               type="checkbox" 
//               checked={rememberMe} 
//               onChange={(e) => setRememberMe(e.target.checked)}
//             />
//             <span>Запомнить меня (не придётся входить заново)</span>
//           </label>
          
//           {error && <div className="error">{error}</div>}
          
//           <button type="submit" disabled={loading}>
//             {loading ? 'Вход...' : 'Войти'}
//           </button>
//         </form>
        
//         <p className="hint">
//           🔐 Сессия действует {rememberMe ? '30 дней' : '1 день'}.<br/>
//           После закрытия браузера останетесь в системе.
//         </p>
//       </div>
//     </div>
//   );
// }