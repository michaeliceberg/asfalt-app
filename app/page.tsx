'use client';

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { motion } from 'framer-motion';
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
import ModeSwitch from './components/ModeSwitch';
import LoadingSpinner from './components/LoadingSpinner';

// ============================================
// ИНТЕРФЕЙСЫ
// ============================================

interface ApiOutgoingRequest {
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
  closed: boolean | null;
  delivery_date: string | null;
}

export interface OutgoingRequest {
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
  closed: boolean | null;
  delivery_date: string | null;
}

export interface IncomingItem {
  id: number;
  number: string;
  date: string;
  division: string;
  supplier: string;
  material: string;
  gross: number | null;
  tara: number | null;
  quantity: number;
  driver: string | null;
  licensePlate: string | null;
  createdAt: number;
}

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
  createdAt: number;
  ЗаявкаНаОтгрузкуНомер?: string;
  ЗаявкаНаОтгрузкуДата?: string;
  clientRequestNumber: string | null;
  clientRequestDate: string | null;
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




// Добавьте этот интерфейс после других интерфейсов
interface ApiRequest {
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
  closed: boolean | null;
  delivery_date: string | null;
}


// ============================================
// ФУНКЦИЯ ОПРЕДЕЛЕНИЯ БЕТОНА
// ============================================

const isConcreteMaterial = (material: string): boolean => {
  if (!material) return false;
  const lower = material.toLowerCase();
  
  // Чёткие маркеры бетона
  const concreteMarkers = ['бст', 'бсм', 'бетон', 'раствор'];
  
  // Исключения — что точно НЕ бетон
  const notConcreteMarkers = ['пбв', 'гранит', 'асфальт', 'щебень', 'песок', 'битум', 'эмульсия'];
  
  // Сначала проверяем исключения
  for (const marker of notConcreteMarkers) {
    if (lower.includes(marker)) return false;
  }
  
  // Потом проверяем маркеры бетона
  for (const marker of concreteMarkers) {
    if (lower.includes(marker)) return true;
  }
  
  return false;
};



type MainTab = 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary';
type ViewTab = 'compact' | 'grouped' | 'list' | 'charts' | 'topCustomers';
type UnifiedDataItem = IncomingItem | ShipmentItem;

// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ
// ============================================

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

const getDateKey = (dateString: string): string => {
  const date = parseRussianDate(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

const isConcrete = (material: string): boolean => {
  if (!material) return false;
  const lower = material.toLowerCase();
  return lower.includes('бст') || 
         lower.includes('бетон') ||
         lower.includes('раствор') ||
         lower.includes('бсм');
};

const detectFactory = (item: UnifiedDataItem, type: 'incoming' | 'shipment'): string => {
  if (type === 'incoming') {
    const incoming = item as IncomingItem;
    if (incoming.division === 'ЛХ') return 'ЛХ';
    if (incoming.division === 'ЛЮ') return 'ЛЮ';
    if (incoming.division === 'СП') return 'СП';
    if (incoming.division === 'Щ') return 'Щ';
    if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
    if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
    if (incoming.number?.startsWith('СП')) return 'СП';
    if (incoming.number?.startsWith('Щ')) return 'Щ';
  } else if (type === 'shipment') {
    const shipment = item as ShipmentItem;
    if (shipment.division === 'ЛХ') return 'ЛХ';
    if (shipment.division === 'ЛЮ') return 'ЛЮ';
    if (shipment.division === 'СП') return 'СП';
    if (shipment.division === 'Щ') return 'Щ';
  }
  return 'Другой';
};

const getFactoryName = (code: string): string => {
  switch (code) {
    case 'ЛХ': return '🏭 Луховицкий';
    case 'ЛЮ': return '🏭 Люберецкий';
    case 'СП': return '🏭 Сергиев Посад';
    case 'Щ': return '🏭 Щёлково';
    default: return '📦 Все заводы';
  }
};

// ============================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================

export default function Home() {
  // Состояния
  const [incomingData, setIncomingData] = useState<IncomingItem[]>([]);
  const [shipmentData, setShipmentData] = useState<ShipmentItem[]>([]);
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
  const [futureRequestsCount, setFutureRequestsCount] = useState<number>(0);
  const [newShipmentsCount, setNewShipmentsCount] = useState<number>(0);
  const [newConcreteCount, setNewConcreteCount] = useState<number>(0);
  const [contentKey, setContentKey] = useState(0);


  const [lastImportInfo, setLastImportInfo] = useState<{ lastImport: string | null; totalRecords: number }>({ lastImport: null, totalRecords: 0 });



  // Режим переключения (ТАС / Айсберг)
  const [mode, setMode] = useState<'tas' | 'iceberg'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('appMode');
      if (saved === 'tas' || saved === 'iceberg') {
        return saved;
      }
    }
    return 'tas';
  });

  // Доступные заводы в зависимости от режима
const availableFactories = mode === 'tas' 
  ? factories.filter(f => f === 'ЛХ' || f === 'ЛЮ')
  : factories.filter(f => f === 'СП' || f === 'Щ');

  // Функция переключения режима
  
  
  
  
  // const toggleMode = () => {
  //   const newMode = mode === 'tas' ? 'iceberg' : 'tas';
    
  //   setContentKey(prev => prev + 1);
  //   setMode(newMode);
  //   setActiveFactory('all');
    
  //   // Вибрация на мобильных устройствах
  //   if (window.navigator && window.navigator.vibrate) {
  //     window.navigator.vibrate(50);
  //   }
    
  //   localStorage.setItem('appMode', newMode);
  // };

