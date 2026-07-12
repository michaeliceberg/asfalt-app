// app/components/ChartsView.tsx
//
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { ShipmentItem } from '@/app/page';
import LoadingSpinner from './LoadingSpinner';
import { isConcreteMaterial } from '@/lib/utils';
import { BarChart3, Factory } from 'lucide-react';

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

// Короткие подписи для заводов на графике — известные боевые коды +
// демо-коды. Всё остальное просто показываем как есть (fallback).
const getFactoryLabel = (factory: string): string => {
  switch (factory) {
    case 'ЛХ': return 'Луховицы';
    case 'ЛЮ': return 'Люберцы';
    case 'СП': return 'Сергиев Посад';
    case 'Щ': return 'Щёлково';
    case 'ДЕМО-СЕВ': return 'Северный';
    case 'ДЕМО-ЮГ': return 'Южный';
    default: return factory;
  }
};

export default function ChartsView({ data, mode = 'tas' }: ChartsViewProps) {
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [selectedFactory, setSelectedFactory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const formatDateShort = (dateStr: string) => {
    const parts = dateStr.split('.');
    return `${parts[0]}.${parts[1]}`;
  };

  // Заводы берём не из жёстко зашитого списка по mode (ЛХ/ЛЮ или СП/Щ),
  // а прямо из переданных данных — иначе демо-коды (ДЕМО-СЕВ/ДЕМО-ЮГ)
  // отфильтровывались подчистую и графики оставались пустыми.
  const factoryCodes = useMemo(() => {
    const codes = new Set<string>();
    data.forEach(item => {
      if (item.division) codes.add(item.division);
    });
    return Array.from(codes).sort();
  }, [data]);

  const availableFactories = useMemo(() => ['all', ...factoryCodes], [factoryCodes]);

  const processData = useCallback(() => {
    setLoading(true);

    // Фильтруем по типу материала (только асфальт) — фильтр по заводу
    // сюда НЕ применяем: раньше данные обрезались по выбранному заводу
    // ДО группировки по дням, из-за чего total/count по бару и колонка
    // "Машин" совпадали, а вот колонки-разбивка по остальным заводам в
    // таблице внизу всегда превращались в нули — они физически не могли
    // получить данные, ведь те записи были уже отфильтрованы. Теперь
    // фильтр применяем ТОЛЬКО к total/count (бар и верхние колонки), а
    // разбивку по заводам считаем всегда по полному набору — так таблицу
    // можно использовать для сравнения заводов, даже когда выбран один.
    const materialFiltered = data.filter(item => !isConcreteMaterial(item.material));

    // Вычисляем дату 10 дней назад
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tenDaysAgo = new Date(today);
    tenDaysAgo.setDate(today.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0);

    // Фильтруем по дате (последние 10 дней) - используем getDateKey для сравнения
    const recentShipments = materialFiltered.filter(item => {
      const itemDate = parseUniversalDate(item.date);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate >= tenDaysAgo;
    });

    // Если нет данных за последние 10 дней, показываем последние 10 записей
    let shipmentsToShow = recentShipments;
    if (recentShipments.length === 0 && materialFiltered.length > 0) {
      shipmentsToShow = materialFiltered.slice(-10);
    }

    // Группируем по дням
    const grouped: { [key: string]: DailyData } = {};

    shipmentsToShow.forEach(shipment => {
      const dateKey = getDateKey(shipment.date);
      if (dateKey === 'unknown') return;

      const factory = shipment.division;
      const matchesFactoryFilter = selectedFactory === 'all' || factory === selectedFactory;

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          total: 0,
          count: 0,
          factories: Object.fromEntries(factoryCodes.map(code => [code, 0])),
        };
      }

      if (matchesFactoryFilter) {
        grouped[dateKey].total += shipment.quantity;
        grouped[dateKey].count += 1;
      }
      // Разбивка по заводам всегда полная, независимо от фильтра.
      if (factory) {
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
  }, [data, selectedFactory, factoryCodes]);

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

  // total/count в dailyData уже учитывают выбранный фильтр завода (см.
  // processData) — отдельная функция-надстройка больше не нужна.
  const filteredDataForChart = dailyData;
  const filteredMax = Math.max(...filteredDataForChart.map(d => d.total), 0);

  const getBarHeight = (total: number) => {
    if (filteredMax === 0) return 0;
    return (total / filteredMax) * 100;
  };

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
        <div className="charts-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={16} strokeWidth={2.2} />
          Отгрузки асфальта за 10 дней
          {factoryCodes.length > 0 && ` (${factoryCodes.map(getFactoryLabel).join('/')})`}
        </div>
        <div className="factory-filter">
          {availableFactories.map(factory => (
            <button
              key={factory}
              className={`factory-filter-btn ${selectedFactory === factory ? 'active' : ''}`}
              onClick={() => setSelectedFactory(factory)}
            >
              {factory === 'all' ? 'Все заводы' : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Factory size={12} strokeWidth={2.2} />{getFactoryLabel(factory)}
                </span>
              )}
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
          {factoryCodes.map(code => (
            <span key={code}>{getFactoryLabel(code)}</span>
          ))}
        </div>
        {filteredDataForChart.map((day, idx) => (
          <div key={idx} className="stats-row">
            <span className="stats-date">{formatDateShort(day.date)}</span>
            <span className="stats-total">{Math.round(day.total)} т</span>
            <span className="stats-count">{day.count}</span>
            {factoryCodes.map(code => (
              <span key={code} className="stats-lx">{Math.round(day.factories[code] || 0)} т</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
