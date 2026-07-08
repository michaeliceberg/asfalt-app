// app/login/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🏭 iCombinator</h1>
        <p className="subtitle">Вход в систему контроля отгрузок</p>

        {/*
          Настоящая отправка формы (не fetch из JS) — важно для iOS PWA:
          так httpOnly cookie сессии приходит как часть навигации браузера
          и надёжно сохраняется, а не через ITP-подверженный fetch().
        */}
        <form method="POST" action="/api/auth/login" onSubmit={() => setSubmitting(true)}>
          <input
            type="text"
            name="username"
            placeholder="Логин"
            autoCapitalize="none"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Пароль"
            required
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
