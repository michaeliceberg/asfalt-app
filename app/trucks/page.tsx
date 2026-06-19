// app/trucks/page.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TruckMap from '@/app/components/TruckMap';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { parseRussianDate } from '@/lib/utils';

interface Truck {
  uid: string;
  name: string;
  position: {
    lat: number;
    lng: number;
    vel: number;
    time: number;
  } | null;
  lastUpdate: string | null;
}

interface Route {
  destination: string;
  factory: string;
  count: number;
  requestNumber: string;
  totalQuantity: number;
  licensePlates: string[];
  destCoords: { lat: number; lng: number; name: string } | null;
  factoryCoords: { lat: number; lng: number; name: string } | null;
  lastShipmentDate?: string | null;
}

export default function TrucksPage() {
  const router = useRouter();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);

  const loadData = async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await fetch('/api/trucks');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }
      
      if (data.success === false) {
        throw new Error(data.error || 'Unknown API error');
      }
      
      if (Array.isArray(data.trucks)) {
        setTrucks(data.trucks);
        setLastUpdate(data.timestamp || new Date().toISOString());
        setCurrentTime(Date.now());
        
        if (data.routes && Array.isArray(data.routes)) {
          setRoutes(data.routes);
          console.log('🔵 Routes set:', data.routes.length);
        }
      } else {
        throw new Error('Trucks data is not an array');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching trucks:', err);
      setError(errorMessage);
      setTrucks([]);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      loadData();
    }
  }, []);

  // Интервал обновления — 60 секунд
  useEffect(() => {
    let isActive = true;
    let intervalId: NodeJS.Timeout | null = null;
    
    const startInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      
      intervalId = setInterval(() => {
        if (isActive && document.visibilityState === 'visible') {
          console.log('🔄 Auto-refresh (60s)');
          loadData();
        }
      }, 60000);
    };
    
    startInterval();
    
    const handleVisibilityChange = () => {
      isActive = document.visibilityState === 'visible';
      if (isActive) {
        console.log('📱 Page became visible, refreshing...');
        loadData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    intervalRef.current = intervalId;
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(timeInterval);
  }, []);

  const handleRefresh = () => {
    loadData();
  };

  const handleBack = () => {
    if (selectedRoute) {
      setSelectedRoute(null);
    } else {
      router.back();
    }
  };

  const handleSelectRoute = (route: Route) => {
    if (selectedRoute?.requestNumber === route.requestNumber) {
      setSelectedRoute(null);
      return;
    }
    setSelectedRoute(route);
  };

  const stats = useMemo(() => {
    const trucksList = Array.isArray(trucks) ? trucks : [];
    const now = currentTime;
    
    const activeCount = trucksList.filter(t => t.position !== null).length;
    
    const standingCount = trucksList.filter(t => {
      if (!t.position) return false;
      if (t.position.vel !== 0) return false;
      const lastUpdateTime = new Date(t.lastUpdate || 0).getTime();
      const minutesSinceUpdate = (now - lastUpdateTime) / 1000 / 60;
      return minutesSinceUpdate > 30;
    }).length;
    
    const loadingCount = trucksList.filter(t => {
      if (!t.position) return false;
      if (t.position.vel !== 0) return false;
      const lastUpdateTime = new Date(t.lastUpdate || 0).getTime();
      const minutesSinceUpdate = (now - lastUpdateTime) / 1000 / 60;
      return minutesSinceUpdate <= 30;
    }).length;
    
    const movingCount = trucksList.filter(t => t.position && t.position.vel > 0).length;
    const offlineCount = trucksList.length - activeCount;

    return {
      trucksList,
      activeCount,
      standingCount,
      loadingCount,
      movingCount,
      offlineCount,
      total: trucksList.length,
    };
  }, [trucks, currentTime]);

  // ✅ ТОЛЬКО АКТИВНЫЕ ОТГРУЗКИ ТАС (ЛХ, ЛЮ) — сегодня/вчера
  const displayedRoutes = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    return routes.filter(route => {
      // Только ТАС (ЛХ, ЛЮ)
      if (route.factory !== 'ЛХ' && route.factory !== 'ЛЮ') {
        return false;
      }
      
      // Проверяем, есть ли у этого маршрута машины с позицией > 0
      const hasMovingTrucks = route.licensePlates.some(plate => {
        const normalizedPlate = plate
          .toUpperCase()
          .replace(/\s/g, '')
          .replace(/[^A-Z0-9]/g, '');
        const truck = trucks.find(t => {
          const tName = t.name
            .toUpperCase()
            .replace(/\s/g, '')
            .replace(/[^A-Z0-9]/g, '');
          return tName === normalizedPlate && t.position && t.position.vel > 0;
        });
        return !!truck;
      });
      
      // Проверяем, есть ли отгрузки за сегодня или вчера
      if (route.lastShipmentDate) {
        const shipmentDate = parseRussianDate(route.lastShipmentDate);
        shipmentDate.setHours(0, 0, 0, 0);
        const isToday = shipmentDate.getTime() === today.getTime();
        const isYesterday = shipmentDate.getTime() === yesterday.getTime();
        return hasMovingTrucks && (isToday || isYesterday);
      }
      
      return hasMovingTrucks;
    });
  }, [routes, trucks]);

  // Уникальные направления для фильтра
  const uniqueDestinations = useMemo(() => {
    const dests = new Set<string>();
    displayedRoutes.forEach(r => {
      if (r.destination) dests.add(r.destination);
    });
    return Array.from(dests).sort();
  }, [displayedRoutes]);

  const formattedLastUpdate = useMemo(() => {
    if (!lastUpdate) return '...';
    return new Date(lastUpdate).toLocaleTimeString();
  }, [lastUpdate]);

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#f87171', marginBottom: 8 }}>Ошибка загрузки данных</h2>
        <p style={{ color: '#888', marginBottom: 16 }}>{error}</p>
        <button
          onClick={handleRefresh}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: '#4a90d9',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          🔄 Попробовать снова
        </button>
      </div>
    );
  }

  const { 
    trucksList, 
    activeCount, 
    standingCount, 
    loadingCount, 
    movingCount, 
    offlineCount,
    total 
  } = stats;

  return (
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 16 }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      padding: '0 8px',
      flexWrap: 'wrap',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleBack}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#333',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#555'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#333'}
        >
          ← Назад
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>
            {selectedRoute ? `🎯 ${selectedRoute.destination}` : '🚛 GPS-мониторинг ТАС'}
          </h1>
          <div style={{ fontSize: 14, color: '#666' }}>
            {selectedRoute 
              ? `${selectedRoute.count} машин, ${Number(selectedRoute.totalQuantity).toFixed(1)} т · обновлено: ${formattedLastUpdate}`
              : `${uniqueDestinations.length} активных колонн · обновлено: ${formattedLastUpdate}`
            }
          </div>
        </div>
      </div>
      <button
        onClick={handleRefresh}
        style={{
          padding: '8px 20px',
          borderRadius: 8,
          border: 'none',
          background: '#4a90d9',
          color: '#fff',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        🔄 Обновить
      </button>
    </div>

    {/* Фильтр по направлениям */}
    {uniqueDestinations.length > 0 && (
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '8px 12px',
        background: '#f8fafc',
        borderRadius: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
        border: '1px solid #e2e8f0',
      }}>
        <span style={{ fontSize: 13, color: '#666', marginRight: 4, fontWeight: 600 }}>
          🚛 Активные колонны (сегодня/вчера):
        </span>
        {uniqueDestinations.map((dest) => {
          const route = displayedRoutes.find(r => r.destination === dest);
          if (!route) return null;
          
          const isSelected = selectedRoute?.requestNumber === route.requestNumber;
          
          const factoryColor = route.factory === 'ЛХ' ? '#166534' : 
                             route.factory === 'ЛЮ' ? '#3b82f6' :
                             route.factory === 'СП' ? '#eab308' : '#ef4444';
          return (
            <button
              key={dest}
              onClick={() => handleSelectRoute(route)}
              style={{
                padding: '4px 14px',
                borderRadius: 16,
                border: `2px solid ${factoryColor}`,
                background: isSelected ? factoryColor : '#fff',
                color: isSelected ? '#fff' : '#1a1a2e',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = factoryColor;
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.color = '#1a1a2e';
                }
              }}
            >
              <span style={{ 
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: factoryColor,
              }}></span>
              {dest.replace('ПК 25 ', '').replace('ПК 26 ', '').replace('АЙСБЕРГ ООО', 'АЙСБЕРГ')}
              <span style={{ 
                background: isSelected ? 'rgba(255,255,255,0.3)' : '#f1f5f9', 
                padding: '0 6px', 
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 700,
              }}>
                {route.count}🚛
              </span>
              {isSelected && <span style={{ fontSize: 10 }}>✓</span>}
            </button>
          );
        })}
      </div>
    )}

    <div style={{
      display: 'flex',
      gap: 24,
      padding: '6px 16px',
      background: '#f8fafc',
      borderRadius: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
      fontSize: 13,
    }}>
      <span>🚛 Всего: <strong>{total}</strong></span>
      <span>🟢 В пути: <strong style={{ color: '#4ade80' }}>{movingCount}</strong></span>
      <span>🟡 Загружаются: <strong style={{ color: '#facc15' }}>{loadingCount}</strong></span>
      <span>🔴 Стоят: <strong style={{ color: '#f87171' }}>{standingCount}</strong></span>
      <span>⚪ Офлайн: <strong style={{ color: '#9ca3af' }}>{offlineCount}</strong></span>
      {selectedRoute && (
        <span style={{ color: '#4a90d9', fontWeight: 600 }}>
          🎯 {selectedRoute.destination}
        </span>
      )}
      <span style={{ color: '#22c55e', fontWeight: 600 }}>
        🟢 Активных колонн: {uniqueDestinations.length}
      </span>
    </div>

    {/* Карта */}
    <div style={{ flex: 1, minHeight: 500, borderRadius: 12, overflow: 'hidden' }}>
      {loading ? (
        <LoadingSpinner message="Загрузка данных о транспорте..." size="large" />
      ) : selectedRoute ? (
        <TruckMap 
          key={selectedRoute.requestNumber}
          trucks={trucksList} 
          routes={[selectedRoute]} 
        />
      ) : (
        <TruckMap trucks={trucksList} routes={displayedRoutes} />
      )}
    </div>

    <div style={{
      display: 'flex',
      gap: 24,
      justifyContent: 'center',
      padding: 12,
      background: '#f8fafc',
      borderRadius: 8,
      marginTop: 12,
      flexWrap: 'wrap',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#166534', display: 'inline-block' }}></span>
        <span>ЛХ (Луховицы)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
        <span>ЛЮ (Люберцы)</span>
      </div>
    </div>
  </div>
);
}






