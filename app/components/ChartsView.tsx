// app/components/ChartsView.tsx
// 
'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShipmentItem } from '@/app/page';
import LoadingSpinner from './LoadingSpinner';
import { isConcreteMaterial } from '@/lib/utils';

interface ChartsViewProps {
  data: ShipmentItem[];
  mode?: 'tas' | 'iceberg';
}

interface DailyData {
  date: string;
  total: number;
  count: number;
  factories: { [key: string]: number };
}

// Универсальная функция парсинга даты (работает и для ТАС, и для Айсберг)
const parseUniversalDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  
  // Если уже ISO формат (для ТАС данные могут быть в ISO)
  if (dateString.includes('T') && !dateString.includes('.')) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Формат ДД.ММ.ГГГГ ЧЧ:ММ:СС (для Айсберг)
  const parts = dateString.split(' ');
  const dateParts = parts[0].split('.');
  
  if (dateParts.length === 3) {
    let hour = 0, minute = 0;
    if (parts[1]) {
      const timeParts = parts[1].split(':');
      hour = parseInt(timeParts[0], 10);
      minute = parseInt(timeParts[1], 10);
    }
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    return new Date(year, month, day, hour, minute);
  }
  
  // Пробуем стандартный парсинг
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) return date;
  
  return new Date();
};