const toggleMode = () => {
  const newMode = mode === 'tas' ? 'iceberg' : 'tas';
  
  setContentKey(prev => prev + 1);
  setMode(newMode);
  setActiveFactory('all');
  
  // Пересчитываем счётчики после смены режима
  setTimeout(() => {
    loadFutureRequestsCount();
    loadNewShipmentsCount();
    if (newMode === 'iceberg') {
      loadNewConcreteCount();
    } else {
      setNewConcreteCount(0);
    }
  }, 100);
  
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(50);
  }
  
  localStorage.setItem('appMode', newMode);
};









  // Применяем класс к body для изменения темы
  useEffect(() => {
    if (mode === 'iceberg') {
      document.body.classList.add('iceberg-mode');
    } else {
      document.body.classList.remove('iceberg-mode');
    }
  }, [mode]);

  // ============================================
  // ЗАГРУЗКА ДАННЫХ
  // ============================================

  const loadNewShipmentsCount = async () => {
  try {
    const [requestsResponse, shipmentsResponse] = await Promise.all([
      fetch('/api/outgoing-requests'),
      fetch('/api/shipments')
    ]);
    
    const allRequests = await requestsResponse.json();
    let allShipments = await shipmentsResponse.json();
    
    // Фильтруем отгрузки по текущему режиму (только асфальт)
    allShipments = allShipments.filter((s: ShipmentItem) => !isConcreteMaterial(s.material));
    
    // Фильтруем по заводам текущего режима
    const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
    allShipments = allShipments.filter((s: ShipmentItem) => validFactories.includes(s.division));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const shipmentsByRequest = new Map();
    for (const shipment of allShipments) {
      const shipmentDate = parseRussianDate(shipment.date);
      shipmentDate.setHours(0, 0, 0, 0);
      if (shipmentDate.getTime() !== today.getTime()) continue;
      
      const requestNumber = shipment.clientRequestNumber;
      if (requestNumber) {
        const current = shipmentsByRequest.get(requestNumber) || { fact: 0 };
        current.fact += shipment.quantity;
        shipmentsByRequest.set(requestNumber, current);
      }
    }
    
    const planMap = new Map();
    for (const req of allRequests) {
      planMap.set(req.number, req.quantity);
    }
    
    let activeCount = 0;
    for (const [requestNumber, data] of shipmentsByRequest) {
      const request = allRequests.find((r: ApiOutgoingRequest) => r.number === requestNumber);
      if (request && !request.closed) {
        const plan = planMap.get(requestNumber) || 0;
        const percent = plan > 0 ? (data.fact / plan) * 100 : 0;
        if (percent > 0 && percent < 90) {
          activeCount++;
        }
      }
    }
    
    setNewShipmentsCount(activeCount);
  } catch (err) {
    console.error(err);
  }
};

const loadNewConcreteCount = async () => {
  try {
    const response = await fetch('/api/shipments');
    let allShipments: ShipmentItem[] = await response.json();
    
    // Только бетон
    allShipments = allShipments.filter(s => isConcreteMaterial(s.material));
    
    // Только заводы текущего режима (Айсберг)
    const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
    allShipments = allShipments.filter(s => validFactories.includes(s.division));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayConcrete = allShipments.filter(shipment => {
      const shipmentDate = parseRussianDate(shipment.date);
      shipmentDate.setHours(0, 0, 0, 0);
      return shipmentDate.getTime() === today.getTime();
    });
    
    setNewConcreteCount(todayConcrete.length);
  } catch (err) {
    console.error(err);
  }
};