// // app/trucks/page.tsx
// 'use client';

// import { useState, useEffect, useRef, useMemo } from 'react';
// import { useRouter } from 'next/navigation';
// import TruckMap from '@/app/components/TruckMap';
// import SingleRouteMap from '@/app/components/SingleRouteMap';
// import LoadingSpinner from '@/app/components/LoadingSpinner';
// import { parseRussianDate } from '@/lib/utils';
// import { YandexMap } from '@/lib/yandex-maps-types';

// interface Truck {
//   uid: string;
//   name: string;
//   position: {
//     lat: number;
//     lng: number;
//     vel: number;
//     time: number;
//   } | null;
//   lastUpdate: string | null;
// }

// interface Route {
//   destination: string;
//   factory: string;
//   count: number;
//   requestNumber: string;
//   totalQuantity: number;
//   licensePlates: string[];
//   destCoords: { lat: number; lng: number; name: string } | null;
//   factoryCoords: { lat: number; lng: number; name: string } | null;
//   lastShipmentDate?: string | null;
// }

// export default function TrucksPage() {
//   const router = useRouter();
//   const [trucks, setTrucks] = useState<Truck[]>([]);
//   const [routes, setRoutes] = useState<Route[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [lastUpdate, setLastUpdate] = useState<string>('');
//   const [error, setError] = useState<string | null>(null);
//   const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
//   const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
//   const [showAllRoutes, setShowAllRoutes] = useState(true);
//   const [activeTab, setActiveTab] = useState<'all' | 'active'>('active');
//   const [sharedMap, setSharedMap] = useState<YandexMap | null>(null);

