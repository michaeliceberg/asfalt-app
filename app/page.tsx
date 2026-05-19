// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PinModal from './components/PinModal';

interface IncomingItem {
  id: number;
  number: string;
  date: string;
  supplier: string;
  material: string;
  gross: number | null;
  tara: number | null;
  quantity: number;
  driver: string | null;
  licensePlate: string | null;
  createdAt: number;
}

interface GroupedRecord {
  date: string;
  supplier: string;
  material: string;
  totalQuantity: number;
  vehicleCount: number;
  records: IncomingItem[];
}

interface CronInfo {
  lastSync: string | null;
  totalRecords: number;
}

const detectFactory = (number: string): string => {
  if (number.startsWith('ЛХ')) return 'ЛХ';
  if (number.startsWith('ЛЮ')) return 'ЛЮ';
  return 'Другой';
};

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [incomingData, setIncomingData] = useState<IncomingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'grouped' | 'list'>('grouped');
  const [activeFactory, setActiveFactory] = useState<string>('all');
  const [cronInfo, setCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
  const [factories, setFactories] = useState<string[]>([]);
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [shouldShake, setShouldShake] = useState<boolean>(false);

  const loadIncomingData = async () => {
    const response = await fetch('/api/incoming');
    const data = await response.json();
    if (Array.isArray(data)) {
      setIncomingData(data);
      const uniqueFactories = [...new Set(data.map((item: IncomingItem) => detectFactory(item.number)))];
      setFactories(uniqueFactories);
    }
  };

  const loadCronInfo = async () => {
    try {
      const response = await fetch('/api/cron-info');
      const data = await response.json();
      if (data.lastSync) {
        setCronInfo(data);
      }
    } catch (err) {
      console.error('Не удалось загрузить информацию о cron');
    }
  };

  const loadAllData = async () => {
    await Promise.all([loadIncomingData(), loadCronInfo()]);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    const oldDataLength = incomingData.length;
    
    try {
      await loadAllData();
      
      const newDataLength = incomingData.length;
      const hasChanges = oldDataLength !== newDataLength;
      
      if (hasChanges) {
        setNotificationMessage(`✅ Данные обновлены! +${newDataLength - oldDataLength} записей`);
      } else {
        setNotificationMessage(`🔄 Данные актуальны (${newDataLength} записей)`);
      }
      
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 2000);
      
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      
      const refreshBtn = document.querySelector('.refresh-btn');
      refreshBtn?.classList.add('refresh-success');
      setTimeout(() => {
        refreshBtn?.classList.remove('refresh-success');
      }, 500);
      
    } catch (err) {
      console.error('Ошибка при обновлении:', err);
      setNotificationMessage('⚠️ Ошибка обновления');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 2000);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    loadAllData().finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        await loadAllData();
        if (isMounted) {
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Ошибка');
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      console.log('🔄 Автообновление...');
      loadAllData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const filteredData = incomingData.filter(item => {
    if (activeFactory === 'all') return true;
    return detectFactory(item.number) === activeFactory;
  });

  const groupDataByDay = (data: IncomingItem[]): Map<string, GroupedRecord[]> => {
    const groupedMap = new Map<string, Map<string, GroupedRecord>>();
    
    data.forEach((record) => {
      const dateOnly = new Date(record.date).toLocaleDateString('ru-RU');
      const key = `${dateOnly}_${record.supplier}_${record.material}`;
      
      if (!groupedMap.has(dateOnly)) {
        groupedMap.set(dateOnly, new Map());
      }
      
      const dayMap = groupedMap.get(dateOnly)!;
      
      if (dayMap.has(key)) {
        const existing = dayMap.get(key)!;
        existing.totalQuantity += record.quantity;
        existing.vehicleCount += 1;
        existing.records.push(record);
      } else {
        dayMap.set(key, {
          date: record.date,
          supplier: record.supplier,
          material: record.material,
          totalQuantity: record.quantity,
          vehicleCount: 1,
          records: [record],
        });
      }
    });
    
    const result: Map<string, GroupedRecord[]> = new Map();
    for (const [date, dayMap] of groupedMap) {
      result.set(date, Array.from(dayMap.values()));
    }
    
    return result;
  };

  const isToday = (dateStr: string): boolean => {
    const today = new Date().toLocaleDateString('ru-RU');
    const recordDate = new Date(dateStr).toLocaleDateString('ru-RU');
    return today === recordDate;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Нет даты';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateOnly = date.toLocaleDateString('ru-RU');
    const todayStr = today.toLocaleDateString('ru-RU');
    const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
    
    if (dateOnly === todayStr) return 'СЕГОДНЯ';
    if (dateOnly === yesterdayStr) return 'ВЧЕРА';
    return dateOnly;
  };

  const formatWeight = (weight?: number | null): string => {
    if (!weight && weight !== 0) return '—';
    return `${weight.toFixed(2)} т`;
  };

  const formatSyncTime = (timestamp: string | null): string => {
    if (!timestamp) return 'Никогда';
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFactoryName = (code: string): string => {
    switch (code) {
      case 'ЛХ': return '🏭 Луховицкий';
      case 'ЛЮ': return '🏭 Люберецкий';
      default: return '📦 Оба завода';
    }
  };

  if (!isAuthenticated) {
    return <PinModal onSuccess={() => setIsAuthenticated(true)} />;
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Загрузка данных...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <p>⚠️ Ошибка: {error}</p>
        <button onClick={handleRetry}>Попробовать снова</button>
      </div>
    );
  }

  const groupedData = groupDataByDay(filteredData);
  const sortedDates = Array.from(groupedData.keys()).sort((a, b) => {
    const dateA = new Date(a.split('.').reverse().join('-'));
    const dateB = new Date(b.split('.').reverse().join('-'));
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <>
      {/* Уведомление */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            className="notification"
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {notificationMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container">
        <header className="header">
          <div className="header-top">
            <h1>📦 Асфальтовые заводы</h1>
            <motion.button
              className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                className="refresh-icon"
                animate={{ rotate: refreshing ? 360 : 0 }}
                transition={{ duration: 0.5, repeat: refreshing ? Infinity : 0 }}
              >
                🔄
              </motion.span>
              {refreshing ? '...' : 'ОБНОВИТЬ'}
            </motion.button>
          </div>

          {/* Строка синхронизации — ПЕРВАЯ (над кнопками заводов) */}
          <div className="sync-info">
            <span className="sync-label">🔄 Синхронизация с 1С:</span>
            <span className="sync-time">{formatSyncTime(cronInfo.lastSync)}</span>
          </div>

          {/* Переключатель заводов — ВТОРОЙ */}
          <div className="factory-switch">
            <button
              className={`factory-btn ${activeFactory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFactory('all')}
            >
              📦 Оба завода
            </button>
            {factories.map(factory => (
              <button
                key={factory}
                className={`factory-btn ${activeFactory === factory ? 'active' : ''}`}
                onClick={() => setActiveFactory(factory)}
              >
                {getFactoryName(factory)}
              </button>
            ))}
          </div>
          
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'grouped' ? 'active' : ''}`}
              onClick={() => setActiveTab('grouped')}
            >
              📊 Итоги по дням
            </button>
            <button 
              className={`tab ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              📋 Список
            </button>
          </div>
          <div className="stats">
            Всего поставок: <strong>{filteredData.length}</strong>
            {activeFactory !== 'all' && ` (${getFactoryName(activeFactory)})`}
          </div>
        </header>

        <motion.div
          animate={shouldShake ? {
            x: [0, -5, 5, -3, 3, 0],
            transition: { duration: 0.3 }
          } : {}}
        >
          {activeTab === 'grouped' && (
            <div className="grouped-view">
              {sortedDates.map((date) => {
                const records = groupedData.get(date)!;
                const isDateToday = date === new Date().toLocaleDateString('ru-RU');
                
                return (
                  <div key={date} className="date-group">
                    <div className={`date-separator ${isDateToday ? 'today-separator' : ''}`}>
                      {isDateToday ? `🌟 ${date} (СЕГОДНЯ)` : date}
                    </div>
                    
                    {records.map((record, idx) => (
                      <div key={idx} className="group-card">
                        <div className="group-card-header">
                          <div className="supplier-name">{record.supplier}</div>
                          <div className="material-name-group">{record.material}</div>
                        </div>
                        
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
                    ))}
                  </div>
                );
              })}
              
              {sortedDates.length === 0 && (
                <div className="empty">
                  <p>Нет данных для группировки</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'list' && (
            <div className="cards">
              {filteredData.length === 0 ? (
                <div className="empty">
                  <p>Нет данных о поступлении</p>
                </div>
              ) : (
                filteredData.map((item) => (
                  <div key={item.id} className={`card ${isToday(item.date) ? 'today-card' : ''}`}>
                    <div className="card-header">
                      <span className="number">№{item.number}</span>
                      <span className={`date ${isToday(item.date) ? 'today-date' : ''}`}>
                        {formatDate(item.date)}
                      </span>
                    </div>
                    
                    <div className="card-content">
                      <div className="supplier">
                        <span className="label">Поставщик:</span>
                        <span className="value">{item.supplier || '—'}</span>
                      </div>
                      
                      <div className="material">
                        <span className="label">Материал:</span>
                        <span className="value material-name">{item.material || '—'}</span>
                      </div>
                      
                      <div className="weight">
                        <span className="label">Количество:</span>
                        <span className="value weight-value">{formatWeight(item.quantity)}</span>
                      </div>
                      
                      <div className="gross">
                        <span className="label">Брутто:</span>
                        <span className="value">{formatWeight(item.gross)}</span>
                      </div>
                      
                      {item.licensePlate && (
                        <div className="truck">
                          <span className="label">🚛 Госномер:</span>
                          <span className="value">{item.licensePlate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}



// один завод
// // app/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import PinModal from './components/PinModal';

// interface IncomingItem {
//   id: number;
//   number: string;
//   date: string;
//   supplier: string;
//   material: string;
//   gross: number | null;
//   tara: number | null;
//   quantity: number;
//   driver: string | null;
//   licensePlate: string | null;
//   createdAt: number;
// }

// interface GroupedRecord {
//   date: string;
//   supplier: string;
//   material: string;
//   totalQuantity: number;
//   vehicleCount: number;
//   records: IncomingItem[];
// }

// interface CronInfo {
//   lastSync: string | null;
//   totalRecords: number;
// }

// export default function Home() {
//   const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
//   const [incomingData, setIncomingData] = useState<IncomingItem[]>([]);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [refreshing, setRefreshing] = useState<boolean>(false);
//   const [error, setError] = useState<string | null>(null);
//   const [activeTab, setActiveTab] = useState<'grouped' | 'list'>('grouped');
//   const [cronInfo, setCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
//   const [showNotification, setShowNotification] = useState<boolean>(false);
//   const [notificationMessage, setNotificationMessage] = useState<string>('');
//   const [shouldShake, setShouldShake] = useState<boolean>(false);

//   // Функции загрузки данных
//   const loadIncomingData = async () => {
//     const response = await fetch('/api/incoming');
//     const data = await response.json();
//     if (Array.isArray(data)) {
//       return data;
//     }
//     return [];
//   };

//   const loadCronInfo = async () => {
//     try {
//       const response = await fetch('/api/cron-info');
//       const data = await response.json();
//       return data;
//     } catch (err) {
//       console.error('Не удалось загрузить информацию о cron');
//       return { lastSync: null, totalRecords: 0 };
//     }
//   };

//   const loadAllData = async () => {
//     const [newData, newCronInfo] = await Promise.all([loadIncomingData(), loadCronInfo()]);
//     setIncomingData(newData);
//     if (newCronInfo.lastSync) {
//       setCronInfo(newCronInfo);
//     }
//   };

//   // Ручное обновление (читает из БД, не трогает 1С)
//   const handleRefresh = async () => {
//     if (refreshing) return;
    
//     setRefreshing(true);
    
//     // Запоминаем старые данные для сравнения
//     const oldDataLength = incomingData.length;
    
//     try {
//       await loadAllData();
      
//       // Проверяем, изменились ли данные
//       const newDataLength = incomingData.length;
//       const hasChanges = oldDataLength !== newDataLength;
      
//       // Показываем уведомление
//       if (hasChanges) {
//         setNotificationMessage(`✅ Данные обновлены! +${newDataLength - oldDataLength} записей`);
//       } else {
//         setNotificationMessage(`🔄 Данные актуальны (${newDataLength} записей)`);
//       }
      
//       setShowNotification(true);
//       setTimeout(() => setShowNotification(false), 2000);
      
//       // Встряхиваем таблицу
//       setShouldShake(true);
//       setTimeout(() => setShouldShake(false), 500);
      
//       // Анимация успеха на кнопке
//       const refreshBtn = document.querySelector('.refresh-btn');
//       refreshBtn?.classList.add('refresh-success');
//       setTimeout(() => {
//         refreshBtn?.classList.remove('refresh-success');
//       }, 500);
      
//     } catch (err) {
//       console.error('Ошибка при обновлении:', err);
//       setNotificationMessage('⚠️ Ошибка обновления');
//       setShowNotification(true);
//       setTimeout(() => setShowNotification(false), 2000);
//     } finally {
//       setRefreshing(false);
//     }
//   };

//   const handleRetry = () => {
//     setLoading(true);
//     setError(null);
//     loadAllData().finally(() => setLoading(false));
//   };

//   // Первичная загрузка после авторизации
//   useEffect(() => {
//     if (!isAuthenticated) return;
    
//     let isMounted = true;
    
//     const fetchData = async () => {
//       try {
//         setLoading(true);
//         await loadAllData();
//         if (isMounted) {
//           setLoading(false);
//         }
//       } catch (err) {
//         if (isMounted) {
//           setError(err instanceof Error ? err.message : 'Ошибка');
//           setLoading(false);
//         }
//       }
//     };
    
//     fetchData();
    
//     return () => {
//       isMounted = false;
//     };
//   }, [isAuthenticated]);

//   // Автообновление каждые 30 секунд (без визуального фидбека)
//   useEffect(() => {
//     if (!isAuthenticated) return;
    
//     const interval = setInterval(async () => {
//       console.log('🔄 Автообновление...');
//       const [newData, newCronInfo] = await Promise.all([loadIncomingData(), loadCronInfo()]);
//       setIncomingData(newData);
//       if (newCronInfo.lastSync) {
//         setCronInfo(newCronInfo);
//       }
//     }, 30000);
    
//     return () => clearInterval(interval);
//   }, [isAuthenticated]);

//   // Группировка и форматирование (оставляем без изменений)
//   const groupDataByDay = (data: IncomingItem[]): Map<string, GroupedRecord[]> => {
//     const groupedMap = new Map<string, Map<string, GroupedRecord>>();
    
//     data.forEach((record) => {
//       const dateOnly = new Date(record.date).toLocaleDateString('ru-RU');
//       const key = `${dateOnly}_${record.supplier}_${record.material}`;
      
//       if (!groupedMap.has(dateOnly)) {
//         groupedMap.set(dateOnly, new Map());
//       }
      
//       const dayMap = groupedMap.get(dateOnly)!;
      
//       if (dayMap.has(key)) {
//         const existing = dayMap.get(key)!;
//         existing.totalQuantity += record.quantity;
//         existing.vehicleCount += 1;
//         existing.records.push(record);
//       } else {
//         dayMap.set(key, {
//           date: record.date,
//           supplier: record.supplier,
//           material: record.material,
//           totalQuantity: record.quantity,
//           vehicleCount: 1,
//           records: [record],
//         });
//       }
//     });
    
//     const result: Map<string, GroupedRecord[]> = new Map();
//     for (const [date, dayMap] of groupedMap) {
//       result.set(date, Array.from(dayMap.values()));
//     }
    
//     return result;
//   };

//   const isToday = (dateStr: string): boolean => {
//     const today = new Date().toLocaleDateString('ru-RU');
//     const recordDate = new Date(dateStr).toLocaleDateString('ru-RU');
//     return today === recordDate;
//   };

//   const formatDate = (dateString?: string): string => {
//     if (!dateString) return 'Нет даты';
//     const date = new Date(dateString);
//     const today = new Date();
//     const yesterday = new Date(today);
//     yesterday.setDate(yesterday.getDate() - 1);
    
//     const dateOnly = date.toLocaleDateString('ru-RU');
//     const todayStr = today.toLocaleDateString('ru-RU');
//     const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
    
//     if (dateOnly === todayStr) return 'СЕГОДНЯ';
//     if (dateOnly === yesterdayStr) return 'ВЧЕРА';
//     return dateOnly;
//   };

//   const formatWeight = (weight?: number | null): string => {
//     if (!weight && weight !== 0) return '—';
//     return `${weight.toFixed(2)} т`;
//   };

//   const formatSyncTime = (timestamp: string | null): string => {
//     if (!timestamp) return 'Никогда';
//     const date = new Date(timestamp);
//     return date.toLocaleString('ru-RU', {
//       day: '2-digit',
//       month: '2-digit',
//       hour: '2-digit',
//       minute: '2-digit'
//     });
//   };

//   // Если не авторизован — показываем PIN-модалку
//   if (!isAuthenticated) {
//     return <PinModal onSuccess={() => setIsAuthenticated(true)} />;
//   }

//   if (loading) {
//     return (
//       <div className="loading">
//         <div className="spinner"></div>
//         <p>Загрузка данных...</p>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="error">
//         <p>⚠️ Ошибка: {error}</p>
//         <button onClick={handleRetry}>Попробовать снова</button>
//       </div>
//     );
//   }

//   const groupedData = groupDataByDay(incomingData);
//   const sortedDates = Array.from(groupedData.keys()).sort((a, b) => {
//     const dateA = new Date(a.split('.').reverse().join('-'));
//     const dateB = new Date(b.split('.').reverse().join('-'));
//     return dateB.getTime() - dateA.getTime();
//   });

//   return (
//     <>
//       {/* Уведомление */}
//       <AnimatePresence>
//         {showNotification && (
//           <motion.div
//             className="notification"
//             initial={{ opacity: 0, y: -50, scale: 0.8 }}
//             animate={{ opacity: 1, y: 0, scale: 1 }}
//             exit={{ opacity: 0, y: -30, scale: 0.8 }}
//             transition={{ type: 'spring', stiffness: 500, damping: 30 }}
//           >
//             {notificationMessage}
//           </motion.div>
//         )}
//       </AnimatePresence>

//       <div className="container">
//         <header className="header">
//           <div className="header-top">
//             <h1>📦 Асфальтовый завод</h1>
//             <motion.button
//               className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
//               onClick={handleRefresh}
//               disabled={refreshing}
//               whileTap={{ scale: 0.95 }}
//             >
//               <motion.span
//                 className="refresh-icon"
//                 animate={{ rotate: refreshing ? 360 : 0 }}
//                 transition={{ duration: 0.5, repeat: refreshing ? Infinity : 0 }}
//               >
//                 🔄
//               </motion.span>
//               {refreshing ? '...' : 'Обновить'}
//             </motion.button>
//           </div>
          
//           <div className="sync-info">
//             <span className="sync-label">🔄 Синхронизация с 1С:</span>
//             <span className="sync-time">{formatSyncTime(cronInfo.lastSync)}</span>
//           </div>
          
//           <div className="tabs">
//             <button 
//               className={`tab ${activeTab === 'grouped' ? 'active' : ''}`}
//               onClick={() => setActiveTab('grouped')}
//             >
//               📊 Итоги по дням
//             </button>
//             <button 
//               className={`tab ${activeTab === 'list' ? 'active' : ''}`}
//               onClick={() => setActiveTab('list')}
//             >
//               📋 Список
//             </button>
//           </div>
//           <div className="stats">
//             Всего поставок: <strong>{incomingData.length}</strong>
//           </div>
//         </header>

//         <motion.div
//           animate={shouldShake ? {
//             x: [0, -5, 5, -3, 3, 0],
//             transition: { duration: 0.3 }
//           } : {}}
//         >
//           {activeTab === 'grouped' && (
//             <div className="grouped-view">
//               {sortedDates.map((date) => {
//                 const records = groupedData.get(date)!;
//                 const isDateToday = date === new Date().toLocaleDateString('ru-RU');
                
//                 return (
//                   <div key={date} className="date-group">
//                     <div className={`date-separator ${isDateToday ? 'today-separator' : ''}`}>
//                       {isDateToday ? `🌟 ${date} (СЕГОДНЯ)` : date}
//                     </div>
                    
//                     {records.map((record, idx) => (
//                       <div key={idx} className="group-card">
//                         <div className="group-card-header">
//                           <div className="supplier-name">{record.supplier}</div>
//                           <div className="material-name-group">{record.material}</div>
//                         </div>
                        
//                         <div className="group-card-stats">
//                           <div className="stat-item">
//                             <span className="stat-label">📦 Всего:</span>
//                             <span className="stat-value highlight">{formatWeight(record.totalQuantity)}</span>
//                           </div>
//                           <div className="stat-item">
//                             <span className="stat-label">🚛 Машин:</span>
//                             <span className="stat-value">{record.vehicleCount}</span>
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 );
//               })}
              
//               {sortedDates.length === 0 && (
//                 <div className="empty">
//                   <p>Нет данных для группировки</p>
//                 </div>
//               )}
//             </div>
//           )}

//           {activeTab === 'list' && (
//             <div className="cards">
//               {incomingData.length === 0 ? (
//                 <div className="empty">
//                   <p>Нет данных о поступлении</p>
//                 </div>
//               ) : (
//                 incomingData.map((item) => (
//                   <div key={item.id} className={`card ${isToday(item.date) ? 'today-card' : ''}`}>
//                     <div className="card-header">
//                       <span className="number">№{item.number}</span>
//                       <span className={`date ${isToday(item.date) ? 'today-date' : ''}`}>
//                         {formatDate(item.date)}
//                       </span>
//                     </div>
                    
//                     <div className="card-content">
//                       <div className="supplier">
//                         <span className="label">Поставщик:</span>
//                         <span className="value">{item.supplier || '—'}</span>
//                       </div>
                      
//                       <div className="material">
//                         <span className="label">Материал:</span>
//                         <span className="value material-name">{item.material || '—'}</span>
//                       </div>
                      
//                       <div className="weight">
//                         <span className="label">Количество:</span>
//                         <span className="value weight-value">{formatWeight(item.quantity)}</span>
//                       </div>
                      
//                       <div className="gross">
//                         <span className="label">Брутто:</span>
//                         <span className="value">{formatWeight(item.gross)}</span>
//                       </div>
                      
//                       {item.licensePlate && (
//                         <div className="truck">
//                           <span className="label">🚛 Госномер:</span>
//                           <span className="value">{item.licensePlate}</span>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 ))
//               )}
//             </div>
//           )}
//         </motion.div>
//       </div>
//     </>
//   );
// }






// // app/page.tsx
// 'use client';

// import { useState, useEffect, useRef } from 'react';
// import PinModal from './components/PinModal';

// interface IncomingItem {
//   id: number;
//   number: string;
//   date: string;
//   supplier: string;
//   material: string;
//   gross: number | null;
//   tara: number | null;
//   quantity: number;
//   driver: string | null;
//   licensePlate: string | null;
//   createdAt: number;
// }

// interface GroupedRecord {
//   date: string;
//   supplier: string;
//   material: string;
//   totalQuantity: number;
//   vehicleCount: number;
//   records: IncomingItem[];
// }

// interface CronInfo {
//   lastSync: string | null;
//   totalRecords: number;
// }

// export default function Home() {
//   const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
//   const [incomingData, setIncomingData] = useState<IncomingItem[]>([]);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [refreshing, setRefreshing] = useState<boolean>(false);
//   const [error, setError] = useState<string | null>(null);
//   const [activeTab, setActiveTab] = useState<'grouped' | 'list'>('grouped');
//   const [cronInfo, setCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });

//   // Функции загрузки данных
//   const loadIncomingData = async () => {
//     const response = await fetch('/api/incoming');
//     const data = await response.json();
//     if (Array.isArray(data)) {
//       setIncomingData(data);
//     }
//   };

//   const loadCronInfo = async () => {
//     try {
//       const response = await fetch('/api/cron-info');
//       const data = await response.json();
//       if (data.lastSync) {
//         setCronInfo(data);
//       }
//     } catch (err) {
//       console.error('Не удалось загрузить информацию о cron');
//     }
//   };

//   const loadAllData = async () => {
//     await Promise.all([loadIncomingData(), loadCronInfo()]);
//   };

//   // Ручное обновление (читает из БД, не трогает 1С)
//   const handleRefresh = async () => {
//     setRefreshing(true);
//     try {
//       await loadAllData();
      
//       // Анимация успеха
//       const refreshBtn = document.querySelector('.refresh-btn');
//       refreshBtn?.classList.add('refresh-success');
//       setTimeout(() => {
//         refreshBtn?.classList.remove('refresh-success');
//       }, 500);
//     } catch (err) {
//       console.error('Ошибка при обновлении:', err);
//       setError('Не удалось обновить данные');
//       setTimeout(() => setError(null), 3000);
//     } finally {
//       setRefreshing(false);
//     }
//   };

//   const handleRetry = () => {
//     setLoading(true);
//     setError(null);
//     loadAllData().finally(() => setLoading(false));
//   };

//   // Первичная загрузка после авторизации
//   useEffect(() => {
//     if (!isAuthenticated) return;
    
//     let isMounted = true;
    
//     const fetchData = async () => {
//       try {
//         setLoading(true);
//         await loadAllData();
//         if (isMounted) {
//           setLoading(false);
//         }
//       } catch (err) {
//         if (isMounted) {
//           setError(err instanceof Error ? err.message : 'Ошибка');
//           setLoading(false);
//         }
//       }
//     };
    
//     fetchData();
    
//     return () => {
//       isMounted = false;
//     };
//   }, [isAuthenticated]);

//   // Автообновление каждые 30 секунд (проверяет БД)
//   useEffect(() => {
//     if (!isAuthenticated) return;
    
//     const interval = setInterval(() => {
//       console.log('🔄 Автообновление...');
//       loadAllData();
//     }, 30000); // каждые 30 секунд
    
//     return () => clearInterval(interval);
//   }, [isAuthenticated]);

//   // Группировка и форматирование
//   const groupDataByDay = (data: IncomingItem[]): Map<string, GroupedRecord[]> => {
//     const groupedMap = new Map<string, Map<string, GroupedRecord>>();
    
//     data.forEach((record) => {
//       const dateOnly = new Date(record.date).toLocaleDateString('ru-RU');
//       const key = `${dateOnly}_${record.supplier}_${record.material}`;
      
//       if (!groupedMap.has(dateOnly)) {
//         groupedMap.set(dateOnly, new Map());
//       }
      
//       const dayMap = groupedMap.get(dateOnly)!;
      
//       if (dayMap.has(key)) {
//         const existing = dayMap.get(key)!;
//         existing.totalQuantity += record.quantity;
//         existing.vehicleCount += 1;
//         existing.records.push(record);
//       } else {
//         dayMap.set(key, {
//           date: record.date,
//           supplier: record.supplier,
//           material: record.material,
//           totalQuantity: record.quantity,
//           vehicleCount: 1,
//           records: [record],
//         });
//       }
//     });
    
//     const result: Map<string, GroupedRecord[]> = new Map();
//     for (const [date, dayMap] of groupedMap) {
//       result.set(date, Array.from(dayMap.values()));
//     }
    
//     return result;
//   };

//   const isToday = (dateStr: string): boolean => {
//     const today = new Date().toLocaleDateString('ru-RU');
//     const recordDate = new Date(dateStr).toLocaleDateString('ru-RU');
//     return today === recordDate;
//   };

//   const formatDate = (dateString?: string): string => {
//     if (!dateString) return 'Нет даты';
//     const date = new Date(dateString);
//     const today = new Date();
//     const yesterday = new Date(today);
//     yesterday.setDate(yesterday.getDate() - 1);
    
//     const dateOnly = date.toLocaleDateString('ru-RU');
//     const todayStr = today.toLocaleDateString('ru-RU');
//     const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
    
//     if (dateOnly === todayStr) return 'СЕГОДНЯ';
//     if (dateOnly === yesterdayStr) return 'ВЧЕРА';
//     return dateOnly;
//   };

//   const formatWeight = (weight?: number | null): string => {
//     if (!weight && weight !== 0) return '—';
//     return `${weight.toFixed(2)} т`;
//   };

//   const formatSyncTime = (timestamp: string | null): string => {
//     if (!timestamp) return 'Никогда';
//     const date = new Date(timestamp);
//     return date.toLocaleString('ru-RU', {
//       day: '2-digit',
//       month: '2-digit',
//       hour: '2-digit',
//       minute: '2-digit'
//     });
//   };

//   // Если не авторизован — показываем PIN-модалку
//   if (!isAuthenticated) {
//     return <PinModal onSuccess={() => setIsAuthenticated(true)} />;
//   }

//   // Если авторизован, но данные загружаются
//   if (loading) {
//     return (
//       <div className="loading">
//         <div className="spinner"></div>
//         <p>Загрузка данных...</p>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="error">
//         <p>⚠️ Ошибка: {error}</p>
//         <button onClick={handleRetry}>Попробовать снова</button>
//       </div>
//     );
//   }

//   const groupedData = groupDataByDay(incomingData);
//   const sortedDates = Array.from(groupedData.keys()).sort((a, b) => {
//     const dateA = new Date(a.split('.').reverse().join('-'));
//     const dateB = new Date(b.split('.').reverse().join('-'));
//     return dateB.getTime() - dateA.getTime();
//   });

//   return (
//     <div className="container">
//       <header className="header">
//         <div className="header-top">
//           <h1>📦 Асфальтовый завод</h1>
//           {/* <button 
//             className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
//             onClick={handleRefresh}
//             disabled={refreshing}
//           >
//             <span className="refresh-icon">🔄</span>
//             {refreshing ? '...' : 'Обновить'}
//           </button> */}

//             <button 
//                 className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
//                 onClick={handleRefresh}
//                 disabled={refreshing}
//                 >
//                 <span className="refresh-icon">🔄</span>
//                 {refreshing ? 'Обновление...' : 'ОБНОВИТЬ'}
//             </button>
//         </div>
        
//         <div className="sync-info">
//           <span className="sync-label">🔄 Синхронизация с 1С:</span>
//           <span className="sync-time">{formatSyncTime(cronInfo.lastSync)}</span>
//         </div>
        
//         <div className="tabs">
//           <button 
//             className={`tab ${activeTab === 'grouped' ? 'active' : ''}`}
//             onClick={() => setActiveTab('grouped')}
//           >
//             📊 Итоги по дням
//           </button>
//           <button 
//             className={`tab ${activeTab === 'list' ? 'active' : ''}`}
//             onClick={() => setActiveTab('list')}
//           >
//             📋 Список
//           </button>
//         </div>
//         <div className="stats">
//           Всего поставок: <strong>{incomingData.length}</strong>
//         </div>
//       </header>

//       {activeTab === 'grouped' && (
//         <div className="grouped-view">
//           {sortedDates.map((date) => {
//             const records = groupedData.get(date)!;
//             const isDateToday = date === new Date().toLocaleDateString('ru-RU');
            
//             return (
//               <div key={date} className="date-group">
//                 <div className={`date-separator ${isDateToday ? 'today-separator' : ''}`}>
//                   {isDateToday ? `🌟 ${date} (СЕГОДНЯ)` : date}
//                 </div>
                
//                 {records.map((record, idx) => (
//                   <div key={idx} className="group-card">
//                     <div className="group-card-header">
//                       <div className="supplier-name">{record.supplier}</div>
//                       <div className="material-name-group">{record.material}</div>
//                     </div>
                    
//                     <div className="group-card-stats">
//                       <div className="stat-item">
//                         <span className="stat-label">📦 Всего:</span>
//                         <span className="stat-value highlight">{formatWeight(record.totalQuantity)}</span>
//                       </div>
//                       <div className="stat-item">
//                         <span className="stat-label">🚛 Машин:</span>
//                         <span className="stat-value">{record.vehicleCount}</span>
//                       </div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             );
//           })}
          
//           {sortedDates.length === 0 && (
//             <div className="empty">
//               <p>Нет данных для группировки</p>
//             </div>
//           )}
//         </div>
//       )}

//       {activeTab === 'list' && (
//         <div className="cards">
//           {incomingData.length === 0 ? (
//             <div className="empty">
//               <p>Нет данных о поступлении</p>
//             </div>
//           ) : (
//             incomingData.map((item) => (
//               <div key={item.id} className={`card ${isToday(item.date) ? 'today-card' : ''}`}>
//                 <div className="card-header">
//                   <span className="number">№{item.number}</span>
//                   <span className={`date ${isToday(item.date) ? 'today-date' : ''}`}>
//                     {formatDate(item.date)}
//                   </span>
//                 </div>
                
//                 <div className="card-content">
//                   <div className="supplier">
//                     <span className="label">Поставщик:</span>
//                     <span className="value">{item.supplier || '—'}</span>
//                   </div>
                  
//                   <div className="material">
//                     <span className="label">Материал:</span>
//                     <span className="value material-name">{item.material || '—'}</span>
//                   </div>
                  
//                   <div className="weight">
//                     <span className="label">Количество:</span>
//                     <span className="value weight-value">{formatWeight(item.quantity)}</span>
//                   </div>
                  
//                   <div className="gross">
//                     <span className="label">Брутто:</span>
//                     <span className="value">{formatWeight(item.gross)}</span>
//                   </div>
                  
//                   {item.licensePlate && (
//                     <div className="truck">
//                       <span className="label">🚛 Госномер:</span>
//                       <span className="value">{item.licensePlate}</span>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//       )}
//     </div>
//   );
// }