// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PinModal from './components/PinModal';
import SummaryView from './components/SummaryView';

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

interface ShipmentItem {
  id: number;
  number: string;
  date: string;
  division: string;
  customer: string;
  consignee: string | null;
  material: string;
  gross: number | null;
  tara: number | null;
  quantity: number;
  driver: string | null;
  licensePlate: string | null;
  clientRequestNumber: string | null;
  clientRequestDate: string | null;
  createdAt: number;
}

interface OutgoingRequestItem {
  id: number;
  number: string;
  date: string;
  division: string;
  customer: string;
  consignee: string | null;
  material: string;
  quantity: number;
  clientRequestNumber: string | null;
  clientRequestDate: string | null;
  createdAt: number;
}

interface GroupedRecord {
  date: string;
  supplier: string;
  material: string;
  totalQuantity: number;
  vehicleCount: number;
  records: (IncomingItem | ShipmentItem)[];
  requestCompletion?: {
    plan: number;
    fact: number;
    percent: number;
    requestNumber: string;
  };
}

interface CronInfo {
  lastSync: string | null;
  totalRecords: number;
}

type MainTab = 'incoming' | 'shipment' | 'summary';




const getPercentClass = (percent: number) => {
  if (percent >= 95) return 'gold';      // золотой — почти выполнено
  if (percent >= 100) return 'green';    // зелёный — выполнено/перевыполнено
  if (percent >= 60) return 'orange';    // оранжевый — хорошо
  return 'red';                          // красный — мало
};



// Определяем завод по номеру (для поступлений) или подразделению (для отгрузок)
// const detectFactory = (item: IncomingItem | ShipmentItem, type: string): string => {
//   if (type === 'incoming') {
//     const incoming = item as IncomingItem;
//     if (incoming.number.startsWith('ЛХ')) return 'ЛХ';
//     if (incoming.number.startsWith('ЛЮ')) return 'ЛЮ';
//   } else {
//     const shipment = item as ShipmentItem;
//     if (shipment.division === 'Луховицы') return 'ЛХ';
//     if (shipment.division === 'Люберцы') return 'ЛЮ';
//   }
//   return 'Другой';
// };

type FactoryItem = IncomingItem | ShipmentItem | { factory: string };

const detectFactory = (item: FactoryItem, type: string): string => {
  if (type === 'incoming') {
    const incoming = item as IncomingItem;
    if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
    if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
  } else if (type === 'shipment') {
    const shipment = item as ShipmentItem;
    if (shipment.division === 'Луховицы') return 'ЛХ';
    if (shipment.division === 'Люберцы') return 'ЛЮ';
  } else if (type === 'factory') {
    const factoryItem = item as { factory: string };
    if (factoryItem.factory === 'Щ') return 'Щ';
    if (factoryItem.factory === 'П') return 'П';
  }
  return 'Другой';
};

// // Обновите detectFactory для новых заводов
// const detectFactory = (item: any, type: string): string => {
//   if (type === 'incoming') {
//     if (item.number?.startsWith('ЛХ')) return 'ЛХ';
//     if (item.number?.startsWith('ЛЮ')) return 'ЛЮ';
//   } else if (type === 'shipment') {
//     if (item.division === 'Луховицы') return 'ЛХ';
//     if (item.division === 'Люберцы') return 'ЛЮ';
//   } else if (type === 'factory') {
//     return item.factory; // Щ или П
//   }
//   return 'Другой';
// };


