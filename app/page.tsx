// app/page.tsx

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
import TruckMap from './components/TruckMap';
import Header from './components/header';
import ChartsView from './components/ChartsView';
import TopCustomersView from './components/TopCustomersView';
import ModeSwitch from './components/ModeSwitch';
import LoadingSpinner from './components/LoadingSpinner';
import { countActiveRequests, getFactoryName, isConcreteMaterial, isSpecialMaterial, parseRussianDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, RefreshCw, ArrowDown } from 'lucide-react';

// ============================================
// ИНТЕРФЕЙСЫ
// ============================================

interface RequestItem {
  number: string;
  division: string;
  closed: boolean | null;
  delivery_date: string | null;
  date: string;
  clientRequestNumber: string | null;
}

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
  destinationPoint: string | null;
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
  clientRequestNumber: string | null;
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
  destinationPoint: string | null;
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

type MainTab = 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary';
type ViewTab = 'compact' | 'grouped' | 'list' | 'charts' | 'topCustomers' | 'gps';
type UnifiedDataItem = IncomingItem | ShipmentItem;

// Форма данных, которую отдаёт /api/trucks — те же интерфейсы, что и в
// app/trucks/page.tsx (структурно совместимы с Truck/Route внутри
// TruckMap.tsx, там они не экспортированы).
interface GpsTruck {
  uid: string;
  name: string;
  position: { lat: number; lng: number; vel: number; time: number } | null;
  lastUpdate: string | null;
}

interface GpsRoute {
  destination: string;
  factory: string;
  count: number;
  requestNumber: string;
  totalQuantity: number;
  licensePlates: string[];
  destCoords: { lat: number; lng: number; name: string } | null;
  factoryCoords: { lat: number; lng: number; name: string } | null;
}

// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ
// ============================================

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

  // Данные для вкладки GPS (ViewTabs) — та же /api/trucks, что и на
  // отдельной странице /trucks. Раньше GPS был доступен только отдельной
  // кнопкой-спутником в шапке, ведущей на /trucks; теперь — вкладка внутри
  // текущего экрана (как в /demo), кнопка в шапке убрана как дублирующая.
  const [gpsTrucks, setGpsTrucks] = useState<GpsTruck[]>([]);
  const [gpsRoutes, setGpsRoutes] = useState<GpsRoute[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const { accessibleFactories } = useAuth();

  // ============================================
  // PULL-TO-REFRESH
  // ============================================
  
  const [pullStartY, setPullStartY] = useState(0);
  const [pullOffset, setPullOffset] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - pullStartY;
    if (diff > 0 && diff < 100) {
      setPullOffset(diff);
      e.preventDefault();
    }
  };
  
  const handleTouchEnd = () => {
    if (isPulling && pullOffset > 60) {
      handleRefresh();
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }
    setPullOffset(0);
    setIsPulling(false);
  };

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

  const availableFactories = mode === 'tas' 
    ? factories.filter(f => f === 'ЛХ' || f === 'ЛЮ')
    : factories.filter(f => f === 'СП' || f === 'Щ');

  const toggleMode = () => {
    const newMode = mode === 'tas' ? 'iceberg' : 'tas';
    setNewShipmentsCount(0);
    setNewConcreteCount(0);
    setFutureRequestsCount(0);
    setContentKey(prev => prev + 1);
    setMode(newMode);
    setActiveFactory('all');
    setTimeout(() => {
      loadFutureRequestsCount();
      loadNewShipmentsCount();
      loadNewConcreteCount();
    }, 50);
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
    localStorage.setItem('appMode', newMode);
  };

  // ✅ Те же плавные fade+slide переходы контента (motion.div key={contentKey}
  // ниже), что и при смене ТАС/Айсберг — теперь и на смену вкладки, фильтра
  // завода и вида (список/компактно). Анимируется один контейнер целиком,
  // а не каждая строка по отдельности — лёгкая нагрузка на телефон.
  const handleMainTabChange = (tab: MainTab) => {
    setActiveMainTab(tab);
    // "Графики"/"Топ-10" скрыты для "Поступления" — если была активна
    // одна из них, возвращаемся на "Компактно" (см. hideAnalytics в ViewTabs).
    if (tab === 'incoming' && (activeViewTab === 'charts' || activeViewTab === 'topCustomers' || activeViewTab === 'gps')) {
      setActiveViewTab('compact');
    }
    setContentKey(prev => prev + 1);
  };

  const handleFactoryChange = (factory: string) => {
    setActiveFactory(factory);
    setContentKey(prev => prev + 1);
  };

  const handleViewTabChange = (tab: ViewTab) => {
    setActiveViewTab(tab);
    setContentKey(prev => prev + 1);
  };

  useEffect(() => {
    if (mode === 'iceberg') {
      document.body.classList.add('iceberg-mode');
    } else {
      document.body.classList.remove('iceberg-mode');
    }
  }, [mode]);

  // ============================================
  // GPS — данные для вкладки (грузим только пока она открыта, опрос раз
  // в 2 минуты — как раньше было на отдельной странице /trucks).
  // ============================================

  useEffect(() => {
    if (activeViewTab !== 'gps') return;

    let cancelled = false;

    const loadGpsData = async () => {
      setGpsLoading(true);
      try {
        const response = await fetch('/api/trucks');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        if (data?.success === false) throw new Error(data.error || 'Unknown error');
        setGpsTrucks(Array.isArray(data.trucks) ? data.trucks : []);
        setGpsRoutes(Array.isArray(data.routes) ? data.routes : []);
        setGpsError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching GPS trucks:', err);
        setGpsError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setGpsLoading(false);
      }
    };

    loadGpsData();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadGpsData();
    }, 120000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeViewTab]);

  // ============================================
  // ЗАГРУЗКА ДАННЫХ
  // ============================================

  // const loadNewShipmentsCount = async () => {
  //   try {
  //     const [requestsResponse, shipmentsResponse] = await Promise.all([
  //       fetch('/api/outgoing-requests'),
  //       fetch('/api/shipments')
  //     ]);
  //     const allRequests = await requestsResponse.json();
  //     const allShipments = await shipmentsResponse.json();
  //     const activeCount = countActiveRequests(allRequests, allShipments, mode, 'asphalt');
  //     setNewShipmentsCount(activeCount);
  //   } catch (err) {
  //     console.error(err);
  //   }
  // };

  // const loadNewConcreteCount = async () => {
  //   try {
  //     const [requestsResponse, shipmentsResponse] = await Promise.all([
  //       fetch('/api/outgoing-requests'),
  //       fetch('/api/shipments')
  //     ]);
  //     const allRequests = await requestsResponse.json();
  //     const allShipments = await shipmentsResponse.json();
  //     const currentMode = mode;
  //     const activeCount = countActiveRequests(allRequests, allShipments, currentMode, 'concrete');
  //     if (mode === currentMode) {
  //       setNewConcreteCount(activeCount);
  //     }
  //   } catch (err) {
  //     console.error('Error loading concrete count:', err);
  //   }
  // };

  // const loadFutureRequestsCount = async () => {
  //   try {
  //     const [requestsResponse, shipmentsResponse] = await Promise.all([
  //       fetch('/api/outgoing-requests'),
  //       fetch('/api/shipments')
  //     ]);
  //     let allRequests = await requestsResponse.json();
  //     let allShipments = await shipmentsResponse.json();
  //     if (!Array.isArray(allRequests)) {
  //       console.error('allRequests is not an array:', allRequests);
  //       setFutureRequestsCount(0);
  //       return;
  //     }
  //     if (!Array.isArray(allShipments)) {
  //       console.error('allShipments is not an array:', allShipments);
  //       setFutureRequestsCount(0);
  //       return;
  //     }
  //     const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
  //     allRequests = allRequests.filter((r) => validFactories.includes(r.division));
  //     allShipments = allShipments.filter((s) => validFactories.includes(s.division));
  //     if (mode === 'iceberg') {
  //       setFutureRequestsCount(0);
  //       return;
  //     }
  //     const today = new Date();
  //     today.setHours(0, 0, 0, 0);
  //     const activeTodayRequests = new Set();
  //     for (const shipment of allShipments) {
  //       const shipmentDate = parseRussianDate(shipment.date);
  //       shipmentDate.setHours(0, 0, 0, 0);
  //       if (shipmentDate.getTime() === today.getTime() && shipment.clientRequestNumber) {
  //         activeTodayRequests.add(shipment.clientRequestNumber);
  //       }
  //     }
  //     const future = allRequests.filter((req: RequestItem) => {
  //       if (req.closed) return false;
  //       if (!req.delivery_date) return false;
  //       const deliveryDate = parseRussianDate(req.delivery_date);
  //       deliveryDate.setHours(0, 0, 0, 0);
  //       return deliveryDate >= today && !activeTodayRequests.has(req.number);
  //     });
  //     setFutureRequestsCount(future.length);
  //   } catch (err) {
  //     console.error('Error in loadFutureRequestsCount:', err);
  //     setFutureRequestsCount(0);
  //   }
  // };









