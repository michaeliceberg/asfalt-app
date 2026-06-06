'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

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

export default function SummaryView() {
  const [futureRequests, setFutureRequests] = useState<FutureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFutureRequests = useCallback(async () => {
    try {
      const [requestsResponse, shipmentsResponse] = await Promise.all([
        fetch('/api/outgoing-requests'),
        fetch('/api/shipments')
      ]);
      
      const allRequests = await requestsResponse.json();
      const allShipments = await shipmentsResponse.json();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Получаем номера заявок, у которых есть отгрузки сегодня
      const activeTodayRequests = new Set();
      for (const shipment of allShipments) {
        const shipmentDate = new Date(shipment.date);
        shipmentDate.setHours(0, 0, 0, 0);
        if (shipmentDate.getTime() === today.getTime() && shipment.clientRequestNumber) {
          activeTodayRequests.add(shipment.clientRequestNumber);
        }
      }
      
      // Фильтруем будущие заявки: не закрытые, с датой >= сегодня, и НЕ имеющие отгрузок сегодня
      const future = allRequests.filter((req: FutureRequest) => {
        if (req.closed) return false;
        if (!req.delivery_date) return false;
        const deliveryDate = new Date(req.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);
        // Показываем только заявки на сегодня/будущее, у которых ещё нет отгрузок
        return deliveryDate >= today && !activeTodayRequests.has(req.number);
      });
      
      future.sort((a: FutureRequest, b: FutureRequest) => {
        return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
      });
      
      setFutureRequests(future);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const getTimeFromDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const isTodayRequest = (deliveryDate: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reqDate = new Date(deliveryDate);
    reqDate.setHours(0, 0, 0, 0);
    return reqDate.getTime() === today.getTime();
  };

  if (loading) return <div className="loading"><div className="spinner"></div><p>Загрузка...</p></div>;

  return (
    <div className="future-requests-view">
      {futureRequests.length === 0 ? (
        <div className="empty">
          <p>📭 Нет запланированных заявок на будущее</p>
        </div>
      ) : (
        <div className="future-requests-compact-list">
          {futureRequests.map((req) => {
            const isToday = isTodayRequest(req.delivery_date);
            
            return (
              <div key={req.number} className={`future-request-compact-item ${isToday ? 'today-item' : ''}`}>
                <div className="future-item-date">
                  <span className="future-item-day">{getDayLabel(req.delivery_date)}</span>
                  <span className="future-item-time">⏰ {getTimeFromDate(req.delivery_date)}</span>
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
                  {req.division === 'Люберцы' ? '🏭 ЛЮ' : '🏭 ЛХ'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