//   const intervalRef = useRef<NodeJS.Timeout | null>(null);
//   const isInitialized = useRef(false);

//   const loadData = async () => {
//     setLoading(true);
//     try {
//       setError(null);
//       const response = await fetch('/api/trucks');
      
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
      
//       const data = await response.json();
      
//       if (!data || typeof data !== 'object') {
//         throw new Error('Invalid response format');
//       }
      
//       if (data.success === false) {
//         throw new Error(data.error || 'Unknown API error');
//       }
      
//       if (Array.isArray(data.trucks)) {
//         setTrucks(data.trucks);
//         setLastUpdate(data.timestamp || new Date().toISOString());
//         setCurrentTime(Date.now());
        
//         if (data.routes && Array.isArray(data.routes)) {
//           setRoutes(data.routes);
//           console.log('🔵 Routes set:', data.routes.length);
//         }
//       } else {
//         throw new Error('Trucks data is not an array');
//       }
      
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'Unknown error';
//       console.error('Error fetching trucks:', err);
//       setError(errorMessage);
//       setTrucks([]);
//       setRoutes([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (!isInitialized.current) {
//       isInitialized.current = true;
//       loadData();
//     }
//   }, []);

//   // Интервал обновления — 60 секунд
//   useEffect(() => {
//     let isActive = true;
//     let intervalId: NodeJS.Timeout | null = null;
    
//     const startInterval = () => {
//       if (intervalId) {
//         clearInterval(intervalId);
//       }
      
//       intervalId = setInterval(() => {
//         if (isActive && document.visibilityState === 'visible') {
//           console.log('🔄 Auto-refresh (60s)');
//           loadData();
//         }
//       }, 60000); // ← 60 секунд
//     };
    
//     startInterval();
    
//     const handleVisibilityChange = () => {
//       isActive = document.visibilityState === 'visible';
//       if (isActive) {
//         console.log('📱 Page became visible, refreshing...');
//         loadData();
//       }
//     };
    
//     document.addEventListener('visibilitychange', handleVisibilityChange);
    
//     intervalRef.current = intervalId;
    
//     return () => {
//       if (intervalId) {
//         clearInterval(intervalId);
//       }
//       document.removeEventListener('visibilitychange', handleVisibilityChange);
//     };
//   }, []);

//   useEffect(() => {
//     const timeInterval = setInterval(() => {
//       setCurrentTime(Date.now());
//     }, 30000);
//     return () => clearInterval(timeInterval);
//   }, []);

//   const handleRefresh = () => {
//     loadData();
//   };

//   const handleBack = () => {
//     if (selectedRoute) {
//       setSelectedRoute(null);
//       setShowAllRoutes(true);
//     } else {
//       router.back();
//     }
//   };

//   const handleSelectRoute = (route: Route) => {
//     if (selectedRoute?.requestNumber === route.requestNumber) {
//       setSelectedRoute(null);
//       setShowAllRoutes(true);
//       return;
//     }
//     setSelectedRoute(route);
//     setShowAllRoutes(false);
//   };

//   const handleShowAll = () => {
//     setSelectedRoute(null);
//     setShowAllRoutes(true);
//   };

//   const stats = useMemo(() => {
//     const trucksList = Array.isArray(trucks) ? trucks : [];
//     const now = currentTime;
    
//     const activeCount = trucksList.filter(t => t.position !== null).length;
    
//     const standingCount = trucksList.filter(t => {
//       if (!t.position) return false;
//       if (t.position.vel !== 0) return false;
//       const lastUpdateTime = new Date(t.lastUpdate || 0).getTime();
//       const minutesSinceUpdate = (now - lastUpdateTime) / 1000 / 60;
//       return minutesSinceUpdate > 30;
//     }).length;
    
//     const loadingCount = trucksList.filter(t => {
//       if (!t.position) return false;
//       if (t.position.vel !== 0) return false;
//       const lastUpdateTime = new Date(t.lastUpdate || 0).getTime();
//       const minutesSinceUpdate = (now - lastUpdateTime) / 1000 / 60;
//       return minutesSinceUpdate <= 30;
//     }).length;
    
//     const movingCount = trucksList.filter(t => t.position && t.position.vel > 0).length;
//     const offlineCount = trucksList.length - activeCount;

//     return {
//       trucksList,
//       activeCount,
//       standingCount,
//       loadingCount,
//       movingCount,
//       offlineCount,
//       total: trucksList.length,
//     };
//   }, [trucks, currentTime]);

//   // Фильтруем ТОЛЬКО ТАС (ЛХ, ЛЮ) И ТОЛЬКО АКТИВНЫЕ ОТГРУЗКИ (сегодня/вчера)
//   const activeRoutes = useMemo(() => {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
    
//     const yesterday = new Date(today);
//     yesterday.setDate(yesterday.getDate() - 1);
    
