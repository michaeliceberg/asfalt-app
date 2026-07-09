// app/components/DemoLanding.tsx
'use client';

import { motion } from 'framer-motion';

const FEATURES = [
  { icon: '📲', text: 'Ваша 1С на телефоне' },
  { icon: '🔄', text: '24/7, обновление каждые 2 мин' },
  { icon: '🛰️', text: 'GPS-навигация машин' },
  { icon: '🔔', text: 'Push-уведомления' },
  { icon: '🔐', text: 'Доступ по ролям' },
];

export default function DemoLanding() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 16,
        padding: '18px 24px',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
      }}
    >
      {/* Декоративные элементы (уменьшены) */}
      <div style={{
        position: 'absolute',
        top: -80,
        right: -80,
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,217,61,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -60,
        left: -60,
        width: 180,
        height: 180,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(74, 144, 217, 0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Основная строка: заголовок слева, контакты справа */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>🚀</span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                color: '#fff',
                fontSize: 17,
                fontWeight: 700,
                margin: 0,
                letterSpacing: '-0.2px',
                lineHeight: 1.3,
              }}>
                Хотите <span style={{ color: '#ffd93d' }}>такое же приложение</span> для своего завода?
              </h2>
              <p style={{
                color: '#9090b0',
                fontSize: 12,
                margin: '3px 0 0',
              }}>
                Контроль отгрузок и поступлений в реальном времени
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            <a
              href="https://t.me/michaeldeve"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '10px 18px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
                color: '#1a1a2e',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 13.5,
                whiteSpace: 'nowrap',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 16px rgba(255, 217, 61, 0.28)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.04)';
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(255, 217, 61, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 217, 61, 0.28)';
              }}
            >
              ✈️ Написать в Telegram
            </a>

            <a
              href="tel:+79160991997"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '10px 16px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(10px)',
                color: '#e0e0f0',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 13,
                whiteSpace: 'nowrap',
                border: '1px solid rgba(255,255,255,0.12)',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }}
            >
              📞 +7 (916) 099-19-97
            </a>
          </div>
        </div>

        {/* Фичи — компактные плашки */}
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {FEATURES.map((f, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#c0c0d8',
                fontSize: 11.5,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
