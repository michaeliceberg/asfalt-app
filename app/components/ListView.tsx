// components/ListView.tsx
import { motion } from 'framer-motion';

// Импортируем типы из page или определяем заново
interface IncomingItem {
  id: number;
  number: string;
  date: string;
  supplier: string;
  material: string;
  gross: number | null;
  tara: number | null;
  quantity: number;
  driver: string | null;
  licensePlate: string | null;
  createdAt: number;
}

interface ShipmentItem {
  id: number;
  number: string;
  date: string;
  division: string;
  customer: string;
  consignee: string | null;
  material: string;
  gross: number | null;
  tara: number | null;
  quantity: number;
  driver: string | null;
  licensePlate: string | null;
  clientRequestNumber: string | null;
  clientRequestDate: string | null;
  createdAt: number;
}

type UnifiedDataItem = IncomingItem | ShipmentItem;

interface ListViewProps {
  data: UnifiedDataItem[];
  mainTab: 'incoming' | 'shipment';
  isToday: (date: string) => boolean;
  formatDate: (date: string) => string;
  formatWeight: (weight: number | null | undefined) => string;
  getFactoryBadge: (item: UnifiedDataItem) => string;
}

export default function ListView({ 
  data, 
  mainTab, 
  isToday, 
  formatDate, 
  formatWeight, 
  getFactoryBadge 
}: ListViewProps) {
  const isIncoming = mainTab === 'incoming';
  const isShipment = mainTab === 'shipment';

  if (data.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных</p>
      </div>
    );
  }

  return (
    <div className="cards">
      {data.map((item) => (
        <div 
          key={item.id} 
          className={`card ${isToday(item.date) ? 'today-card' : ''}`}
        >
          <div className="card-header">
            <div className="header-left">
              <div className={`factory-badge ${getFactoryBadge(item)}`}>
                {getFactoryBadge(item)}
              </div>
              <span className="number">
                №{item.number}
              </span>
            </div>
            {isToday(item.date) && (
              <div className="header-center">
                <span className="today-badge">СЕГОДНЯ</span>
              </div>
            )}
            <div className="header-right">
              <span className={`date ${isToday(item.date) ? 'today-date' : ''}`}>
                {formatDate(item.date)}
              </span>
            </div>
          </div>
          
          <div className="card-content">
            <div className="supplier">
              <span className="label">{isIncoming ? 'Поставщик:' : 'Покупатель:'}</span>
              <span className="value">
                {isIncoming ? (item as IncomingItem).supplier : (item as ShipmentItem).customer}
              </span>
            </div>
            
            {isShipment && (item as ShipmentItem).consignee && (
              <div className="consignee-line">
                <span className="label">📦 Грузополучатель:</span>
                <span className="value">{(item as ShipmentItem).consignee}</span>
              </div>
            )}
            
            <div className="material">
              <span className="label">Материал:</span>
              <span className="value material-name">{item.material}</span>
            </div>
            
            <div className="weight-row">
              <div className="weight-item">
                <span className="label">Количество:</span>
                <span className="value weight-value">{formatWeight(item.quantity)}</span>
              </div>
              <div className="weight-item">
                <span className="label">Брутто:</span>
                <span className="value">{formatWeight((item as IncomingItem | ShipmentItem).gross)}</span>
              </div>
            </div>
            
            <div className="driver-row">
              {item.driver && (
                <div className="driver-item">
                  <span className="label">👨‍✈️ Водитель:</span>
                  <span className="value">{item.driver}</span>
                </div>
              )}
              {item.licensePlate && (
                <div className="plate-item">
                  <span className="label">🚛 Госномер:</span>
                  <span className="value">{item.licensePlate}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}