//     return routes.filter(route => {
//       if (route.factory !== 'ЛХ' && route.factory !== 'ЛЮ') {
//         return false;
//       }
      
//       const hasMovingTrucks = route.licensePlates.some(plate => {
//         const normalizedPlate = plate
//           .toUpperCase()
//           .replace(/\s/g, '')
//           .replace(/[^A-Z0-9]/g, '');
//         const truck = trucks.find(t => {
//           const tName = t.name
//             .toUpperCase()
//             .replace(/\s/g, '')
//             .replace(/[^A-Z0-9]/g, '');
//           return tName === normalizedPlate && t.position && t.position.vel > 0;
//         });
//         return !!truck;
//       });
      
//       if (route.lastShipmentDate) {
//         const shipmentDate = parseRussianDate(route.lastShipmentDate);
//         shipmentDate.setHours(0, 0, 0, 0);
//         const isToday = shipmentDate.getTime() === today.getTime();
//         const isYesterday = shipmentDate.getTime() === yesterday.getTime();
//         return hasMovingTrucks && (isToday || isYesterday);
//       }
      
//       return hasMovingTrucks;
//     });
//   }, [routes, trucks]);

//   const displayedRoutes = activeTab === 'active' ? activeRoutes : routes;

//   const uniqueDestinations = useMemo(() => {
//     const dests = new Set<string>();
//     displayedRoutes.forEach(r => {
//       if (r.destination) dests.add(r.destination);
//     });
//     return Array.from(dests).sort();
//   }, [displayedRoutes]);

//   const formattedLastUpdate = useMemo(() => {
//     if (!lastUpdate) return '...';
//     return new Date(lastUpdate).toLocaleTimeString();
//   }, [lastUpdate]);

//   if (error) {
//     return (
//       <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
//         <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
//         <h2 style={{ color: '#f87171', marginBottom: 8 }}>Ошибка загрузки данных</h2>
//         <p style={{ color: '#888', marginBottom: 16 }}>{error}</p>
//         <button
//           onClick={handleRefresh}
//           style={{
//             padding: '10px 24px',
//             borderRadius: 8,
//             border: 'none',
//             background: '#4a90d9',
//             color: '#fff',
//             cursor: 'pointer',
//             fontWeight: 500,
//           }}
//         >
//           🔄 Попробовать снова
//         </button>
//       </div>
//     );
//   }

//   const { 
//     trucksList, 
//     activeCount, 
//     standingCount, 
//     loadingCount, 
//     movingCount, 
//     offlineCount,
//     total 
//   } = stats;

//   return (
//     <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 16 }}>
//       <div style={{
//         display: 'flex',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         marginBottom: 12,
//         padding: '0 8px',
//         flexWrap: 'wrap',
//         gap: 8,
//       }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
//           <button
//             onClick={handleBack}
//             style={{
//               padding: '8px 16px',
//               borderRadius: 8,
//               border: 'none',
//               color: '#fff',
//               cursor: 'pointer',
//               fontWeight: 500,
//               display: 'flex',
//               alignItems: 'center',
//               gap: 6,
//               background: '#333',
//             }}
//             onMouseEnter={(e) => e.currentTarget.style.background = '#555'}
//             onMouseLeave={(e) => e.currentTarget.style.background = '#333'}
//           >
//             ← Назад
//           </button>
//           <div>
//             <h1 style={{ margin: 0, fontSize: 24 }}>
//               {selectedRoute ? `🎯 ${selectedRoute.destination}` : '🚛 GPS-мониторинг'}
//             </h1>
//             <div style={{ fontSize: 14, color: '#666' }}>
//               {selectedRoute 
//                 ? `${selectedRoute.count} машин, ${Number(selectedRoute.totalQuantity).toFixed(1)} т · обновлено: ${formattedLastUpdate}`
//                 : `${activeCount} из ${total} машин активно · обновлено: ${formattedLastUpdate}`
//               }
//             </div>
//           </div>
//         </div>
//         <button
//           onClick={handleRefresh}
//           style={{
//             padding: '8px 20px',
//             borderRadius: 8,
//             border: 'none',
//             background: '#4a90d9',
//             color: '#fff',
//             cursor: 'pointer',
//             fontWeight: 500,
//           }}
//         >
//           🔄 Обновить
//         </button>
//       </div>

//       {!selectedRoute && (
//         <div style={{
//           display: 'flex',
//           gap: 4,
//           padding: '4px 12px',
//           background: '#f1f5f9',
//           borderRadius: 10,
//           marginBottom: 12,
//           width: 'fit-content',
//         }}>
//           <button
//             onClick={() => setActiveTab('all')}
//             style={{
//               padding: '6px 16px',
//               borderRadius: 8,
//               border: 'none',
//               background: activeTab === 'all' ? '#fff' : 'transparent',
//               color: activeTab === 'all' ? '#1a1a2e' : '#888',
//               cursor: 'pointer',
//               fontWeight: 500,
//               fontSize: 13,
//               boxShadow: activeTab === 'all' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
//               transition: 'all 0.2s',
//             }}
//           >
//             📋 Все маршруты ТАС ({routes.filter(r => r.factory === 'ЛХ' || r.factory === 'ЛЮ').length})
//           </button>
//           <button
//             onClick={() => setActiveTab('active')}
//             style={{
//               padding: '6px 16px',
//               borderRadius: 8,
//               border: 'none',
//               background: activeTab === 'active' ? '#fff' : 'transparent',
//               color: activeTab === 'active' ? '#1a1a2e' : '#888',
//               cursor: 'pointer',
//               fontWeight: 500,
//               fontSize: 13,
//               boxShadow: activeTab === 'active' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
//               transition: 'all 0.2s',
//             }}
//           >
//             🟢 Активные отгрузки ({activeRoutes.length})
//           </button>
//         </div>
//       )}

