// app/components/ActivityChart.tsx

'use client';

import { ShipmentItem } from '@/app/page';
import { isConcreteMaterial, isSpecialMaterial, parseRussianDate } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface ActivityChartProps {
  shipments: ShipmentItem[];
  selectedFactory: string;
  mode?: 'tas' | 'iceberg';
  materialType?: 'asphalt' | 'concrete' | 'all';  // добавляем тип материала
}




export default function ActivityChart({ 
  shipments, 
  selectedFactory, 
  mode = 'tas',
  materialType = 'asphalt' 
}: ActivityChartProps) {
  const [activityData, setActivityData] = useState<Array<{ 
    period: string; 
    startHour: number;
    totalTons: number;
    hasActivity: boolean;
    isCurrent: boolean;
  }>>([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    
    // Определяем допустимые заводы для текущего режима
    const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentBlockStart = Math.floor(currentHour / 2) * 2;
    
    // Создаём 12 периодов (последние 24 часа) от текущего блока назад
    const periods = [];
    for (let i = 11; i >= 0; i--) {
      let startHour = currentBlockStart - i * 2;
      if (startHour < 0) startHour += 24;
      const periodLabel = `${startHour.toString().padStart(2, '0')}-${startHour + 2}`;
      periods.push({
        startHour: startHour,
        period: periodLabel,
        isCurrent: false,
      });
    }
    
    // Определяем текущий блок
    const currentBlockStartNow = Math.floor(currentHour / 2) * 2;
    periods.forEach(p => {
      p.isCurrent = (p.startHour === currentBlockStartNow);
    });
    
    // Фильтруем отгрузки
    let filteredShipments = [...shipments];
    
    // 1. Фильтруем по заводам текущего режима
    filteredShipments = filteredShipments.filter(s => validFactories.includes(s.division));
    
    // 2. Фильтруем по выбранному заводу (если выбран конкретный, а не "Все")
    if (selectedFactory !== 'all') {
      filteredShipments = filteredShipments.filter(s => s.division === selectedFactory);
    }
    
    // 3. Фильтруем по типу материала (асфальт/бетон/все)
    // if (materialType === 'asphalt') {
    //   filteredShipments = filteredShipments.filter(s => !isConcreteMaterial(s.material));
    // } else if (materialType === 'concrete') {
    //   filteredShipments = filteredShipments.filter(s => isConcreteMaterial(s.material));
    // }

    // 3. Фильтруем по типу материала (асфальт/бетон/все)
if (materialType === 'asphalt') {
  filteredShipments = filteredShipments.filter(s => {
    return !isConcreteMaterial(s.material) && !isSpecialMaterial(s.material);
  });
} else if (materialType === 'concrete') {
  filteredShipments = filteredShipments.filter(s => isConcreteMaterial(s.material));
}



    // если 'all' — показываем всё
    
    // Считаем тонны по периодам
    const activity: { [key: number]: { tons: number } } = {};
    
    for (const shipment of filteredShipments) {
      const shipmentDate = parseRussianDate(shipment.date);
      const shipmentHour = shipmentDate.getHours();
      const blockStart = Math.floor(shipmentHour / 2) * 2;
      const hoursDiff = (now.getTime() - shipmentDate.getTime()) / (1000 * 60 * 60);
      
      // Для текущего блока (последние 2 часа) — только отгрузки за последние 2 часа
      if (blockStart === currentBlockStartNow) {
        if (hoursDiff <= 2) {
          if (!activity[blockStart]) activity[blockStart] = { tons: 0 };
          activity[blockStart].tons += shipment.quantity;
        }
      } else {
        // Для остальных блоков — все отгрузки за последние 24 часа
        if (hoursDiff <= 24) {
          if (!activity[blockStart]) activity[blockStart] = { tons: 0 };
          activity[blockStart].tons += shipment.quantity;
        }
      }
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
        isCurrent: p.isCurrent,
      };
    });
    
    if (isMounted.current) {
      setActivityData(result);
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [shipments, selectedFactory, mode, materialType]);

  const activeTons = activityData.filter(d => d.hasActivity).map(d => d.totalTons);
  const maxTons = activeTons.length > 0 ? Math.max(...activeTons) : 1;

  const getHeight = (tons: number, hasActivity: boolean) => {
    if (!hasActivity) return 2;
    return Math.max(6, (tons / maxTons) * 24);
  };

  const formatTons = (tons: number): string => {
    return Math.round(tons).toString();
  };

  if (activityData.length === 0) return null;

  return (
    <div className="activity-chart-wrapper">
      <div className="activity-chart-bars-row">
        {activityData.map((item) => {
          const height = getHeight(item.totalTons, item.hasActivity);

          return (
            // key = period, а не индекс — так framer-motion понимает, что это
            // тот же самый столбик, и плавно анимирует высоту при любом
            // изменении данных (смена режима ТАС/Айсберг, фильтр завода и т.д.),
            // а не просто рисует его заново с нуля
            <div key={item.period} className="activity-chart-bar-wrapper">
              {item.hasActivity && (
                <div className={`activity-chart-bar-value ${item.isCurrent ? 'current' : ''}`}>
                  {formatTons(item.totalTons)}
                </div>
              )}
              <motion.div
                className={`activity-chart-bar ${item.hasActivity ? 'active' : 'inactive'} ${item.isCurrent ? 'current-bar' : ''}`}
                initial={{ height: 0 }}
                animate={{ height }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                title={`${item.period}: ${item.totalTons} т`}
              />
              <div className="activity-chart-label">
                {item.period}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

