// app/components/SummaryView.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface SummaryItem {
  request: {
    number: string;
    date: string;
    division: string;
    customer: string;
    consignee: string;
    material: string;
    planQuantity: number;
    clientRequestNumber: string;
    clientRequestDate: string;
  };
  factQuantity: number;
  remaining: number;
  percentCompleted: number;
  shipments: Array<{
    number: string;
    date: string;
    quantity: number;
    driver: string;
    licensePlate: string;
  }>;
}

export default function SummaryView() {
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/summary');
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      await fetchSummary();
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [fetchSummary]);

  const formatWeight = (weight: number) => `${weight.toFixed(2)} т`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU');

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Загрузка данных...</p>
      </div>
    );
  }

  if (summary.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных по заявкам</p>
      </div>
    );
  }

  return (
    <div className="summary-view">
      {summary.map((item) => (
        <div key={item.request.number} className="summary-card">
          <div 
            className="summary-header" 
            onClick={() => setExpandedId(expandedId === item.request.number ? null : item.request.number)}
          >
            <div className="summary-title">
              <span className="request-number">№{item.request.clientRequestNumber}</span>
              <span className="request-consignee">{item.request.consignee || item.request.customer}</span>
            </div>
            <div className="summary-stats">
              <div className="plan-fact">
                <span className="plan">📋 {formatWeight(item.request.planQuantity)}</span>
                <span className="fact">✅ {formatWeight(item.factQuantity)}</span>
                <span className="remaining">⏳ {formatWeight(item.remaining)}</span>
              </div>
              <div className="percent">
                <div className="percent-bar">
                  <div className="percent-fill" style={{ width: `${Math.min(item.percentCompleted, 100)}%` }} />
                </div>
                <span className="percent-text">{item.percentCompleted}%</span>
              </div>
            </div>
            <div className="expand-icon">{expandedId === item.request.number ? '▲' : '▼'}</div>
          </div>
          
          {expandedId === item.request.number && (
            <motion.div 
              className="summary-details" 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              <div className="detail-row">
                <span className="label">Материал:</span>
                <span className="value">{item.request.material}</span>
              </div>
              <div className="detail-row">
                <span className="label">Грузополучатель:</span>
                <span className="value">{item.request.consignee || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Дата заявки:</span>
                <span className="value">{formatDate(item.request.clientRequestDate)}</span>
              </div>
              {item.shipments.length > 0 && (
                <div className="shipments-list">
                  <div className="shipments-title">✅ Выполненные отгрузки:</div>
                  {item.shipments.map((ship) => (
                    <div key={ship.number} className="shipment-item">
                      <span>№{ship.number} от {formatDate(ship.date)}</span>
                      <span>{formatWeight(ship.quantity)}</span>
                      <span className="shipment-driver">{ship.driver} ({ship.licensePlate})</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}