export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [incomingData, setIncomingData] = useState<IncomingItem[]>([]);
  const [shipmentData, setShipmentData] = useState<ShipmentItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('shipment');
  const [activeTab, setActiveTab] = useState<'grouped' | 'list'>('grouped');
  const [activeFactory, setActiveFactory] = useState<string>('all');
  const [cronInfo, setCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
  const [shipmentCronInfo, setShipmentCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
  const [factories, setFactories] = useState<string[]>([]);
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [shouldShake, setShouldShake] = useState<boolean>(false);


const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  // Точное время (часы:минуты)
  const exactTime = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Если не сегодня — возвращаем дату + точное время
  if (!isToday(dateString)) {
    return `${formatDate(dateString)} в ${exactTime}`;
  }
  
  // Если сегодня — относительное время + точное время
  if (diffMins < 1) return `только что (${exactTime})`;
  if (diffMins < 60) return `${diffMins} мин назад (${exactTime})`;
  if (diffHours < 24) return `${diffHours} ч назад (${exactTime})`;
  
  return `${formatDate(dateString)} в ${exactTime}`;
};



  // Загрузка данных
  const loadIncomingData = async () => {
    try {
      const response = await fetch('/api/incoming');
      const data = await response.json();
      if (Array.isArray(data)) {
        setIncomingData(data);
        return data;
      }
      return [];
    } catch (err) {
      console.error('Error loading incoming:', err);
      return [];
    }
  };

  const loadShipmentData = async () => {
    try {
      const response = await fetch('/api/shipments');
      const data = await response.json();
      if (Array.isArray(data)) {
        setShipmentData(data);
        return data;
      }
      return [];
    } catch (err) {
      console.error('Error loading shipments:', err);
      return [];
    }
  };

  const loadOutgoingRequests = async () => {
    try {
      const response = await fetch('/api/outgoing-requests');
      const data = await response.json();
      if (Array.isArray(data)) {
        setOutgoingRequests(data);
      }
    } catch (err) {
      console.error('Error loading requests:', err);
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

  const loadShipmentCronInfo = async () => {
    try {
      const response = await fetch('/api/cron-info-shipments');
      const data = await response.json();
      if (data.lastSync) {
        setShipmentCronInfo(data);
      }
    } catch (err) {
      console.error('Не удалось загрузить информацию о cron отгрузок');
    }
  };

  // Получение процента выполнения заявки
  const getRequestCompletion = useCallback((clientRequestNumber: string | null) => {
    if (!clientRequestNumber) return null;
    
    const request = outgoingRequests.find(r => r.number === clientRequestNumber);
    if (!request) return null;
    
    const shipmentsForRequest = shipmentData.filter(s => s.clientRequestNumber === clientRequestNumber);
    const factQuantity = shipmentsForRequest.reduce((sum, s) => sum + s.quantity, 0);
    const percent = request.quantity > 0 ? (factQuantity / request.quantity) * 100 : 0;
    
    return {
      plan: request.quantity,
      fact: factQuantity,
      percent: Math.round(percent),
      requestNumber: request.number,
      consignee: request.consignee
    };
  }, [outgoingRequests, shipmentData]);

  const loadAllData = async () => {
    try {
      const [incoming, shipment, requests] = await Promise.all([
        loadIncomingData(),
        loadShipmentData(),
        loadOutgoingRequests(),
      ]);
      
      await Promise.all([
        loadCronInfo(),
        loadShipmentCronInfo(),
      ]);
      
      const allItems = [...(Array.isArray(incoming) ? incoming : []), ...(Array.isArray(shipment) ? shipment : [])];
      const uniqueFactories = [...new Set(allItems.map(item => {
        if ('supplier' in item) {
          if (item.number.startsWith('ЛХ')) return 'ЛХ';
          if (item.number.startsWith('ЛЮ')) return 'ЛЮ';
        } else {
          if (item.division === 'Луховицы') return 'ЛХ';
          if (item.division === 'Люберцы') return 'ЛЮ';
        }
        return null;
      }).filter(f => f !== null))];
      
      setFactories(uniqueFactories);
    } catch (err) {
      console.error('Error loading all data:', err);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    
    try {
      if (activeMainTab === 'incoming') {
        await fetch('/api/cron', {
          headers: { 'Authorization': 'Bearer icg72xf3b1' }
        });
        await loadIncomingData();
        await loadCronInfo();
        setNotificationMessage(`✅ Поступления обновлены`);
      } else if (activeMainTab === 'shipment') {
        await fetch('/api/cron-shipments', {
          headers: { 'Authorization': 'Bearer icg72xf3b1' }
        });
        await loadShipmentData();
        await loadOutgoingRequests();
        await loadShipmentCronInfo();
        setNotificationMessage(`✅ Отгрузки обновлены`);
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
      if (activeMainTab === 'incoming') {
        loadIncomingData();
        loadCronInfo();
      } else if (activeMainTab === 'shipment') {
        loadShipmentData();
        loadOutgoingRequests();
        loadShipmentCronInfo();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, activeMainTab]);

  const getCurrentData = () => {
    return activeMainTab === 'incoming' ? incomingData : shipmentData;
  };

  const getFilteredData = () => {
    const data = getCurrentData();
    if (activeFactory === 'all') return data;
    
    return data.filter(item => {
      const factory = detectFactory(item, activeMainTab);
      return factory === activeFactory;
    });
  };

  const groupDataByDay = (data: (IncomingItem | ShipmentItem)[]) => {
    const groupedMap = new Map<string, Map<string, GroupedRecord>>();
    
    data.forEach((record) => {
      const dateOnly = new Date(record.date).toLocaleDateString('ru-RU');
      
      let supplier: string;
      if (activeMainTab === 'incoming') {
        supplier = (record as IncomingItem).supplier;
      } else {
        const shipment = record as ShipmentItem;
        supplier = shipment.consignee || shipment.customer;
      }
      
      const key = `${dateOnly}_${supplier}_${record.material}`;
      
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
          supplier: supplier,
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

  // const getFactoryName = (code: string): string => {
  //   switch (code) {
  //     case 'ЛХ': return '🏭 Луховицкий';
  //     case 'ЛЮ': return '🏭 Люберецкий';
  //     default: return '📦 Все заводы';
  //   }
  // };


// Обновите getFactoryName
const getFactoryName = (code: string): string => {
  switch (code) {
    case 'ЛХ': return '🏭 Луховицкий';
    case 'ЛЮ': return '🏭 Люберецкий';
    case 'Щ': return '🏭 Щелково';
    case 'П': return '🏭 Сергиев Посад';
    default: return '📦 Все заводы';
  }
};




  const currentSyncInfo = activeMainTab === 'incoming' ? cronInfo : shipmentCronInfo;
  const currentTitle = activeMainTab === 'incoming' ? '📦 Поступление материалов' : '🚛 Отгрузка асфальта';

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

  const filteredData = getFilteredData();
  const groupedData = groupDataByDay(filteredData);
  const sortedDates = Array.from(groupedData.keys()).sort((a, b) => {
    const dateA = new Date(a.split('.').reverse().join('-'));
    const dateB = new Date(b.split('.').reverse().join('-'));
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <>
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
            <h1>📦 Асфальтовый завод</h1>
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
              {refreshing ? '...' : 'Обновить'}
            </motion.button>
          </div>

          <div className="main-tabs">
            <button
              className={`main-tab ${activeMainTab === 'incoming' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('incoming')}
            >
              📦 Поступление
            </button>
            <button
              className={`main-tab ${activeMainTab === 'shipment' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('shipment')}
            >
              🚛 Отгрузка
            </button>
            <button
              className={`main-tab ${activeMainTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveMainTab('summary')}
            >
              📊 План-факт
            </button>
          </div>

          <div className="sync-info">
            <span className="sync-label">🔄 Синхронизация с 1С:</span>
            <span className="sync-time">{formatSyncTime(currentSyncInfo.lastSync)}</span>
          </div>

          {activeMainTab !== 'summary' && (
            <>
              <div className="factory-switch">
                <button
                  className={`factory-btn ${activeFactory === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveFactory('all')}
                >
                  📦 Все заводы
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
                Всего записей: <strong>{filteredData.length}</strong>
                {activeFactory !== 'all' && ` (${getFactoryName(activeFactory)})`}
              </div>
            </>
          )}
        </header>

        <motion.div
          animate={shouldShake ? {
            x: [0, -5, 5, -3, 3, 0],
            transition: { duration: 0.3 }
          } : {}}
        >
          {activeMainTab === 'summary' && <SummaryView />}

          {activeMainTab !== 'summary' && activeTab === 'grouped' && (
            <div className="grouped-view">
              {sortedDates.map((date) => {
                const records = groupedData.get(date)!;
                const isDateToday = date === new Date().toLocaleDateString('ru-RU');
                
                return (
                  <div key={date} className="date-group">
                    <div className={`date-separator ${isDateToday ? 'today-separator' : ''}`}>
                      {isDateToday ? `🌟 ${date} (СЕГОДНЯ)` : date}
                    </div>
                    
                    {records.map((record, idx) => {
                      // Получаем процент выполнения заявки (только для отгрузок)
                      let requestCompletion = null;
                      if (activeMainTab === 'shipment' && record.records[0] && 'clientRequestNumber' in record.records[0]) {
                        const clientRequestNumber = (record.records[0] as ShipmentItem).clientRequestNumber;
                        requestCompletion = getRequestCompletion(clientRequestNumber);
                      }
                      
                      return (
                        <div key={idx} className="group-card">
                          <div className="group-card-header">
                            <div className="supplier-name">{record.supplier}</div>
                            <div className="material-name-group">{record.material}</div>
                          </div>
                          
                          {requestCompletion && (
  <div className="request-completion">
    <div className="completion-header">
      <span className="completion-label">📊 Заявка {requestCompletion.requestNumber}</span>
      <span className="completion-percent">{requestCompletion.percent}%</span>
    </div>
    <div className="completion-bar">
      <div 
        className="completion-fill" 
        style={{ width: `${Math.min(requestCompletion.percent, 100)}%` }}
      />
    </div>
    <div className="completion-stats">
      <span>📦 {requestCompletion.fact.toFixed(0)} / {requestCompletion.plan.toFixed(0)} т</span>
    </div>
  </div>
)}
                          
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
                      );
                    })}
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

          {activeMainTab !== 'summary' && activeTab === 'list' && (
            <div className="cards">
              {filteredData.length === 0 ? (
                <div className="empty">
                  <p>Нет данных</p>
                </div>
              ) : (
                filteredData.map((item) => {
                  const isShipment = 'customer' in item;
                  let requestCompletion = null;
                  if (isShipment && (item as ShipmentItem).clientRequestNumber) {
                    requestCompletion = getRequestCompletion((item as ShipmentItem).clientRequestNumber);
                  }
                  
                  return (
                    <div key={item.id} className={`card ${isToday(item.date) ? 'today-card' : ''}`}>
<div className="card-header">
  <span className="number">№{item.number}</span>
  <span className={`date ${isToday(item.date) ? 'today-date' : ''}`}>
    {formatTimeAgo(item.date)}
  </span>
</div>
                      
                      <div className="card-content">
                        <div className="supplier">
                          <span className="label">{activeMainTab === 'incoming' ? 'Поставщик:' : 'Покупатель:'}</span>
                          <span className="value">
                            {activeMainTab === 'incoming' 
                              ? (item as IncomingItem).supplier 
                              : (item as ShipmentItem).customer}
                          </span>
                        </div>
                        
                        {activeMainTab === 'shipment' && (item as ShipmentItem).consignee && (
                          <div className="consignee-line">
                            <span className="label">📦 Грузополучатель:</span>
                            <span className="value">{(item as ShipmentItem).consignee}</span>
                          </div>
                        )}
                        
                        {requestCompletion && (
                          <div className="request-completion-row">
                            <span className="label">📊 Заявка:</span>
                            <span className={`value ${requestCompletion.percent >= 100 ? 'completed' : 'in-progress'}`}>
                              {requestCompletion.percent}% ({requestCompletion.fact.toFixed(0)}/{requestCompletion.plan.toFixed(0)} т)
                            </span>
                          </div>
                        )}
                        
                        <div className="material">
                          <span className="label">Материал:</span>
                          <span className="value material-name">{item.material}</span>
                        </div>
                        
                        <div className="weight-row">
                          <div className="weight-item">
                            <span className="label">Количество:</span>
                            <span className="value weight-value">{formatWeight(item.quantity)}</span>
                          </div>
                          <div className="weight-item">
                            <span className="label">Брутто:</span>
                            <span className="value">{formatWeight(item.gross)}</span>
                          </div>
                        </div>
                        
                        <div className="driver-row">
                          {item.driver && (
                            <div className="driver-item">
                              <span className="label">👨‍✈️ Водитель:</span>
                              <span className="value">{item.driver}</span>
                            </div>
                          )}
                          {item.licensePlate && (
                            <div className="plate-item">
                              <span className="label">🚛 Госномер:</span>
                              <span className="value">{item.licensePlate}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}




// // app/page.tsx
// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import PinModal from './components/PinModal';
// import SummaryView from './components/SummaryView';

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

// interface ShipmentItem {
//   id: number;
//   number: string;
//   date: string;
//   division: string;
//   customer: string;
//   consignee: string | null;
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
//   records: (IncomingItem | ShipmentItem)[];
// }

// interface CronInfo {
//   lastSync: string | null;
//   totalRecords: number;
// }

// type DataType = 'incoming' | 'shipment';
// type MainTab = 'incoming' | 'shipment' | 'summary';

// // Определяем завод по номеру (для поступлений) или подразделению (для отгрузок)
// const detectFactory = (item: IncomingItem | ShipmentItem, type: DataType): string => {
//   if (type === 'incoming') {
//     const incoming = item as IncomingItem;
//     if (incoming.number.startsWith('ЛХ')) return 'ЛХ';
//     if (incoming.number.startsWith('ЛЮ')) return 'ЛЮ';
//   } else {
//     const shipment = item as ShipmentItem;
//     if (shipment.division === 'Луховицы') return 'ЛХ';
//     if (shipment.division === 'Люберцы') return 'ЛЮ';
//   }
//   return 'Другой';
// };

// export default function Home() {
//   const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
//   const [incomingData, setIncomingData] = useState<IncomingItem[]>([]);
//   const [shipmentData, setShipmentData] = useState<ShipmentItem[]>([]);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [refreshing, setRefreshing] = useState<boolean>(false);
//   const [error, setError] = useState<string | null>(null);
//   const [activeMainTab, setActiveMainTab] = useState<MainTab>('shipment');
//   const [activeDataType, setActiveDataType] = useState<DataType>('shipment');
//   const [activeTab, setActiveTab] = useState<'grouped' | 'list'>('grouped');
//   const [activeFactory, setActiveFactory] = useState<string>('all');
//   const [cronInfo, setCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
//   const [shipmentCronInfo, setShipmentCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
//   const [factories, setFactories] = useState<string[]>([]);
//   const [showNotification, setShowNotification] = useState<boolean>(false);
//   const [notificationMessage, setNotificationMessage] = useState<string>('');
//   const [shouldShake, setShouldShake] = useState<boolean>(false);

//   // Загрузка данных
//   const loadIncomingData = async () => {
//     try {
//       const response = await fetch('/api/incoming');
//       const data = await response.json();
//       if (Array.isArray(data)) {
//         setIncomingData(data);
//         return data;
//       }
//       return [];
//     } catch (err) {
//       console.error('Error loading incoming:', err);
//       return [];
//     }
//   };

//   const loadShipmentData = async () => {
//     try {
//       const response = await fetch('/api/shipments');
//       const data = await response.json();
//       if (Array.isArray(data)) {
//         setShipmentData(data);
//         return data;
//       }
//       return [];
//     } catch (err) {
//       console.error('Error loading shipments:', err);
//       return [];
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

//   const loadShipmentCronInfo = async () => {
//     try {
//       const response = await fetch('/api/cron-info-shipments');
//       const data = await response.json();
//       if (data.lastSync) {
//         setShipmentCronInfo(data);
//       }
//     } catch (err) {
//       console.error('Не удалось загрузить информацию о cron отгрузок');
//     }
//   };

//   const loadAllData = async () => {
//     try {
//       const [incoming, shipment] = await Promise.all([
//         loadIncomingData(),
//         loadShipmentData(),
//       ]);
      
//       await Promise.all([
//         loadCronInfo(),
//         loadShipmentCronInfo(),
//       ]);
      
//       const allItems = [...(Array.isArray(incoming) ? incoming : []), ...(Array.isArray(shipment) ? shipment : [])];
//       const uniqueFactories = [...new Set(allItems.map(item => {
//         if ('supplier' in item) {
//           if (item.number.startsWith('ЛХ')) return 'ЛХ';
//           if (item.number.startsWith('ЛЮ')) return 'ЛЮ';
//         } else {
//           if (item.division === 'Луховицы') return 'ЛХ';
//           if (item.division === 'Люберцы') return 'ЛЮ';
//         }
//         return null;
//       }).filter(f => f !== null))];
      
//       setFactories(uniqueFactories);
//     } catch (err) {
//       console.error('Error loading all data:', err);
//     }
//   };

//   const handleRefresh = async () => {
//     if (refreshing) return;
    
//     setRefreshing(true);
    
//     try {
//       if (activeMainTab === 'incoming') {
//         await fetch('/api/cron', {
//           headers: { 'Authorization': 'Bearer icg72xf3b1' }
//         });
//         await loadIncomingData();
//         await loadCronInfo();
//         setNotificationMessage(`✅ Поступления обновлены`);
//       } else if (activeMainTab === 'shipment') {
//         await fetch('/api/cron-shipments', {
//           headers: { 'Authorization': 'Bearer icg72xf3b1' }
//         });
//         await loadShipmentData();
//         await loadShipmentCronInfo();
//         setNotificationMessage(`✅ Отгрузки обновлены`);
//       }
      
//       setShowNotification(true);
//       setTimeout(() => setShowNotification(false), 2000);
      
//       setShouldShake(true);
//       setTimeout(() => setShouldShake(false), 500);
      
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

//   useEffect(() => {
//     if (!isAuthenticated) return;
    
//     const interval = setInterval(() => {
//       console.log('🔄 Автообновление...');
//       if (activeMainTab === 'incoming') {
//         loadIncomingData();
//         loadCronInfo();
//       } else if (activeMainTab === 'shipment') {
//         loadShipmentData();
//         loadShipmentCronInfo();
//       }
//     }, 30000);
    
//     return () => clearInterval(interval);
//   }, [isAuthenticated, activeMainTab]);

//   // Получаем текущие данные
//   const getCurrentData = () => {
//     return activeMainTab === 'incoming' ? incomingData : shipmentData;
//   };

//   // Фильтрация по заводу
//   const getFilteredData = () => {
//     const data = getCurrentData();
//     if (activeFactory === 'all') return data;
    
//     return data.filter(item => {
//       const factory = detectFactory(item, activeMainTab as DataType);
//       return factory === activeFactory;
//     });
//   };

//   // Группировка по дням
//   const groupDataByDay = (data: (IncomingItem | ShipmentItem)[]) => {
//     const groupedMap = new Map<string, Map<string, GroupedRecord>>();
    
//     data.forEach((record) => {
//       const dateOnly = new Date(record.date).toLocaleDateString('ru-RU');
      
//       let supplier: string;
//       if (activeMainTab === 'incoming') {
//         supplier = (record as IncomingItem).supplier;
//       } else {
//         const shipment = record as ShipmentItem;
//         supplier = shipment.consignee || shipment.customer;
//       }
      
//       const key = `${dateOnly}_${supplier}_${record.material}`;
      
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
//           supplier: supplier,
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

//   const getFactoryName = (code: string): string => {
//     switch (code) {
//       case 'ЛХ': return '🏭 Луховицкий';
//       case 'ЛЮ': return '🏭 Люберецкий';
//       default: return '📦 Все заводы';
//     }
//   };

//   const currentSyncInfo = activeMainTab === 'incoming' ? cronInfo : shipmentCronInfo;
//   const currentTitle = activeMainTab === 'incoming' ? '📦 Поступление материалов' : '🚛 Отгрузка асфальта';

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

//   const filteredData = getFilteredData();
//   const groupedData = groupDataByDay(filteredData);
//   const sortedDates = Array.from(groupedData.keys()).sort((a, b) => {
//     const dateA = new Date(a.split('.').reverse().join('-'));
//     const dateB = new Date(b.split('.').reverse().join('-'));
//     return dateB.getTime() - dateA.getTime();
//   });

//   return (
//     <>
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

//           {/* Основные вкладки */}
//           <div className="main-tabs">
//             <button
//               className={`main-tab ${activeMainTab === 'incoming' ? 'active' : ''}`}
//               onClick={() => setActiveMainTab('incoming')}
//             >
//               📦 Поступление
//             </button>
//             <button
//               className={`main-tab ${activeMainTab === 'shipment' ? 'active' : ''}`}
//               onClick={() => setActiveMainTab('shipment')}
//             >
//               🚛 Отгрузка
//             </button>
//             <button
//               className={`main-tab ${activeMainTab === 'summary' ? 'active' : ''}`}
//               onClick={() => setActiveMainTab('summary')}
//             >
//               📊 План-факт
//             </button>
//           </div>

//           <div className="sync-info">
//             <span className="sync-label">🔄 Синхронизация с 1С:</span>
//             <span className="sync-time">{formatSyncTime(currentSyncInfo.lastSync)}</span>
//           </div>

//           {activeMainTab !== 'summary' && (
//             <>
//               <div className="factory-switch">
//                 <button
//                   className={`factory-btn ${activeFactory === 'all' ? 'active' : ''}`}
//                   onClick={() => setActiveFactory('all')}
//                 >
//                   📦 Все заводы
//                 </button>
//                 {factories.map(factory => (
//                   <button
//                     key={factory}
//                     className={`factory-btn ${activeFactory === factory ? 'active' : ''}`}
//                     onClick={() => setActiveFactory(factory)}
//                   >
//                     {getFactoryName(factory)}
//                   </button>
//                 ))}
//               </div>
              
//               <div className="tabs">
//                 <button 
//                   className={`tab ${activeTab === 'grouped' ? 'active' : ''}`}
//                   onClick={() => setActiveTab('grouped')}
//                 >
//                   📊 Итоги по дням
//                 </button>
//                 <button 
//                   className={`tab ${activeTab === 'list' ? 'active' : ''}`}
//                   onClick={() => setActiveTab('list')}
//                 >
//                   📋 Список
//                 </button>
//               </div>
//               <div className="stats">
//                 Всего записей: <strong>{filteredData.length}</strong>
//                 {activeFactory !== 'all' && ` (${getFactoryName(activeFactory)})`}
//               </div>
//             </>
//           )}
//         </header>

//         <motion.div
//           animate={shouldShake ? {
//             x: [0, -5, 5, -3, 3, 0],
//             transition: { duration: 0.3 }
//           } : {}}
//         >
//           {activeMainTab === 'summary' && <SummaryView />}

//           {activeMainTab !== 'summary' && activeTab === 'grouped' && (
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

//           {activeMainTab !== 'summary' && activeTab === 'list' && (
//             <div className="cards">
//               {filteredData.length === 0 ? (
//                 <div className="empty">
//                   <p>Нет данных</p>
//                 </div>
//               ) : (
//                 filteredData.map((item) => (
//                   <div key={item.id} className={`card ${isToday(item.date) ? 'today-card' : ''}`}>
//                     <div className="card-header">
//                       <span className="number">№{item.number}</span>
//                       <span className={`date ${isToday(item.date) ? 'today-date' : ''}`}>
//                         {formatDate(item.date)}
//                       </span>
//                     </div>
                    
//                     <div className="card-content">
//                       <div className="supplier">
//                         <span className="label">{activeMainTab === 'incoming' ? 'Поставщик:' : 'Покупатель:'}</span>
//                         <span className="value">
//                           {activeMainTab === 'incoming' 
//                             ? (item as IncomingItem).supplier 
//                             : (item as ShipmentItem).customer}
//                         </span>
//                       </div>
                      
//                       {activeMainTab === 'shipment' && (item as ShipmentItem).consignee && (
//                         <div className="consignee-line">
//                           <span className="label">📦 Грузополучатель:</span>
//                           <span className="value">{(item as ShipmentItem).consignee}</span>
//                         </div>
//                       )}
                      
//                       <div className="material">
//                         <span className="label">Материал:</span>
//                         <span className="value material-name">{item.material}</span>
//                       </div>
                      
//                       <div className="weight-row">
//                         <div className="weight-item">
//                           <span className="label">Количество:</span>
//                           <span className="value weight-value">{formatWeight(item.quantity)}</span>
//                         </div>
//                         <div className="weight-item">
//                           <span className="label">Брутто:</span>
//                           <span className="value">{formatWeight(item.gross)}</span>
//                         </div>
//                       </div>
                      
//                       <div className="driver-row">
//                         {item.driver && (
//                           <div className="driver-item">
//                             <span className="label">👨‍✈️ Водитель:</span>
//                             <span className="value">{item.driver}</span>
//                           </div>
//                         )}
//                         {item.licensePlate && (
//                           <div className="plate-item">
//                             <span className="label">🚛 Госномер:</span>
//                             <span className="value">{item.licensePlate}</span>
//                           </div>
//                         )}
//                       </div>
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
