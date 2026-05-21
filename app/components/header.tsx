// app/components/Header.tsx

import { motion } from 'framer-motion';

interface HeaderProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export default function Header({ refreshing, onRefresh }: HeaderProps) {
  return (
    <div className="header-top">
      <h1>📦 Асфальтовый завод</h1>
      <motion.button
        className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
        onClick={onRefresh}
        disabled={refreshing}
        whileTap={{ scale: 0.95 }}
      >
        <motion.span
          className="refresh-icon"
          animate={{ rotate: refreshing ? 360 : 0 }}
          transition={{ duration: 0.5, repeat: refreshing ? Infinity : 0 }}
        >
          🔄
        </motion.span>
        {refreshing ? '...' : 'Обновить'}
      </motion.button>
    </div>
  );
}