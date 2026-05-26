// components/TopCustomersView.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShipmentItem } from '@/app/page';

interface TopCustomersViewProps {
  data: ShipmentItem[];
}

interface CustomerStats {
  name: string;
  total: number;
  count: number;
  factories: { [key: string]: number };
}

export default function TopCustomersView({ data }: TopCustomersViewProps) {
  const [customers, setCustomers] = useState<CustomerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFactory, setSelectedFactory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'total' | 'count'>('total');

  const processData = useCallback(() => {
    // Группируем по грузополучателю
    const grouped: { [key: string]: CustomerStats } = {};

    data.forEach(shipment => {
      const customerName = shipment.consignee || shipment.customer || 'Неизвестно';
      const factory = shipment.division === 'Луховицы' ? 'ЛХ' : 'ЛЮ';
      
      if (!grouped[customerName]) {
        grouped[customerName] = {
          name: customerName,
          total: 0,
          count: 0,
          factories: { ЛХ: 0, ЛЮ: 0 }
        };
      }
      
      grouped[customerName].total += shipment.quantity;
      grouped[customerName].count += 1;
      grouped[customerName].factories[factory] += shipment.quantity;
    });

    // Преобразуем в массив и сортируем
    let customersArray = Object.values(grouped);
    
    // Фильтруем по заводу
    if (selectedFactory !== 'all') {
      customersArray = customersArray.filter(c => c.factories[selectedFactory] > 0);
    }
    
    // Сортируем
    customersArray.sort((a, b) => b[sortBy] - a[sortBy]);
    
    // Берём топ-10
    setCustomers(customersArray.slice(0, 10));
    setLoading(false);
  }, [data, selectedFactory, sortBy]);

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

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Загрузка данных...</p>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="empty">
        <p>Нет данных по грузополучателям</p>
      </div>
    );
  }

  return (
    <div className="top-customers-view">
      <div className="top-customers-header">
        <div className="top-customers-title">🏆 Топ-10 грузополучателей</div>
        <div className="top-customers-controls">
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
                  <span className="customer-count">🚛 {customer.count} машин</span>
                </div>
                <div className="customer-bar-wrapper">
                  <div 
                    className="customer-bar"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="customer-factories">
                  {customer.factories.ЛХ > 0 && (
                    <span className="factory-badge-mini ЛХ">ЛХ {Math.round(customer.factories.ЛХ)} т</span>
                  )}
                  {customer.factories.ЛЮ > 0 && (
                    <span className="factory-badge-mini ЛЮ">ЛЮ {Math.round(customer.factories.ЛЮ)} т</span>
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