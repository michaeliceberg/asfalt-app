// app/demo/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    // Устанавливаем флаг демо-режима
    localStorage.setItem('demoMode', 'true');
    console.log('✅ Демо-режим активирован!');
    // Перенаправляем на главную
    router.push('/');
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <div className="premium-spinner" style={{ width: 48, height: 48 }}>
        <div className="premium-spinner-ring"></div>
        <div className="premium-spinner-ring"></div>
        <div className="premium-spinner-ring"></div>
      </div>
      <p style={{ color: '#6c757d', fontSize: '16px' }}>Загрузка демо-версии...</p>
    </div>
  );
}