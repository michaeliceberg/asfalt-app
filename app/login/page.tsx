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
        // Cookie для middleware сервер уже поставил сам (httpOnly, 30 дней) —
        // тут её больше не выставляем через document.cookie, это как раз и
        // ломало сохранение сессии в PWA на Safari/iOS (ITP срезает
        // "скриптовые" cookie гораздо раньше их формального срока).
        // localStorage оставляем — от него зависит клиентская проверка
        // авторизации в hooks/useAuth.ts (отдельная от серверной middleware).
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