//       {activeTab === 'active' && uniqueDestinations.length > 0 && (
//         <div style={{
//           display: 'flex',
//           gap: 6,
//           padding: '8px 12px',
//           background: '#f8fafc',
//           borderRadius: 8,
//           marginBottom: 12,
//           flexWrap: 'wrap',
//           alignItems: 'center',
//           border: '1px solid #e2e8f0',
//         }}>
//           <span style={{ fontSize: 13, color: '#666', marginRight: 4, fontWeight: 600 }}>
//             🚛 Активные колонны (сегодня/вчера):
//           </span>
//           {uniqueDestinations.map((dest) => {
//             const route = displayedRoutes.find(r => r.destination === dest);
//             if (!route) return null;
            
//             const isSelected = selectedRoute?.requestNumber === route.requestNumber;
            
//             const factoryColor = route.factory === 'ЛХ' ? '#166534' : 
//                                route.factory === 'ЛЮ' ? '#3b82f6' :
//                                route.factory === 'СП' ? '#eab308' : '#ef4444';
//             return (
//               <button
//                 key={dest}
//                 onClick={() => {
//                   if (isSelected) {
//                     handleShowAll();
//                   } else {
//                     handleSelectRoute(route);
//                   }
//                 }}
//                 style={{
//                   padding: '4px 14px',
//                   borderRadius: 16,
//                   border: `2px solid ${factoryColor}`,
//                   background: isSelected ? factoryColor : '#fff',
//                   color: isSelected ? '#fff' : '#1a1a2e',
//                   cursor: 'pointer',
//                   fontSize: 12,
//                   fontWeight: 600,
//                   whiteSpace: 'nowrap',
//                   transition: 'all 0.2s',
//                   display: 'flex',
//                   alignItems: 'center',
//                   gap: 6,
//                 }}
//                 onMouseEnter={(e) => {
//                   if (!isSelected) {
//                     e.currentTarget.style.background = factoryColor;
//                     e.currentTarget.style.color = '#fff';
//                   }
//                 }}
//                 onMouseLeave={(e) => {
//                   if (!isSelected) {
//                     e.currentTarget.style.background = '#fff';
//                     e.currentTarget.style.color = '#1a1a2e';
//                   }
//                 }}
//               >
//                 <span style={{ 
//                   display: 'inline-block',
//                   width: 10,
//                   height: 10,
//                   borderRadius: '50%',
//                   background: factoryColor,
//                 }}></span>
//                 {dest.replace('ПК 25 ', '').replace('ПК 26 ', '').replace('АЙСБЕРГ ООО', 'АЙСБЕРГ')}
//                 <span style={{ 
//                   background: isSelected ? 'rgba(255,255,255,0.3)' : '#f1f5f9', 
//                   padding: '0 6px', 
//                   borderRadius: 10,
//                   fontSize: 10,
//                   fontWeight: 700,
//                 }}>
//                   {route.count}🚛
//                 </span>
//                 {isSelected && <span style={{ fontSize: 10 }}>✓</span>}
//               </button>
//             );
//           })}
//         </div>
//       )}

//       <div style={{
//         display: 'flex',
//         gap: 24,
//         padding: '6px 16px',
//         background: '#f8fafc',
//         borderRadius: 8,
//         marginBottom: 12,
//         flexWrap: 'wrap',
//         fontSize: 13,
//       }}>
//         <span>🚛 Всего: <strong>{total}</strong></span>
//         <span>🟢 В пути: <strong style={{ color: '#4ade80' }}>{movingCount}</strong></span>
//         <span>🟡 Загружаются: <strong style={{ color: '#facc15' }}>{loadingCount}</strong></span>
//         <span>🔴 Стоят: <strong style={{ color: '#f87171' }}>{standingCount}</strong></span>
//         <span>⚪ Офлайн: <strong style={{ color: '#9ca3af' }}>{offlineCount}</strong></span>
//         {selectedRoute && (
//           <span style={{ color: '#4a90d9', fontWeight: 600 }}>
//             🎯 {selectedRoute.destination}
//           </span>
//         )}
//         {activeTab === 'active' && !selectedRoute && (
//           <span style={{ color: '#22c55e', fontWeight: 600 }}>
//             🟢 Активных колонн: {uniqueDestinations.length}
//           </span>
//         )}
//       </div>

//       <div style={{ flex: 1, minHeight: 500, borderRadius: 12, overflow: 'hidden' }}>
//         {loading ? (
//           <LoadingSpinner message="Загрузка данных о транспорте..." size="large" />
//         ) : selectedRoute ? (
//           <TruckMap 
//             key={selectedRoute.requestNumber}
//             trucks={trucksList} 
//             routes={[selectedRoute]} 
//           />
//         ) : (
//           <TruckMap 
//             trucks={trucksList} 
//             routes={displayedRoutes}
//             onMapReady={(map) => setSharedMap(map)}
//           />
//         )}
//       </div>

//       <div style={{
//         display: 'flex',
//         gap: 24,
//         justifyContent: 'center',
//         padding: 12,
//         background: '#f8fafc',
//         borderRadius: 8,
//         marginTop: 12,
//         flexWrap: 'wrap',
//         fontSize: 13,
//       }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#166534', display: 'inline-block' }}></span>
//           <span>ЛХ (Луховицы)</span>
//         </div>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
//           <span>ЛЮ (Люберцы)</span>
//         </div>
//       </div>
//     </div>
//   );
// }









// // app/trucks/page.tsx
// 'use client';

