// app/components/OnboardingTour.tsx
//
// Короткая "экскурсия" для тех, кто впервые открыл /demo: 3 шага,
// затемняем всё кроме нужного элемента (spotlight через огромный
// box-shadow — без SVG-масок, надёжно работает везде) и показываем
// подсказку рядом. Показывается один раз — состояние в localStorage.
//
// Прожектор и подсказка — это ОДИН persistent motion.div на весь тур
// (без key={stepIndex}), у которого просто меняется animate-цель
// (top/left/width/height). Так framer-motion сам плавно интерполирует
// между позициями шагов, а не дёргается с одного места на другое.
// Текст внутри подсказки при этом мягко перекрещивается через
// AnimatePresence — двигается плавно контейнер, а не сам текст.
'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TourStep {
  targetId: string;
  title: string;
  text: string;
}

const STEPS: TourStep[] = [
  {
    targetId: 'onboarding-guest-badge',
    title: 'Вы сейчас гость',
    text: 'Это демо-версия — данные ненастоящие, но приложение работает точно так же, как боевое.',
  },
  {
    targetId: 'onboarding-factory-filter',
    title: 'Выберите завод',
    text: 'Можно смотреть все заводы сразу или переключаться между конкретными.',
  },
  {
    targetId: 'onboarding-view-tabs',
    title: 'Разные виды данных',
    text: 'Компактный список, таблица, графики активности и топ клиентов — переключайтесь как удобнее.',
  },
];

const STORAGE_KEY = 'abz_demo_tour_seen_v2';
const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT_ESTIMATE = 150;
const SPRING = { type: 'spring' as const, stiffness: 260, damping: 28 };

export default function OnboardingTour() {
  const [stepIndex, setStepIndex] = useState<number>(-1); // -1 = тур не запущен
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: 400, h: 800 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => setStepIndex(0), 700);
    return () => clearTimeout(timer);
  }, []);

  const measure = useCallback(() => {
    if (stepIndex < 0 || stepIndex >= STEPS.length) return;
    const el = document.getElementById(STEPS[stepIndex].targetId);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Даём scrollIntoView время доехать перед тем, как замерять позицию —
    // иначе прожектор поедет туда, где элемент был ДО скролла.
    const t = setTimeout(() => {
      setRect(el.getBoundingClientRect());
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }, 320);
    return () => clearTimeout(t);
  }, [stepIndex]);

  useEffect(() => {
    const cleanup = measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (cleanup) cleanup();
    };
  }, [measure]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setStepIndex(-1);
    setRect(null);
  };

  const next = () => {
    if (stepIndex >= STEPS.length - 1) {
      finish();
    } else {
      setStepIndex(stepIndex + 1); // rect НЕ сбрасываем — так прожектор плавно едет со старого места на новое
    }
  };

  if (stepIndex < 0 || stepIndex >= STEPS.length) return null;
  const step = STEPS[stepIndex];
  const { w: viewportW, h: viewportH } = viewport;

  const spotlightTarget = rect
    ? {
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
        borderRadius: 14,
        opacity: 1,
      }
    : {
        top: 0,
        left: 0,
        width: viewportW,
        height: viewportH,
        borderRadius: 0,
        opacity: 1,
      };

  const tooltipBelow = rect ? rect.bottom + TOOLTIP_HEIGHT_ESTIMATE + 20 < viewportH : true;
  const rawTop = rect
    ? (tooltipBelow ? rect.bottom + SPOTLIGHT_PADDING + 14 : rect.top - SPOTLIGHT_PADDING - 14 - TOOLTIP_HEIGHT_ESTIMATE)
    : viewportH / 2 - 80;
  const tooltipTop = Math.max(12, Math.min(rawTop, viewportH - TOOLTIP_HEIGHT_ESTIMATE - 12));
  const tooltipLeft = rect
    ? Math.min(Math.max(rect.left, 16), viewportW - TOOLTIP_WIDTH - 16)
    : (viewportW - TOOLTIP_WIDTH) / 2;

  return (
    <>
      <motion.div
        initial={false}
        animate={spotlightTarget}
        transition={SPRING}
        style={{
          position: 'fixed',
          boxShadow: '0 0 0 9999px rgba(10,10,20,0.8)',
          border: '2px solid rgba(255,217,61,0.6)',
          zIndex: 10001,
          pointerEvents: 'none',
        }}
      />
      <motion.div
        initial={false}
        animate={{ top: tooltipTop, left: tooltipLeft, opacity: 1 }}
        transition={SPRING}
        style={{
          position: 'fixed',
          width: TOOLTIP_WIDTH,
          zIndex: 10002,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1px solid rgba(255,217,61,0.3)',
          borderRadius: 14,
          padding: '14px 16px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          color: '#fff',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#ffd93d', fontWeight: 700, letterSpacing: '0.3px' }}>
                ШАГ {stepIndex + 1} ИЗ {STEPS.length}
              </span>
              <button
                onClick={finish}
                style={{ background: 'none', border: 'none', color: '#9090b0', fontSize: 12, cursor: 'pointer', padding: 0 }}
              >
                Пропустить
              </button>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{step.title}</div>
            <div style={{ fontSize: 12.5, color: '#c0c0d8', lineHeight: 1.45, marginBottom: 12 }}>{step.text}</div>
            <button
              onClick={next}
              style={{
                width: '100%',
                padding: '9px 0',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
                color: '#1a1a2e',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {stepIndex === STEPS.length - 1 ? 'Понятно!' : 'Далее'}
            </button>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </>
  );
}
