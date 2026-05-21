// components/CompactView.tsx
'use client';

import { IncomingItem, ShipmentItem } from '@/app/page';

type UnifiedDataItem = IncomingItem | ShipmentItem;

interface CompactViewProps {
  data: UnifiedDataItem[];
  mainTab: 'incoming' | 'shipment';
  getRequestCompletion?: (clientRequestNumber: string | null) => { plan: number; fact: number; percent: number; requestNumber: string } | null;
}

interface GroupedItem {
  time: string;
  factQuantity: number;
  planQuantity: number;
  consignee: string;      // Для отгрузок - грузополучатель, для поступлений - поставщик
  factories: string[];
  truckCount: number;
  material: string;
}

export default function CompactView({ data, mainTab, getRequestCompletion }: CompactViewProps) {
  const isShipment = mainTab === 'shipment';
  
  const groupedByDateAndRequest = data.reduce((acc, item) => {
    const date = new Date(item.date).toLocaleDateString('ru-RU');
    
    if (mainTab === 'incoming') {
      // ========== ПОСТУПЛЕНИЯ ==========
      const incoming = item as IncomingItem;
      
      let factory = '—';
      if (incoming.number?.startsWith('ЛХ')) factory = 'ЛХ';
      else if (incoming.number?.startsWith('ЛЮ')) factory = 'ЛЮ';
      
      // Группируем по дате + заводу + материалу + поставщику
      const groupKey = `${date}_${factory}_${incoming.material}_${incoming.supplier}`;
      
      if (!acc[date]) {
        acc[date] = new Map<string, GroupedItem>();
      }
      
      if (!acc[date].has(groupKey)) {
        acc[date].set(groupKey, {
          time: new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          factQuantity: incoming.quantity,
          planQuantity: 0,
          consignee: incoming.supplier,
          factories: [factory],
          truckCount: 1,
          material: incoming.material,
        });
      } else {
        const existing = acc[date].get(groupKey)!;
        existing.factQuantity += incoming.quantity;
        existing.truckCount += 1;
        if (!existing.factories.includes(factory) && factory !== '—') {
          existing.factories.push(factory);
        }
        const currentTime = new Date(incoming.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (currentTime > existing.time) {
          existing.time = currentTime;
        }
      }
      
    } else {
      // ========== ОТГРУЗКИ ==========
      const shipment = item as ShipmentItem;
      
      let factory = '—';
      if (shipment.division === 'Луховицы') factory = 'ЛХ';
      else if (shipment.division === 'Люберцы') factory = 'ЛЮ';
      
      // Группируем по дате + заводу + грузополучателю + материалу
      const groupKey = `${date}_${factory}_${shipment.consignee || shipment.customer}_${shipment.material}`;
      
      let planQuantity = 0;
      if (getRequestCompletion && shipment.clientRequestNumber) {
        const completion = getRequestCompletion(shipment.clientRequestNumber);
        if (completion && completion.plan > 0) {
          planQuantity = completion.plan;
        }
      }
      
      if (!acc[date]) {
        acc[date] = new Map<string, GroupedItem>();
      }
      
      if (!acc[date].has(groupKey)) {
        acc[date].set(groupKey, {
          time: new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          factQuantity: shipment.quantity,
          planQuantity: planQuantity,
          consignee: shipment.consignee || shipment.customer || '—',
          factories: [factory],
          truckCount: 1,
          material: shipment.material,
        });
      } else {
        const existing = acc[date].get(groupKey)!;
        existing.factQuantity += shipment.quantity;
        existing.truckCount += 1;
        if (planQuantity > existing.planQuantity) {
          existing.planQuantity = planQuantity;
        }
        if (!existing.factories.includes(factory) && factory !== '—') {
          existing.factories.push(factory);
        }
        const currentTime = new Date(shipment.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (currentTime > existing.time) {
          existing.time = currentTime;
        }
      }
    }
    
    return acc;
  }, {} as Record<string, Map<string, GroupedItem>>);

  const sortedDates = Object.keys(groupedByDateAndRequest).sort((a, b) => {
    const dateA = new Date(a.split('.').reverse().join('-'));
    const dateB = new Date(b.split('.').reverse().join('-'));
    return dateB.getTime() - dateA.getTime();
  });

  const getDayLabel = (dateStr: string): string => {
    const today = new Date().toLocaleDateString('ru-RU');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
    
    if (dateStr === today) return 'СЕГОДНЯ';
    if (dateStr === yesterdayStr) return 'ВЧЕРА';
    return dateStr;
  };

  const getFactoryBadgeClass = (factory: string): string => {
    switch (factory) {
      case 'ЛХ': return 'factory-badge-small ЛХ';
      case 'ЛЮ': return 'factory-badge-small ЛЮ';
      default: return 'factory-badge-small Другой';
    }
  };

  if (data.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных</p>
      </div>
    );
  }

  return (
    <div className="compact-view">
      {sortedDates.map(date => {
        const items = Array.from(groupedByDateAndRequest[date].values());
        
        return (
          <div key={date} className="compact-date-group">
            <div className="compact-date-header">
              {getDayLabel(date)}
            </div>
            <div className="compact-table">
              {/* Заголовки для ОТГРУЗОК */}
              {isShipment && (
                <div className="compact-header">
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-slash"></span>
                  <span className="col-plan">Заяв</span>
                  <span className="col-consignee">Грузополучатель</span>
                  <span className="col-factory">Завод</span>
                  <span className="col-trucks">Машин</span>
                  <span className="col-material">Материал</span>
                </div>
              )}
              
              {/* Заголовки для ПОСТУПЛЕНИЙ */}
              {!isShipment && (
                <div className="compact-header">
                  <span className="col-time">Время</span>
                  <span className="col-fact">Вып</span>
                  <span className="col-material-header">Материал</span>
                  <span className="col-factory">Завод</span>
                  <span className="col-trucks">Машин</span>
                  <span className="col-supplier">Поставщик</span>
                </div>
              )}
              
              {items.map((item, idx) => (
                // ОТГРУЗКИ
                isShipment ? (
                  <div key={idx} className="compact-row">
                    <span className="col-time">{item.time}</span>
                    <span className="col-fact">{item.factQuantity.toFixed(1)}</span>
                    <span className="col-slash">/</span>
                    <span className="col-plan">
                      {item.planQuantity > 0 ? item.planQuantity.toFixed(0) : '—'}
                    </span>
                    <span className="col-consignee">{item.consignee}</span>
                    <span className="col-factory">
                      <div className="factory-badges-group">
                        {item.factories.map((factory, i) => (
                          <div key={i} className={getFactoryBadgeClass(factory)}>
                            {factory}
                          </div>
                        ))}
                      </div>
                    </span>
                    <span className="col-trucks">{item.truckCount}</span>
                    <span className="col-material">{item.material?.substring(0, 25)}</span>
                  </div>
                ) : (
                  // ПОСТУПЛЕНИЯ - другой порядок колонок
                  <div key={idx} className="compact-row">
                    <span className="col-time">{item.time}</span>
                    <span className="col-fact">{item.factQuantity.toFixed(1)}</span>
                    <span className="col-material">{item.material?.substring(0, 25)}</span>
                    <span className="col-factory">
                      <div className="factory-badges-group">
                        {item.factories.map((factory, i) => (
                          <div key={i} className={getFactoryBadgeClass(factory)}>
                            {factory}
                          </div>
                        ))}
                      </div>
                    </span>
                    <span className="col-trucks">{item.truckCount}</span>
                    <span className="col-supplier">{item.consignee}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}