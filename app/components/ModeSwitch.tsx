'use client';

import { motion } from 'framer-motion';

interface ModeSwitchProps {
  mode: 'tas' | 'iceberg';
  onToggle: () => void;
}

export default function ModeSwitch({ mode, onToggle }: ModeSwitchProps) {
  const handleToggle = () => {
    onToggle();
  };

  return (
    <div className="mode-switch-wrapper">
      <div className="mode-switch-container">
        {/* Анимированный бегунок - движется слева направо и обратно */}
        <motion.div
          className="mode-switch-slider"
          animate={{ x: mode === 'tas' ? 0 : '100%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
        
        {/* Кнопка ТАС */}
        <button
          className={`mode-option ${mode === 'tas' ? 'active' : ''}`}
          onClick={handleToggle}
        >
          <span className="mode-icon">☀️</span>
          <span className="mode-label">ТАС</span>
          <span className="mode-location">Транс-Авто-Сервис</span>
        </button>
        
        {/* Кнопка Айсберг */}
        <button
          className={`mode-option ${mode === 'iceberg' ? 'active' : ''}`}
          onClick={handleToggle}
        >
          <span className="mode-icon">🏔️</span>
          <span className="mode-label">Айсберг</span>
          <span className="mode-location">Щёлково • Сергиев Посад</span>
        </button>
      </div>
    </div>
  );
}