// import { useState, useEffect, useRef, useMemo } from 'react';
// import { useRouter } from 'next/navigation';
// import TruckMap from '@/app/components/TruckMap';
// import SingleRouteMap from '@/app/components/SingleRouteMap';
// import LoadingSpinner from '@/app/components/LoadingSpinner';
// import { parseRussianDate } from '@/lib/utils';
// import { YandexMap } from '@/lib/yandex-maps-types';

// interface Truck {
//   uid: string;
//   name: string;
//   position: {
//     lat: number;
//     lng: number;
//     vel: number;
//     time: number;
//   } | null;
//   lastUpdate: string | null;
// }

// interface Route {
//   destination: string;
//   factory: string;
//   count: number;
//   requestNumber: string;
//   totalQuantity: number;
//   licensePlates: string[];
//   destCoords: { lat: number; lng: number; name: string } | null;
//   factoryCoords: { lat: number; lng: number; name: string } | null;
//   lastShipmentDate?: string | null;
// }

// export default function TrucksPage() {
//   const router = useRouter();
//   const [trucks, setTrucks] = useState<Truck[]>([]);
//   const [routes, setRoutes] = useState<Route[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [lastUpdate, setLastUpdate] = useState<string>('');
//   const [error, setError] = useState<string | null>(null);
//   const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
//   const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
//   const [showAllRoutes, setShowAllRoutes] = useState(true);
//   const [activeTab, setActiveTab] = useState<'all' | 'active'>('active');

//   const [sharedMap, setSharedMap] = useState<YandexMap | null>(null);


//   const intervalRef = useRef<NodeJS.Timeout | null>(null);
//   const isInitialized = useRef(false);

//   const loadData = async () => {
//     setLoading(true);
//     try {
//       setError(null);
//       const response = await fetch('/api/trucks');
      
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
      
//       const data = await response.json();
      
//       if (!data || typeof data !== 'object') {
//         throw new Error('Invalid response format');
//       }
      
//       if (data.success === false) {
//         throw new Error(data.error || 'Unknown API error');
//       }
      
//       if (Array.isArray(data.trucks)) {
//         setTrucks(data.trucks);
//         setLastUpdate(data.timestamp || new Date().toISOString());
//         setCurrentTime(Date.now());
        
//         if (data.routes && Array.isArray(data.routes)) {
//           setRoutes(data.routes);
//           console.log('🔵 Routes set:', data.routes.length);
//         }
//       } else {
//         throw new Error('Trucks data is not an array');
//       }
      
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : 'Unknown error';
//       console.error('Error fetching trucks:', err);
//       setError(errorMessage);
//       setTrucks([]);
//       setRoutes([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (!isInitialized.current) {
//       isInitialized.current = true;
//       loadData();
//     }
//   }, []);

//   useEffect(() => {
//     intervalRef.current = setInterval(loadData, 30000);
//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current);
//         intervalRef.current = null;
//       }
//     };
//   }, []);

//   useEffect(() => {
//     const timeInterval = setInterval(() => {
//       setCurrentTime(Date.now());
//     }, 30000);
//     return () => clearInterval(timeInterval);
//   }, []);

//   const handleRefresh = () => {
//     loadData();
//   };

//   const handleBack = () => {
//     if (selectedRoute) {
//       setSelectedRoute(null);
//       setShowAllRoutes(true);
//     } else {
//       router.back();
//     }
//   };

//   // const handleSelectRoute = (route: Route) => {
//   //   setSelectedRoute(route);
//   //   setShowAllRoutes(false);
//   // };



// const handleSelectRoute = (route: Route) => {
//   // Если уже выбран этот же маршрут — снимаем выбор
//   if (selectedRoute?.requestNumber === route.requestNumber) {
//     setSelectedRoute(null);
//     setShowAllRoutes(true);
//     return;
//   }
//   setSelectedRoute(route);
//   setShowAllRoutes(false);
// };


//   const handleShowAll = () => {
//     setSelectedRoute(null);
//     setShowAllRoutes(true);
//   };

//   const stats = useMemo(() => {
//     const trucksList = Array.isArray(trucks) ? trucks : [];
//     const now = currentTime;
    
//     const activeCount = trucksList.filter(t => t.position !== null).length;
    
//     const standingCount = trucksList.filter(t => {
//       if (!t.position) return false;
//       if (t.position.vel !== 0) return false;
//       const lastUpdateTime = new Date(t.lastUpdate || 0).getTime();
//       const minutesSinceUpdate = (now - lastUpdateTime) / 1000 / 60;
//       return minutesSinceUpdate > 30;
//     }).length;
    
//     const loadingCount = trucksList.filter(t => {
//       if (!t.position) return false;
//       if (t.position.vel !== 0) return false;
//       const lastUpdateTime = new Date(t.lastUpdate || 0).getTime();
//       const minutesSinceUpdate = (now - lastUpdateTime) / 1000 / 60;
//       return minutesSinceUpdate <= 30;
//     }).length;
    
//     const movingCount = trucksList.filter(t => t.position && t.position.vel > 0).length;
//     const offlineCount = trucksList.length - activeCount;

//     return {
//       trucksList,
//       activeCount,
//       standingCount,
//       loadingCount,
//       movingCount,
//       offlineCount,
//       total: trucksList.length,
//     };
//   }, [trucks, currentTime]);




// // 🔥 ФИЛЬТРУЕМ ТОЛЬКО ТАС (ЛХ, ЛЮ) И ТОЛЬКО АКТИВНЫЕ ОТГРУЗКИ (сегодня/вчера)
// const activeRoutes = useMemo(() => {
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
  
//   const yesterday = new Date(today);
//   yesterday.setDate(yesterday.getDate() - 1);
  
//   return routes.filter(route => {
//     // ✅ ТОЛЬКО ТАС (ЛХ, ЛЮ)
//     if (route.factory !== 'ЛХ' && route.factory !== 'ЛЮ') {
//       return false;
//     }
    
