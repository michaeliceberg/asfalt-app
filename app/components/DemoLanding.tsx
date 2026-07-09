// app/components/DemoLanding.tsx
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function DemoLanding() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 20,
        padding: '32px 40px',
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}
    >
      {/* Декоративные элементы */}
      <div style={{
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,217,61,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -80,
        left: -80,
        width: 250,
        height: 250,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(74, 144, 217, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Основной контент */}
        <div style={{ textAlign: 'center' }}>
          {/* Иконка и заголовок */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 8 }}>🚀</span>
            <h2 style={{ 
              color: '#fff', 
              fontSize: 28, 
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-0.5px'
            }}>
              Хотите <span style={{ color: '#ffd93d' }}>такое же приложение</span> для своего завода?
            </h2>
          </div>

          {/* Подзаголовок */}
          <p style={{ 
            color: '#b0b0c8', 
            fontSize: 16, 
            marginBottom: 24,
            maxWidth: 500,
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.6
          }}>
            📊 Контроль отгрузок и поступлений в реальном времени
          </p>

          {/* Кнопки */}
          <div style={{ 
            display: 'flex', 
            gap: 16, 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <a
              href="mailto:abziceberg@gmail.com?subject=Запрос%20на%20внедрение%20АБЗ%20Контроль"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 36px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
                color: '#1a1a2e',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 16,
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 20px rgba(255, 217, 61, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.04)';
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(255, 217, 61, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 217, 61, 0.3)';
              }}
            >
              📧 Связаться с нами
            </a>

            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 36px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(10px)',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 16,
                border: '1px solid rgba(255,255,255,0.12)',
                transition: 'transform 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.04)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }}
            >
              🔐 Войти в систему
            </Link>
          </div>

          {/* Дополнительная информация */}
          <div style={{ 
            marginTop: 20,
            display: 'flex',
            justifyContent: 'center',
            gap: 32,
            flexWrap: 'wrap',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8888aa', fontSize: 13 }}>
              <span>⚡</span>
              <span>Реальное время</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8888aa', fontSize: 13 }}>
              <span>📊</span>
              <span>Аналитика</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8888aa', fontSize: 13 }}>
              <span>🚛</span>
              <span>Контроль отгрузок</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8888aa', fontSize: 13 }}>
              <span>📦</span>
              <span>Учёт поступлений</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}