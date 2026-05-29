// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import PinModal from './components/PinModal';
// import Header from './components/Header';
import MainTabs from './components/MainTabs';
import FactoryFilter from './components/FactoryFilter';
import ViewTabs from './components/ViewTabs';
import Notification from './components/Notification';
import SummaryView from './components/SummaryView';
import ListView from './components/ListView';
import GroupedView from './components/GroupedView';
import CompactView from './components/CompactView';
import Header from './components/header';
import ChartsView from './components/ChartsView';
import TopCustomersView from './components/TopCustomersView';

export interface OutgoingRequest {
  id: number;
  number: string;
  date: string;
  division: string;
  customer: string;
  consignee: string | null;  // ← оставляем null
  material: string;
  quantity: number;
  clientRequestNumber: string | null;
  clientRequestDate: string | null;
  createdAt: number;
}


export interface IncomingItem {
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

// export interface ShipmentItem {
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
//   clientRequestNumber: string | null;
//   clientRequestDate: string | null;
//   createdAt: number;
  
// }


export interface ShipmentItem {
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
  // clientRequestNumber: string | null;
  // clientRequestDate: string | null;
  createdAt: number;
  // Поля из 1С (русские названия)
  ЗаявкаНаОтгрузкуНомер?: string;
  ЗаявкаНаОтгрузкуДата?: string;
  clientRequestNumber: string | null;
  clientRequestDate: string | null;
}



export interface FactoryRequest {
  id: number;
  clientRequestNumber: string;
  date: string;
  material: string;
  planQuantity: number;
  factQuantity: number;
  consignee: string;
  customer: string;
  factory: string;
  createdAt: number;
}

interface GroupedRecord {
  date: string;
  supplier: string;
  material: string;
  totalQuantity: number;
  vehicleCount: number;
  records: (IncomingItem | ShipmentItem)[];
}

interface CronInfo {
  lastSync: string | null;
  totalRecords: number;
}

type MainTab = 'incoming' | 'shipment' | 'summary';
// type ViewTab = 'grouped' | 'list' | 'compact';
// type ViewTab = 'compact' | 'grouped' | 'list' | 'charts';
type ViewTab = 'compact' | 'grouped' | 'list' | 'charts' | 'topCustomers';


type UnifiedDataItem = IncomingItem | ShipmentItem;


// Парсинг даты из формата "DD.MM.YYYY HH:MM:SS" или "DD.MM.YYYY"
const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  
  if (dateString.includes('T')) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
  }
  
  const parts = dateString.split(' ');
  const dateParts = parts[0].split('.');
  
  let hour = 0, minute = 0, second = 0;
  if (parts[1]) {
    const timeParts = parts[1].split(':');
    hour = parseInt(timeParts[0], 10);
    minute = parseInt(timeParts[1], 10);
    second = parseInt(timeParts[2], 10);
  }
  
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  
  return new Date(year, month, day, hour, minute, second);
};

// Парсинг даты для сортировки
const parseDateForSort = (dateString: string): Date => {
  if (!dateString) return new Date(0);
  const parts = dateString.split(' ');
  const dateParts = parts[0].split('.');
  const timeParts = parts[1]?.split(':') || ['0', '0', '0'];
  
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  const second = parseInt(timeParts[2], 10);
  
  return new Date(year, month, day, hour, minute, second);
};

// Определяем завод
const detectFactory = (item: UnifiedDataItem, type: 'incoming' | 'shipment'): string => {
  if (type === 'incoming') {
    const incoming = item as IncomingItem;
    if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
    if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
  } else if (type === 'shipment') {
    const shipment = item as ShipmentItem;
    if (shipment.division === 'Луховицы') return 'ЛХ';
    if (shipment.division === 'Люберцы') return 'ЛЮ';
  }
  return 'Другой';
};