//     // Проверяем, есть ли у этого маршрута машины с позицией > 0
//     const hasMovingTrucks = route.licensePlates.some(plate => {
//       const normalizedPlate = plate
//         .toUpperCase()
//         .replace(/\s/g, '')
//         .replace(/[^A-Z0-9]/g, '');
//       const truck = trucks.find(t => {
//         const tName = t.name
//           .toUpperCase()
//           .replace(/\s/g, '')
//           .replace(/[^A-Z0-9]/g, '');
//         return tName === normalizedPlate && t.position && t.position.vel > 0;
//       });
//       return !!truck;
//     });
    
//     // Проверяем, есть ли отгрузки за сегодня или вчера
//     if (route.lastShipmentDate) {
//       const shipmentDate = parseRussianDate(route.lastShipmentDate);
//       shipmentDate.setHours(0, 0, 0, 0);
//       const isToday = shipmentDate.getTime() === today.getTime();
//       const isYesterday = shipmentDate.getTime() === yesterday.getTime();
//       return hasMovingTrucks && (isToday || isYesterday);
//     }
    
//     return hasMovingTrucks;
//   });
// }, [routes, trucks]);




















//   // Отображаемые маршруты (все или только активные)
//   const displayedRoutes = activeTab === 'active' ? activeRoutes : routes;

//   // Уникальные направления для фильтра
//   const uniqueDestinations = useMemo(() => {
//     const dests = new Set<string>();
//     displayedRoutes.forEach(r => {
//       if (r.destination) dests.add(r.destination);
//     });
//     return Array.from(dests).sort();
//   }, [displayedRoutes]);

//   const formattedLastUpdate = useMemo(() => {
//     if (!lastUpdate) return '...';
//     return new Date(lastUpdate).toLocaleTimeString();
//   }, [lastUpdate]);

//   if (error) {
//     return (
//       <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
//         <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
//         <h2 style={{ color: '#f87171', marginBottom: 8 }}>Ошибка загрузки данных</h2>
//         <p style={{ color: '#888', marginBottom: 16 }}>{error}</p>
//         <button
//           onClick={handleRefresh}
//           style={{
//             padding: '10px 24px',
//             borderRadius: 8,
//             border: 'none',
//             background: '#4a90d9',
//             color: '#fff',
//             cursor: 'pointer',
//             fontWeight: 500,
//           }}
//         >
//           🔄 Попробовать снова
//         </button>
//       </div>
//     );
//   }

//   const { 
//     trucksList, 
//     activeCount, 
//     standingCount, 
//     loadingCount, 
//     movingCount, 
//     offlineCount,
//     total 
//   } = stats;

//   return (
//     <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 16 }}>
//       <div style={{
//         display: 'flex',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         marginBottom: 12,
//         padding: '0 8px',
//         flexWrap: 'wrap',
//         gap: 8,
//       }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
//           <button
//             onClick={handleBack}
//             style={{
//               padding: '8px 16px',
//               borderRadius: 8,
//               border: 'none',
//               color: '#fff',
//               cursor: 'pointer',
//               fontWeight: 500,
//               display: 'flex',
//               alignItems: 'center',
//               gap: 6,
//               background: '#333',
//             }}
//             onMouseEnter={(e) => e.currentTarget.style.background = '#555'}
//             onMouseLeave={(e) => e.currentTarget.style.background = '#333'}
//           >
//             ← Назад
//           </button>
//           <div>
//             <h1 style={{ margin: 0, fontSize: 24 }}>
//               {selectedRoute ? `🎯 ${selectedRoute.destination}` : '🚛 GPS-мониторинг'}
//             </h1>
//             <div style={{ fontSize: 14, color: '#666' }}>
//               {selectedRoute 
//     ? `${selectedRoute.count} машин, ${Number(selectedRoute.totalQuantity).toFixed(1)} т · обновлено: ${formattedLastUpdate}`
//     : `${activeCount} из ${total} машин активно · обновлено: ${formattedLastUpdate}`
//   }
//             </div>
//           </div>
//         </div>
//         <button
//           onClick={handleRefresh}
//           style={{
//             padding: '8px 20px',
//             borderRadius: 8,
//             border: 'none',
//             background: '#4a90d9',
//             color: '#fff',
//             cursor: 'pointer',
//             fontWeight: 500,
//           }}
//         >
//           🔄 Обновить
//         </button>
//       </div>

//       {/* Вкладки: Все маршруты / Активные отгрузки */}
//       {!selectedRoute && (
//         <div style={{
//           display: 'flex',
//           gap: 4,
//           padding: '4px 12px',
//           background: '#f1f5f9',
//           borderRadius: 10,
//           marginBottom: 12,
//           width: 'fit-content',
//         }}>
//           <button
//             onClick={() => setActiveTab('all')}
//             style={{
//               padding: '6px 16px',
//               borderRadius: 8,
//               border: 'none',
//               background: activeTab === 'all' ? '#fff' : 'transparent',
//               color: activeTab === 'all' ? '#1a1a2e' : '#888',
//               cursor: 'pointer',
//               fontWeight: 500,
//               fontSize: 13,
//               boxShadow: activeTab === 'all' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
//               transition: 'all 0.2s',
//             }}
//           >
//             📋 Все маршруты ({routes.length})
//           </button>
//           <button
//             onClick={() => setActiveTab('active')}
//             style={{
//               padding: '6px 16px',
//               borderRadius: 8,
//               border: 'none',
//               background: activeTab === 'active' ? '#fff' : 'transparent',
//               color: activeTab === 'active' ? '#1a1a2e' : '#888',
//               cursor: 'pointer',
//               fontWeight: 500,
//               fontSize: 13,
//               boxShadow: activeTab === 'active' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
//               transition: 'all 0.2s',
//             }}
//           >
//             🟢 Активные отгрузки ({activeRoutes.length})
//           </button>
//         </div>
//       )}




