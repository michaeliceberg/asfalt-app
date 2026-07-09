// app/trucks/page.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TruckMap from '@/app/components/TruckMap';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { parseRussianDate } from '@/lib/utils';
import { YandexMap } from '@/lib/yandex-maps-types';
import { AlertTriangle, RefreshCw, ArrowLeft, Target, Truck as TruckIcon, Clock, Check } from 'lucide-react';

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
  truckTimes?: Record<string, string>;
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
  const [sharedMap, setSharedMap] = useState<YandexMap | null>(null);

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









  // // Интервал обновления — 60 секунд
  // useEffect(() => {
  //   let isActive = true;
  //   let intervalId: NodeJS.Timeout | null = null;
    
  //   const startInterval = () => {
  //     if (intervalId) {
  //       clearInterval(intervalId);
  //     }
      
  //     intervalId = setInterval(() => {
  //       if (isActive && document.visibilityState === 'visible') {
  //         console.log('🔄 Auto-refresh (60s)');
  //         loadData();
  //       }
  //     }, 60000);
  //   };
    
  //   startInterval();
    
  //   const handleVisibilityChange = () => {
  //     isActive = document.visibilityState === 'visible';
  //     if (isActive) {
  //       console.log('📱 Page became visible, refreshing...');
  //       loadData();
  //     }
  //   };
    
  //   document.addEventListener('visibilitychange', handleVisibilityChange);
    
  //   intervalRef.current = intervalId;
    
  //   return () => {
  //     if (intervalId) {
  //       clearInterval(intervalId);
  //     }
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //   };
  // }, []);

// app/trucks/page.tsx

