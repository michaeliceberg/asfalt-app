'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { formatTime, getFactoryBadgeClass } from '@/lib/utils';

interface FutureRequest {
  number: string;
  date: string;
  division: string;
  customer: string;
  consignee: string;
  material: string;
  quantity: number;
  delivery_date: string;
  clientRequestNumber: string;
  clientRequestDate: string;
  closed?: boolean;
}

interface SummaryViewProps {
  mode?: 'tas' | 'iceberg';
}

// Функция для определения завода (копия из page.tsx)
const getDivisionName = (division: string): string => {
  switch (division) {
    case 'ЛХ': return 'ЛХ';
    case 'ЛЮ': return 'ЛЮ';
    case 'СП': return 'СП';
    case 'Щ': return 'Щ';
    default: return '—';
  }
};


export default function SummaryView({ mode = 'tas' }: SummaryViewProps) {
  const [futureRequests, setFutureRequests] = useState<FutureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFutureRequests = useCallback(async () => {
    try {
      const [requestsResponse, shipmentsResponse] = await Promise.all([
        fetch('/api/outgoing-requests'),
        fetch('/api/shipments')
      ]);
      
      let allRequests = await requestsResponse.json();
      const allShipments = await shipmentsResponse.json();
      
      // Фильтруем по заводам текущего режима
      const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
      allRequests = allRequests.filter((req: FutureRequest) => validFactories.includes(req.division));
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Получаем номера заявок, у которых есть отгрузки сегодня
      const activeTodayRequests = new Set();
      for (const shipment of allShipments) {
        if (!validFactories.includes(shipment.division)) continue;
        
        const shipmentDate = new Date(shipment.date);
        shipmentDate.setHours(0, 0, 0, 0);
        if (shipmentDate.getTime() === today.getTime() && shipment.clientRequestNumber) {
          activeTodayRequests.add(shipment.clientRequestNumber);
        }
      }
      
      // Фильтруем будущие заявки
      const future = allRequests.filter((req: FutureRequest) => {
        if (req.closed) return false;
        if (!req.delivery_date) return false;
        const deliveryDate = new Date(req.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);
        return deliveryDate >= today && !activeTodayRequests.has(req.number);
      });
      
      // Сортируем по дате
      future.sort((a: FutureRequest, b: FutureRequest) => {
        return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
      });
      
      setFutureRequests(future);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      await fetchFutureRequests();
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [fetchFutureRequests]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };


  // const formatTime = (dateStr: string) => {
  //   const date = new Date(dateStr);
  //   return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  // };

  const getDayLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'СЕГОДНЯ';
    if (date.toDateString() === tomorrow.toDateString()) return 'ЗАВТРА';
    return formatDate(dateStr);
  };

  if (loading) {
    return <LoadingSpinner message="Загрузка планов..." size="medium" />;
  }

  if (futureRequests.length === 0) {
    return (
      <div className="empty">
        <p>📭 Нет запланированных заявок на будущее</p>
      </div>
    );
  }

  return (
    <div className="future-requests-view">
      <div className="future-requests-compact-list">
        {futureRequests.map((req) => {
          const isToday = getDayLabel(req.delivery_date) === 'СЕГОДНЯ';
          const division = getDivisionName(req.division);
          
          return (
            <div key={req.number} className={`future-request-compact-item ${isToday ? 'today-item' : ''}`}>
              <div className="future-item-date">
                <span className="future-item-day">{getDayLabel(req.delivery_date)}</span>
                <span className="future-item-time">⏰ {formatTime(req.delivery_date)}</span>
              </div>
              <div className="future-item-info">
                <div className="future-item-number">№{req.number}</div>
                <div className="future-item-consignee">{req.consignee || req.customer}</div>
                <div className="future-item-details">
                  <span className="future-item-material">{req.material}</span>
                  <span className="future-item-quantity">{Math.round(req.quantity)} т</span>
                </div>
              </div>
              <div className="future-item-badge">
                <div className={getFactoryBadgeClass(req.division)}>
                  {division}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