const loadFutureRequestsCount = async () => {
  try {
    const [requestsResponse, shipmentsResponse] = await Promise.all([
      fetch('/api/outgoing-requests'),
      fetch('/api/shipments')
    ]);
    
    let allRequests: ApiRequest[] = await requestsResponse.json();
    let allShipments: ShipmentItem[] = await shipmentsResponse.json();
    
    // Фильтруем по заводам текущего режима
    const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
    allRequests = allRequests.filter((r) => validFactories.includes(r.division));
    allShipments = allShipments.filter((s) => validFactories.includes(s.division));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeTodayRequests = new Set();
    for (const shipment of allShipments) {
      const shipmentDate = parseRussianDate(shipment.date);
      shipmentDate.setHours(0, 0, 0, 0);
      if (shipmentDate.getTime() === today.getTime() && shipment.clientRequestNumber) {
        activeTodayRequests.add(shipment.clientRequestNumber);
      }
    }
    
    const future = allRequests.filter((req) => {
      if (req.closed) return false;
      if (!req.delivery_date) return false;
      const deliveryDate = parseRussianDate(req.delivery_date);
      deliveryDate.setHours(0, 0, 0, 0);
      return deliveryDate >= today && !activeTodayRequests.has(req.number);
    });
    
    setFutureRequestsCount(future.length);
  } catch (err) {
    console.error(err);
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
      console.error('Error loading outgoing requests:', err);
    }
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
      const data: ShipmentItem[] = await response.json();
      
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


  // 👇 ДОБАВЬТЕ ЭТУ ФУНКЦИЮ 👇
  const loadLastImportInfo = async () => {
    try {
      const response = await fetch('/api/last-import-info');
      const data = await response.json();
      setLastImportInfo(data);
    } catch (err) {
      console.error('Failed to load import info:', err);
    }
  };



const loadAllData = async () => {
  try {
    const [incoming, shipment] = await Promise.all([
      loadIncomingData(),
      loadShipmentData(),
      loadOutgoingRequests(),
    ]);
    
    const factorySet = new Set<string>();
    
    // Добавляем все найденные заводы
    (incoming as IncomingItem[]).forEach(item => {
      if (item.division) factorySet.add(item.division);
      if (item.number?.startsWith('ЛХ')) factorySet.add('ЛХ');
      if (item.number?.startsWith('ЛЮ')) factorySet.add('ЛЮ');
      if (item.number?.startsWith('СП')) factorySet.add('СП');
      if (item.number?.startsWith('Щ')) factorySet.add('Щ');
    });
    
    (shipment as ShipmentItem[]).forEach(item => {
      if (item.division) factorySet.add(item.division);
    });
    
    setFactories(Array.from(factorySet).sort());
  } catch (err) {
    console.error('Error loading all data:', err);
  }
};





  // ============================================
  // ОБНОВЛЕНИЕ ДАННЫХ
  // ============================================

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
      await loadNewShipmentsCount();  // ← добавить
      setNotificationMessage(`✅ Отгрузки асфальта обновлены`);
    } else if (activeMainTab === 'shipmentConcrete') {
      await fetch('/api/cron-shipments', {
        headers: { 'Authorization': 'Bearer icg72xf3b1' }
      });
      await loadShipmentData();
      await loadShipmentCronInfo();
      await loadNewConcreteCount();  // ← добавить
      setNotificationMessage(`✅ Отгрузки бетона обновлены`);
    } else if (activeMainTab === 'summary') {
      await Promise.all([
        fetch('/api/cron', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
        fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
      ]);
      await loadAllData();
      await loadFutureRequestsCount();
      await loadNewShipmentsCount();
      await loadNewConcreteCount();  // ← добавить
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

  // ============================================
  // ФИЛЬТРАЦИЯ ДАННЫХ
  // ============================================

  const getFilteredShipmentsByType = (type: 'asphalt' | 'concrete'): ShipmentItem[] => {
    let filtered = shipmentData;
    
    // Фильтруем по заводу
    if (activeFactory !== 'all') {
      filtered = filtered.filter(item => {
        const factory = detectFactory(item, 'shipment');
        return factory === activeFactory;
      });
    }
    
    // Фильтруем по типу материала
    if (type === 'asphalt') {
      filtered = filtered.filter(item => !isConcrete(item.material));
    } else if (type === 'concrete') {
      filtered = filtered.filter(item => isConcrete(item.material));
    }
    
    return filtered;
  };

  
  
  
  

  const getCurrentData = (): UnifiedDataItem[] => {
  // Поступления
  if (activeMainTab === 'incoming') {
    let filtered = incomingData;
    
    // Фильтруем по заводу если выбран конкретный
    if (activeFactory !== 'all') {
      filtered = filtered.filter(item => {
        const factory = detectFactory(item, 'incoming');
        return factory === activeFactory;
      });
    } else {
      // Если выбран "Все заводы", фильтруем по текущему режиму
      filtered = filtered.filter(item => {
        const factory = detectFactory(item, 'incoming');
        if (mode === 'tas') {
          return factory === 'ЛХ' || factory === 'ЛЮ';
        } else {
          return factory === 'СП' || factory === 'Щ';
        }
      });
    }
    return filtered;
  }
  
  // Отгрузка Асфальт
  if (activeMainTab === 'shipment') {
    let filtered = shipmentData.filter(item => !isConcreteMaterial(item.material));
    
    if (activeFactory !== 'all') {
      filtered = filtered.filter(item => {
        const factory = detectFactory(item, 'shipment');
        return factory === activeFactory;
      });
    } else {
      filtered = filtered.filter(item => {
        const factory = detectFactory(item, 'shipment');
        if (mode === 'tas') {
          return factory === 'ЛХ' || factory === 'ЛЮ';
        } else {
          return factory === 'СП' || factory === 'Щ';
        }
      });
    }
    return filtered;
  }
  
  // Отгрузка Бетон (только для Айсберг)
  if (activeMainTab === 'shipmentConcrete') {
    let filtered = shipmentData.filter(item => isConcreteMaterial(item.material));
    
    if (activeFactory !== 'all') {
      filtered = filtered.filter(item => {
        const factory = detectFactory(item, 'shipment');
        return factory === activeFactory;
      });
    } else {
      filtered = filtered.filter(item => {
        const factory = detectFactory(item, 'shipment');
        if (mode === 'tas') {
          return factory === 'ЛХ' || factory === 'ЛЮ';
        } else {
          return factory === 'СП' || factory === 'Щ';
        }
      });
    }
    return filtered;
  }
  
  return [];
};








  const filteredData = getCurrentData();

  const outgoingRequestsForCompact = outgoingRequests.map(req => ({
    number: req.number,
    date: req.date,
    division: req.division,
    quantity: req.quantity,
    consignee: req.consignee || '',
    material: req.material,
    closed: req.closed,
  }));

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

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        await loadAllData();
        await loadFutureRequestsCount();
        await loadNewShipmentsCount();
        await loadNewConcreteCount();
        await loadLastImportInfo();  // 👈 ДОБАВЬТЕ ЭТУ СТРОКУ
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
  }, []);












  useEffect(() => {
  const interval = setInterval(() => {
    console.log('🔄 Автообновление...');
    
    if (activeMainTab === 'incoming') {
      loadIncomingData();
      loadCronInfo();
    } 
    else if (activeMainTab === 'shipment') {
      loadShipmentData();
      loadShipmentCronInfo();
      loadNewShipmentsCount();
    } 
    else if (activeMainTab === 'shipmentConcrete') {
      loadShipmentData();
      loadShipmentCronInfo();
      // Обновляем счётчик бетона только в режиме Айсберг
      if (mode === 'iceberg') {
        loadNewConcreteCount();
      }
    } 
    else if (activeMainTab === 'summary') {
      loadAllData();
      loadFutureRequestsCount();
      loadNewShipmentsCount();
      if (mode === 'iceberg') {
        loadNewConcreteCount();
      }
    }
  }, 30000);
  
  return () => clearInterval(interval);
}, [activeMainTab, mode]);






