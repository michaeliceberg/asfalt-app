// app/components/DemoLanding.tsx
'use client';

import { motion } from 'framer-motion';
import { Rocket, Send, Phone, ShoppingCart } from 'lucide-react';

function scrollToPricing() {
  document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          <Rocket size={26} color="#ffd93d" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
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
          <button
            onClick={scrollToPricing}
            title="Смотреть тарифы"
            aria-label="Смотреть тарифы"
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(255, 217, 61, 0.12)',
              border: '1px solid rgba(255, 217, 61, 0.3)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ShoppingCart size={17} strokeWidth={2.2} color="#ffd93d" />
          </button>
        </div>

        {/* CTA — растянуты на всю ширину */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <a
            href="https://t.me/michaeldeve"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: '1 1 0',
              minWidth: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '11px 10px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
              color: '#1a1a2e',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 16px rgba(255, 217, 61, 0.28)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 6px 22px rgba(255, 217, 61, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 217, 61, 0.28)';
            }}
          >
            <Send size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>Написать в Telegram</span>
          </a>

          <a
            href="tel:+79160991997"
            style={{
              flex: '1 1 0',
              minWidth: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '11px 10px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(10px)',
              color: '#e0e0f0',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 13,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
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
            <Phone size={15} strokeWidth={2.2} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>+7 (916) 099-19-97</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
}
