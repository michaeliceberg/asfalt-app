// app/components/ListView.tsx

'use client';

import { IncomingItem, ShipmentItem } from '@/app/page';
import { formatTime, getDateKey, getFactoryBadgeClass, isConcreteMaterial, isSpecialMaterial, parseRussianDate } from '@/lib/utils';

type UnifiedDataItem = IncomingItem | ShipmentItem;

interface ListViewProps {
  data: UnifiedDataItem[];
  mainTab: 'incoming' | 'shipment' | 'shipmentConcrete';
}







// const formatTime = (dateStr: string): string => {
//   const date = parseRussianDate(dateStr);
//   if (isNaN(date.getTime())) return '—';
//   return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
// };

// const getDateKey = (dateString: string): string => {
//   const date = parseRussianDate(dateString);
//   if (isNaN(date.getTime())) return dateString;
  
//   const day = date.getDate().toString().padStart(2, '0');
//   const month = (date.getMonth() + 1).toString().padStart(2, '0');
//   const year = date.getFullYear();
  
//   return `${day}.${month}.${year}`;
// };




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
  } else if ('division' in item) {
    const shipment = item as ShipmentItem;
    if (shipment.division === 'ЛХ') return 'ЛХ';
    if (shipment.division === 'ЛЮ') return 'ЛЮ';
    if (shipment.division === 'СП') return 'СП';
    if (shipment.division === 'Щ') return 'Щ';
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
      {sortedDates.map(date => {
        const items = groupedByDate[date];
        const isDateToday = date === getDateKey(new Date().toISOString());
        
        return (
          <div key={date} className="compact-date-group">




<div className={`compact-date-header ${isDateToday ? 'today-separator' : ''}`}>
  <div className="date-wrapper">
    <span className="date-text">{getDayLabel(date)}</span>
    {getDayLabel(date) === 'СЕГОДНЯ' && <span className="today-badge">СЕГОДНЯ</span>}
  </div>
</div>
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
            <span className={getFactoryBadgeClass(factory)}>{factory}</span>
          </span>
          <span className="list-license" title={item.licensePlate || '—'}>{getLicensePlate(item)}</span>
        </div>
      );
    })}
  </div>
</div>




          </div>
        );
      })}
    </div>
  );
}