// ✅ ДОБАВИТЬ ПОСЛЕ loadAllData

// Пересчёт активных заявок из уже загруженных данных (без fetch)
const loadNewShipmentsCount = useCallback(() => {
  const activeCount = countActiveRequests(
    outgoingRequests,
    shipmentData,
    mode,
    'asphalt'
  );
  setNewShipmentsCount(activeCount);
}, [outgoingRequests, shipmentData, mode]);

// Пересчёт бетона из уже загруженных данных (без fetch)
const loadNewConcreteCount = useCallback(() => {
  const activeCount = countActiveRequests(
    outgoingRequests,
    shipmentData,
    mode,
    'concrete'
  );
  setNewConcreteCount(activeCount);
}, [outgoingRequests, shipmentData, mode]);

// Пересчёт будущих заявок из уже загруженных данных (без fetch)
const loadFutureRequestsCount = useCallback(() => {
  if (mode === 'iceberg') {
    setFutureRequestsCount(0);
    return;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const validFactories = ['ЛХ', 'ЛЮ'];
  const filteredRequests = outgoingRequests.filter(r => 
    validFactories.includes(r.division) && !r.closed
  );
  
  const activeTodayRequests = new Set();
  for (const shipment of shipmentData) {
    const shipmentDate = parseRussianDate(shipment.date);
    shipmentDate.setHours(0, 0, 0, 0);
    if (shipmentDate.getTime() === today.getTime() && shipment.clientRequestNumber) {
      activeTodayRequests.add(shipment.clientRequestNumber);
    }
  }
  
  const future = filteredRequests.filter(req => {
    if (!req.delivery_date) return false;
    const deliveryDate = parseRussianDate(req.delivery_date);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate >= today && !activeTodayRequests.has(req.number);
  });
  
  setFutureRequestsCount(future.length);
}, [outgoingRequests, shipmentData, mode]);

















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

  const loadLastImportInfo = async () => {
    try {
      const response = await fetch('/api/last-import-info');
      const data = await response.json();
      setLastImportInfo(data);
    } catch (err) {
      console.error('Failed to load import info:', err);
    }
  };






  // // ⭐ ГЛАВНАЯ ФУНКЦИЯ ЗАГРУЗКИ — используем /api/all-data
  // const loadAllData = async () => {
  //   try {
  //     const response = await fetch('/api/all-data');
  //     const data = await response.json();
      
  //     if (data.shipments) {
  //       console.log(`📦 Загружено ${data.shipments.length} отгрузок`);
  //       setShipmentData(data.shipments);
  //     }
  //     if (data.outgoingRequests) {
  //       console.log(`📋 Загружено ${data.outgoingRequests.length} заявок`);
  //       setOutgoingRequests(data.outgoingRequests);
  //     }
  //     if (data.incoming) {
  //       console.log(`📥 Загружено ${data.incoming.length} поступлений`);
  //       setIncomingData(data.incoming);
  //     }
      
  //     // Обновляем список заводов
  //     const factorySet = new Set<string>();
  //     (data.shipments || []).forEach((item: ShipmentItem) => {
  //       if (item.division) factorySet.add(item.division);
  //     });
  //     (data.incoming || []).forEach((item: IncomingItem) => {
  //       if (item.division) factorySet.add(item.division);
  //       if (item.number?.startsWith('ЛХ')) factorySet.add('ЛХ');
  //       if (item.number?.startsWith('ЛЮ')) factorySet.add('ЛЮ');
  //       if (item.number?.startsWith('СП')) factorySet.add('СП');
  //       if (item.number?.startsWith('Щ')) factorySet.add('Щ');
  //     });
  //     setFactories(Array.from(factorySet).sort());
  //   } catch (error) {
  //     console.error('Error loading all data:', error);
  //   }
  // };


// const loadAllData = async () => {
//   try {
//     const response = await fetch('/api/all-data');
//     const data = await response.json();
    
//     if (data.shipments) {
//       console.log(`📦 Загружено ${data.shipments.length} отгрузок`);
//       setShipmentData(data.shipments);
//     }
//     if (data.outgoingRequests) {
//       console.log(`📋 Загружено ${data.outgoingRequests.length} заявок`);
//       setOutgoingRequests(data.outgoingRequests);
//     }
//     if (data.incoming) {
//       console.log(`📥 Загружено ${data.incoming.length} поступлений`);
//       setIncomingData(data.incoming);
//     }
    
//     // ✅ ОБНОВЛЯЕМ ВРЕМЯ СИНХРОНИЗАЦИИ
//     await Promise.all([
//       loadCronInfo(),
//       loadShipmentCronInfo(),
//       loadLastImportInfo()
//     ]);
    
//   } catch (error) {
//     console.error('Error loading all data:', error);
//   }
// };

const loadAllData = async () => {
  try {
    const response = await fetch('/api/all-data');
    const data = await response.json();
    
    if (data.shipments) {
      console.log(`📦 Загружено ${data.shipments.length} отгрузок`);
      setShipmentData(data.shipments);
    }
    if (data.outgoingRequests) {
      console.log(`📋 Загружено ${data.outgoingRequests.length} заявок`);
      setOutgoingRequests(data.outgoingRequests);
    }
    if (data.incoming) {
      console.log(`📥 Загружено ${data.incoming.length} поступлений`);
      setIncomingData(data.incoming);
    }
    
    // ✅ Обновляем список заводов из всех данных
    const factorySet = new Set<string>();
    
    // Из отгрузок
    (data.shipments || []).forEach((item: ShipmentItem) => {
      if (item.division) factorySet.add(item.division);
    });
    
    // Из заявок
    (data.outgoingRequests || []).forEach((item: OutgoingRequest) => {
      if (item.division) factorySet.add(item.division);
    });
    
    // Из поступлений
    (data.incoming || []).forEach((item: IncomingItem) => {
      if (item.division) factorySet.add(item.division);
      if (item.number?.startsWith('ЛХ')) factorySet.add('ЛХ');
      if (item.number?.startsWith('ЛЮ')) factorySet.add('ЛЮ');
      if (item.number?.startsWith('СП')) factorySet.add('СП');
      if (item.number?.startsWith('Щ')) factorySet.add('Щ');
    });
    
    setFactories(Array.from(factorySet).sort());
    console.log('🏭 Заводы:', Array.from(factorySet).sort());
    
    // Пересчёт счётчиков
    loadNewShipmentsCount();
    loadNewConcreteCount();
    loadFutureRequestsCount();
    
  } catch (error) {
    console.error('Error loading all data:', error);
  }
};








  // ============================================
  // ОБНОВЛЕНИЕ ДАННЫХ
  // ============================================




  // const handleRefresh = async () => {
  //   if (refreshing) return;
  //   setRefreshing(true);
  //   try {
  //     if (activeMainTab === 'incoming') {
  //       await fetch('/api/cron', { headers: { 'Authorization': 'Bearer icg72xf3b1' } });
  //       await loadAllData();
  //       await loadCronInfo();
  //       setNotificationMessage('✅ Поступления обновлены');
  //     } else if (activeMainTab === 'shipment') {
  //       await fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } });
  //       await loadAllData();
  //       await loadShipmentCronInfo();
  //       await loadNewShipmentsCount();
  //       setNotificationMessage('✅ Отгрузки асфальта обновлены');
  //     } else if (activeMainTab === 'shipmentConcrete') {
  //       await fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } });
  //       await loadAllData();
  //       await loadShipmentCronInfo();
  //       await loadNewConcreteCount();
  //       setNotificationMessage('✅ Отгрузки бетона обновлены');
  //     } else if (activeMainTab === 'summary') {
  //       await Promise.all([
  //         fetch('/api/cron', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
  //         fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
  //       ]);
  //       await loadAllData();
  //       await loadFutureRequestsCount();
  //       await loadNewShipmentsCount();
  //       await loadNewConcreteCount();
  //       setNotificationMessage('✅ Все данные обновлены');
  //     }
  //     setShowNotification(true);
  //     setTimeout(() => setShowNotification(false), 2000);
  //     setShouldShake(true);
  //     setTimeout(() => setShouldShake(false), 500);
  //   } catch (err) {
  //     console.error('Ошибка при обновлении:', err);
  //     setNotificationMessage('⚠️ Ошибка обновления');
  //     setShowNotification(true);
  //     setTimeout(() => setShowNotification(false), 2000);
  //   } finally {
  //     setRefreshing(false);
  //   }
  // };


const handleRefresh = async () => {
  if (refreshing) return;
  setRefreshing(true);
  try {
    if (activeMainTab === 'incoming') {
      await fetch('/api/cron', { headers: { 'Authorization': 'Bearer icg72xf3b1' } });
      await loadAllData();
      await loadCronInfo();
      setNotificationMessage('Поступления обновлены');
    } else if (activeMainTab === 'shipment') {
      await fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } });
      await loadAllData();
      await loadShipmentCronInfo();
      loadNewShipmentsCount(); // ✅ БЕЗ await
      setNotificationMessage('Отгрузки асфальта обновлены');
    } else if (activeMainTab === 'shipmentConcrete') {
      await fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } });
      await loadAllData();
      await loadShipmentCronInfo();
      loadNewConcreteCount(); // ✅ БЕЗ await
      setNotificationMessage('Отгрузки бетона обновлены');
    } else if (activeMainTab === 'summary') {
      await Promise.all([
        fetch('/api/cron', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
        fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
      ]);
      await loadAllData();
      loadFutureRequestsCount(); // ✅ БЕЗ await
      loadNewShipmentsCount(); // ✅ БЕЗ await
      loadNewConcreteCount(); // ✅ БЕЗ await
      setNotificationMessage('Все данные обновлены');
    }
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 2000);
    setShouldShake(true);
    setTimeout(() => setShouldShake(false), 500);
  } catch (err) {
    console.error('Ошибка при обновлении:', err);
    setNotificationMessage('Ошибка обновления');
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
    if (activeFactory !== 'all') {
      filtered = filtered.filter(item => {
        const factory = detectFactory(item, 'shipment');
        return factory === activeFactory;
      });
    }
    if (type === 'asphalt') {
      filtered = filtered.filter(item => !isConcrete(item.material));
    } else if (type === 'concrete') {
      filtered = filtered.filter(item => isConcrete(item.material));
    }
    return filtered;
  };

  const getCurrentData = (): UnifiedDataItem[] => {
    if (activeMainTab === 'incoming') {
      let filtered = incomingData;
      if (activeFactory !== 'all') {
        filtered = filtered.filter(item => {
          const factory = detectFactory(item, 'incoming');
          return factory === activeFactory;
        });
      } else {
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
    
    if (activeMainTab === 'shipment') {
      let filtered = shipmentData.filter(item => {
        const isConcrete = isConcreteMaterial(item.material);
        const isSpecial = isSpecialMaterial(item.material);
        return !isConcrete && !isSpecial;
      });
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
      setNotificationMessage(`План отправлен! ${data.planCount} заказов`);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    } catch (err) {
      setNotificationMessage('Ошибка отправки');
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

  // ✅ ОСНОВНОЙ useEffect для загрузки данных
  // useEffect(() => {
  //   let isMounted = true;
  //   const fetchData = async () => {
  //     try {
  //       setLoading(true);
  //       await loadAllData();
  //       await loadFutureRequestsCount();
  //       await loadNewShipmentsCount();
  //       await loadNewConcreteCount();
  //       await loadLastImportInfo();
  //       if (isMounted) {
  //         setLoading(false);
  //       }
  //     } catch (err) {
  //       if (isMounted) {
  //         setError(err instanceof Error ? err.message : 'Ошибка');
  //         setLoading(false);
  //       }
  //     }
  //   };
  //   fetchData();
  //   return () => {
  //     isMounted = false;
  //   };
  // }, []);


// ✅ ОСНОВНОЙ useEffect для загрузки данных
useEffect(() => {
  let isMounted = true;
  const fetchData = async () => {
    try {
      setLoading(true);
      await loadAllData();
      // ✅ Пересчёт счётчиков из загруженных данных
      loadFutureRequestsCount();
      loadNewShipmentsCount();
      loadNewConcreteCount();
      await loadLastImportInfo();
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













  // ✅ Автообновление каждые 60 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Автообновление...');
      loadAllData();
      if (activeMainTab === 'incoming') {
        loadCronInfo();
      } else if (activeMainTab === 'shipment' || activeMainTab === 'shipmentConcrete') {
        loadShipmentCronInfo();
      }
      if (activeMainTab === 'shipment') {
        loadNewShipmentsCount();
      } else if (activeMainTab === 'shipmentConcrete' && mode === 'iceberg') {
        loadNewConcreteCount();
      } else if (activeMainTab === 'summary') {
        loadFutureRequestsCount();
        loadNewShipmentsCount();
        if (mode === 'iceberg') {
          loadNewConcreteCount();
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [activeMainTab, mode]);

  // При смене режима пересчитываем счётчики
  useEffect(() => {
    loadFutureRequestsCount();
    loadNewShipmentsCount();
    loadNewConcreteCount();
  }, [mode]);

  // Пересчитываем счётчик "на будущее" (только для ТАС) сразу,
  // как только реально обновились заявки или отгрузки —
  // раньше счётчик на кнопке считался один раз при монтировании,
  // до того как данные успевали загрузиться, и потом не обновлялся,
  // из-за чего цифра на кнопке расходилась с фактическим списком.
  useEffect(() => {
    if (mode === 'tas') {
      loadFutureRequestsCount();
    }
  }, [outgoingRequests, shipmentData, mode]);

  // ============================================
  // РЕНДЕР
  // ============================================

  if (loading) {
    return <LoadingSpinner message="Загрузка данных..." size="large" fullScreen />;
  }

  if (error) {
    return (
      <div className="error">
        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <AlertTriangle size={16} strokeWidth={2.2} />Ошибка: {error}
        </p>
        <button onClick={handleRetry}>Попробовать снова</button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="app-container"
    >
      <div 
        className="pull-to-refresh-indicator"
        style={{ 
          transform: `translateY(${Math.min(pullOffset, 80)}px)`,
          opacity: Math.min(pullOffset / 60, 1)
        }}
      >
        {pullOffset > 60 ? (
          <><RefreshCw size={13} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />Отпустите для обновления</>
        ) : (
          <><ArrowDown size={13} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />Тяните вниз для обновления</>
        )}
      </div>
      
      <Notification message={notificationMessage} show={showNotification} />

      <div className="container">
        <header className="header">
          <Header 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
          />
          
          <ModeSwitch 
            mode={mode} 
            onToggle={toggleMode}
            tasSyncTime={currentSyncInfo.lastSync}
            icebergSyncTime={lastImportInfo.lastImport}
            accessibleFactories={accessibleFactories}
          />

          <MainTabs
            activeTab={activeMainTab}
            onTabChange={handleMainTabChange}
            futureRequestsCount={futureRequestsCount}
            newShipmentsCount={newShipmentsCount}
            newConcreteCount={newConcreteCount}
            showConcreteTab={mode === 'iceberg'}
          />

          {activeMainTab !== 'summary' && (
            <>
              <FactoryFilter
                factories={availableFactories}
                activeFactory={activeFactory}
                onFactoryChange={handleFactoryChange}
              />

              <ViewTabs
                activeTab={activeViewTab}
                onTabChange={handleViewTabChange}
                hideAnalytics={activeMainTab === 'incoming'}
                showGps
              />
              
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

          {activeMainTab !== 'summary' && activeViewTab === 'charts' && (
            <ChartsView data={shipmentData} mode={mode} />
          )}

          {activeMainTab !== 'summary' && activeViewTab === 'topCustomers' && (
            <TopCustomersView
              data={shipmentData}
              mode={mode}
            />
          )}

          {activeMainTab !== 'summary' && activeViewTab === 'gps' && (
            <div style={{ height: 520, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
              {gpsError && (
                <div style={{
                  position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
                  background: 'rgba(220,38,38,0.95)', color: '#fff', padding: '8px 14px',
                  borderRadius: 10, fontSize: 13, textAlign: 'center',
                }}>
                  {gpsError}
                </div>
              )}
              {gpsLoading && gpsTrucks.length === 0 ? (
                <LoadingSpinner message="Загрузка данных GPS..." size="large" />
              ) : (
                <TruckMap trucks={gpsTrucks} routes={gpsRoutes} filterPlate={null} />
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}











// // app/page.tsx

// 'use client';

// import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
// import { motion } from 'framer-motion';
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
// import ModeSwitch from './components/ModeSwitch';
// import LoadingSpinner from './components/LoadingSpinner';
// import { countActiveRequests, getFactoryName, isConcreteMaterial, isSpecialMaterial, parseRussianDate } from '@/lib/utils';
// import { useAuth } from '@/hooks/useAuth';

// // ============================================
// // ИНТЕРФЕЙСЫ
// // ============================================


// interface RequestItem {
//   number: string;
//   division: string;
//   closed: boolean | null;
//   delivery_date: string | null;
//   date: string;
//   clientRequestNumber: string | null;
// }

// // interface ShipmentItem {
// //   date: string;
// //   division: string;
// //   clientRequestNumber: string | null;
// // }


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
//   delivery_date: string | null;
//   destinationPoint: string | null; // ✅ ДОБАВИТЬ
// }

// export interface IncomingItem {
//   id: number;
//   number: string;
//   date: string;
//   division: string;
//   supplier: string;
//   material: string;
//   gross: number | null;
//   tara: number | null;
//   quantity: number;
//   driver: string | null;
//   licensePlate: string | null;
//   createdAt: number;
//   clientRequestNumber: string | null;  // ← ДОБАВИТЬ
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
//   destinationPoint: string | null;
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




// // Добавьте этот интерфейс после других интерфейсов
// interface ApiRequest {
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





// type MainTab = 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary';
// type ViewTab = 'compact' | 'grouped' | 'list' | 'charts' | 'topCustomers';
// type UnifiedDataItem = IncomingItem | ShipmentItem;

// // ============================================
// // ФУНКЦИИ ДЛЯ РАБОТЫ С ДАТАМИ
// // ============================================

// const getDateKey = (dateString: string): string => {
//   const date = parseRussianDate(dateString);
//   if (isNaN(date.getTime())) return dateString;
  
//   const day = date.getDate().toString().padStart(2, '0');
//   const month = (date.getMonth() + 1).toString().padStart(2, '0');
//   const year = date.getFullYear();
  
//   return `${day}.${month}.${year}`;
// };

// const isConcrete = (material: string): boolean => {
//   if (!material) return false;
//   const lower = material.toLowerCase();
//   return lower.includes('бст') || 
//          lower.includes('бетон') ||
//          lower.includes('раствор') ||
//          lower.includes('бсм');
// };

// const detectFactory = (item: UnifiedDataItem, type: 'incoming' | 'shipment'): string => {
//   if (type === 'incoming') {
//     const incoming = item as IncomingItem;
//     if (incoming.division === 'ЛХ') return 'ЛХ';
//     if (incoming.division === 'ЛЮ') return 'ЛЮ';
//     if (incoming.division === 'СП') return 'СП';
//     if (incoming.division === 'Щ') return 'Щ';
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




// // ============================================
// // ОСНОВНОЙ КОМПОНЕНТ
// // ============================================

// export default function Home() {
//   // Состояния
//   const [incomingData, setIncomingData] = useState<IncomingItem[]>([]);
//   const [shipmentData, setShipmentData] = useState<ShipmentItem[]>([]);
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
//   const [newConcreteCount, setNewConcreteCount] = useState<number>(0);
//   const [contentKey, setContentKey] = useState(0);


//   const [lastImportInfo, setLastImportInfo] = useState<{ lastImport: string | null; totalRecords: number }>({ lastImport: null, totalRecords: 0 });



//   const { accessibleFactories } = useAuth();

//    // ============================================
//   // PULL-TO-REFRESH (смахивание вниз)
//   // ============================================
  
//   const [pullStartY, setPullStartY] = useState(0);
//   const [pullOffset, setPullOffset] = useState(0);
//   const [isPulling, setIsPulling] = useState(false);
//   const containerRef = useRef<HTMLDivElement>(null);
  
//   const handleTouchStart = (e: React.TouchEvent) => {
//     // Только если скролл вверху страницы
//     if (window.scrollY === 0) {
//       setPullStartY(e.touches[0].clientY);
//       setIsPulling(true);
//     }
//   };
  
//   const handleTouchMove = (e: React.TouchEvent) => {
//     if (!isPulling) return;
    
//     const currentY = e.touches[0].clientY;
//     const diff = currentY - pullStartY;
    
//     if (diff > 0 && diff < 100) {
//       setPullOffset(diff);
//       e.preventDefault();
//     }
//   };
  
//   const handleTouchEnd = () => {
//     if (isPulling && pullOffset > 60) {
//       // Сработал pull-to-refresh
//       handleRefresh();
//       // Вибрация на мобильных
//       if (window.navigator && window.navigator.vibrate) {
//         window.navigator.vibrate(50);
//       }
//     }
//     setPullOffset(0);
//     setIsPulling(false);
//   };








//   // Режим переключения (ТАС / Айсберг)
//   const [mode, setMode] = useState<'tas' | 'iceberg'>(() => {
//     if (typeof window !== 'undefined') {
//       const saved = localStorage.getItem('appMode');
//       if (saved === 'tas' || saved === 'iceberg') {
//         return saved;
//       }
//     }
//     return 'tas';
//   });

//   // Доступные заводы в зависимости от режима
// const availableFactories = mode === 'tas' 
//   ? factories.filter(f => f === 'ЛХ' || f === 'ЛЮ')
//   : factories.filter(f => f === 'СП' || f === 'Щ');

//   // Функция переключения режима
  
  
  
  
//   // const toggleMode = () => {
//   //   const newMode = mode === 'tas' ? 'iceberg' : 'tas';
    
//   //   setContentKey(prev => prev + 1);
//   //   setMode(newMode);
//   //   setActiveFactory('all');
    
//   //   // Вибрация на мобильных устройствах
//   //   if (window.navigator && window.navigator.vibrate) {
//   //     window.navigator.vibrate(50);
//   //   }
    
//   //   localStorage.setItem('appMode', newMode);
//   // };

// // const toggleMode = () => {
// //   const newMode = mode === 'tas' ? 'iceberg' : 'tas';
  
// //   setContentKey(prev => prev + 1);
// //   setMode(newMode);
// //   setActiveFactory('all');
  
// //   // Пересчитываем счётчики после смены режима
// //   setTimeout(() => {
// //     loadFutureRequestsCount();
// //     loadNewShipmentsCount();
// //     if (newMode === 'iceberg') {
// //       loadNewConcreteCount();
// //     } else {
// //       setNewConcreteCount(0);
// //     }
// //   }, 100);
  
// //   if (window.navigator && window.navigator.vibrate) {
// //     window.navigator.vibrate(50);
// //   }
  
// //   localStorage.setItem('appMode', newMode);
// // };





// // const toggleMode = () => {
// //   const newMode = mode === 'tas' ? 'iceberg' : 'tas';
  
// //   // Сбрасываем счётчики сразу, чтобы не показывало старые цифры
// //   setNewShipmentsCount(0);
// //   setNewConcreteCount(0);
// //   setFutureRequestsCount(0);
  
// //   setContentKey(prev => prev + 1);
// //   setMode(newMode);
// //   setActiveFactory('all');
  
// //   // Загружаем новые данные
// //   setTimeout(() => {
// //     loadFutureRequestsCount();
// //     loadNewShipmentsCount();
// //     loadNewConcreteCount();
// //   }, 50);
  
// //   if (window.navigator && window.navigator.vibrate) {
// //     window.navigator.vibrate(50);
// //   }
  
// //   localStorage.setItem('appMode', newMode);
// // };



// const toggleMode = () => {
//   const newMode = mode === 'tas' ? 'iceberg' : 'tas';
  
//   // Сбрасываем все счётчики
//   setNewShipmentsCount(0);
//   setNewConcreteCount(0);
//   setFutureRequestsCount(0);  // ← добавить сброс "На будущее"
  
//   setContentKey(prev => prev + 1);
//   setMode(newMode);
//   setActiveFactory('all');
  
//   setTimeout(() => {
//     loadFutureRequestsCount();
//     loadNewShipmentsCount();
//     loadNewConcreteCount();
//   }, 50);
  
//   if (window.navigator && window.navigator.vibrate) {
//     window.navigator.vibrate(50);
//   }
  
//   localStorage.setItem('appMode', newMode);
// };





//   // Применяем класс к body для изменения темы
//   useEffect(() => {
//     if (mode === 'iceberg') {
//       document.body.classList.add('iceberg-mode');
//     } else {
//       document.body.classList.remove('iceberg-mode');
//     }
//   }, [mode]);

//   // ============================================
//   // ЗАГРУЗКА ДАННЫХ
//   // ============================================







// const loadNewShipmentsCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     const allRequests = await requestsResponse.json();
//     const allShipments = await shipmentsResponse.json();
    
//     const activeCount = countActiveRequests(
//       allRequests,
//       allShipments,
//       mode,
//       'asphalt'
//     );
    
//     setNewShipmentsCount(activeCount);
//   } catch (err) {
//     console.error(err);
//   }
// };


// const loadNewConcreteCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     const allRequests = await requestsResponse.json();
//     const allShipments = await shipmentsResponse.json();
    
//     const currentMode = mode;
    
//     // Используем ту же логику, что и для асфальта
//     const activeCount = countActiveRequests(
//       allRequests,
//       allShipments,
//       currentMode,
//       'concrete'
//     );
    
//     // Обновляем только если режим не изменился
//     if (mode === currentMode) {
//       setNewConcreteCount(activeCount);
//     }
//   } catch (err) {
//     console.error('Error loading concrete count:', err);
//   }
// };




// const loadFutureRequestsCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     let allRequests = await requestsResponse.json();
//     let allShipments = await shipmentsResponse.json();
    
//     // ✅ КРИТИЧЕСКИ ВАЖНО: проверка на массив
//     if (!Array.isArray(allRequests)) {
//       console.error('allRequests is not an array:', allRequests);
//       setFutureRequestsCount(0);
//       return;
//     }
//     if (!Array.isArray(allShipments)) {
//       console.error('allShipments is not an array:', allShipments);
//       setFutureRequestsCount(0);
//       return;
//     }
    
//     // Фильтруем по заводам текущего режима
//     const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
//     allRequests = allRequests.filter((r) => validFactories.includes(r.division));
//     allShipments = allShipments.filter((s) => validFactories.includes(s.division));
    
//     // Для Айсберга пока НЕТ логики "На будущее"
//     if (mode === 'iceberg') {
//       setFutureRequestsCount(0);
//       return;
//     }
    
//     // ========== ЛОГИКА ТОЛЬКО ДЛЯ ТАС ==========
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     const activeTodayRequests = new Set();
//     for (const shipment of allShipments) {
//       const shipmentDate = parseRussianDate(shipment.date);
//       shipmentDate.setHours(0, 0, 0, 0);
//       if (shipmentDate.getTime() === today.getTime() && shipment.clientRequestNumber) {
//         activeTodayRequests.add(shipment.clientRequestNumber);
//       }
//     }
    
//     const future = allRequests.filter((req: RequestItem) => {
//       if (req.closed) return false;
//       if (!req.delivery_date) return false;
//       const deliveryDate = parseRussianDate(req.delivery_date);
//       deliveryDate.setHours(0, 0, 0, 0);
//       return deliveryDate >= today && !activeTodayRequests.has(req.number);
//     });
    
//     setFutureRequestsCount(future.length);
//   } catch (err) {
//     console.error('Error in loadFutureRequestsCount:', err);
//     setFutureRequestsCount(0);
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
//       const data: ShipmentItem[] = await response.json();
      
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


//   // 👇 ДОБАВЬТЕ ЭТУ ФУНКЦИЮ 👇
//   const loadLastImportInfo = async () => {
//     try {
//       const response = await fetch('/api/last-import-info');
//       const data = await response.json();
//       setLastImportInfo(data);
//     } catch (err) {
//       console.error('Failed to load import info:', err);
//     }
//   };



// // const loadAllData = async () => {
// //   try {
// //     const [incoming, shipment] = await Promise.all([
// //       loadIncomingData(),
// //       loadShipmentData(),
// //       loadOutgoingRequests(),
// //     ]);
    
// //     const factorySet = new Set<string>();
    
// //     // Добавляем все найденные заводы
// //     (incoming as IncomingItem[]).forEach(item => {
// //       if (item.division) factorySet.add(item.division);
// //       if (item.number?.startsWith('ЛХ')) factorySet.add('ЛХ');
// //       if (item.number?.startsWith('ЛЮ')) factorySet.add('ЛЮ');
// //       if (item.number?.startsWith('СП')) factorySet.add('СП');
// //       if (item.number?.startsWith('Щ')) factorySet.add('Щ');
// //     });
    
// //     (shipment as ShipmentItem[]).forEach(item => {
// //       if (item.division) factorySet.add(item.division);
// //     });
    
// //     setFactories(Array.from(factorySet).sort());
// //   } catch (err) {
// //     console.error('Error loading all data:', err);
// //   }
// // };

// // app/page.tsx

// // const loadAllData = async () => {
// //   try {
// //     // Загружаем последовательно, а не параллельно
// //     console.log('🔄 Загрузка поступлений...');
// //     await loadIncomingData();
// //     await new Promise(resolve => setTimeout(resolve, 100));
    
// //     console.log('🔄 Загрузка отгрузок...');
// //     await loadShipmentData();
// //     await new Promise(resolve => setTimeout(resolve, 100));
    
// //     console.log('🔄 Загрузка заявок...');
// //     await loadOutgoingRequests();
// //     await new Promise(resolve => setTimeout(resolve, 100));
    
// //     console.log('✅ Все данные загружены');
// //   } catch (err) {
// //     console.error('Error loading all data:', err);
// //   }
// // };


// // // Вместо loadIncomingData(), loadShipmentData(), loadOutgoingRequests()
// // const loadAllData = async () => {
// //   try {
// //     const response = await fetch('/api/all-data');
// //     const data = await response.json();
    
// //     if (data.shipments) setShipmentData(data.shipments);
// //     if (data.outgoingRequests) setOutgoingRequests(data.outgoingRequests);
// //     if (data.incoming) setIncomingData(data.incoming);
// //   } catch (error) {
// //     console.error('Error loading data:', error);
// //   }
// // };




// // const loadAllData = async () => {
// //   try {
// //     const response = await fetch('/api/all-data');
// //     const data = await response.json();
    
// //     if (data.shipments) {
// //       console.log(`📦 Загружено ${data.shipments.length} отгрузок`);
// //       setShipmentData(data.shipments);
// //     }
// //     if (data.outgoingRequests) {
// //       console.log(`📋 Загружено ${data.outgoingRequests.length} заявок`);
// //       setOutgoingRequests(data.outgoingRequests);
// //     }
// //     if (data.incoming) {
// //       console.log(`📥 Загружено ${data.incoming.length} поступлений`);
// //       setIncomingData(data.incoming);
// //     }
// //   } catch (error) {
// //     console.error('Error loading all data:', error);
// //   }
// // };

// const loadAllData = async () => {
//   try {
//     const response = await fetch('/api/all-data');
//     const data = await response.json();
    
//     if (data.shipments) {
//       console.log(`📦 Загружено ${data.shipments.length} отгрузок`);
//       setShipmentData(data.shipments);
//     }
//     if (data.outgoingRequests) {
//       console.log(`📋 Загружено ${data.outgoingRequests.length} заявок`);
//       setOutgoingRequests(data.outgoingRequests);
//     }
//     if (data.incoming) {
//       console.log(`📥 Загружено ${data.incoming.length} поступлений`);
//       setIncomingData(data.incoming);
//     }
//   } catch (error) {
//     console.error('Error loading all data:', error);
//   }
// };




//   // ============================================
//   // ОБНОВЛЕНИЕ ДАННЫХ
//   // ============================================

//   const handleRefresh = async () => {
//   if (refreshing) return;
  
//   setRefreshing(true);
  
//   try {
//     if (activeMainTab === 'incoming') {
//       await fetch('/api/cron', {
//         headers: { 'Authorization': 'Bearer icg72xf3b1' }
//       });
//       await loadIncomingData();
//       await loadCronInfo();
//       setNotificationMessage(`✅ Поступления обновлены`);
//     } else if (activeMainTab === 'shipment') {
//       await fetch('/api/cron-shipments', {
//         headers: { 'Authorization': 'Bearer icg72xf3b1' }
//       });
//       await loadShipmentData();
//       await loadShipmentCronInfo();
//       await loadNewShipmentsCount();  // ← добавить
//       setNotificationMessage(`✅ Отгрузки асфальта обновлены`);
//     } else if (activeMainTab === 'shipmentConcrete') {
//       await fetch('/api/cron-shipments', {
//         headers: { 'Authorization': 'Bearer icg72xf3b1' }
//       });
//       await loadShipmentData();
//       await loadShipmentCronInfo();
//       await loadNewConcreteCount();  // ← добавить
//       setNotificationMessage(`✅ Отгрузки бетона обновлены`);
//     } else if (activeMainTab === 'summary') {
//       await Promise.all([
//         fetch('/api/cron', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
//         fetch('/api/cron-shipments', { headers: { 'Authorization': 'Bearer icg72xf3b1' } }),
//       ]);
//       await loadAllData();
//       await loadFutureRequestsCount();
//       await loadNewShipmentsCount();
//       await loadNewConcreteCount();  // ← добавить
//       setNotificationMessage(`✅ Все данные обновлены`);
//     }
    
//     setShowNotification(true);
//     setTimeout(() => setShowNotification(false), 2000);
    
//     setShouldShake(true);
//     setTimeout(() => setShouldShake(false), 500);
//   } catch (err) {
//     console.error('Ошибка при обновлении:', err);
//     setNotificationMessage('⚠️ Ошибка обновления');
//     setShowNotification(true);
//     setTimeout(() => setShowNotification(false), 2000);
//   } finally {
//     setRefreshing(false);
//   }
// };







//   const handleRetry = () => {
//     setLoading(true);
//     setError(null);
//     loadAllData().finally(() => setLoading(false));
//   };

//   // ============================================
//   // ФИЛЬТРАЦИЯ ДАННЫХ
//   // ============================================

//   const getFilteredShipmentsByType = (type: 'asphalt' | 'concrete'): ShipmentItem[] => {
//     let filtered = shipmentData;
    
//     // Фильтруем по заводу
//     if (activeFactory !== 'all') {
//       filtered = filtered.filter(item => {
//         const factory = detectFactory(item, 'shipment');
//         return factory === activeFactory;
//       });
//     }
    
//     // Фильтруем по типу материала
//     if (type === 'asphalt') {
//       filtered = filtered.filter(item => !isConcrete(item.material));
//     } else if (type === 'concrete') {
//       filtered = filtered.filter(item => isConcrete(item.material));
//     }
    
//     return filtered;
//   };

  
  
  
  

//   const getCurrentData = (): UnifiedDataItem[] => {
//   // Поступления
//   if (activeMainTab === 'incoming') {
//     let filtered = incomingData;
    
//     // Фильтруем по заводу если выбран конкретный
//     if (activeFactory !== 'all') {
//       filtered = filtered.filter(item => {
//         const factory = detectFactory(item, 'incoming');
//         return factory === activeFactory;
//       });
//     } else {
//       // Если выбран "Все заводы", фильтруем по текущему режиму
//       filtered = filtered.filter(item => {
//         const factory = detectFactory(item, 'incoming');
//         if (mode === 'tas') {
//           return factory === 'ЛХ' || factory === 'ЛЮ';
//         } else {
//           return factory === 'СП' || factory === 'Щ';
//         }
//       });
//     }
//     return filtered;
//   }
  
//   // Отгрузка Асфальт
//   if (activeMainTab === 'shipment') {
//     // let filtered = shipmentData.filter(item => !isConcreteMaterial(item.material));

//   // Фильтруем: не бетон И не инертные
//     let filtered = shipmentData.filter(item => {
//       const isConcrete = isConcreteMaterial(item.material);
//       const isSpecial = isSpecialMaterial(item.material);
      
//       // Исключаем и бетон, и инертные
//       return !isConcrete && !isSpecial;
//     });


//     if (activeFactory !== 'all') {
//       filtered = filtered.filter(item => {
//         const factory = detectFactory(item, 'shipment');
//         return factory === activeFactory;
//       });
//     } else {
//       filtered = filtered.filter(item => {
//         const factory = detectFactory(item, 'shipment');
//         if (mode === 'tas') {
//           return factory === 'ЛХ' || factory === 'ЛЮ';
//         } else {
//           return factory === 'СП' || factory === 'Щ';
//         }
//       });
//     }
//     return filtered;
//   }
  
//   // Отгрузка Бетон (только для Айсберг)
//   if (activeMainTab === 'shipmentConcrete') {
//     let filtered = shipmentData.filter(item => isConcreteMaterial(item.material));
    
//     if (activeFactory !== 'all') {
//       filtered = filtered.filter(item => {
//         const factory = detectFactory(item, 'shipment');
//         return factory === activeFactory;
//       });
//     } else {
//       filtered = filtered.filter(item => {
//         const factory = detectFactory(item, 'shipment');
//         if (mode === 'tas') {
//           return factory === 'ЛХ' || factory === 'ЛЮ';
//         } else {
//           return factory === 'СП' || factory === 'Щ';
//         }
//       });
//     }
//     return filtered;
//   }
  
//   return [];
// };








//   const filteredData = getCurrentData();

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

//   // ============================================
//   // EFFECTS
//   // ============================================

//   useEffect(() => {
//     let isMounted = true;
    
//     const fetchData = async () => {
//       try {
//         setLoading(true);
//         await loadAllData();
//         await loadFutureRequestsCount();
//         await loadNewShipmentsCount();
//         await loadNewConcreteCount();
//         await loadLastImportInfo();  // 👈 ДОБАВЬТЕ ЭТУ СТРОКУ
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












//   useEffect(() => {
//   const interval = setInterval(() => {
//     console.log('🔄 Автообновление...');
    
//     if (activeMainTab === 'incoming') {
//       loadIncomingData();
//       loadCronInfo();
//     } 
//     else if (activeMainTab === 'shipment') {
//       loadShipmentData();
//       loadShipmentCronInfo();
//       loadNewShipmentsCount();
//     } 
//     else if (activeMainTab === 'shipmentConcrete') {
//       loadShipmentData();
//       loadShipmentCronInfo();
//       // Обновляем счётчик бетона только в режиме Айсберг
//       if (mode === 'iceberg') {
//         loadNewConcreteCount();
//       }
//     } 
//     else if (activeMainTab === 'summary') {
//       loadAllData();
//       loadFutureRequestsCount();
//       loadNewShipmentsCount();
//       if (mode === 'iceberg') {
//         loadNewConcreteCount();
//       }
//     }
//   }, 60000);
  
//   return () => clearInterval(interval);
// }, [activeMainTab, mode]);






// // При смене режима пересчитываем счётчики
// useEffect(() => {
//   loadFutureRequestsCount();
//   loadNewShipmentsCount();
//   loadNewConcreteCount(); // функция сама проверит mode
// }, [mode]);



// // ============================================
// // РЕНДЕР
// // ============================================

// if (loading) {
//   return <LoadingSpinner message="Загрузка данных..." size="large" fullScreen />;
// }

// if (error) {
//   return (
//     <div className="error">
//       <p>⚠️ Ошибка: {error}</p>
//       <button onClick={handleRetry}>Попробовать снова</button>
//     </div>
//   );
// }

// return (
//   <div 
//     ref={containerRef}
//     onTouchStart={handleTouchStart}
//     onTouchMove={handleTouchMove}
//     onTouchEnd={handleTouchEnd}
//     className="app-container"
//   >
//     {/* Индикатор pull-to-refresh */}
//     <div 
//       className="pull-to-refresh-indicator"
//       style={{ 
//         transform: `translateY(${Math.min(pullOffset, 80)}px)`,
//         opacity: Math.min(pullOffset / 60, 1)
//       }}
//     >
//       {pullOffset > 60 ? '🔄 Отпустите для обновления' : '👇 Тяните вниз для обновления'}
//     </div>
    
//     <Notification message={notificationMessage} show={showNotification} />

//     <div className="container">
//       <header className="header">
//         <Header 
//           refreshing={refreshing} 
//           onRefresh={handleRefresh}
//           // onSendPlan={sendPlan}
//         />
        
//         {/* <ModeSwitch mode={mode} onToggle={toggleMode} /> */}

//         <ModeSwitch 
//           mode={mode} 
//           onToggle={toggleMode}
//           tasSyncTime={currentSyncInfo.lastSync}
//           icebergSyncTime={lastImportInfo.lastImport}
//           accessibleFactories={accessibleFactories}
//         />


//         <MainTabs 
//           activeTab={activeMainTab} 
//           onTabChange={setActiveMainTab}
//           futureRequestsCount={futureRequestsCount}
//           newShipmentsCount={newShipmentsCount}
//           newConcreteCount={newConcreteCount}
//           showConcreteTab={mode === 'iceberg'}
//         />

//         {/* <div className="sync-info">
//           <span className="sync-label">🔄 Синхронизация с 1С (ЛХ/ЛЮ):</span>
//           <span className="sync-time">{formatSyncTime(currentSyncInfo.lastSync)}</span>
//         </div>

//         <div className="sync-info">
//           <span className="sync-label">🔄 Синхронизация с 1С (СП/Щ):</span>
//           <span className="sync-time">{formatSyncTime(lastImportInfo.lastImport)}</span>
//         </div> */}

//         {activeMainTab !== 'summary' && (
//           <>
//             <FactoryFilter 
//               factories={availableFactories} 
//               activeFactory={activeFactory} 
//               onFactoryChange={setActiveFactory} 
//             />
            
//             <ViewTabs activeTab={activeViewTab} onTabChange={setActiveViewTab} />
            
//             <div className="stats">
//               Всего записей: <strong>{filteredData.length}</strong>
//               {activeFactory !== 'all' && ` (${getFactoryName(activeFactory)})`}
//             </div>
//           </>
//         )}
//       </header>

//       <motion.div
//         key={contentKey}
//         initial={{ opacity: 0, x: mode === 'tas' ? -20 : 20 }}
//         animate={{ opacity: 1, x: 0 }}
//         exit={{ opacity: 0, x: mode === 'tas' ? 20 : -20 }}
//         transition={{ duration: 0.3, type: 'spring', stiffness: 400, damping: 30 }}
//       >
//         {activeMainTab === 'summary' && <SummaryView mode={mode} />}
        
//         {activeMainTab !== 'summary' && activeViewTab === 'list' && (
//           <ListView 
//             data={getCurrentData()}
//             mainTab={activeMainTab}
//           />
//         )}

//         {activeMainTab !== 'summary' && activeViewTab === 'compact' && (
//           <CompactView 
//             data={getCurrentData()}
//             mainTab={activeMainTab}
//             outgoingRequests={outgoingRequestsForCompact}
//             allShipments={shipmentData}
//             allShipmentsForChart={shipmentData}
//             selectedFactory={activeFactory}
//             mode={mode}
//           />
//         )}

//         {activeMainTab !== 'summary' && activeViewTab === 'charts' && (
//           <ChartsView data={shipmentData} mode={mode} />
//         )}

//         {activeMainTab !== 'summary' && activeViewTab === 'topCustomers' && (
//           <TopCustomersView 
//             data={shipmentData} 
//             mode={mode} 
//           />
//         )}
//       </motion.div>
//     </div>
//   </div>
// );
// }










// const loadNewConcreteCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     const allRequests = await requestsResponse.json();
//     const allShipments = await shipmentsResponse.json();
    
//     const activeCount = countActiveRequests(
//       allRequests,
//       allShipments,
//       mode,
//       'concrete'
//     );
    
//     setNewConcreteCount(activeCount);
//   } catch (err) {
//     console.error(err);
//   }
// };



// const loadNewConcreteCount = async () => {
//   try {
//     const response = await fetch('/api/shipments');
//     let allShipments: ShipmentItem[] = await response.json();
    
//     // Только бетон
//     allShipments = allShipments.filter(s => isConcreteMaterial(s.material));
    
//     // Только заводы текущего режима (Айсберг)
//     const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
//     allShipments = allShipments.filter(s => validFactories.includes(s.division));
    
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     const todayConcrete = allShipments.filter(shipment => {
//       const shipmentDate = parseRussianDate(shipment.date);
//       shipmentDate.setHours(0, 0, 0, 0);
//       return shipmentDate.getTime() === today.getTime();
//     });
    
//     setNewConcreteCount(todayConcrete.length);
//   } catch (err) {
//     console.error(err);
//   }
// };

// const loadNewConcreteCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     let allRequests: OutgoingRequest[] = await requestsResponse.json();
//     let allShipments: ShipmentItem[] = await shipmentsResponse.json();
    
//     // Только бетон
//     allShipments = allShipments.filter((s: ShipmentItem) => isConcreteMaterial(s.material));
//     allRequests = allRequests.filter((r: OutgoingRequest) => isConcreteMaterial(r.material));
    
//     // Только заводы текущего режима (Айсберг)
//     const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
//     allShipments = allShipments.filter((s: ShipmentItem) => validFactories.includes(s.division));
//     allRequests = allRequests.filter((r: OutgoingRequest) => validFactories.includes(r.division));
    
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     // Группируем отгрузки по заявкам
//     const shipmentsByRequest = new Map<string, number>();
//     for (const shipment of allShipments) {
//       const shipmentDate = parseRussianDate(shipment.date);
//       shipmentDate.setHours(0, 0, 0, 0);
      
//       // Только сегодняшние отгрузки
//       if (shipmentDate.getTime() !== today.getTime()) continue;
      
//       const requestNumber = shipment.clientRequestNumber;
//       if (requestNumber) {
//         const current = shipmentsByRequest.get(requestNumber) || 0;
//         shipmentsByRequest.set(requestNumber, current + shipment.quantity);
//       }
//     }
    
//     // Создаём карту планов
//     const planMap = new Map<string, number>();
//     for (const req of allRequests) {
//       planMap.set(req.number, req.quantity);
//     }
    
//     // Считаем незавершённые заявки
//     let activeCount = 0;
//     for (const [requestNumber, factQuantity] of shipmentsByRequest) {
//       const planQuantity = planMap.get(requestNumber) || 0;
//       if (planQuantity > 0) {
//         const percent = (factQuantity / planQuantity) * 100;
//         if (percent > 0 && percent < 90) {  // незавершённая
//           activeCount++;
//         }
//       }
//     }
    
//     setNewConcreteCount(activeCount);
//   } catch (err) {
//     console.error('Error loading concrete count:', err);
//   }
// };

// const loadNewConcreteCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     let allRequests: OutgoingRequest[] = await requestsResponse.json();
//     let allShipments: ShipmentItem[] = await shipmentsResponse.json();
    
//     // Только бетон
//     allShipments = allShipments.filter((s: ShipmentItem) => isConcreteMaterial(s.material));
//     allRequests = allRequests.filter((r: OutgoingRequest) => isConcreteMaterial(r.material));
    
//     // Только заводы текущего режима (Айсберг)
//     const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
//     allShipments = allShipments.filter((s: ShipmentItem) => validFactories.includes(s.division));
//     allRequests = allRequests.filter((r: OutgoingRequest) => validFactories.includes(r.division));
    
//     // Сегодня и вчера
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     const yesterday = new Date(today);
//     yesterday.setDate(yesterday.getDate() - 1);
    
//     // Группируем отгрузки по заявкам (только сегодня и вчера)
//     const shipmentsByRequest = new Map<string, number>();
//     for (const shipment of allShipments) {
//       const shipmentDate = parseRussianDate(shipment.date);
//       shipmentDate.setHours(0, 0, 0, 0);
      
//       // Проверяем: сегодня ИЛИ вчера
//       const isToday = shipmentDate.getTime() === today.getTime();
//       const isYesterday = shipmentDate.getTime() === yesterday.getTime();
      
//       if (!isToday && !isYesterday) continue;
      
//       const requestNumber = shipment.clientRequestNumber;
//       if (requestNumber) {
//         const current = shipmentsByRequest.get(requestNumber) || 0;
//         shipmentsByRequest.set(requestNumber, current + shipment.quantity);
//       }
//     }
    
//     // Карта планов
//     const planMap = new Map<string, number>();
//     for (const req of allRequests) {
//       planMap.set(req.number, req.quantity);
//     }
    
//     // Считаем незавершённые заявки (факт > 0 и факт < 90% от плана)
//     let activeCount = 0;
//     for (const [requestNumber, factQuantity] of shipmentsByRequest) {
//       const planQuantity = planMap.get(requestNumber) || 0;
//       if (planQuantity > 0) {
//         const percent = (factQuantity / planQuantity) * 100;
//         if (percent > 0 && percent < 90) {
//           activeCount++;
//         }
//       }
//     }
    
//     setNewConcreteCount(activeCount);
//   } catch (err) {
//     console.error('Error loading concrete count:', err);
//   }
// };







// const loadFutureRequestsCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     let allRequests: ApiRequest[] = await requestsResponse.json();
//     let allShipments: ShipmentItem[] = await shipmentsResponse.json();
    
//     // Фильтруем по заводам текущего режима
//     const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
//     allRequests = allRequests.filter((r) => validFactories.includes(r.division));
//     allShipments = allShipments.filter((s) => validFactories.includes(s.division));
    
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     const activeTodayRequests = new Set();
//     for (const shipment of allShipments) {
//       const shipmentDate = parseRussianDate(shipment.date);
//       shipmentDate.setHours(0, 0, 0, 0);
//       if (shipmentDate.getTime() === today.getTime() && shipment.clientRequestNumber) {
//         activeTodayRequests.add(shipment.clientRequestNumber);
//       }
//     }
    
//     const future = allRequests.filter((req) => {
//       if (req.closed) return false;
//       if (!req.delivery_date) return false;
//       const deliveryDate = parseRussianDate(req.delivery_date);
//       deliveryDate.setHours(0, 0, 0, 0);
//       return deliveryDate >= today && !activeTodayRequests.has(req.number);
//     });
    
//     setFutureRequestsCount(future.length);
//   } catch (err) {
//     console.error(err);
//   }
// };


// const loadFutureRequestsCount = async () => {
//   try {
//     const [requestsResponse, shipmentsResponse] = await Promise.all([
//       fetch('/api/outgoing-requests'),
//       fetch('/api/shipments')
//     ]);
    
//     let allRequests: ApiRequest[] = await requestsResponse.json();
//     let allShipments: ShipmentItem[] = await shipmentsResponse.json();
    
//     // Фильтруем по заводам текущего режима
//     const validFactories = mode === 'tas' ? ['ЛХ', 'ЛЮ'] : ['СП', 'Щ'];
//     allRequests = allRequests.filter((r) => validFactories.includes(r.division));
//     allShipments = allShipments.filter((s) => validFactories.includes(s.division));
    
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     // Для Айсберга пока НЕТ логики "На будущее"
//     if (mode === 'iceberg') {
//       setFutureRequestsCount(0);
//       return;
//     }
    
//     // ========== ЛОГИКА ТОЛЬКО ДЛЯ ТАС ==========
//     const activeTodayRequests = new Set();
//     for (const shipment of allShipments) {
//       const shipmentDate = parseRussianDate(shipment.date);
//       shipmentDate.setHours(0, 0, 0, 0);
//       if (shipmentDate.getTime() === today.getTime() && shipment.clientRequestNumber) {
//         activeTodayRequests.add(shipment.clientRequestNumber);
//       }
//     }
    
//     const future = allRequests.filter((req) => {
//       if (req.closed) return false;
//       if (!req.delivery_date) return false;
//       const deliveryDate = parseRussianDate(req.delivery_date);
//       deliveryDate.setHours(0, 0, 0, 0);
//       return deliveryDate >= today && !activeTodayRequests.has(req.number);
//     });
    
//     setFutureRequestsCount(future.length);
//   } catch (err) {
//     console.error(err);
//     setFutureRequestsCount(0);
//   }
// };
