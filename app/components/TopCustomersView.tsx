'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShipmentItem } from '@/app/page';
import LoadingSpinner from './LoadingSpinner';

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

// Функция для определения бетона (исключаем из топа)
const isConcreteMaterial = (material: string): boolean => {
  if (!material) return false;
  const lower = material.toLowerCase();
  return lower.includes('бст') || 
         lower.includes('бетон') ||
         lower.includes('раствор') ||
         lower.includes('бсм');
};

// Парсинг русской даты для последних 30 дней
const parseRussianDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  
  if (dateString.includes('T') && !dateString.includes('.')) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
  }
  
  const parts = dateString.split(' ');
  const dateParts = parts[0].split('.');
  
  let hour = 0, minute = 0;
  if (parts[1]) {
    const timeParts = parts[1].split(':');
    hour = parseInt(timeParts[0], 10);
    minute = parseInt(timeParts[1], 10);
  }
  
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  
  return new Date(year, month, day, hour, minute);
};

export default function TopCustomersView({ data, mode = 'tas' }: TopCustomersViewProps) {
  const [customers, setCustomers] = useState<CustomerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFactory, setSelectedFactory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'total' | 'count'>('total');

  // Доступные заводы в зависимости от режима
  const getAvailableFactories = () => {
    if (mode === 'tas') {
      return ['all', 'ЛХ', 'ЛЮ'];
    } else {
      return ['all', 'СП', 'Щ'];
    }
  };

  // Названия заводов для отображения
  const getFactoryLabel = (factory: string) => {
    switch (factory) {
      case 'ЛХ': return 'Луховицы';
      case 'ЛЮ': return 'Люберцы';
      case 'СП': return 'Сергиев Посад';
      case 'Щ': return 'Щёлково';
      default: return 'Все заводы';
    }
  };

  const processData = useCallback(() => {
    setLoading(true);
    
    // Определяем допустимые заводы для текущего режима
    const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
    
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
        <div className="top-customers-title">
          🏆 Топ-10 грузополучателей (а
          {mode === 'tas' ? 'сфальт, ЛХ/ЛЮ' : 'сфальт, СП/Щ'}
        </div>
        <div className="top-customers-controls">
          <div className="factory-filter">
            {availableFactories.map(factory => (
              <button
                key={factory}
                className={`factory-filter-btn ${selectedFactory === factory ? 'active' : ''}`}
                onClick={() => setSelectedFactory(factory)}
              >
                {factory === 'all' ? 'Все заводы' : `🏭 ${getFactoryLabel(factory)}`}
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
                  <span className="customer-count">🚛 {customer.count} машин</span>
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



// // components/TopCustomersView.tsx
// 'use client';

// import { useEffect, useState, useCallback } from 'react';
// import { ShipmentItem } from '@/app/page';
// import LoadingSpinner from './LoadingSpinner';

// interface TopCustomersViewProps {
//   data: ShipmentItem[];
// }

// interface CustomerStats {
//   name: string;
//   total: number;
//   count: number;
//   factories: { [key: string]: number };
// }

// export default function TopCustomersView({ data }: TopCustomersViewProps) {
//   const [customers, setCustomers] = useState<CustomerStats[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedFactory, setSelectedFactory] = useState<string>('all');
//   const [sortBy, setSortBy] = useState<'total' | 'count'>('total');

//   const processData = useCallback(() => {
//     // Группируем по грузополучателю
//     const grouped: { [key: string]: CustomerStats } = {};

//     data.forEach(shipment => {
//       const customerName = shipment.consignee || shipment.customer || 'Неизвестно';
//       const factory = shipment.division === 'Луховицы' ? 'ЛХ' : 'ЛЮ';
      
//       if (!grouped[customerName]) {
//         grouped[customerName] = {
//           name: customerName,
//           total: 0,
//           count: 0,
//           factories: { ЛХ: 0, ЛЮ: 0 }
//         };
//       }
      
//       grouped[customerName].total += shipment.quantity;
//       grouped[customerName].count += 1;
//       grouped[customerName].factories[factory] += shipment.quantity;
//     });

//     // Преобразуем в массив и сортируем
//     let customersArray = Object.values(grouped);
    
//     // Фильтруем по заводу
//     if (selectedFactory !== 'all') {
//       customersArray = customersArray.filter(c => c.factories[selectedFactory] > 0);
//     }
    
//     // Сортируем
//     customersArray.sort((a, b) => b[sortBy] - a[sortBy]);
    
//     // Берём топ-10
//     setCustomers(customersArray.slice(0, 10));
//     setLoading(false);
//   }, [data, selectedFactory, sortBy]);

//   useEffect(() => {
//     let isMounted = true;
    
//     const loadData = async () => {
//       if (!isMounted) return;
//       processData();
//     };
    
//     loadData();
    
//     return () => {
//       isMounted = false;
//     };
//   }, [processData]);

//   const getMaxTotal = () => {
//     if (customers.length === 0) return 0;
//     return Math.max(...customers.map(c => c.total));
//   };

//   const maxTotal = getMaxTotal();

//   const getBarWidth = (total: number) => {
//     if (maxTotal === 0) return 0;
//     return (total / maxTotal) * 100;
//   };

//   if (loading) {
//     return <LoadingSpinner message="Загрузка..." size="medium" />;
//   }

//   if (customers.length === 0) {
//     return (
//       <div className="empty">
//         <p>Нет данных по грузополучателям</p>
//       </div>
//     );
//   }

//   return (
//     <div className="top-customers-view">
//       <div className="top-customers-header">
//         <div className="top-customers-title">🏆 Топ-10 грузополучателей</div>
//         <div className="top-customers-controls">
//           <div className="factory-filter">
//             <button
//               className={`factory-filter-btn ${selectedFactory === 'all' ? 'active' : ''}`}
//               onClick={() => setSelectedFactory('all')}
//             >
//               Все заводы
//             </button>
//             <button
//               className={`factory-filter-btn ${selectedFactory === 'ЛХ' ? 'active' : ''}`}
//               onClick={() => setSelectedFactory('ЛХ')}
//             >
//               🏭 Луховицы
//             </button>
//             <button
//               className={`factory-filter-btn ${selectedFactory === 'ЛЮ' ? 'active' : ''}`}
//               onClick={() => setSelectedFactory('ЛЮ')}
//             >
//               🏭 Люберцы
//             </button>
//           </div>
//           <div className="sort-filter">
//             <button
//               className={`sort-btn ${sortBy === 'total' ? 'active' : ''}`}
//               onClick={() => setSortBy('total')}
//             >
//               По тоннам
//             </button>
//             <button
//               className={`sort-btn ${sortBy === 'count' ? 'active' : ''}`}
//               onClick={() => setSortBy('count')}
//             >
//               По машинам
//             </button>
//           </div>
//         </div>
//       </div>

//       <div className="top-customers-list">
//         {customers.map((customer, idx) => {
//           const barWidth = getBarWidth(customer.total);
//           const isTop3 = idx < 3;
          
//           return (
//             <div key={customer.name} className="customer-row">
//               <div className="customer-rank">
//                 <span className={`rank-number ${isTop3 ? 'top' : ''}`}>{idx + 1}</span>
//               </div>
//               <div className="customer-info">
//                 <div className="customer-name">{customer.name}</div>
//                 <div className="customer-stats">
//                   <span className="customer-total">{Math.round(customer.total)} т</span>
//                   <span className="customer-count">🚛 {customer.count} машин</span>
//                 </div>
//                 <div className="customer-bar-wrapper">
//                   <div 
//                     className="customer-bar"
//                     style={{ width: `${barWidth}%` }}
//                   />
//                 </div>
//                 <div className="customer-factories">
//                   {customer.factories.ЛХ > 0 && (
//                     <span className="factory-badge-mini ЛХ">ЛХ {Math.round(customer.factories.ЛХ)} т</span>
//                   )}
//                   {customer.factories.ЛЮ > 0 && (
//                     <span className="factory-badge-mini ЛЮ">ЛЮ {Math.round(customer.factories.ЛЮ)} т</span>
//                   )}
//                 </div>
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }