// app/components/DemoBanner.tsx
'use client';

import Link from 'next/link'; // ← Добавляем импорт
import { motion } from 'framer-motion';

interface DemoBannerProps {
  totalRecords: number;
  activeTab: string;
  companyName?: string;
}

export default function DemoBanner({ totalRecords, activeTab, companyName = 'АБЗ-ДЕМО' }: DemoBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: 'linear-gradient(135deg, #ffd93d, #f6b93b)',
        borderRadius: 16,
        padding: '16px 24px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 4px 20px rgba(255, 217, 61, 0.3)',
      }}
    >
      <div>
        <span style={{ fontSize: 24, marginRight: 8 }}>🏭</span>
        <span style={{ fontWeight: 'bold', fontSize: 18, color: '#1a1a2e' }}>
          {companyName}
        </span>
        <span style={{ fontSize: 14, color: '#333', marginLeft: 12 }}>
          🎯 Демо-версия
        </span>
        {totalRecords > 0 && (
          <span style={{ fontSize: 13, color: '#555', marginLeft: 12 }}>
            📊 {totalRecords} записей
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ 
          fontSize: 12, 
          background: 'rgba(255,255,255,0.3)', 
          padding: '4px 12px', 
          borderRadius: 20,
          color: '#1a1a2e'
        }}>
          👆 Кликайте по вкладкам
        </span>
        <span style={{ fontSize: 20, animation: 'pulse 2s infinite' }}>👇</span>
      </div>
    </motion.div>
  );
}