// Функция для получения строки даты для группировки (ДД.ММ.ГГГГ)
const getDateKey = (dateString: string): string => {
  const date = parseUniversalDate(dateString);
  if (isNaN(date.getTime())) return 'unknown';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

// ISCONCRETEMATERIAL
// Функция для определения типа материала (асфальт/бетон)
// const isConcreteMaterial = (material: string): boolean => {
//   if (!material) return false;
//   const lower = material.toLowerCase();
//   return lower.includes('бст') || 
//          lower.includes('бетон') ||
//          lower.includes('раствор') ||
//          lower.includes('бсм');
// };

export default function ChartsView({ data, mode = 'tas' }: ChartsViewProps) {
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [selectedFactory, setSelectedFactory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const formatDateShort = (dateStr: string) => {
    const parts = dateStr.split('.');
    return `${parts[0]}.${parts[1]}`;
  };

  // Доступные заводы в зависимости от режима
  const getAvailableFactories = () => {
    if (mode === 'tas') {
      return ['all', 'ЛХ', 'ЛЮ'];
    } else {
      return ['all', 'СП', 'Щ'];
    }
  };

  // Названия заводов для отображения
  const getFactoryLabel = (factory: string) => {
    switch (factory) {
      case 'ЛХ': return 'Луховицы';
      case 'ЛЮ': return 'Люберцы';
      case 'СП': return 'Сергиев Посад';
      case 'Щ': return 'Щёлково';
      default: return 'Все заводы';
    }
  };

  const processData = useCallback(() => {
    setLoading(true);
    
    // Определяем допустимые заводы для текущего режима
    const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
    
    // Фильтруем по заводам текущего режима
    let filteredData = data.filter(item => validFactories.includes(item.division));
    
    // Фильтруем по выбранному заводу
    if (selectedFactory !== 'all') {
      filteredData = filteredData.filter(item => item.division === selectedFactory);
    }
    
    // Фильтруем по типу материала (только асфальт)
    filteredData = filteredData.filter(item => !isConcreteMaterial(item.material));
    
    // Вычисляем дату 10 дней назад
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(today.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0);
    
    // Фильтруем по дате (последние 10 дней) - используем getDateKey для сравнения
    const recentShipments = filteredData.filter(item => {
      const itemDate = parseUniversalDate(item.date);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate >= tenDaysAgo;
    });
    
    // Если нет данных за последние 10 дней, показываем последние 10 записей
    let shipmentsToShow = recentShipments;
    if (recentShipments.length === 0 && filteredData.length > 0) {
      shipmentsToShow = filteredData.slice(-10);
    }
    
    // Группируем по дням
    const grouped: { [key: string]: DailyData } = {};
    
    shipmentsToShow.forEach(shipment => {
      const dateKey = getDateKey(shipment.date);
      if (dateKey === 'unknown') return;
      
      const factory = shipment.division;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          total: 0,
          count: 0,
          factories: { ЛХ: 0, ЛЮ: 0, СП: 0, Щ: 0 }
        };
      }
      
      grouped[dateKey].total += shipment.quantity;
      grouped[dateKey].count += 1;
      if (factory && grouped[dateKey].factories[factory] !== undefined) {
        grouped[dateKey].factories[factory] = (grouped[dateKey].factories[factory] || 0) + shipment.quantity;
      }
    });
    
    // Сортируем по дате (от старых к новым)
    const sorted = Object.values(grouped).sort((a, b) => {
      const [dayA, monthA, yearA] = a.date.split('.');
      const [dayB, monthB, yearB] = b.date.split('.');
      const dateA = new Date(parseInt(yearA), parseInt(monthA) - 1, parseInt(dayA));
      const dateB = new Date(parseInt(yearB), parseInt(monthB) - 1, parseInt(dayB));
      return dateA.getTime() - dateB.getTime();
    });
    
    setDailyData(sorted);
    setLoading(false);
  }, [data, selectedFactory, mode]);

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
    const [day, month, year] = dateStr.split('.');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    if (date.getTime() === today.getTime()) return 'СЕГОДНЯ';
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.getTime() === yesterday.getTime()) return 'ВЧЕРА';
    
    return `${day}.${month}`;
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

  const filteredDataForChart = getFactoryData();
  const filteredMax = Math.max(...filteredDataForChart.map(d => d.total), 0);

  const getBarHeight = (total: number) => {
    if (filteredMax === 0) return 0;
    return (total / filteredMax) * 100;
  };

  const availableFactories = getAvailableFactories();

  if (loading && dailyData.length === 0) {
    return <LoadingSpinner message="Загрузка графиков..." size="medium" />;
  }

  if (dailyData.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных за последние 10 дней для выбранного режима</p>
      </div>
    );
  }

  return (
    <div className="charts-view">
      <div className="charts-header">
        <div className="charts-title">
          {mode === 'tas' ? '📊 Отгрузки асфальта за 10 дней (ЛХ/ЛЮ)' : '📊 Отгрузки асфальта за 10 дней (СП/Щ)'}
        </div>
        <div className="factory-filter">
          {availableFactories.map(factory => (
            <button
              key={factory}
              className={`factory-filter-btn ${selectedFactory === factory ? 'active' : ''}`}
              onClick={() => setSelectedFactory(factory)}
            >
              {factory === 'all' ? 'Все заводы' : `🏭 ${getFactoryLabel(factory)}`}
            </button>
          ))}
        </div>
      </div>

      <div className="charts-container">
        <div className="bars-container">
          {filteredDataForChart.map((day, idx) => {
            const dayLabel = getDayLabel(day.date);
            const isToday = dayLabel === 'СЕГОДНЯ';
            const barHeight = getBarHeight(day.total);
            
            return (
              <div key={idx} className="bar-column">
                <div className="bar-wrapper">
                  <div 
                    className="bar"
                    style={{ height: `${barHeight}%` }}
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
          {mode === 'tas' ? (
            <>
              <span>ЛХ</span>
              <span>ЛЮ</span>
            </>
          ) : (
            <>
              <span>СП</span>
              <span>Щ</span>
            </>
          )}
        </div>
        {filteredDataForChart.map((day, idx) => (
          <div key={idx} className="stats-row">
            <span className="stats-date">{formatDateShort(day.date)}</span>
            <span className="stats-total">{Math.round(day.total)} т</span>
            <span className="stats-count">{day.count}</span>
            {mode === 'tas' ? (
              <>
                <span className="stats-lx">{Math.round(day.factories.ЛХ || 0)} т</span>
                <span className="stats-ly">{Math.round(day.factories.ЛЮ || 0)} т</span>
              </>
            ) : (
              <>
                <span className="stats-lx">{Math.round(day.factories.СП || 0)} т</span>
                <span className="stats-ly">{Math.round(day.factories.Щ || 0)} т</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


