// app/components/ListView.tsx

'use client';

import { IncomingItem, ShipmentItem } from '@/app/page';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatTime, getDateKey, getFactoryBadgeClass, isConcreteMaterial, isSpecialMaterial, parseRussianDate } from '@/lib/utils';

type UnifiedDataItem = IncomingItem | ShipmentItem;

interface ListViewProps {
  data: UnifiedDataItem[];
  mainTab: 'incoming' | 'shipment' | 'shipmentConcrete';
}





const getDayLabel = (dateStr: string): string => {
  const date = parseRussianDate(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  // Форматируем дату как "7 июня"
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  
  return `${day} ${month}`;
};

// Отдельная функция для проверки, является ли дата сегодняшней
const isDateToday = (dateStr: string): boolean => {
  const date = parseRussianDate(dateStr);
  if (isNaN(date.getTime())) return false;
  
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
};


const getFactory = (item: UnifiedDataItem): string => {
  if ('supplier' in item) {
    const incoming = item as IncomingItem;
    if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
    if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
    if (incoming.number?.startsWith('СП')) return 'СП';
    if (incoming.number?.startsWith('Щ')) return 'Щ';
    if (incoming.division === 'ЛХ') return 'ЛХ';
    if (incoming.division === 'ЛЮ') return 'ЛЮ';
    if (incoming.division === 'СП') return 'СП';
    if (incoming.division === 'Щ') return 'Щ';
    // Демо-дивизионы — та же повторяющаяся проблема, что уже чинилась в
    // lib/utils.ts / lib/constants.ts / CompactView.tsx: локальная функция
    // не знала про ДЕМО-СЕВ/ДЕМО-ЮГ и всегда падала в '—' → фиолетовый
    // бейдж "неизвестный завод" на каждой строке демо-списка.
    if (incoming.division === 'ДЕМО-СЕВ') return 'СЕ';
    if (incoming.division === 'ДЕМО-ЮГ') return 'ЮГ';
  } else if ('division' in item) {
    const shipment = item as ShipmentItem;
    if (shipment.division === 'ЛХ') return 'ЛХ';
    if (shipment.division === 'ЛЮ') return 'ЛЮ';
    if (shipment.division === 'СП') return 'СП';
    if (shipment.division === 'Щ') return 'Щ';
    if (shipment.division === 'ДЕМО-СЕВ') return 'СЕ';
    if (shipment.division === 'ДЕМО-ЮГ') return 'ЮГ';
  }
  return '—';
};

const getCustomer = (item: UnifiedDataItem, isShipment: boolean): string => {
  if (isShipment) {
    const shipment = item as ShipmentItem;
    return shipment.consignee || shipment.customer || '—';
  } else {
    return (item as IncomingItem).supplier || '—';
  }
};

const getMaterial = (item: UnifiedDataItem): string => {
  let material = item.material;
  if (material.length > 20) {
    material = material.substring(0, 17) + '...';
  }
  return material;
};

const getLicensePlate = (item: UnifiedDataItem): string => {
  const plate = item.licensePlate || '—';
  return plate.length > 10 ? plate.substring(0, 10) : plate;
};



export default function ListView({ data, mainTab }: ListViewProps) {
  const isShipment = mainTab === 'shipment' || mainTab === 'shipmentConcrete';
  const isConcreteOnly = mainTab === 'shipmentConcrete';

  // Сворачивание по дням: верхние 2 дня развёрнуты по умолчанию, остальные
  // свёрнуты — иначе на большом периоде список получается очень длинным.
  // toggledDates хранит только ОТКЛОНЕНИЯ от дефолта (XOR-логика ниже),
  // поэтому и верхние дни можно свернуть кликом, и нижние — развернуть.
  const [toggledDates, setToggledDates] = useState<Set<string>>(new Set());
  const toggleDate = (date: string) => {
    setToggledDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };
  
  // Фильтруем данные по типу материала
  const filteredData = data.filter(item => {
    if (mainTab === 'incoming') return true;
    if (isConcreteOnly) return isConcreteMaterial(item.material);
    return !isConcreteMaterial(item.material);
  });
  
  // Группируем по дате
  const groupedByDate = filteredData.reduce((acc, item) => {
    const dateKey = getDateKey(item.date);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, UnifiedDataItem[]>);
  
  // Сортируем даты (новые сверху)
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
    const dateA = parseRussianDate(a);
    const dateB = parseRussianDate(b);
    return dateB.getTime() - dateA.getTime();
  });
  
  if (filteredData.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных</p>
      </div>
    );
  }
  
  return (
    <div className="compact-view">
      {sortedDates.map((date, dateIdx) => {
        const items = groupedByDate[date];
        const isDateToday = date === getDateKey(new Date().toISOString());
        const isDefaultExpanded = dateIdx < 2;
        const isExpanded = isDefaultExpanded !== toggledDates.has(date);

        return (
          <div key={date} className="compact-date-group">




<div className={`compact-date-header ${isDateToday ? 'today-separator' : ''}`}>
  <div
    className="date-wrapper"
    onClick={() => toggleDate(date)}
    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
  >
    {isExpanded ? <ChevronDown size={14} strokeWidth={2.4} /> : <ChevronRight size={14} strokeWidth={2.4} />}
    <span className="date-text">{getDayLabel(date)}</span>
    {getDayLabel(date) === 'СЕГОДНЯ' && <span className="today-badge">СЕГОДНЯ</span>}
  </div>
  {!isExpanded && (
    <button
      onClick={() => toggleDate(date)}
      style={{
        background: 'transparent',
        border: 'none',
        color: '#3a56d4',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        padding: '2px 6px',
      }}
    >
      Развернуть ({items.length})
    </button>
  )}
</div>
{isExpanded && (
<div className="list-table">
  <div className="list-header">
    <span className="list-time">Время</span>
    <span className="list-material">Материал</span>
    <span className="list-quantity">т</span>
    <span className="list-customer">Контрагент</span>
    <span className="list-factory"></span>
    <span className="list-license">Машина</span>
  </div>
  <div className="list-rows">
    {[...items].sort((a, b) => {
      const dateA = parseRussianDate(a.date);
      const dateB = parseRussianDate(b.date);
      return dateB.getTime() - dateA.getTime();
    }).map((item, idx) => {
      const factory = getFactory(item);
      const time = formatTime(item.date);
      const isConcrete = isConcreteMaterial(item.material);
      const isSpecial = isSpecialMaterial(item.material);
      
      // Определяем, какой бейдж показывать (приоритет: бетон > инертные)
      let badge = null;
      if (isConcrete && isShipment) {
        badge = <span className="concrete-badge-row">БЕТОН</span>;
      } else if (isSpecial && isShipment && !isConcrete) {
        badge = <span className="special-badge">ИНЕРТНЫЕ</span>;
      }
      
      return (
        <div 
          key={idx} 
          className={`list-row ${isConcrete && isShipment ? 'concrete-row' : ''} ${isSpecial && !isConcrete ? 'special-row' : ''}`}
        >
          <span className="list-time">{time}</span>
          <span className="list-material" title={item.material}>{getMaterial(item)}</span>
          <span className="list-quantity">
            {item.quantity.toFixed(1)} {isConcrete ? 'м³' : 'т'}
          </span>
          <span className="list-customer" title={getCustomer(item, isShipment)}>
            {getCustomer(item, isShipment)}
            {badge}
          </span>
          <span className="list-factory">
            <span className={getFactoryBadgeClass(factory)} title={factory === '—' ? 'Завод не определён' : `Завод: ${factory}`}>{factory}</span>
          </span>
          <span className="list-license" title={item.licensePlate || '—'}>{getLicensePlate(item)}</span>
        </div>
      );
    })}
  </div>
</div>
)}



          </div>
        );
      })}
    </div>
  );
}

