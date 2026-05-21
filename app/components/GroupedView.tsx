// components/GroupedView.tsx
// import { IncomingItem, ShipmentItem } from '../app/page'; // или определите типы внутри

import { IncomingItem, ShipmentItem } from "../page";

type UnifiedDataItem = IncomingItem | ShipmentItem;

interface GroupedRecord {
  date: string;
  supplier: string;
  material: string;
  totalQuantity: number;
  vehicleCount: number;
  records: UnifiedDataItem[];
}

interface GroupedViewProps {
  groupedData: Map<string, GroupedRecord[]>;
  dates: string[];
  mainTab: 'incoming' | 'shipment';
  formatWeight: (weight: number | null | undefined) => string;
  getUniqueFactories: (records: UnifiedDataItem[]) => string[];
}

export default function GroupedView({ 
  groupedData, 
  dates, 
  mainTab, 
  formatWeight, 
  getUniqueFactories 
}: GroupedViewProps) {
  const isToday = (dateStr: string): boolean => {
    const today = new Date().toLocaleDateString('ru-RU');
    return dateStr === today;
  };

  if (dates.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных для группировки</p>
      </div>
    );
  }

  return (
    <div className="grouped-view">
      {dates.map((date) => {
        const records = groupedData.get(date)!;
        const isDateToday = isToday(date);
        const allRecordsForDay = records.flatMap((r) => r.records);
        const uniqueFactories = getUniqueFactories(allRecordsForDay);
        
        return (
          <div key={date} className="date-group">
            <div className={`date-separator ${isDateToday ? 'today-separator' : ''}`}>
              <div className="date-text">
                <span>{date}</span>
                {isDateToday && <span className="today-badge-header">СЕГОДНЯ</span>}
              </div>
              {uniqueFactories.length > 0 && (
                <div className="factory-badges-group">
                  {uniqueFactories.map((factory) => (
                    <div key={factory} className={`factory-badge-group ${factory}`}>
                      {factory}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {records.map((record, idx) => {
              const cardFactories = getUniqueFactories(record.records);
              
              return (
                <div key={idx} className="group-card">
                  <div className="group-card-header">
                    <div className="supplier-name">{record.supplier}</div>
                    <div className="factory-badges-group">
                      {cardFactories.map((factory) => (
                        <div key={factory} className={`factory-badge-small ${factory}`}>
                          {factory}
                        </div>
                      ))}
                    </div>
                  </div>
                  {isDateToday && (
                    <div className="group-today-badge-center">
                      <span className="group-today-badge">СЕГОДНЯ</span>
                    </div>
                  )}
                  <div className="material-name-group">{record.material}</div>
                  
                  <div className="group-card-stats">
                    <div className="stat-item">
                      <span className="stat-label">📦 Всего:</span>
                      <span className="stat-value highlight">{formatWeight(record.totalQuantity)}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">🚛 Машин:</span>
                      <span className="stat-value">{record.vehicleCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}