const getFactoryName = (code: string): string => {
  switch (code) {
    case 'ЛХ': return '🏭 Луховицкий';
    case 'ЛЮ': return '🏭 Люберецкий';
    default: return '📦 Все заводы';
  }
};

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [incomingData, setIncomingData] = useState<IncomingItem[]>([]);
  const [shipmentData, setShipmentData] = useState<ShipmentItem[]>([]);
  const [factoryRequests, setFactoryRequests] = useState<FactoryRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('shipment');
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('compact');
  const [activeFactory, setActiveFactory] = useState<string>('all');
  const [cronInfo, setCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
  const [shipmentCronInfo, setShipmentCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
  const [factories, setFactories] = useState<string[]>([]);
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [shouldShake, setShouldShake] = useState<boolean>(false);

  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequest[]>([]);


  const loadOutgoingRequests = async () => {
  try {
    const response = await fetch('/api/outgoing-requests');
    const data = await response.json();
    if (Array.isArray(data)) {
      setOutgoingRequests(data);
    }
  } catch (err) {
    console.error('Error loading outgoing requests:', err);
  }
};

  // Форматирование даты для отображения
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Нет даты';
    const date = parseDate(dateString);
    if (isNaN(date.getTime())) return 'Нет даты';
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = today.toLocaleDateString('ru-RU');
    const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
    const dateStr = date.toLocaleDateString('ru-RU');
    const timeStr = date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (dateStr === todayStr) return timeStr;
    if (dateStr === yesterdayStr) return `ВЧЕРА в ${timeStr}`;
    return `${dateStr} в ${timeStr}`;
  };

  // Проверка, сегодня ли дата
  const isToday = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const date = parseDate(dateStr);
    if (isNaN(date.getTime())) return false;
    
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Форматирование веса
  const formatWeight = (weight?: number | null): string => {
    if (weight === undefined || weight === null) return '—';
    if (isNaN(weight)) return '—';
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

  // Получить метку завода для бейджа
  const getFactoryBadge = (item: UnifiedDataItem): string => {
    if ('supplier' in item) {
      const incoming = item as IncomingItem;
      if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
      if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
    } else if ('division' in item) {
      const shipment = item as ShipmentItem;
      if (shipment.division === 'Луховицы') return 'ЛХ';
      if (shipment.division === 'Люберцы') return 'ЛЮ';
    }
    return 'Другой';
  };

  // Получить уникальные заводы из записей в группе
  const getUniqueFactories = (records: UnifiedDataItem[]): string[] => {
    const factoriesSet = new Set<string>();
    records.forEach(record => {
      if ('supplier' in record) {
        const incoming = record as IncomingItem;
        if (incoming.number?.startsWith('ЛХ')) factoriesSet.add('ЛХ');
        if (incoming.number?.startsWith('ЛЮ')) factoriesSet.add('ЛЮ');
      } else if ('division' in record) {
        const shipment = record as ShipmentItem;
        if (shipment.division === 'Луховицы') factoriesSet.add('ЛХ');
        if (shipment.division === 'Люберцы') factoriesSet.add('ЛЮ');
      }
    });
    return Array.from(factoriesSet);
  };

  // Получение информации о заявке для компактного вида
  // const getRequestCompletion = useCallback((clientRequestNumber: string | null) => {
  //   if (!clientRequestNumber) return null;
    
  //   const request = factoryRequests.find(r => r.clientRequestNumber === clientRequestNumber);
  //   if (!request) return null;
    
  //   return {
  //     plan: request.planQuantity,
  //     fact: request.factQuantity,
  //     percent: request.planQuantity > 0 ? (request.factQuantity / request.planQuantity) * 100 : 0,
  //     requestNumber: request.clientRequestNumber,
  //   };
  // }, [factoryRequests]);
// const getRequestCompletion = useCallback((clientRequestNumber: string | null) => {
//   console.log('Looking for:', clientRequestNumber);
//   console.log('Available requests:', factoryRequests.map(r => r.clientRequestNumber));
  
//   if (!clientRequestNumber) return null;
  
//   const request = factoryRequests.find(r => r.clientRequestNumber === clientRequestNumber);
//   if (!request) {
//     console.log('Not found:', clientRequestNumber);
//     return null;
//   }
  
//   console.log('Found:', request);
  
//   return {
//     plan: request.planQuantity,
//     fact: request.factQuantity,
//     percent: request.planQuantity > 0 ? (request.factQuantity / request.planQuantity) * 100 : 0,
//     requestNumber: request.clientRequestNumber,
//   };
// }, [factoryRequests]);

// const getRequestCompletion = useCallback((clientRequestNumber: string | null) => {
//   if (!clientRequestNumber) return null;
  
//   // Ищем заявку по number (номеру заявки)
//   const request = outgoingRequests.find(r => r.number === clientRequestNumber);
  
//   if (!request) return null;
  
//   return {
//     plan: request.quantity,
//     fact: 0, // факт можно будет посчитать из отгрузок
//     percent: 0,
//     requestNumber: request.number,
//   };
// }, [outgoingRequests]);

const getRequestCompletion = useCallback((clientRequestNumber: string | null) => {
  if (!clientRequestNumber) return null;
  
  // Ищем заявку по number (номеру заявки)
  const request = outgoingRequests.find(r => r.number === clientRequestNumber);
  
  if (!request) return null;
  
  // Считаем факт из отгрузок, связанных с этой заявкой
  const relatedShipments = shipmentData.filter(s => s.clientRequestNumber === clientRequestNumber);
  const factQuantity = relatedShipments.reduce((sum, s) => sum + s.quantity, 0);
  const percent = request.quantity > 0 ? (factQuantity / request.quantity) * 100 : 0;
  
  return {
    plan: request.quantity,
    fact: factQuantity,
    percent: Math.round(percent),
    requestNumber: request.number,
  };
}, [outgoingRequests, shipmentData]);



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

  const loadFactoryRequests = async () => {
    try {
      const response = await fetch('/api/factory-requests');
      const data = await response.json();
      if (Array.isArray(data)) {
        setFactoryRequests(data);
      }
    } catch (err) {
      console.error('Error loading factory requests:', err);
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

  const loadAllData = async () => {
    try {
      const [incoming, shipment] = await Promise.all([
        loadIncomingData(),
        loadShipmentData(),
        loadOutgoingRequests(),
      ]);
      
      await Promise.all([
        loadFactoryRequests(),
        loadCronInfo(),
        loadShipmentCronInfo(),
      ]);
      
      // Собираем уникальные заводы
      const factorySet = new Set<string>();
      
      (incoming as IncomingItem[]).forEach(item => {
        if (item.number?.startsWith('ЛХ')) factorySet.add('ЛХ');
        if (item.number?.startsWith('ЛЮ')) factorySet.add('ЛЮ');
      });
      
      (shipment as ShipmentItem[]).forEach(item => {
        if (item.division === 'Луховицы') factorySet.add('ЛХ');
        if (item.division === 'Люберцы') factorySet.add('ЛЮ');
      });
      
      setFactories(Array.from(factorySet).sort());
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
        await loadShipmentCronInfo();
        setNotificationMessage(`✅ Отгрузки обновлены`);
      } else if (activeMainTab === 'summary') {
        await Promise.all([
          fetch('/api/cron', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
          fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
        ]);
        await loadAllData();
        setNotificationMessage(`✅ Все данные обновлены`);
      }
      
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 2000);
      
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
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
        loadShipmentCronInfo();
      } else if (activeMainTab === 'summary') {
        loadAllData();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, activeMainTab]);

  const getCurrentData = (): UnifiedDataItem[] => {
    if (activeMainTab === 'incoming') {
      return incomingData;
    }
    return shipmentData;
  };

  const getFilteredData = (): UnifiedDataItem[] => {
    const data = getCurrentData();
    if (activeFactory === 'all') return data;
    
    return data.filter(item => {
      const factory = detectFactory(item, activeMainTab as 'incoming' | 'shipment');
      return factory === activeFactory;
    });
  };

  const groupDataByDay = (data: UnifiedDataItem[]) => {
    const groupedMap = new Map<string, Map<string, GroupedRecord>>();
    
    data.forEach((record) => {
      const date = parseDate(record.date);
      const dateOnly = date.toLocaleDateString('ru-RU');
      
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

  const filteredData = getFilteredData();
  const groupedData = groupDataByDay(filteredData);
  const sortedDates = Array.from(groupedData.keys()).sort((a, b) => {
    const dateA = parseDateForSort(a);
    const dateB = parseDateForSort(b);
    return dateB.getTime() - dateA.getTime();
  });



const outgoingRequestsForCompact = outgoingRequests.map(req => ({
  number: req.number,
  date: req.date,
  division: req.division,     // ← ДОБАВИТЬ подразделение (завод)
  quantity: req.quantity,
  consignee: req.consignee || '',  // ← null заменяем на пустую строку
  material: req.material,
}));


// console.log('outgoingRequestsForCompact length:', outgoingRequestsForCompact.length);
// console.log('Sample:', outgoingRequestsForCompact[0]);





const sendPlan = async () => {
  setRefreshing(true);
  try {
    const response = await fetch('/api/send-plan', {
      headers: { 'Authorization': 'Bearer icg72xf3b1' }
    });
    const data = await response.json();
    setNotificationMessage(`✅ План отправлен! ${data.planCount} заказов`);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  } catch (err) {
    setNotificationMessage('⚠️ Ошибка отправки');
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  } finally {
    setRefreshing(false);
  }
};




  const currentSyncInfo = activeMainTab === 'incoming' ? cronInfo : shipmentCronInfo;

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

  return (
    <>
      <Notification message={notificationMessage} show={showNotification} />

      <div className="container">
        <header className="header">
          {/* <Header refreshing={refreshing} onRefresh={handleRefresh} /> */}
          
          <Header 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            onSendPlan={sendPlan}
          />
          

          <MainTabs activeTab={activeMainTab} onTabChange={setActiveMainTab} />
          
          <div className="sync-info">
            <span className="sync-label">🔄 Синхронизация с 1С:</span>
            <span className="sync-time">{formatSyncTime(currentSyncInfo.lastSync)}</span>
          </div>

          {activeMainTab !== 'summary' && (
            <>
              <FactoryFilter 
                factories={factories} 
                activeFactory={activeFactory} 
                onFactoryChange={setActiveFactory} 
              />
              
              <ViewTabs activeTab={activeViewTab} onTabChange={setActiveViewTab} />
              
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

          {/* {activeMainTab !== 'summary' && activeViewTab === 'list' && (
            <ListView 
              data={filteredData}
              mainTab={activeMainTab}
              isToday={isToday}
              formatDate={formatDate}
              formatWeight={formatWeight}
              getFactoryBadge={getFactoryBadge}
            />
          )} */}


          {activeMainTab !== 'summary' && activeViewTab === 'list' && (
  <ListView 
    data={filteredData}
    mainTab={activeMainTab}
  />
)}

          {/* {activeMainTab !== 'summary' && activeViewTab === 'grouped' && (
            <GroupedView 
              groupedData={groupedData}
              dates={sortedDates}
              mainTab={activeMainTab}
              formatWeight={formatWeight}
              getUniqueFactories={getUniqueFactories}
            />
          )} */}

{activeMainTab !== 'summary' && activeViewTab === 'compact' && (
  <CompactView 
    data={filteredData}
    mainTab={activeMainTab}
    outgoingRequests={outgoingRequestsForCompact}
  />
)}


{activeMainTab !== 'summary' && activeViewTab === 'charts' && (
  <ChartsView data={shipmentData} />
)}



{activeMainTab !== 'summary' && activeViewTab === 'topCustomers' && (
  <TopCustomersView data={shipmentData} />
)}





        </motion.div>
      </div>
    </>
  );
}