// Интервал обновления — 120 секунд (2 минуты)
useEffect(() => {
  let isActive = true;
  let intervalId: NodeJS.Timeout | null = null;
  
  const startInterval = () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    intervalId = setInterval(() => {
      if (isActive && document.visibilityState === 'visible') {
        console.log('🔄 Auto-refresh (2 min)');
        loadData();
      }
    }, 120000); // ← 120 секунд = 2 минуты
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
    }, 60000);
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

  // ✅ АКТИВНЫЕ ОТГРУЗКИ ТАС (ЛХ, ЛЮ) — ТОЛЬКО СЕГОДНЯ
  const activeRoutes = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    
    return routes.filter(route => {
      if (route.factory !== 'ЛХ' && route.factory !== 'ЛЮ') {
        return false;
      }
      
      if (!route.lastShipmentDate) {
        return false;
      }
      
      const shipmentDate = parseRussianDate(route.lastShipmentDate);
      shipmentDate.setHours(0, 0, 0, 0);
      
      return shipmentDate.getTime() === today.getTime();
    });
  }, [routes]);

  // Сортируем по дате последней отгрузки (новые сверху)
  const displayedRoutes = useMemo(() => {
    return [...activeRoutes].sort((a, b) => {
      const dateA = a.lastShipmentDate ? parseRussianDate(a.lastShipmentDate) : new Date(0);
      const dateB = b.lastShipmentDate ? parseRussianDate(b.lastShipmentDate) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [activeRoutes]);

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

  // Функция для центрирования карты на машине
  const handleTruckClick = (plate: string, mapInstance: YandexMap | null) => {
    if (!mapInstance) return;
    
    const normalizedPlate = plate
      .toUpperCase()
      .replace(/\s/g, '')
      .replace(/[^A-Z0-9]/g, '');
    
    const truck = trucks.find(t => {
      const tName = t.name
        .toUpperCase()
        .replace(/\s/g, '')
        .replace(/[^A-Z0-9]/g, '');
      return tName === normalizedPlate && t.position;
    });
    
    if (truck?.position) {
      mapInstance.setCenter([truck.position.lat, truck.position.lng], 15);
    }
  };

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><AlertTriangle size={44} strokeWidth={2} color="#f87171" /></div>
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
          <RefreshCw size={14} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />Попробовать снова
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
            <ArrowLeft size={14} strokeWidth={2.2} style={{ marginRight: 4, verticalAlign: -2 }} />Назад
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedRoute ? <><Target size={20} strokeWidth={2.2} />{selectedRoute.destination}</> : <><TruckIcon size={20} strokeWidth={2.2} />GPS-мониторинг ТАС</>}
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
          <RefreshCw size={14} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />Обновить
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
          <span style={{ fontSize: 13, color: '#666', marginRight: 4, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <TruckIcon size={13} strokeWidth={2.2} />Активные колонны (сегодня):
          </span>
          {uniqueDestinations.map((dest) => {
            const route = displayedRoutes.find(r => r.destination === dest);
            if (!route) return null;
            
            const isSelected = selectedRoute?.requestNumber === route.requestNumber;
            
            const factoryColor = route.factory === 'ЛХ' ? '#166534' : 
                               route.factory === 'ЛЮ' ? '#1d4ed8' :
                               route.factory === 'СП' ? '#ca8a04' : '#b91c1c';
            
            const lastTime = route.lastShipmentDate 
              ? new Date(route.lastShipmentDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
              : '';
            
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                }}>
                  {route.count}<TruckIcon size={10} strokeWidth={2.4} />
                </span>
                {lastTime && (
                  <span style={{ 
                    fontSize: 9, 
                    color: isSelected ? 'rgba(255,255,255,0.7)' : '#888',
                    marginLeft: 2,
                  }}>
                    {lastTime}
                  </span>
                )}
                {isSelected && <Check size={11} strokeWidth={2.6} />}
              </button>
            );
          })}
        </div>
      )}

      {/* Список машин выбранной колонны или общая статистика */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 16px',
        background: '#f8fafc',
        borderRadius: 8,
        marginBottom: 12,
      }}>
        {selectedRoute ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <TruckIcon size={13} strokeWidth={2.2} />{selectedRoute.destination.replace('ПК 25 ', '').replace('ПК 26 ', '')}
              </span>
              <span style={{ fontSize: 12, color: '#666' }}>
                {selectedRoute.count} машин · {Number(selectedRoute.totalQuantity).toFixed(1)} т
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 2,
              maxHeight: 200,
              overflow: 'auto',
            }}>
              {[...selectedRoute.licensePlates].sort((a, b) => {
                const normalizedA = a.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
                const normalizedB = b.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
                const timeA = selectedRoute.truckTimes?.[normalizedA] || '';
                const timeB = selectedRoute.truckTimes?.[normalizedB] || '';
                return timeB.localeCompare(timeA);
              }).map((plate, idx) => {
                const normalizedPlate = plate
                  .toUpperCase()
                  .replace(/\s/g, '')
                  .replace(/[^A-Z0-9]/g, '');
                
                let dateTime = '—';
                let hasPosition = false;
                
                if (selectedRoute.truckTimes && selectedRoute.truckTimes[normalizedPlate]) {
                  const date = new Date(selectedRoute.truckTimes[normalizedPlate]);
                  dateTime = date.toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  hasPosition = true;
                } else {
                  const truck = trucksList.find(t => {
                    const tName = t.name
                      .toUpperCase()
                      .replace(/\s/g, '')
                      .replace(/[^A-Z0-9]/g, '');
                    return tName === normalizedPlate;
                  });
                  if (truck?.lastUpdate) {
                    const date = new Date(truck.lastUpdate);
                    dateTime = date.toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  }
                  hasPosition = truck?.position !== null && truck?.position !== undefined;
                }
                
                const color = hasPosition ? '#4ade80' : '#f87171';
                
                return (
                  <div 
                    key={idx} 
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                      fontSize: 12,
                      borderBottom: idx < selectedRoute.licensePlates.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => handleTruckClick(plate, sharedMap)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ 
                        display: 'inline-block',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: color,
                      }}></span>
                      <span style={{ color: '#1a1a2e', fontWeight: 500 }}>{plate}</span>
                    </div>
                    <span style={{ color: '#888', fontSize: 11, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} strokeWidth={2.2} />{dateTime}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><TruckIcon size={13} strokeWidth={2.2} />Всего: <strong>{total}</strong></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />В пути: <strong style={{ color: '#4ade80' }}>{movingCount}</strong></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#facc15', display: 'inline-block' }} />Загружаются: <strong style={{ color: '#facc15' }}>{loadingCount}</strong></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', display: 'inline-block' }} />Стоят: <strong style={{ color: '#f87171' }}>{standingCount}</strong></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }} />Офлайн: <strong style={{ color: '#9ca3af' }}>{offlineCount}</strong></span>
            <span style={{ color: '#22c55e', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />Активных колонн: {uniqueDestinations.length}
            </span>
          </div>
        )}
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
            filterPlate={selectedRoute.licensePlates[0] || null}
            onMapReady={(map) => setSharedMap(map)}
          />
        ) : (
          <TruckMap 
            trucks={trucksList} 
            routes={displayedRoutes}
            filterPlate={null}
            onMapReady={(map) => setSharedMap(map)}
          />
        )}
      </div>

      {/* Легенда */}
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
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#1d4ed8', display: 'inline-block' }}></span>
          <span>ЛЮ (Люберцы)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#ca8a04', display: 'inline-block' }}></span>
          <span>СП (Сергиев Посад)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#b91c1c', display: 'inline-block' }}></span>
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
// import { parseRussianDate } from '@/lib/utils';

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
//   truckTimes?: Record<string, string>; // ✅ Добавляем
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
//       }, 60000);
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
//     } else {
//       router.back();
//     }
//   };

//   const handleSelectRoute = (route: Route) => {
//     if (selectedRoute?.requestNumber === route.requestNumber) {
//       setSelectedRoute(null);
//       return;
//     }
//     setSelectedRoute(route);
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










//   // // ✅ ТОЛЬКО АКТИВНЫЕ ОТГРУЗКИ ТАС (ЛХ, ЛЮ) — сегодня/вчера
//   // const displayedRoutes = useMemo(() => {
//   //   const today = new Date();
//   //   today.setHours(0, 0, 0, 0);
    
//   //   const yesterday = new Date(today);
//   //   yesterday.setDate(yesterday.getDate() - 1);
    
//   //   return routes.filter(route => {
//   //     // Только ТАС (ЛХ, ЛЮ)
//   //     if (route.factory !== 'ЛХ' && route.factory !== 'ЛЮ') {
//   //       return false;
//   //     }
      
//   //     // Проверяем, есть ли у этого маршрута машины с позицией > 0
//   //     const hasMovingTrucks = route.licensePlates.some(plate => {
//   //       const normalizedPlate = plate
//   //         .toUpperCase()
//   //         .replace(/\s/g, '')
//   //         .replace(/[^A-Z0-9]/g, '');
//   //       const truck = trucks.find(t => {
//   //         const tName = t.name
//   //           .toUpperCase()
//   //           .replace(/\s/g, '')
//   //           .replace(/[^A-Z0-9]/g, '');
//   //         return tName === normalizedPlate && t.position && t.position.vel > 0;
//   //       });
//   //       return !!truck;
//   //     });
      
//   //     // Проверяем, есть ли отгрузки за сегодня или вчера
//   //     if (route.lastShipmentDate) {
//   //       const shipmentDate = parseRussianDate(route.lastShipmentDate);
//   //       shipmentDate.setHours(0, 0, 0, 0);
//   //       const isToday = shipmentDate.getTime() === today.getTime();
//   //       const isYesterday = shipmentDate.getTime() === yesterday.getTime();
//   //       return hasMovingTrucks && (isToday || isYesterday);
//   //     }
      
//   //     return hasMovingTrucks;
//   //   });
//   // }, [routes, trucks]);





// // const activeRoutes = useMemo(() => {
// //   const now = new Date();
// //   const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
// //   return routes.filter(route => {
// //     // Только ТАС (ЛХ, ЛЮ)
// //     if (route.factory !== 'ЛХ' && route.factory !== 'ЛЮ') {
// //       return false;
// //     }
    
// //     // Проверяем, есть ли отгрузки за последние 24 часа
// //     if (!route.lastShipmentDate) {
// //       return false;
// //     }
    
// //     const shipmentDate = parseRussianDate(route.lastShipmentDate);
// //     return shipmentDate >= twentyFourHoursAgo;
// //   });
// // }, [routes]);

// // // Сортируем по дате последней отгрузки (новые сверху)
// // const displayedRoutes = useMemo(() => {
// //   return [...activeRoutes].sort((a, b) => {
// //     const dateA = a.lastShipmentDate ? parseRussianDate(a.lastShipmentDate) : new Date(0);
// //     const dateB = b.lastShipmentDate ? parseRussianDate(b.lastShipmentDate) : new Date(0);
// //     return dateB.getTime() - dateA.getTime();
// //   });
// // }, [activeRoutes]);

// // app/trucks/page.tsx

// // ✅ АКТИВНЫЕ ОТГРУЗКИ ТАС (ЛХ, ЛЮ) — ТОЛЬКО СЕГОДНЯ
// const activeRoutes = useMemo(() => {
//   const now = new Date();
//   const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   today.setHours(0, 0, 0, 0);
  
//   return routes.filter(route => {
//     // Только ТАС (ЛХ, ЛЮ)
//     if (route.factory !== 'ЛХ' && route.factory !== 'ЛЮ') {
//       return false;
//     }
    
//     // Проверяем, есть ли отгрузки
//     if (!route.lastShipmentDate) {
//       return false;
//     }
    
//     const shipmentDate = parseRussianDate(route.lastShipmentDate);
//     shipmentDate.setHours(0, 0, 0, 0);
    
//     // Только сегодняшние отгрузки
//     return shipmentDate.getTime() === today.getTime();
//   });
// }, [routes]);

// // Сортируем по дате последней отгрузки (новые сверху)
// const displayedRoutes = useMemo(() => {
//   return [...activeRoutes].sort((a, b) => {
//     const dateA = a.lastShipmentDate ? parseRussianDate(a.lastShipmentDate) : new Date(0);
//     const dateB = b.lastShipmentDate ? parseRussianDate(b.lastShipmentDate) : new Date(0);
//     return dateB.getTime() - dateA.getTime();
//   });
// }, [activeRoutes]);


















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
//         <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><AlertTriangle size={44} strokeWidth={2} color="#f87171" /></div>
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
//           <RefreshCw size={14} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />Попробовать снова
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
//   <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 16 }}>
//     <div style={{
//       display: 'flex',
//       justifyContent: 'space-between',
//       alignItems: 'center',
//       marginBottom: 12,
//       padding: '0 8px',
//       flexWrap: 'wrap',
//       gap: 8,
//     }}>
//       <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
//         <button
//           onClick={handleBack}
//           style={{
//             padding: '8px 16px',
//             borderRadius: 8,
//             border: 'none',
//             color: '#fff',
//             cursor: 'pointer',
//             fontWeight: 500,
//             display: 'flex',
//             alignItems: 'center',
//             gap: 6,
//             background: '#333',
//           }}
//           onMouseEnter={(e) => e.currentTarget.style.background = '#555'}
//           onMouseLeave={(e) => e.currentTarget.style.background = '#333'}
//         >
//           ← Назад
//         </button>
//         <div>
//           <h1 style={{ margin: 0, fontSize: 24 }}>
//             {selectedRoute ? `🎯 ${selectedRoute.destination}` : '🚛 GPS-мониторинг ТАС'}
//           </h1>
//           <div style={{ fontSize: 14, color: '#666' }}>
//             {selectedRoute 
//               ? `${selectedRoute.count} машин, ${Number(selectedRoute.totalQuantity).toFixed(1)} т · обновлено: ${formattedLastUpdate}`
//               : `${uniqueDestinations.length} активных колонн · обновлено: ${formattedLastUpdate}`
//             }
//           </div>
//         </div>
//       </div>
//       <button
//         onClick={handleRefresh}
//         style={{
//           padding: '8px 20px',
//           borderRadius: 8,
//           border: 'none',
//           background: '#4a90d9',
//           color: '#fff',
//           cursor: 'pointer',
//           fontWeight: 500,
//         }}
//       >
//         🔄 Обновить
//       </button>
//     </div>

//     {/* Фильтр по направлениям */}
//     {uniqueDestinations.length > 0 && (
//       <div style={{
//         display: 'flex',
//         gap: 6,
//         padding: '8px 12px',
//         background: '#f8fafc',
//         borderRadius: 8,
//         marginBottom: 12,
//         flexWrap: 'wrap',
//         alignItems: 'center',
//         border: '1px solid #e2e8f0',
//       }}>
//         <span style={{ fontSize: 13, color: '#666', marginRight: 4, fontWeight: 600 }}>
//           🚛 Активные колонны (сегодня/вчера):
//         </span>
//         {uniqueDestinations.map((dest) => {
//           const route = displayedRoutes.find(r => r.destination === dest);
//           if (!route) return null;
          
//           const isSelected = selectedRoute?.requestNumber === route.requestNumber;
          
//           const factoryColor = route.factory === 'ЛХ' ? '#166534' : 
//                              route.factory === 'ЛЮ' ? '#3b82f6' :
//                              route.factory === 'СП' ? '#eab308' : '#ef4444';



//   // ✅ Форматируем время последней отгрузки
//   const lastTime = route.lastShipmentDate 
//     ? new Date(route.lastShipmentDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
//     : '';



//           return (
//             <button
//               key={dest}
//               onClick={() => handleSelectRoute(route)}
//               style={{
//                 padding: '4px 14px',
//                 borderRadius: 16,
//                 border: `2px solid ${factoryColor}`,
//                 background: isSelected ? factoryColor : '#fff',
//                 color: isSelected ? '#fff' : '#1a1a2e',
//                 cursor: 'pointer',
//                 fontSize: 12,
//                 fontWeight: 600,
//                 whiteSpace: 'nowrap',
//                 transition: 'all 0.2s',
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: 6,
//               }}
//               onMouseEnter={(e) => {
//                 if (!isSelected) {
//                   e.currentTarget.style.background = factoryColor;
//                   e.currentTarget.style.color = '#fff';
//                 }
//               }}
//               onMouseLeave={(e) => {
//                 if (!isSelected) {
//                   e.currentTarget.style.background = '#fff';
//                   e.currentTarget.style.color = '#1a1a2e';
//                 }
//               }}
//             >
//               <span style={{ 
//                 display: 'inline-block',
//                 width: 10,
//                 height: 10,
//                 borderRadius: '50%',
//                 background: factoryColor,
//               }}></span>
//               {dest.replace('ПК 25 ', '').replace('ПК 26 ', '').replace('АЙСБЕРГ ООО', 'АЙСБЕРГ')}
//               <span style={{ 
//                 background: isSelected ? 'rgba(255,255,255,0.3)' : '#f1f5f9', 
//                 padding: '0 6px', 
//                 borderRadius: 10,
//                 fontSize: 10,
//                 fontWeight: 700,
//               }}>
//                 {route.count}🚛
//               </span>
//               {isSelected && <span style={{ fontSize: 10 }}>✓</span>}
//             </button>
//           );
//         })}
//       </div>
//     )}

    
    
    
    
    
    
    
    

// {/*     
//     <div style={{
//       display: 'flex',
//       gap: 24,
//       padding: '6px 16px',
//       background: '#f8fafc',
//       borderRadius: 8,
//       marginBottom: 12,
//       flexWrap: 'wrap',
//       fontSize: 13,
//     }}>
//       <span>🚛 Всего: <strong>{total}</strong></span>
//       <span>🟢 В пути: <strong style={{ color: '#4ade80' }}>{movingCount}</strong></span>
//       <span>🟡 Загружаются: <strong style={{ color: '#facc15' }}>{loadingCount}</strong></span>
//       <span>🔴 Стоят: <strong style={{ color: '#f87171' }}>{standingCount}</strong></span>
//       <span>⚪ Офлайн: <strong style={{ color: '#9ca3af' }}>{offlineCount}</strong></span>
//       {selectedRoute && (
//         <span style={{ color: '#4a90d9', fontWeight: 600 }}>
//           🎯 {selectedRoute.destination}
//         </span>
//       )}
//       <span style={{ color: '#22c55e', fontWeight: 600 }}>
//         🟢 Активных колонн: {uniqueDestinations.length}
//       </span>
//     </div> */}



// <div style={{
//   display: 'flex',
//   flexDirection: 'column',
//   gap: 4,
//   padding: '8px 16px',
//   background: '#f8fafc',
//   borderRadius: 8,
//   marginBottom: 12,
// }}>
//   {selectedRoute ? (
//     <>
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
//         <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
//           🚛 {selectedRoute.destination.replace('ПК 25 ', '').replace('ПК 26 ', '')}
//         </span>
//         <span style={{ fontSize: 12, color: '#666' }}>
//           {selectedRoute.count} машин · {Number(selectedRoute.totalQuantity).toFixed(1)} т
//         </span>
//       </div>
//       <div style={{ 
//         display: 'flex', 
//         flexDirection: 'column', 
//         gap: 2,
//         maxHeight: 200,
//         overflow: 'auto',
//       }}>



//         {/* {selectedRoute.licensePlates.map((plate, idx) => {
//           const normalizedPlate = plate
//             .toUpperCase()
//             .replace(/\s/g, '')
//             .replace(/[^A-Z0-9]/g, '');
//           const truck = trucks.find(t => {
//             const tName = t.name
//               .toUpperCase()
//               .replace(/\s/g, '')
//               .replace(/[^A-Z0-9]/g, '');
//             return tName === normalizedPlate;
//           });
          
//           let dateTime = '—';
//           if (truck?.lastUpdate) {
//             const date = new Date(truck.lastUpdate);
//             dateTime = date.toLocaleString('ru-RU', {
//               day: '2-digit',
//               month: '2-digit',
//               hour: '2-digit',
//               minute: '2-digit'
//             });
//           } */}
          
//           {/* {selectedRoute.licensePlates.map((plate, idx) => {
//   const normalizedPlate = plate
//     .toUpperCase()
//     .replace(/\s/g, '')
//     .replace(/[^A-Z0-9]/g, '');
  
//   // ✅ Берём время отгрузки из truckTimes
//   let dateTime = '—';
//   if (selectedRoute.truckTimes && selectedRoute.truckTimes[normalizedPlate]) {
//     const date = new Date(selectedRoute.truckTimes[normalizedPlate]);
//     dateTime = date.toLocaleString('ru-RU', {
//       day: '2-digit',
//       month: '2-digit',
//       hour: '2-digit',
//       minute: '2-digit'
//     });
//   } else {
//     // Fallback: время из GPS (если нет данных отгрузки)
//     const truck = trucks.find(t => {
//       const tName = t.name
//         .toUpperCase()
//         .replace(/\s/g, '')
//         .replace(/[^A-Z0-9]/g, '');
//       return tName === normalizedPlate;
//     });
//     if (truck?.lastUpdate) {
//       const date = new Date(truck.lastUpdate);
//       dateTime = date.toLocaleString('ru-RU', {
//         day: '2-digit',
//         month: '2-digit',
//         hour: '2-digit',
//         minute: '2-digit'
//       });
//     }
//   }
  

//           const hasPosition = truck?.position !== null;
//           const color = hasPosition ? '#4ade80' : '#f87171';
          
//           return (
//             <div key={idx} style={{
//               display: 'flex',
//               justifyContent: 'space-between',
//               alignItems: 'center',
//               padding: '3px 8px',
//               borderRadius: 4,
//               background: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
//               fontSize: 12,
//               borderBottom: idx < selectedRoute.licensePlates.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
//             }}>
//               <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//                 <span style={{ 
//                   display: 'inline-block',
//                   width: 6,
//                   height: 6,
//                   borderRadius: '50%',
//                   background: color,
//                 }}></span>
//                 <span style={{ color: '#1a1a2e', fontWeight: 500 }}>{plate}</span>
//               </div>
//               <span style={{ color: '#888', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
//                 🕐 {dateTime}
//               </span>
//             </div>
//           );
//         })}
//  */}


// {selectedRoute.licensePlates.map((plate, idx) => {
//   const normalizedPlate = plate
//     .toUpperCase()
//     .replace(/\s/g, '')
//     .replace(/[^A-Z0-9]/g, '');
  
//   // ✅ Берём время отгрузки из truckTimes
//   let dateTime = '—';
//   let hasPosition = false;
  
//   if (selectedRoute.truckTimes && selectedRoute.truckTimes[normalizedPlate]) {
//     const date = new Date(selectedRoute.truckTimes[normalizedPlate]);
//     dateTime = date.toLocaleString('ru-RU', {
//       day: '2-digit',
//       month: '2-digit',
//       hour: '2-digit',
//       minute: '2-digit'
//     });
//     // Если есть время отгрузки, считаем что машина была в пути
//     hasPosition = true;
//   } else {
//     // Fallback: время из GPS (если нет данных отгрузки)
//     const truck = trucks.find(t => {
//       const tName = t.name
//         .toUpperCase()
//         .replace(/\s/g, '')
//         .replace(/[^A-Z0-9]/g, '');
//       return tName === normalizedPlate;
//     });
//     if (truck?.lastUpdate) {
//       const date = new Date(truck.lastUpdate);
//       dateTime = date.toLocaleString('ru-RU', {
//         day: '2-digit',
//         month: '2-digit',
//         hour: '2-digit',
//         minute: '2-digit'
//       });
//     }
//     hasPosition = truck?.position !== null && truck?.position !== undefined;
//   }
  
//   const color = hasPosition ? '#4ade80' : '#f87171';
  
//   return (
//     <div key={idx} style={{
//       display: 'flex',
//       justifyContent: 'space-between',
//       alignItems: 'center',
//       padding: '3px 8px',
//       borderRadius: 4,
//       background: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
//       fontSize: 12,
//       borderBottom: idx < selectedRoute.licensePlates.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
//     }}>
//       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//         <span style={{ 
//           display: 'inline-block',
//           width: 6,
//           height: 6,
//           borderRadius: '50%',
//           background: color,
//         }}></span>
//         <span style={{ color: '#1a1a2e', fontWeight: 500 }}>{plate}</span>
//       </div>
//       <span style={{ color: '#888', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
//         🕐 {dateTime}
//       </span>
//     </div>
//   );
// })}






//       </div>
//     </>
//   ) : (
//     <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
//       <span>🚛 Всего: <strong>{total}</strong></span>
//       <span>🟢 В пути: <strong style={{ color: '#4ade80' }}>{movingCount}</strong></span>
//       <span>🟡 Загружаются: <strong style={{ color: '#facc15' }}>{loadingCount}</strong></span>
//       <span>🔴 Стоят: <strong style={{ color: '#f87171' }}>{standingCount}</strong></span>
//       <span>⚪ Офлайн: <strong style={{ color: '#9ca3af' }}>{offlineCount}</strong></span>
//     </div>
//   )}
// </div>









//     {/* Карта */}
//     <div style={{ flex: 1, minHeight: 500, borderRadius: 12, overflow: 'hidden' }}>
//       {loading ? (
//         <LoadingSpinner message="Загрузка данных о транспорте..." size="large" />
//       ) : selectedRoute ? (
//         <TruckMap 
//           key={selectedRoute.requestNumber}
//           trucks={trucksList} 
//           routes={[selectedRoute]} 
//         />
//       ) : (
//         <TruckMap trucks={trucksList} routes={displayedRoutes} />
//       )}
//     </div>

//     <div style={{
//       display: 'flex',
//       gap: 24,
//       justifyContent: 'center',
//       padding: 12,
//       background: '#f8fafc',
//       borderRadius: 8,
//       marginTop: 12,
//       flexWrap: 'wrap',
//       fontSize: 13,
//     }}>
//       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//         <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#166534', display: 'inline-block' }}></span>
//         <span>ЛХ (Луховицы)</span>
//       </div>
//       <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//         <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
//         <span>ЛЮ (Люберцы)</span>
//       </div>
//     </div>
//   </div>
// );
// }

