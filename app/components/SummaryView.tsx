'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { formatTime, getFactoryBadgeClass } from '@/lib/utils';
import { Inbox, Clock as ClockIcon } from 'lucide-react';

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
  // Демо: готовый список заявок передаётся напрямую, без похода в /api/all-data
  // (тот эндпоинт отдаёт боевые данные и требует авторизацию).
  demoRequests?: FutureRequest[];
}

// Функция для определения завода (копия из page.tsx)
const getDivisionName = (division: string): string => {
  switch (division) {
    case 'ЛХ': return 'ЛХ';
    case 'ЛЮ': return 'ЛЮ';
    case 'СП': return 'СП';
    case 'Щ': return 'Щ';
    case 'ДЕМО-СЕВ': return 'СЕВ';
    case 'ДЕМО-ЮГ': return 'ЮГ';
    default: return '—';
  }
};


export default function SummaryView({ mode = 'tas', demoRequests }: SummaryViewProps) {
  const [futureRequests, setFutureRequests] = useState<FutureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFutureRequests = useCallback(async () => {
    // Демо: список уже готов и передан пропом — не ходим в /api/all-data
    // (эндпоинт боевой и требует авторизацию, гостю демо он недоступен).
    if (demoRequests) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const future = demoRequests.filter((req) => {
        if (req.closed) return false;
        if (!req.delivery_date) return false;
        const deliveryDate = new Date(req.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);
        return deliveryDate >= today;
      });

      future.sort((a, b) => new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime());

      setFutureRequests(future);
      setLoading(false);
      return;
    }

    try {
      // ⚠️ Раньше брали данные из /api/outgoing-requests и /api/shipments —
      // эти эндпоинты режут выдачу до 300 записей (ORDER BY date DESC LIMIT 300),
      // а в колонке shipments.date вперемешку лежат ISO- и русские даты,
      // из-за чего сортировка по дате как по тексту ломается и свежие
      // отгрузки ТАС могли не попасть в лимит. В итоге заявки, которые
      // уже отгружаются сегодня, ошибочно показывались как "будущие".
      // /api/all-data отдаёт всё без лимита — используем его, как и счётчик на кнопке.
      const allDataResponse = await fetch('/api/all-data');
      const allData = await allDataResponse.json();

      let allRequests = allData.outgoingRequests || [];
      const allShipments = allData.shipments || [];
      
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
  }, [mode, demoRequests]);

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
        <p><Inbox size={15} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -3 }} />Нет запланированных заявок на будущее</p>
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
                <span className="future-item-time"><ClockIcon size={11} strokeWidth={2.2} style={{ marginRight: 2, verticalAlign: -1 }} />{formatTime(req.delivery_date)}</span>
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



