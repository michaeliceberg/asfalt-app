// app/trucks/page.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TruckMap from '@/app/components/TruckMap';
import SingleRouteMap from '@/app/components/SingleRouteMap';
import LoadingSpinner from '@/app/components/LoadingSpinner';

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
  destCoords: { lat: number; lng: number } | null;
  factoryCoords: { lat: number; lng: number } | null;
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
  const [showAllRoutes, setShowAllRoutes] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active'>('active'); // ← НОВОЕ

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);

  const loadData = async () => {
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
          const validRoutes = data.routes.filter((r: Route) => r.destCoords && r.factoryCoords);
          setRoutes(validRoutes);
          console.log('🔵 Routes with coords:', validRoutes.length);
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

  useEffect(() => {
    intervalRef.current = setInterval(loadData, 30000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(timeInterval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    loadData();
  };

  const handleBack = () => {
    if (selectedRoute) {
      setSelectedRoute(null);
      setShowAllRoutes(true);
    } else {
      router.back();
    }
  };

  const handleSelectRoute = (route: Route) => {
    setSelectedRoute(route);
    setShowAllRoutes(false);
  };

  const handleShowAll = () => {
    setSelectedRoute(null);
    setShowAllRoutes(true);
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

  const formattedLastUpdate = useMemo(() => {
    if (!lastUpdate) return '...';
    return new Date(lastUpdate).toLocaleTimeString();
  }, [lastUpdate]);

  // 🔥 ФИЛЬТРУЕМ ТОЛЬКО АКТИВНЫЕ ОТГРУЗКИ (где есть машины в пути)
  const activeRoutes = useMemo(() => {
    return routes.filter(route => {
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
      return hasMovingTrucks;
    });
  }, [routes, trucks]);

  // Отображаемые маршруты (все или только активные)
  const displayedRoutes = activeTab === 'active' ? activeRoutes : routes;

  // Уникальные направления для фильтра
  const uniqueDestinations = useMemo(() => {
    const dests = new Set<string>();
    displayedRoutes.forEach(r => {
      if (r.destination) dests.add(r.destination);
    });
    return Array.from(dests).sort();
  }, [displayedRoutes]);

  if (loading) {
    return <LoadingSpinner message="Загрузка данных о транспорте..." size="large" fullScreen />;
  }

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
              {selectedRoute ? `🎯 ${selectedRoute.destination}` : '🚛 GPS-мониторинг'}
            </h1>
            <div style={{ fontSize: 14, color: '#666' }}>
              {selectedRoute 
                ? `${selectedRoute.count} машин, ${selectedRoute.totalQuantity} т · обновлено: ${formattedLastUpdate}`
                : `${activeCount} из ${total} машин активно · обновлено: ${formattedLastUpdate}`
              }
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedRoute && (
            <button
              onClick={handleShowAll}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: '1px solid #4a90d9',
                background: 'transparent',
                color: '#4a90d9',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              📋 Все маршруты
            </button>
          )}
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
      </div>

      {/* 🔥 ВКЛАДКИ: Все маршруты / Активные отгрузки */}
      {!selectedRoute && (
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '4px 12px',
          background: '#f1f5f9',
          borderRadius: 10,
          marginBottom: 12,
          width: 'fit-content',
        }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'all' ? '#fff' : 'transparent',
              color: activeTab === 'all' ? '#1a1a2e' : '#888',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              boxShadow: activeTab === 'all' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            📋 Все маршруты ({routes.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'active' ? '#fff' : 'transparent',
              color: activeTab === 'active' ? '#1a1a2e' : '#888',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              boxShadow: activeTab === 'active' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            🟢 Активные отгрузки ({activeRoutes.length})
          </button>
        </div>
      )}

      {/* 🔥 ФИЛЬТР ПО НАПРАВЛЕНИЯМ (только для активных) */}
      {!selectedRoute && activeTab === 'active' && uniqueDestinations.length > 0 && (
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
            🚛 Активные колонны:
          </span>
          {uniqueDestinations.map((dest) => {
            const route = displayedRoutes.find(r => r.destination === dest);
            if (!route) return null;
            // Определяем цвет в зависимости от завода
            const factoryColor = route.factory === 'ЛХ' ? '#22c55e' : 
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
                  background: '#fff',
                  color: '#1a1a2e',
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
                  e.currentTarget.style.background = factoryColor;
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.color = '#1a1a2e';
                }}
              >
                <span style={{ 
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: factoryColor,
                }}></span>
                {dest.replace('ПК 25 ', '').replace('ПК 26 ', '')}
                <span style={{ 
                  background: '#f1f5f9', 
                  padding: '0 6px', 
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                }}>
                  {route.count}🚛
                </span>
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
        {activeTab === 'active' && !selectedRoute && (
          <span style={{ color: '#22c55e', fontWeight: 600 }}>
            🟢 Активных колонн: {uniqueDestinations.length}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 500, borderRadius: 12, overflow: 'hidden' }}>
        {selectedRoute ? (
          <SingleRouteMap requestNumber={selectedRoute.requestNumber} />
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
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
          <span>ЛХ (Луховицы)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
          <span>ЛЮ (Люберцы)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#eab308', display: 'inline-block' }}></span>
          <span>СП (Сергиев Посад)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
          <span>Щ (Щёлково)</span>
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
// import LoadingSpinner from '@/app/components/LoadingSpinner';

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
//   destCoords: { lat: number; lng: number } | null;
//   factoryCoords: { lat: number; lng: number } | null;
// }

// export default function TrucksPage() {
//   const router = useRouter();
//   const [trucks, setTrucks] = useState<Truck[]>([]);
//   const [routes, setRoutes] = useState<Route[]>([]); // ← Добавлено
//   const [loading, setLoading] = useState(true);
//   const [lastUpdate, setLastUpdate] = useState<string>('');
//   const [error, setError] = useState<string | null>(null);
//   const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

//   const intervalRef = useRef<NodeJS.Timeout | null>(null);
//   const isInitialized = useRef(false);

//   const loadData = async () => {
//     try {
//       setError(null);
//       const response = await fetch('/api/trucks');
      
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
      
//       const data = await response.json();
      
//       console.log('🔵 API response keys:', Object.keys(data));
//       console.log('🔵 Has routes?', !!data.routes);
//       console.log('🔵 Routes count:', data.routes?.length);
      
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
        
//         // ✅ Сохраняем маршруты
//         if (data.routes && Array.isArray(data.routes)) {
//           setRoutes(data.routes);
//           console.log('🔵 Routes set:', data.routes.length);
//         } else {
//           console.log('🔵 No routes in response');
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

//   // Загрузка при монтировании
//   useEffect(() => {
//     if (!isInitialized.current) {
//       isInitialized.current = true;
//       loadData();
//     }
//   }, []);

//   // Настройка интервала обновления данных
//   useEffect(() => {
//     intervalRef.current = setInterval(loadData, 30000);

//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current);
//         intervalRef.current = null;
//       }
//     };
//   }, []);

//   // Обновляем текущее время каждые 30 секунд
//   useEffect(() => {
//     const timeInterval = setInterval(() => {
//       setCurrentTime(Date.now());
//     }, 30000);

//     return () => clearInterval(timeInterval);
//   }, []);

//   const handleRefresh = () => {
//     setLoading(true);
//     loadData();
//   };

//   const handleBack = () => {
//     router.back();
//   };

//   // Вычисляем статистику
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

//   // Форматируем время последнего обновления
//   const formattedLastUpdate = useMemo(() => {
//     if (!lastUpdate) return '...';
//     return new Date(lastUpdate).toLocaleTimeString();
//   }, [lastUpdate]);

//   if (loading) {
//     return <LoadingSpinner message="Загрузка данных о транспорте..." size="large" fullScreen />;
//   }

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
//         marginBottom: 16,
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
//             <h1 style={{ margin: 0, fontSize: 24 }}>🚛 GPS-мониторинг</h1>
//             <div style={{ fontSize: 14, color: '#666' }}>
//               {activeCount} из {total} машин активно · 
//               обновлено: {formattedLastUpdate}
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

//       <div style={{
//         display: 'flex',
//         gap: 24,
//         padding: '8px 16px',
//         background: '#f8fafc',
//         borderRadius: 8,
//         marginBottom: 12,
//         flexWrap: 'wrap',
//       }}>
//         <span>🚛 Всего: <strong>{total}</strong></span>
//         <span>🟢 В пути: <strong style={{ color: '#4ade80' }}>{movingCount}</strong></span>
//         <span>🟡 Загружаются: <strong style={{ color: '#facc15' }}>{loadingCount}</strong></span>
//         <span>🔴 Стоят: <strong style={{ color: '#f87171' }}>{standingCount}</strong></span>
//         <span>⚪ Офлайн: <strong style={{ color: '#9ca3af' }}>{offlineCount}</strong></span>
//       </div>

//       <div style={{ flex: 1, minHeight: 500, borderRadius: 12, overflow: 'hidden' }}>
//         <TruckMap trucks={trucksList} routes={routes} /> {/* ← Передаём routes */}
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
//       }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#f87171', display: 'inline-block' }}></span>
//           <span style={{ fontSize: 13 }}>Стоит (0 км/ч, &gt;30 мин)</span>
//         </div>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#facc15', display: 'inline-block' }}></span>
//           <span style={{ fontSize: 13 }}>Загружается (0 км/ч, &lt;30 мин)</span>
//         </div>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
//           <span style={{ fontSize: 13 }}>Едет (20-50 км/ч)</span>
//         </div>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }}></span>
//           <span style={{ fontSize: 13 }}>Быстро (&gt;50 км/ч)</span>
//         </div>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//           <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }}></span>
//           <span style={{ fontSize: 13 }}>Офлайн (нет данных)</span>
//         </div>
//       </div>
//     </div>
//   );
// }
