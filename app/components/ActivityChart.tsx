'use client';

import { ShipmentItem } from '@/app/page';
import { useEffect, useState, useRef } from 'react';

interface ActivityChartProps {
  shipments: ShipmentItem[];
  selectedFactory: string;
}

export default function ActivityChart({ shipments, selectedFactory }: ActivityChartProps) {
  const [activityData, setActivityData] = useState<Array<{ 
    period: string; 
    startHour: number;
    totalTons: number;
    hasActivity: boolean;
  }>>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    // Получаем текущее время
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Определяем текущий 2-часовой блок
    let currentBlockStart;
    if (currentHour % 2 === 0) {
      currentBlockStart = currentHour;
    } else {
      currentBlockStart = currentHour - 1;
    }
    
    // Создаём 12 периодов (последние 24 часа) от текущего блока назад
    const periods = [];
    for (let i = 11; i >= 0; i--) {
      let startHour = currentBlockStart - i * 2;
      if (startHour < 0) startHour += 24;
      const endHour = startHour + 2;
      const periodLabel = `${startHour.toString().padStart(2, '0')}-${endHour.toString().padStart(2, '0')}`;
      periods.push({
        startHour: startHour,
        endHour: endHour,
        period: periodLabel,
      });
    }
    
    // Фильтруем по заводу
    let filteredShipments = shipments;
    if (selectedFactory === 'ЛХ') {
      filteredShipments = shipments.filter(s => s.division === 'Луховицы');
    } else if (selectedFactory === 'ЛЮ') {
      filteredShipments = shipments.filter(s => s.division === 'Люберцы');
    }
    
    // Фильтруем отгрузки за последние 24 часа от текущего момента
    const last24Hours = filteredShipments.filter(s => {
      const shipmentDate = new Date(s.date);
      const diffHours = (now.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60);
      return diffHours <= 24;
    });
    
    // Считаем тонны по периодам
    const activity: { [key: number]: { tons: number } } = {};
    
    for (const shipment of last24Hours) {
      const shipmentDate = new Date(shipment.date);
      const shipmentHour = shipmentDate.getHours();
      // Определяем начало 2-часового блока для отгрузки
      const blockStart = Math.floor(shipmentHour / 2) * 2;
      
      if (!activity[blockStart]) {
        activity[blockStart] = { tons: 0 };
      }
      activity[blockStart].tons += shipment.quantity;
    }
    
    // Формируем результат
    const result = periods.map(p => {
      const act = activity[p.startHour];
      const hasActivity = act && act.tons > 0;
      return {
        period: p.period,
        startHour: p.startHour,
        totalTons: act?.tons || 0,
        hasActivity: hasActivity || false,
      };
    });
    
    if (isMounted.current) {
      setActivityData(result);
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [shipments, selectedFactory]);

  const activeTons = activityData.filter(d => d.hasActivity).map(d => d.totalTons);
  const maxTons = activeTons.length > 0 ? Math.max(...activeTons) : 1;

  const getHeight = (tons: number, hasActivity: boolean) => {
    if (!hasActivity) return 2;
    return Math.max(6, (tons / maxTons) * 24);
  };

  const formatTons = (tons: number): string => {
    return Math.round(tons).toString();
  };

  // Определяем, является ли период текущим
  const isCurrentPeriod = (startHour: number): boolean => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentBlockStart = Math.floor(currentHour / 2) * 2;
    return startHour === currentBlockStart;
  };

  return (
    <div className="activity-chart-wrapper">
      <div className="activity-chart-title">Активность за 24 часа</div>
      <div className="activity-chart-bars-row">
        {activityData.map((item, idx) => {
          const height = getHeight(item.totalTons, item.hasActivity);
          const isCurrent = isCurrentPeriod(item.startHour);
          
          return (
            <div key={idx} className="activity-chart-bar-wrapper">
              {item.hasActivity && (
                <div className={`activity-chart-bar-value ${isCurrent ? 'current' : ''}`}>
                  {formatTons(item.totalTons)}
                </div>
              )}
              <div 
                className={`activity-chart-bar ${item.hasActivity ? 'active' : 'inactive'} ${isCurrent ? 'current-bar' : ''}`}
                style={{ height: `${height}px` }}
                title={`${item.period}: ${item.totalTons} т`}
              />
            </div>
          );
        })}
      </div>
      <div className="activity-chart-labels-row">
        {activityData.map((item, idx) => {
          const isCurrent = isCurrentPeriod(item.startHour);
          return (
            <div key={idx} className="activity-chart-label-wrapper">
              <span className={`activity-chart-label ${item.hasActivity ? 'active-label' : 'inactive-label'} ${isCurrent ? 'current-label' : ''}`}>
                {item.period}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

