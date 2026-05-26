// components/ChartsView.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShipmentItem } from '@/app/page';

interface ChartsViewProps {
  data: ShipmentItem[];
}

interface DailyData {
  date: string;
  total: number;
  count: number;
  factories: { [key: string]: number };
}

export default function ChartsView({ data }: ChartsViewProps) {
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [selectedFactory, setSelectedFactory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const formatDateShort = (dateStr: string) => {
    const parts = dateStr.split('.');
    return `${parts[0]}.${parts[1]}`;
  };

  const processData = useCallback(() => {
    const today = new Date();
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(today.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0);

    const recentShipments = data.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= tenDaysAgo;
    });

    const grouped: { [key: string]: DailyData } = {};

    recentShipments.forEach(shipment => {
      const date = new Date(shipment.date);
      const dateKey = date.toLocaleDateString('ru-RU');
      const factory = shipment.division === 'Луховицы' ? 'ЛХ' : 'ЛЮ';
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          total: 0,
          count: 0,
          factories: { ЛХ: 0, ЛЮ: 0 }
        };
      }
      
      grouped[dateKey].total += shipment.quantity;
      grouped[dateKey].count += 1;
      grouped[dateKey].factories[factory] += shipment.quantity;
    });

    const sorted = Object.values(grouped).sort((a, b) => {
      const dateA = new Date(a.date.split('.').reverse().join('-'));
      const dateB = new Date(b.date.split('.').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });

    setDailyData(sorted);
    setLoading(false);
  }, [data]);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      processData();
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [processData]);

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr.split('.').reverse().join('-'));
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) return 'СЕГОДНЯ';
    return `${date.getDate()}.${date.getMonth() + 1}`;
  };

  const getFactoryData = () => {
    if (selectedFactory === 'all') {
      return dailyData;
    }
    return dailyData.map(day => ({
      ...day,
      total: day.factories[selectedFactory] || 0
    }));
  };

  const filteredData = getFactoryData();
  const filteredMax = Math.max(...filteredData.map(d => d.total), 0);

  const getBarHeightFiltered = (total: number) => {
    if (filteredMax === 0) return 0;
    return (total / filteredMax) * 100;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (dailyData.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных за последние 10 дней</p>
      </div>
    );
  }

  return (
    <div className="charts-view">
      <div className="charts-header">
        <div className="charts-title">📊 Отгрузки асфальта за 10 дней</div>
        <div className="factory-filter">
          <button
            className={`factory-filter-btn ${selectedFactory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedFactory('all')}
          >
            Все заводы
          </button>
          <button
            className={`factory-filter-btn ${selectedFactory === 'ЛХ' ? 'active' : ''}`}
            onClick={() => setSelectedFactory('ЛХ')}
          >
            🏭 Луховицы
          </button>
          <button
            className={`factory-filter-btn ${selectedFactory === 'ЛЮ' ? 'active' : ''}`}
            onClick={() => setSelectedFactory('ЛЮ')}
          >
            🏭 Люберцы
          </button>
        </div>
      </div>

      <div className="charts-container">
        <div className="bars-container">
          {filteredData.map((day, idx) => {
            const dayLabel = getDayLabel(day.date);
            const isToday = dayLabel === 'СЕГОДНЯ';
            
            return (
              <div key={idx} className="bar-column">
                <div className="bar-wrapper">
                  <div 
                    className="bar"
                    style={{ height: `${getBarHeightFiltered(day.total)}%` }}
                  >
                    <span className="bar-value">{Math.round(day.total)}</span>
                  </div>
                </div>
                <div className={`bar-label ${isToday ? 'today' : ''}`}>
                  {dayLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Статистика по дням в табличном виде */}
      <div className="charts-stats">
        <div className="stats-header">
          <span>Дата</span>
          <span>Тонны</span>
          <span>Машин</span>
          <span>ЛХ</span>
          <span>ЛЮ</span>
        </div>
        {filteredData.map((day, idx) => (
          <div key={idx} className="stats-row">
            <span className="stats-date">{formatDateShort(day.date)}</span>
            <span className="stats-total">{Math.round(day.total)} т</span>
            <span className="stats-count">{day.count}</span>
            <span className="stats-lx">{Math.round(day.factories.ЛХ)} т</span>
            <span className="stats-ly">{Math.round(day.factories.ЛЮ)} т</span>
          </div>
        ))}
      </div>
    </div>
  );
}