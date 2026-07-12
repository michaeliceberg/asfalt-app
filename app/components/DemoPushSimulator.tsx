// app/components/DemoPushSimulator.tsx
//
// Демонстрация push-уведомлений на /demo: через 10 сек после захода на
// страницу (даёт время пройти онбординг-тур и осмотреться) прилетает
// "Новая заявка", ещё через 5 сек — "Прибыл". Уведомления НЕ исчезают
// сами — только по крестику — чтобы это точно заметили. Оформлены как
// системные push-баннеры (иконка + заголовок + строки), а не просто toast.
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DemoPushItem {
  id: number;
  icon: string;
  title: string;
  lines: string[];
}

const PUSH_1: Omit<DemoPushItem, 'id'> = {
  icon: '✅',
  title: 'Новая заявка!',
  lines: ['СЕВ · ДСУ-5 Сосновский', 'ЩМА-20 · 380 т'],
};

const PUSH_2: Omit<DemoPushItem, 'id'> = {
  icon: '🚛',
  title: 'Прибыл!',
  lines: ['С599КЕ689', '38.2 т · ПромСтройКом'],
};

interface DemoPushSimulatorProps {
  onFirstShown?: () => void;
}

export default function DemoPushSimulator({ onFirstShown }: DemoPushSimulatorProps) {
  const [items, setItems] = useState<DemoPushItem[]>([]);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setItems((prev) => [...prev, { id: 1, ...PUSH_1 }]);
      onFirstShown?.();
    }, 10000);
    const t2 = setTimeout(() => {
      setItems((prev) => [...prev, { id: 2, ...PUSH_2 }]);
    }, 15000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = (id: number) => setItems((prev) => prev.filter((it) => it.id !== id));

  return (
    <div
      id="onboarding-push-notification"
      style={{
        position: 'fixed',
        top: 10,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        zIndex: 10500,
        pointerEvents: 'none',
        padding: '0 10px',
      }}
    >
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -46, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              maxWidth: 380,
              background: 'rgba(255,255,255,0.98)',
              backdropFilter: 'blur(10px)',
              border: '1px solid #e9ecef',
              borderRadius: 14,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              padding: '10px 10px 10px 12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{item.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>АБЗ Контроль</span>
                <span style={{ fontSize: 9.5, fontWeight: 500, color: '#aaa' }}>сейчас</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1a2e', marginTop: 2 }}>
                {item.title}
              </div>
              {item.lines.map((line, i) => (
                <div key={i} style={{ fontSize: 12, color: '#555', lineHeight: 1.45 }}>
                  {line}
                </div>
              ))}
            </div>
            <button
              onClick={() => close(item.id)}
              aria-label="Закрыть уведомление"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#aaa',
                padding: 3,
                flexShrink: 0,
                borderRadius: 6,
              }}
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