// {activeTab === 'active' && uniqueDestinations.length > 0 && (
//   <div style={{
//     display: 'flex',
//     gap: 6,
//     padding: '8px 12px',
//     background: '#f8fafc',
//     borderRadius: 8,
//     marginBottom: 12,
//     flexWrap: 'wrap',
//     alignItems: 'center',
//     border: '1px solid #e2e8f0',
//   }}>
//     <span style={{ fontSize: 13, color: '#666', marginRight: 4, fontWeight: 600 }}>
//       🚛 Активные колонны (сегодня/вчера):
//     </span>
//     {uniqueDestinations.map((dest) => {
//       const route = displayedRoutes.find(r => r.destination === dest);
//       if (!route) return null;
      
//       // Определяем, выбран ли этот маршрут
//       const isSelected = selectedRoute?.requestNumber === route.requestNumber;
      
//       const factoryColor = route.factory === 'ЛХ' ? '#166534' : 
//                          route.factory === 'ЛЮ' ? '#3b82f6' :
//                          route.factory === 'СП' ? '#eab308' : '#ef4444';
//       return (
//         <button
//           key={dest}
//           onClick={() => {
//             if (isSelected) {
//               // Если уже выбран — снимаем выбор (показываем все)
//               handleShowAll();
//             } else {
//               handleSelectRoute(route);
//             }
//           }}
//           style={{
//             padding: '4px 14px',
//             borderRadius: 16,
//             border: `2px solid ${factoryColor}`,
//             background: isSelected ? factoryColor : '#fff',
//             color: isSelected ? '#fff' : '#1a1a2e',
//             cursor: 'pointer',
//             fontSize: 12,
//             fontWeight: 600,
//             whiteSpace: 'nowrap',
//             transition: 'all 0.2s',
//             display: 'flex',
//             alignItems: 'center',
//             gap: 6,
//           }}
//           onMouseEnter={(e) => {
//             if (!isSelected) {
//               e.currentTarget.style.background = factoryColor;
//               e.currentTarget.style.color = '#fff';
//             }
//           }}
//           onMouseLeave={(e) => {
//             if (!isSelected) {
//               e.currentTarget.style.background = '#fff';
//               e.currentTarget.style.color = '#1a1a2e';
//             }
//           }}
//         >
//           <span style={{ 
//             display: 'inline-block',
//             width: 10,
//             height: 10,
//             borderRadius: '50%',
//             background: factoryColor,
//           }}></span>
//           {dest.replace('ПК 25 ', '').replace('ПК 26 ', '').replace('АЙСБЕРГ ООО', 'АЙСБЕРГ')}
//           <span style={{ 
//             background: isSelected ? 'rgba(255,255,255,0.3)' : '#f1f5f9', 
//             padding: '0 6px', 
//             borderRadius: 10,
//             fontSize: 10,
//             fontWeight: 700,
//           }}>
//             {route.count}🚛
//           </span>
//           {isSelected && <span style={{ fontSize: 10 }}>✓</span>}
//         </button>
//       );
//     })}
//   </div>
// )}
















//       <div style={{
//         display: 'flex',
//         gap: 24,
//         padding: '6px 16px',
//         background: '#f8fafc',
//         borderRadius: 8,
//         marginBottom: 12,
//         flexWrap: 'wrap',
//         fontSize: 13,
//       }}>
//         <span>🚛 Всего: <strong>{total}</strong></span>
//         <span>🟢 В пути: <strong style={{ color: '#4ade80' }}>{movingCount}</strong></span>
//         <span>🟡 Загружаются: <strong style={{ color: '#facc15' }}>{loadingCount}</strong></span>
//         <span>🔴 Стоят: <strong style={{ color: '#f87171' }}>{standingCount}</strong></span>
//         <span>⚪ Офлайн: <strong style={{ color: '#9ca3af' }}>{offlineCount}</strong></span>
//         {selectedRoute && (
//           <span style={{ color: '#4a90d9', fontWeight: 600 }}>
//             🎯 {selectedRoute.destination}
//           </span>
//         )}
//         {activeTab === 'active' && !selectedRoute && (
//           <span style={{ color: '#22c55e', fontWeight: 600 }}>
//             🟢 Активных колонн: {uniqueDestinations.length}
//           </span>
//         )}
//       </div>







// <div style={{ flex: 1, minHeight: 500, borderRadius: 12, overflow: 'hidden' }}>
//   {loading ? (
//     <LoadingSpinner message="Загрузка данных о транспорте..." size="large" />
//   ) : selectedRoute ? (
//     // ✅ Используем TruckMap с одним маршрутом
//     <TruckMap 
//       key={selectedRoute.requestNumber} // ← форсируем перерисовку при смене маршрута
//       trucks={trucksList} 
//       routes={[selectedRoute]} 
//     />
//   ) : (
//     <TruckMap trucks={trucksList} routes={displayedRoutes} />
//   )}
// </div>





//       <div style={{
//         display: 'flex',
//         gap: 24,
//         justifyContent: 'center',
//         padding: 12,
//         background: '#f8fafc',
//         borderRadius: 8,
//         marginTop: 12,
//         flexWrap: 'wrap',
//         fontSize: 13,
//       }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#166534', display: 'inline-block' }}></span>
//           <span>ЛХ (Луховицы)</span>
//         </div>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
//           <span>ЛЮ (Люберцы)</span>
//         </div>
//         {/* <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#eab308', display: 'inline-block' }}></span>
//           <span>СП (Сергиев Посад)</span>
//         </div>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
//           <span>Щ (Щёлково)</span>
//         </div> */}
//       </div>
//     </div>
//   );
// }