// При смене режима пересчитываем счётчики
useEffect(() => {
  loadFutureRequestsCount();
  loadNewShipmentsCount();
  loadNewConcreteCount(); // функция сама проверит mode
}, [mode]);



  // ============================================
  // РЕНДЕР
  // ============================================

  if (loading) {
    return <LoadingSpinner message="Загрузка данных..." size="large" fullScreen />;
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
          <Header 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            onSendPlan={sendPlan}
          />
          
          <ModeSwitch mode={mode} onToggle={toggleMode} />

          <MainTabs 
            activeTab={activeMainTab} 
            onTabChange={setActiveMainTab}
            futureRequestsCount={futureRequestsCount}
            newShipmentsCount={newShipmentsCount}
            newConcreteCount={newConcreteCount}
            showConcreteTab={mode === 'iceberg'}  // ← показываем только в режиме Айсберг
          />

          <div className="sync-info">
            <span className="sync-label">🔄 Синхронизация с 1С (ЛХ/ЛЮ):</span>
            <span className="sync-time">{formatSyncTime(currentSyncInfo.lastSync)}</span>
          </div>

          {/* 👇 ДОБАВЬТЕ ЭТОТ БЛОК 👇 */}
          <div className="sync-info">
            <span className="sync-label">📁 Импорт Excel (СП/Щ):</span>
            <span className="sync-time">{formatSyncTime(lastImportInfo.lastImport)}</span>
          </div>

          {activeMainTab !== 'summary' && (
            <>
              <FactoryFilter 
                factories={availableFactories} 
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
          key={contentKey}
          initial={{ opacity: 0, x: mode === 'tas' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: mode === 'tas' ? 20 : -20 }}
          transition={{ duration: 0.3, type: 'spring', stiffness: 400, damping: 30 }}
        >
          {/* {activeMainTab === 'summary' && <SummaryView />} */}
          {activeMainTab === 'summary' && <SummaryView mode={mode} />}
          
{activeMainTab !== 'summary' && activeViewTab === 'list' && (
  <ListView 
    data={getCurrentData()}
    mainTab={activeMainTab}
  />
)}

{activeMainTab !== 'summary' && activeViewTab === 'compact' && (
  <CompactView 
    data={getCurrentData()}
    mainTab={activeMainTab}
    outgoingRequests={outgoingRequestsForCompact}
    allShipments={shipmentData}
    allShipmentsForChart={shipmentData}
    selectedFactory={activeFactory}
    mode={mode}
  />
)}

          {/* {activeMainTab !== 'summary' && activeViewTab === 'charts' && (
            <ChartsView data={shipmentData} />
          )} */}


{activeMainTab !== 'summary' && activeViewTab === 'charts' && (
  <ChartsView data={shipmentData} mode={mode} />
)}

          {activeMainTab !== 'summary' && activeViewTab === 'topCustomers' && (
            <TopCustomersView 
              data={shipmentData} 
              mode={mode} 
            />
          )}
        </motion.div>
      </div>
    </>
  );
}



// // app/page.tsx
// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { motion } from 'framer-motion';
// // import PinModal from './components/PinModal';
// import MainTabs from './components/MainTabs';
// import FactoryFilter from './components/FactoryFilter';
// import ViewTabs from './components/ViewTabs';
// import Notification from './components/Notification';
// import SummaryView from './components/SummaryView';
// import ListView from './components/ListView';
// import GroupedView from './components/GroupedView';
// import CompactView from './components/CompactView';
// import Header from './components/header';
// import ChartsView from './components/ChartsView';
// import TopCustomersView from './components/TopCustomersView';


// // Добавьте интерфейс после других импортов
// interface ApiOutgoingRequest {
//   id: number;
//   number: string;
//   date: string;
//   division: string;
//   customer: string;
//   consignee: string | null;
//   material: string;
//   quantity: number;
//   clientRequestNumber: string | null;
//   clientRequestDate: string | null;
//   createdAt: number;
//   closed: boolean | null;
//   delivery_date: string | null;
// }


// export interface OutgoingRequest {
//   id: number;
//   number: string;
//   date: string;
//   division: string;
//   customer: string;
//   consignee: string | null;
//   material: string;
//   quantity: number;
//   clientRequestNumber: string | null;
//   clientRequestDate: string | null;
//   createdAt: number;
//   closed: boolean | null;
//   delivery_date: string | null;  // ← добавить
// }

// export interface IncomingItem {
//   id: number;
//   number: string;
//   date: string;
//   division: string;          // ← ДОБАВИТЬ ЭТУ СТРОКУ!
//   supplier: string;
//   material: string;
//   gross: number | null;
//   tara: number | null;
//   quantity: number;
//   driver: string | null;
//   licensePlate: string | null;
//   createdAt: number;
// }

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
//   createdAt: number;
//   ЗаявкаНаОтгрузкуНомер?: string;
//   ЗаявкаНаОтгрузкуДата?: string;
//   clientRequestNumber: string | null;
//   clientRequestDate: string | null;
// }

// export interface FactoryRequest {
//   id: number;
//   clientRequestNumber: string;
//   date: string;
//   material: string;
//   planQuantity: number;
//   factQuantity: number;
//   consignee: string;
//   customer: string;
//   factory: string;
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

// type MainTab = 'incoming' | 'shipment' | 'summary';
// type ViewTab = 'compact' | 'grouped' | 'list' | 'charts' | 'topCustomers';

// type UnifiedDataItem = IncomingItem | ShipmentItem;

// const parseDate = (dateString: string): Date => {
//   if (!dateString) return new Date();
  
//   if (dateString.includes('T')) {
//     const date = new Date(dateString);
//     if (!isNaN(date.getTime())) return date;
//   }
  
//   const parts = dateString.split(' ');
//   const dateParts = parts[0].split('.');
  
//   let hour = 0, minute = 0, second = 0;
//   if (parts[1]) {
//     const timeParts = parts[1].split(':');
//     hour = parseInt(timeParts[0], 10);
//     minute = parseInt(timeParts[1], 10);
//     second = parseInt(timeParts[2], 10);
//   }
  
//   const day = parseInt(dateParts[0], 10);
//   const month = parseInt(dateParts[1], 10) - 1;
//   const year = parseInt(dateParts[2], 10);
  
//   return new Date(year, month, day, hour, minute, second);
// };

// const parseDateForSort = (dateString: string): Date => {
//   if (!dateString) return new Date(0);
//   const parts = dateString.split(' ');
//   const dateParts = parts[0].split('.');
//   const timeParts = parts[1]?.split(':') || ['0', '0', '0'];
  
//   const day = parseInt(dateParts[0], 10);
//   const month = parseInt(dateParts[1], 10) - 1;
//   const year = parseInt(dateParts[2], 10);
//   const hour = parseInt(timeParts[0], 10);
//   const minute = parseInt(timeParts[1], 10);
//   const second = parseInt(timeParts[2], 10);
  
//   return new Date(year, month, day, hour, minute, second);
// };

// // const detectFactory = (item: UnifiedDataItem, type: 'incoming' | 'shipment'): string => {
// //   if (type === 'incoming') {
// //     const incoming = item as IncomingItem;
// //     if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
// //     if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
// //   } else if (type === 'shipment') {
// //     const shipment = item as ShipmentItem;
// //     if (shipment.division === 'Луховицы') return 'ЛХ';
// //     if (shipment.division === 'Люберцы') return 'ЛЮ';
// //   }
// //   return 'Другой';
// // };



// // const detectFactory = (item: UnifiedDataItem, type: 'incoming' | 'shipment'): string => {
// //   if (type === 'incoming') {
// //     const incoming = item as IncomingItem;
// //     if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
// //     if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
// //   } else if (type === 'shipment') {
// //     const shipment = item as ShipmentItem;
// //     if (shipment.division === 'ЛХ') return 'ЛХ';
// //     if (shipment.division === 'ЛЮ') return 'ЛЮ';
// //   }
// //   return 'Другой';
// // };


// // const detectFactory = (item: UnifiedDataItem, type: 'incoming' | 'shipment'): string => {
// //   if (type === 'incoming') {
// //     const incoming = item as IncomingItem;
// //     if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
// //     if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
// //     if (incoming.number?.startsWith('СП')) return 'СП';
// //     if (incoming.number?.startsWith('Щ')) return 'Щ';
// //     if (incoming.division === 'СП') return 'СП';
// //     if (incoming.division === 'Щ') return 'Щ';
// //   } else if (type === 'shipment') {
// //     const shipment = item as ShipmentItem;
// //     if (shipment.division === 'ЛХ') return 'ЛХ';
// //     if (shipment.division === 'ЛЮ') return 'ЛЮ';
// //     if (shipment.division === 'СП') return 'СП';
// //     if (shipment.division === 'Щ') return 'Щ';
// //   }
// //   return 'Другой';
// // };

// const detectFactory = (item: UnifiedDataItem, type: 'incoming' | 'shipment'): string => {
//   if (type === 'incoming') {
//     const incoming = item as IncomingItem;
//     // division уже есть в типе!
//     if (incoming.division === 'ЛХ') return 'ЛХ';
//     if (incoming.division === 'ЛЮ') return 'ЛЮ';
//     if (incoming.division === 'СП') return 'СП';
//     if (incoming.division === 'Щ') return 'Щ';
//     // Если division нет, пробуем по номеру
//     if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
//     if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
//     if (incoming.number?.startsWith('СП')) return 'СП';
//     if (incoming.number?.startsWith('Щ')) return 'Щ';
//   } else if (type === 'shipment') {
//     const shipment = item as ShipmentItem;
//     if (shipment.division === 'ЛХ') return 'ЛХ';
//     if (shipment.division === 'ЛЮ') return 'ЛЮ';
//     if (shipment.division === 'СП') return 'СП';
//     if (shipment.division === 'Щ') return 'Щ';
//   }
//   return 'Другой';
// };


// // const getFactoryName = (code: string): string => {
// //   switch (code) {
// //     case 'ЛХ': return '🏭 Луховицкий';
// //     case 'ЛЮ': return '🏭 Люберецкий';
// //     default: return '📦 Все заводы';
// //   }
// // };


// const getFactoryName = (code: string): string => {
//   switch (code) {
//     case 'ЛХ': return '🏭 Луховицкий';
//     case 'ЛЮ': return '🏭 Люберецкий';
//     case 'СП': return '🏭 Сергиев Посад';
//     case 'Щ': return '🏭 Щёлково';
//     default: return '📦 Все заводы';
//   }
// };



// export default function Home() {
//   // const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
//   const [incomingData, setIncomingData] = useState<IncomingItem[]>([]);
//   const [shipmentData, setShipmentData] = useState<ShipmentItem[]>([]);
//   // const [factoryRequests, setFactoryRequests] = useState<FactoryRequest[]>([]);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [refreshing, setRefreshing] = useState<boolean>(false);
//   const [error, setError] = useState<string | null>(null);
//   const [activeMainTab, setActiveMainTab] = useState<MainTab>('shipment');
//   const [activeViewTab, setActiveViewTab] = useState<ViewTab>('compact');
//   const [activeFactory, setActiveFactory] = useState<string>('all');
//   const [cronInfo, setCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
//   const [shipmentCronInfo, setShipmentCronInfo] = useState<CronInfo>({ lastSync: null, totalRecords: 0 });
//   const [factories, setFactories] = useState<string[]>([]);
//   const [showNotification, setShowNotification] = useState<boolean>(false);
//   const [notificationMessage, setNotificationMessage] = useState<string>('');
//   const [shouldShake, setShouldShake] = useState<boolean>(false);
//   const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequest[]>([]);
//   const [futureRequestsCount, setFutureRequestsCount] = useState<number>(0);
//   const [newShipmentsCount, setNewShipmentsCount] = useState<number>(0);



//   // Функция загрузки количества новых отгрузок (за сегодня)

// //   const loadNewShipmentsCount = async () => {
// //   try {
// //     // Получаем заявки
// //     const requestsResponse = await fetch('/api/outgoing-requests');
// //     const allRequests = await requestsResponse.json();
    
// //     // Получаем отгрузки за сегодня
// //     const shipmentsResponse = await fetch('/api/shipments');
// //     const allShipments = await shipmentsResponse.json();
    
// //     const today = new Date();
// //     today.setHours(0, 0, 0, 0);
    
// //     // Группируем отгрузки по заявкам
// //     const shipmentsByRequest = new Map();
// //     for (const shipment of allShipments) {
// //       const shipmentDate = new Date(shipment.date);
// //       shipmentDate.setHours(0, 0, 0, 0);
// //       if (shipmentDate.getTime() !== today.getTime()) continue;
      
// //       const requestNumber = shipment.clientRequestNumber;
// //       if (requestNumber) {
// //         if (!shipmentsByRequest.has(requestNumber)) {
// //           shipmentsByRequest.set(requestNumber, { fact: 0, count: 0 });
// //         }
// //         const stats = shipmentsByRequest.get(requestNumber);
// //         stats.fact += shipment.quantity;
// //         stats.count += 1;
// //       }
// //     }
    
// //     // Считаем активные заявки (не закрытые и с фактом > 0)
// //     let activeCount = 0;
// //     for (const request of allRequests) {
// //       if (request.closed) continue;
// //       const stats = shipmentsByRequest.get(request.number);
// //       if (stats && stats.fact > 0) {
// //         activeCount++;
// //       }
// //     }
    
// //     setNewShipmentsCount(activeCount);
// //   } catch (err) {
// //     console.error(err);
// //   }
// // };

// const loadNewShipmentsCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     const allRequests = await requestsResponse.json();
//     const allShipments = await shipmentsResponse.json();
    
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     // Группируем отгрузки по заявкам
//     const shipmentsByRequest = new Map();
//     for (const shipment of allShipments) {
//       const shipmentDate = new Date(shipment.date);
//       shipmentDate.setHours(0, 0, 0, 0);
//       if (shipmentDate.getTime() !== today.getTime()) continue;
      
//       const requestNumber = shipment.clientRequestNumber;
//       if (requestNumber) {
//         const current = shipmentsByRequest.get(requestNumber) || { fact: 0 };
//         current.fact += shipment.quantity;
//         shipmentsByRequest.set(requestNumber, current);
//       }
//     }
    
//     // Создаём карту плановых количеств
// const planMap = new Map();
// for (const req of allRequests) {
//   planMap.set(req.number, req.quantity);
// }

// // Считаем активные заявки (не закрытые, факт > 0, процент < 90%)
// let activeCount = 0;
// for (const [requestNumber, data] of shipmentsByRequest) {
//   const request = allRequests.find((r: ApiOutgoingRequest) => r.number === requestNumber);
//   if (request && !request.closed) {
//     const plan = planMap.get(requestNumber) || 0;
//     const percent = plan > 0 ? (data.fact / plan) * 100 : 0;
//     if (percent > 0 && percent < 90) {
//       activeCount++;
//     }
//   }
// }
    
//     setNewShipmentsCount(activeCount);
//   } catch (err) {
//     console.error(err);
//   }
// };


//   const loadFutureRequestsCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     const allRequests = await requestsResponse.json();
//     const allShipments = await shipmentsResponse.json();
    
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     // Получаем номера заявок, у которых есть отгрузки сегодня
//     const activeTodayRequests = new Set();
//     for (const shipment of allShipments) {
//       const shipmentDate = new Date(shipment.date);
//       shipmentDate.setHours(0, 0, 0, 0);
//       if (shipmentDate.getTime() === today.getTime() && shipment.clientRequestNumber) {
//         activeTodayRequests.add(shipment.clientRequestNumber);
//       }
//     }
    
//     // Фильтруем будущие заявки: не закрытые, с датой >= сегодня, и НЕ имеющие отгрузок сегодня
// const future = allRequests.filter((req: ApiOutgoingRequest) => {
//   if (req.closed) return false;
//   if (!req.delivery_date) return false;
//   const deliveryDate = new Date(req.delivery_date);
//   deliveryDate.setHours(0, 0, 0, 0);
//   return deliveryDate >= today && !activeTodayRequests.has(req.number);
// });
    
//     setFutureRequestsCount(future.length);
//   } catch (err) {
//     console.error(err);
//   }
// };

  
//   const loadOutgoingRequests = async () => {
//     try {
//       const response = await fetch('/api/outgoing-requests');
//       const data = await response.json();
//       if (Array.isArray(data)) {
//         setOutgoingRequests(data);
//       }
//     } catch (err) {
//       console.error('Error loading outgoing requests:', err);
//     }
//   };

//   const formatDate = (dateString?: string): string => {
//     if (!dateString) return 'Нет даты';
//     const date = parseDate(dateString);
//     if (isNaN(date.getTime())) return 'Нет даты';
    
//     const today = new Date();
//     const yesterday = new Date(today);
//     yesterday.setDate(yesterday.getDate() - 1);
    
//     const todayStr = today.toLocaleDateString('ru-RU');
//     const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
//     const dateStr = date.toLocaleDateString('ru-RU');
//     const timeStr = date.toLocaleTimeString('ru-RU', {
//       hour: '2-digit',
//       minute: '2-digit'
//     });
    
//     if (dateStr === todayStr) return timeStr;
//     if (dateStr === yesterdayStr) return `ВЧЕРА в ${timeStr}`;
//     return `${dateStr} в ${timeStr}`;
//   };

//   const isToday = (dateStr: string): boolean => {
//     if (!dateStr) return false;
//     const date = parseDate(dateStr);
//     if (isNaN(date.getTime())) return false;
    
//     const today = new Date();
//     return date.getDate() === today.getDate() &&
//       date.getMonth() === today.getMonth() &&
//       date.getFullYear() === today.getFullYear();
//   };

//   const formatWeight = (weight?: number | null): string => {
//     if (weight === undefined || weight === null) return '—';
//     if (isNaN(weight)) return '—';
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

//   const getFactoryBadge = (item: UnifiedDataItem): string => {
//     if ('supplier' in item) {
//       const incoming = item as IncomingItem;
//       if (incoming.number?.startsWith('ЛХ')) return 'ЛХ';
//       if (incoming.number?.startsWith('ЛЮ')) return 'ЛЮ';
//     } else if ('division' in item) {
//       const shipment = item as ShipmentItem;
//       if (shipment.division === 'Луховицы') return 'ЛХ';
//       if (shipment.division === 'Люберцы') return 'ЛЮ';
//     }
//     return 'Другой';
//   };

//   const getUniqueFactories = (records: UnifiedDataItem[]): string[] => {
//     const factoriesSet = new Set<string>();
//     records.forEach(record => {
//       if ('supplier' in record) {
//         const incoming = record as IncomingItem;
//         if (incoming.number?.startsWith('ЛХ')) factoriesSet.add('ЛХ');
//         if (incoming.number?.startsWith('ЛЮ')) factoriesSet.add('ЛЮ');
//       } else if ('division' in record) {
//         const shipment = record as ShipmentItem;
//         if (shipment.division === 'Луховицы') factoriesSet.add('ЛХ');
//         if (shipment.division === 'Люберцы') factoriesSet.add('ЛЮ');
//       }
//     });
//     return Array.from(factoriesSet);
//   };

//   const getRequestCompletion = useCallback((clientRequestNumber: string | null) => {
//     if (!clientRequestNumber) return null;
    
//     const request = outgoingRequests.find(r => r.number === clientRequestNumber);
//     if (!request) return null;
    
//     const relatedShipments = shipmentData.filter(s => s.clientRequestNumber === clientRequestNumber);
//     const factQuantity = relatedShipments.reduce((sum, s) => sum + s.quantity, 0);
//     const percent = request.quantity > 0 ? (factQuantity / request.quantity) * 100 : 0;
    
//     return {
//       plan: request.quantity,
//       fact: factQuantity,
//       percent: Math.round(percent),
//       requestNumber: request.number,
//     };
//   }, [outgoingRequests, shipmentData]);

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

//   // const loadShipmentData = async () => {
//   //   try {
//   //     const response = await fetch('/api/shipments');
//   //     const data = await response.json();
//   //     if (Array.isArray(data)) {
//   //       setShipmentData(data);
//   //       return data;
//   //     }
//   //     return [];
//   //   } catch (err) {
//   //     console.error('Error loading shipments:', err);
//   //     return [];
//   //   }
//   // };


// const loadShipmentData = async () => {
//   try {
//     const response = await fetch('/api/shipments');
//     const data: ShipmentItem[] = await response.json();

//     console.log('📦 Shipments loaded:', data.length);
//     console.log('📦 First shipment:', data[0]);

    
//     if (Array.isArray(data)) {
//       setShipmentData(data);
//       // Обновляем счётчик новых отгрузок
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
//       const todayShipments = data.filter((shipment: ShipmentItem) => {
//         if (!shipment.date) return false;
//         const shipmentDate = new Date(shipment.date);
//         shipmentDate.setHours(0, 0, 0, 0);
//         return shipmentDate.getTime() === today.getTime();
//       });
//       setNewShipmentsCount(todayShipments.length);
//       return data;
//     }
//     return [];
//   } catch (err) {
//     console.error('Error loading shipments:', err);
//     return [];
//   }
// };


//   // const loadFactoryRequests = async () => {
//   //   try {
//   //     const response = await fetch('/api/factory-requests');
//   //     const data = await response.json();
//   //     if (Array.isArray(data)) {
//   //       setFactoryRequests(data);
//   //     }
//   //   } catch (err) {
//   //     console.error('Error loading factory requests:', err);
//   //   }
//   // };

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












// //   const loadAllData = async () => {
// //     try {
// //       const [incoming, shipment] = await Promise.all([
// //         loadIncomingData(),
// //         loadShipmentData(),
// //         loadOutgoingRequests(),
// //       ]);
      
// //       await Promise.all([
// //         // loadFactoryRequests(),
// //         loadCronInfo(),
// //         loadShipmentCronInfo(),
// //       ]);
      
// //       const factorySet = new Set<string>();
      
// //       // (incoming as IncomingItem[]).forEach(item => {
// //       //   if (item.number?.startsWith('ЛХ')) factorySet.add('ЛХ');
// //       //   if (item.number?.startsWith('ЛЮ')) factorySet.add('ЛЮ');
// //       // });
      
// // (incoming as IncomingItem[]).forEach(item => {
// //   if (item.number?.startsWith('ЛХ')) factorySet.add('ЛХ');
// //   if (item.number?.startsWith('ЛЮ')) factorySet.add('ЛЮ');
// //   if (item.number?.startsWith('СП')) factorySet.add('СП');
// //   if (item.number?.startsWith('Щ')) factorySet.add('Щ');
// // });


// //       (shipment as ShipmentItem[]).forEach(item => {
// //         if (item.division === 'Луховицы') factorySet.add('ЛХ');
// //         if (item.division === 'Люберцы') factorySet.add('ЛЮ');
// //       });
      
// //       setFactories(Array.from(factorySet).sort());
// //     } catch (err) {
// //       console.error('Error loading all data:', err);
// //     }
// //   };


// const loadAllData = async () => {
//   try {
//     const [incoming, shipment] = await Promise.all([
//       loadIncomingData(),
//       loadShipmentData(),
//       loadOutgoingRequests(),
//     ]);
    
//     const factorySet = new Set<string>();
    
//     // Для поступлений - по номеру
//     (incoming as IncomingItem[]).forEach(item => {
//       if (item.number?.startsWith('ЛХ')) factorySet.add('ЛХ');
//       if (item.number?.startsWith('ЛЮ')) factorySet.add('ЛЮ');
//       if (item.number?.startsWith('СП')) factorySet.add('СП');
//       if (item.number?.startsWith('Щ')) factorySet.add('Щ');
//       // Также по division, если есть
//       if (item.division === 'ЛХ') factorySet.add('ЛХ');
//       if (item.division === 'ЛЮ') factorySet.add('ЛЮ');
//       if (item.division === 'СП') factorySet.add('СП');
//       if (item.division === 'Щ') factorySet.add('Щ');
//     });
    
//     // Для отгрузок - по division
//     (shipment as ShipmentItem[]).forEach(item => {
//       if (item.division === 'ЛХ') factorySet.add('ЛХ');
//       if (item.division === 'ЛЮ') factorySet.add('ЛЮ');
//       if (item.division === 'СП') factorySet.add('СП');
//       if (item.division === 'Щ') factorySet.add('Щ');
//     });
    
//     setFactories(Array.from(factorySet).sort());
//   } catch (err) {
//     console.error('Error loading all data:', err);
//   }
// };















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
//       } else if (activeMainTab === 'summary') {
//         await Promise.all([
//           fetch('/api/cron', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
//           fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
//         ]);
//         await loadAllData();
//         setNotificationMessage(`✅ Все данные обновлены`);
//       }
      
//       setShowNotification(true);
//       setTimeout(() => setShowNotification(false), 2000);
      
//       setShouldShake(true);
//       setTimeout(() => setShouldShake(false), 500);
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

//   // useEffect(() => {
//   //   if (!isAuthenticated) return;
    
//   //   let isMounted = true;
    
//   //   const fetchData = async () => {
//   //     try {
//   //       setLoading(true);
//   //       await loadAllData();
//   //       await loadFutureRequestsCount();
//   //       if (isMounted) {
//   //         setLoading(false);
//   //       }
//   //     } catch (err) {
//   //       if (isMounted) {
//   //         setError(err instanceof Error ? err.message : 'Ошибка');
//   //         setLoading(false);
//   //       }
//   //     }
//   //   };
    
//   //   fetchData();
    
//   //   return () => {
//   //     isMounted = false;
//   //   };
//   // }, [isAuthenticated]);

//   // useEffect(() => {
//   //   if (!isAuthenticated) return;
    
//   //   const interval = setInterval(() => {
//   //     console.log('🔄 Автообновление...');
//   //     if (activeMainTab === 'incoming') {
//   //       loadIncomingData();
//   //       loadCronInfo();
//   //     } else if (activeMainTab === 'shipment') {
//   //       loadShipmentData();
//   //       loadShipmentCronInfo();
//   //     } else if (activeMainTab === 'summary') {
//   //       loadAllData();
//   //       loadFutureRequestsCount();
//   //     }
//   //   }, 30000);
    
//   //   return () => clearInterval(interval);
//   // }, [isAuthenticated, activeMainTab]);

// //   useEffect(() => {
// //   if (!isAuthenticated) return;
  
// //   let isMounted = true;
  
// //   const fetchData = async () => {
// //     try {
// //       setLoading(true);
// //       await loadAllData();
// //       await loadFutureRequestsCount();
// //       await loadNewShipmentsCount();  // ← добавить
// //       if (isMounted) {
// //         setLoading(false);
// //       }
// //     } catch (err) {
// //       if (isMounted) {
// //         setError(err instanceof Error ? err.message : 'Ошибка');
// //         setLoading(false);
// //       }
// //     }
// //   };
  
// //   fetchData();
  
// //   return () => {
// //     isMounted = false;
// //   };
// // }, [isAuthenticated]);




// // Также обновляем при автообновлении
// // useEffect(() => {
// //   if (!isAuthenticated) return;
  
// //   const interval = setInterval(() => {
// //     console.log('🔄 Автообновление...');
// //     if (activeMainTab === 'incoming') {
// //       loadIncomingData();
// //       loadCronInfo();
// //     } else if (activeMainTab === 'shipment') {
// //       loadShipmentData();
// //       loadShipmentCronInfo();
// //       loadNewShipmentsCount();  // ← добавить
// //     } else if (activeMainTab === 'summary') {
// //       loadAllData();
// //       loadFutureRequestsCount();
// //       loadNewShipmentsCount();  // ← добавить
// //     }
// //   }, 30000);
  
// //   return () => clearInterval(interval);
// // }, [isAuthenticated, activeMainTab]);

// useEffect(() => {
//   // if (!isAuthenticated) return;
  
//   const interval = setInterval(() => {
//     console.log('🔄 Автообновление...');
//     if (activeMainTab === 'incoming') {
//       loadIncomingData();
//       loadCronInfo();
//     } else if (activeMainTab === 'shipment') {
//       loadShipmentData();
//       loadShipmentCronInfo();
//       loadNewShipmentsCount();
//     } else if (activeMainTab === 'summary') {
//       loadAllData();
//       loadFutureRequestsCount();  // ← обновляем счётчик
//       loadNewShipmentsCount();
//     }
//   }, 30000);
  
//   return () => clearInterval(interval);
// }, [activeMainTab]);


//   const getCurrentData = (): UnifiedDataItem[] => {
//     if (activeMainTab === 'incoming') {
//       return incomingData;
//     }
//     return shipmentData;
//   };

//   // const getFilteredData = (): UnifiedDataItem[] => {
//   //   const data = getCurrentData();
//   //   if (activeFactory === 'all') return data;
    
//   //   return data.filter(item => {
//   //     const factory = detectFactory(item, activeMainTab as 'incoming' | 'shipment');
//   //     return factory === activeFactory;
//   //   });
//   // };




//   const getFilteredData = (): UnifiedDataItem[] => {
//   const data = getCurrentData();
//   console.log('Active factory filter:', activeFactory);
  
//   if (activeFactory === 'all') return data;
  
//   const filtered = data.filter(item => {
//     const factory = detectFactory(item, activeMainTab as 'incoming' | 'shipment');
//     console.log('Item factory:', factory, 'Filter:', activeFactory, 'Match:', factory === activeFactory);
//     return factory === activeFactory;
//   });
  
//   console.log('Filtered count:', filtered.length);
//   return filtered;
// };





//   const groupDataByDay = (data: UnifiedDataItem[]) => {
//     const groupedMap = new Map<string, Map<string, GroupedRecord>>();
    
//     data.forEach((record) => {
//       const date = parseDate(record.date);
//       const dateOnly = date.toLocaleDateString('ru-RU');
      
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

//   const filteredData = getFilteredData();
//   const groupedData = groupDataByDay(filteredData);
//   const sortedDates = Array.from(groupedData.keys()).sort((a, b) => {
//     const dateA = parseDateForSort(a);
//     const dateB = parseDateForSort(b);
//     return dateB.getTime() - dateA.getTime();
//   });

//   const outgoingRequestsForCompact = outgoingRequests.map(req => ({
//     number: req.number,
//     date: req.date,
//     division: req.division,
//     quantity: req.quantity,
//     consignee: req.consignee || '',
//     material: req.material,
//     closed: req.closed,
//   }));

//   const sendPlan = async () => {
//     setRefreshing(true);
//     try {
//       const response = await fetch('/api/send-plan', {
//         headers: { 'Authorization': 'Bearer icg72xf3b1' }
//       });
//       const data = await response.json();
//       setNotificationMessage(`✅ План отправлен! ${data.planCount} заказов`);
//       setShowNotification(true);
//       setTimeout(() => setShowNotification(false), 3000);
//     } catch (err) {
//       setNotificationMessage('⚠️ Ошибка отправки');
//       setShowNotification(true);
//       setTimeout(() => setShowNotification(false), 3000);
//     } finally {
//       setRefreshing(false);
//     }
//   };

//   const currentSyncInfo = activeMainTab === 'incoming' ? cronInfo : shipmentCronInfo;

//   // if (!isAuthenticated) {
//   //   return <PinModal onSuccess={() => setIsAuthenticated(true)} />;
//   // }











//   // Загрузка данных при монтировании компонента
//   useEffect(() => {
//     let isMounted = true;
    
//     const fetchData = async () => {
//       try {
//         setLoading(true);
//         await loadAllData();
//         await loadFutureRequestsCount();
//         await loadNewShipmentsCount();
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
//   }, []);

//   // Автообновление раз в 30 секунд
//   useEffect(() => {
//     const interval = setInterval(() => {
//       console.log('🔄 Автообновление...');
//       if (activeMainTab === 'incoming') {
//         loadIncomingData();
//         loadCronInfo();
//       } else if (activeMainTab === 'shipment') {
//         loadShipmentData();
//         loadShipmentCronInfo();
//         loadNewShipmentsCount();
//       } else if (activeMainTab === 'summary') {
//         loadAllData();
//         loadFutureRequestsCount();
//         loadNewShipmentsCount();
//       }
//     }, 30000);
    
//     return () => clearInterval(interval);
//   }, [activeMainTab]);













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





























//   return (
//     <>
//       <Notification message={notificationMessage} show={showNotification} />

//       <div className="container">
//         <header className="header">
//           <Header 
//             refreshing={refreshing} 
//             onRefresh={handleRefresh}
//             onSendPlan={sendPlan}
//           />
          
//           {/* <MainTabs 
//             activeTab={activeMainTab} 
//             onTabChange={setActiveMainTab}
//             futureRequestsCount={futureRequestsCount}
//           />
//            */}


//            <MainTabs 
//   activeTab={activeMainTab} 
//   onTabChange={setActiveMainTab}
//   futureRequestsCount={futureRequestsCount}
//   newShipmentsCount={newShipmentsCount}
// />



//           <div className="sync-info">
//             <span className="sync-label">🔄 Синхронизация с 1С:</span>
//             <span className="sync-time">{formatSyncTime(currentSyncInfo.lastSync)}</span>
//           </div>

//           {activeMainTab !== 'summary' && (
//             <>
//               <FactoryFilter 
//                 factories={factories} 
//                 activeFactory={activeFactory} 
//                 onFactoryChange={setActiveFactory} 
//               />
              
//               <ViewTabs activeTab={activeViewTab} onTabChange={setActiveViewTab} />
              
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

//           {activeMainTab !== 'summary' && activeViewTab === 'list' && (
//             <ListView 
//               data={filteredData}
//               mainTab={activeMainTab}
//             />
//           )}

//           {activeMainTab !== 'summary' && activeViewTab === 'compact' && (
//             <CompactView 
//               data={filteredData}
//               mainTab={activeMainTab}
//               outgoingRequests={outgoingRequestsForCompact}
//               allShipments={shipmentData}  // ← добавить
//               allShipmentsForChart={shipmentData}  // ← добавить
//               selectedFactory={activeFactory}  // ← добавить
//             />
//           )}

//           {activeMainTab !== 'summary' && activeViewTab === 'charts' && (
//             <ChartsView data={shipmentData} />
//           )}

//           {activeMainTab !== 'summary' && activeViewTab === 'topCustomers' && (
//             <TopCustomersView data={shipmentData} />
//           )}
//         </motion.div>
//       </div>
//     </>
//   );
// }






