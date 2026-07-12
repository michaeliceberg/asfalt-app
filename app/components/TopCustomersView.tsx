'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShipmentItem } from '@/app/page';
import LoadingSpinner from './LoadingSpinner';
import { isConcreteMaterial, parseRussianDate } from '@/lib/utils';
import { Trophy, Factory, Truck } from 'lucide-react';

interface TopCustomersViewProps {
  data: ShipmentItem[];
  mode?: 'tas' | 'iceberg';
}

interface CustomerStats {
  name: string;
  total: number;
  count: number;
  factories: { [key: string]: number };
}




export default function TopCustomersView({ data, mode = 'tas' }: TopCustomersViewProps) {
  const [customers, setCustomers] = useState<CustomerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFactory, setSelectedFactory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'total' | 'count'>('total');

  // Раньше тут был захардкоженный список заводов по режиму — та же
  // проблема, что чинили в ActivityChart/ChartsView/CompactView: демо-дивизии
  // (ДЕМО-СЕВ/ДЕМО-ЮГ) никогда не попадали ни в 'tas', ни в 'iceberg' список
  // и вкладка "Топ-10" в демо всегда была пустой. Берём заводы из реально
  // переданных данных.
  const getAvailableFactories = () => {
    return ['all', ...Array.from(new Set(data.map(item => item.division).filter(Boolean)))];
  };

  // Названия заводов для отображения
  const getFactoryLabel = (factory: string) => {
    switch (factory) {
      case 'ЛХ': return 'Луховицы';
      case 'ЛЮ': return 'Люберцы';
      case 'СП': return 'Сергиев Посад';
      case 'Щ': return 'Щёлково';
      case 'ДЕМО-СЕВ': return 'Северный';
      case 'ДЕМО-ЮГ': return 'Южный';
      default: return 'Все заводы';
    }
  };

  const processData = useCallback(() => {
    setLoading(true);

    // См. комментарий у getAvailableFactories выше — раньше тут отсеивались
    // все заводы, кроме ЛХ/ЛЮ/СП/Щ.
    const validFactories = Array.from(new Set(data.map(item => item.division).filter(Boolean)));

    // Фильтруем по заводам текущего режима
    let filteredData = data.filter(item => validFactories.includes(item.division));
    
    // Фильтруем по выбранному заводу
    if (selectedFactory !== 'all') {
      filteredData = filteredData.filter(item => item.division === selectedFactory);
    }
    
    // Исключаем бетон
    filteredData = filteredData.filter(item => !isConcreteMaterial(item.material));
    
    // Берём только последние 30 дней
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    
    const recentData = filteredData.filter(item => {
      const itemDate = parseRussianDate(item.date);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate >= thirtyDaysAgo;
    });
    
    // Группируем по грузополучателю
    const grouped: { [key: string]: CustomerStats } = {};

    recentData.forEach(shipment => {
      const customerName = shipment.consignee || shipment.customer || 'Неизвестно';
      const factory = shipment.division;
      
      if (!grouped[customerName]) {
        grouped[customerName] = {
          name: customerName,
          total: 0,
          count: 0,
          factories: { ЛХ: 0, ЛЮ: 0, СП: 0, Щ: 0 }
        };
      }
      
      grouped[customerName].total += shipment.quantity;
      grouped[customerName].count += 1;
      if (factory && grouped[customerName].factories[factory] !== undefined) {
        grouped[customerName].factories[factory] += shipment.quantity;
      }
    });

    // Преобразуем в массив
    const customersArray = Object.values(grouped);
    
    // Сортируем
    customersArray.sort((a, b) => b[sortBy] - a[sortBy]);
    
    // Берём топ-10
    setCustomers(customersArray.slice(0, 10));
    setLoading(false);
  }, [data, selectedFactory, sortBy, mode]);

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

  const getMaxTotal = () => {
    if (customers.length === 0) return 0;
    return Math.max(...customers.map(c => c.total));
  };

  const maxTotal = getMaxTotal();

  const getBarWidth = (total: number) => {
    if (maxTotal === 0) return 0;
    return (total / maxTotal) * 100;
  };

  const availableFactories = getAvailableFactories();

  // Заголовок раньше был захардкожен по mode ('ЛХ/ЛЮ' для tas, 'СП/Щ' для
  // iceberg) — в демо (division='ДЕМО-СЕВ'/'ДЕМО-ЮГ') это всегда давало
  // неверную подпись "СП/Щ". Строим подпись из реальных дивизионов данных.
  const divisionShortCode = (division: string) => {
    if (division === 'ДЕМО-СЕВ') return 'СЕ';
    if (division === 'ДЕМО-ЮГ') return 'ЮГ';
    return division;
  };
  const factoriesLabel = Array.from(
    new Set(data.map(item => item.division).filter(Boolean).map(divisionShortCode))
  ).sort().join('/');

  if (loading && customers.length === 0) {
    return <LoadingSpinner message="Загрузка рейтинга..." size="medium" />;
  }

  if (customers.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных по грузополучателям за последние 30 дней</p>
      </div>
    );
  }

  return (
    <div className="top-customers-view">
      <div className="top-customers-header">
        <div className="top-customers-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={16} strokeWidth={2.2} />
          Топ-10 грузополучателей (асфальт{factoriesLabel ? `, ${factoriesLabel}` : ''})
        </div>
        <div className="top-customers-controls">
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
          <div className="sort-filter">
            <button
              className={`sort-btn ${sortBy === 'total' ? 'active' : ''}`}
              onClick={() => setSortBy('total')}
            >
              По тоннам
            </button>
            <button
              className={`sort-btn ${sortBy === 'count' ? 'active' : ''}`}
              onClick={() => setSortBy('count')}
            >
              По машинам
            </button>
          </div>
        </div>
      </div>

      <div className="top-customers-list">
        {customers.map((customer, idx) => {
          const barWidth = getBarWidth(customer.total);
          const isTop3 = idx < 3;
          
          return (
            <div key={customer.name} className="customer-row">
              <div className="customer-rank">
                <span className={`rank-number ${isTop3 ? 'top' : ''}`}>{idx + 1}</span>
              </div>
              <div className="customer-info">
                <div className="customer-name">{customer.name}</div>
                <div className="customer-stats">
                  <span className="customer-total">{Math.round(customer.total)} т</span>
                  <span className="customer-count"><Truck size={11} strokeWidth={2.2} style={{ marginRight: 2, verticalAlign: -1 }} />{customer.count} машин</span>
                </div>
                <div className="customer-bar-wrapper">
                  <div 
                    className="customer-bar"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="customer-factories">
                  {mode === 'tas' ? (
                    <>
                      {customer.factories.ЛХ > 0 && (
                        <span className="factory-badge-mini ЛХ">ЛХ {Math.round(customer.factories.ЛХ)} т</span>
                      )}
                      {customer.factories.ЛЮ > 0 && (
                        <span className="factory-badge-mini ЛЮ">ЛЮ {Math.round(customer.factories.ЛЮ)} т</span>
                      )}
                    </>
                  ) : (
                    <>
                      {customer.factories.СП > 0 && (
                        <span className="factory-badge-mini СП">СП {Math.round(customer.factories.СП)} т</span>
                      )}
                      {customer.factories.Щ > 0 && (
                        <span className="factory-badge-mini Щ">Щ {Math.round(customer.factories.Щ)} т</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

