// app/demo/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import CompactView from '@/app/components/CompactView';
import ListView from '@/app/components/ListView';
import ChartsView from '@/app/components/ChartsView';
import TopCustomersView from '@/app/components/TopCustomersView';
import Header from '@/app/components/header';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import MainTabs from '@/app/components/MainTabs';
import ViewTabs from '@/app/components/ViewTabs';
import FactoryFilter from '@/app/components/FactoryFilter';
import DemoLanding from '@/app/components/DemoLanding'; // ← Новый компонент
import { IncomingItem, ShipmentItem } from '@/app/page';
import { getFactoryName, isConcreteMaterial, isSpecialMaterial } from '@/lib/utils';
import { getDemoData } from '@/lib/demo-data';

type MainTab = 'incoming' | 'shipment' | 'shipmentConcrete';
type ViewTab = 'compact' | 'list' | 'charts' | 'topCustomers';

type UnifiedDataItem = IncomingItem | ShipmentItem;

export default function DemoPage() {
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('shipment');
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('compact');
  const [activeFactory, setActiveFactory] = useState<string>('all');
  const [data, setData] = useState<{ incoming: IncomingItem[]; shipments: ShipmentItem[] }>({
    incoming: [],
    shipments: [],
  });

  useEffect(() => {
    const loadDemoData = async () => {
      try {
        const [incomingRes, shipmentsRes] = await Promise.all([
          fetch('/api/incoming?demo=true'),
          fetch('/api/shipments?demo=true'),
        ]);
        
        let incoming = await incomingRes.json();
        let shipments = await shipmentsRes.json();
        
        if (!Array.isArray(incoming) || incoming.length === 0) {
          console.log('🔄 Используем встроенные демо-данные для поступлений');
          const demo = getDemoData();
          incoming = demo.incoming;
        }
        
        if (!Array.isArray(shipments) || shipments.length === 0) {
          console.log('🔄 Используем встроенные демо-данные для отгрузок');
          const demo = getDemoData();
          shipments = demo.shipments;
        }
        
        setData({
          incoming: Array.isArray(incoming) ? incoming : [],
          shipments: Array.isArray(shipments) ? shipments : [],
        });
      } catch (err) {
        console.error('Error loading demo data from API, using fallback:', err);
        const demo = getDemoData();
        setData({
          incoming: demo.incoming,
          shipments: demo.shipments,
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadDemoData();
  }, []);

  const getFilteredData = (): UnifiedDataItem[] => {
    let filtered: UnifiedDataItem[] = [];
    
    if (activeMainTab === 'incoming') {
      filtered = data.incoming;
    } else if (activeMainTab === 'shipment') {
      filtered = data.shipments.filter(item => 
        !isConcreteMaterial(item.material) && !isSpecialMaterial(item.material)
      );
    } else if (activeMainTab === 'shipmentConcrete') {
      filtered = data.shipments.filter(item => 
        isConcreteMaterial(item.material)
      );
    }
    
    if (activeFactory !== 'all') {
      filtered = filtered.filter(item => 
        item.division === activeFactory
      );
    }
    
    return filtered;
  };

  if (loading) {
    return <LoadingSpinner message="Загрузка демо-данных..." size="large" fullScreen />;
  }

  const filteredData = getFilteredData();
  const factories = ['ДЕМО-СП', 'ДЕМО-Щ'];
  const totalIncoming = data.incoming.length;
  const totalShipments = data.shipments.length;

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      {/* ← УБИРАЕМ DemoBanner, СТАВИМ DemoLanding */}
      <DemoLanding />

      <div className="header">
        <Header 
          refreshing={false} 
          onRefresh={() => {
            setLoading(true);
            const demo = getDemoData();
            setData({
              incoming: demo.incoming,
              shipments: demo.shipments,
            });
            setLoading(false);
          }}
          isDemoMode={true}
          hideLogout={true}
        />

        <MainTabs 
          activeTab={activeMainTab} 
          onTabChange={(tab) => setActiveMainTab(tab as MainTab)}
          futureRequestsCount={0}
          newShipmentsCount={0}
          newConcreteCount={0}
          showConcreteTab={true}
        />

        <div className="sync-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="sync-label">🏷️ Завод:</span>
          <span className="sync-time" style={{ color: '#ffd93d' }}>🏭 АБЗ-ДЕМО (СП / Щ)</span>
          <span style={{ fontSize: '12px', color: '#aaa' }}>
            📊 {totalIncoming + totalShipments} записей
          </span>
        </div>

        <FactoryFilter 
          factories={factories} 
          activeFactory={activeFactory} 
          onFactoryChange={setActiveFactory} 
        />

        <ViewTabs 
          activeTab={activeViewTab} 
          onTabChange={(tab) => setActiveViewTab(tab as ViewTab)} 
        />

        <div className="stats">
          Показано: <strong>{filteredData.length}</strong> записей
          {activeFactory !== 'all' && ` (${getFactoryName(activeFactory)})`}
        </div>
      </div>

      <motion.div
        key={`${activeViewTab}-${activeMainTab}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {filteredData.length === 0 ? (
          <div className="empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '18px', color: '#888' }}>📭 Нет данных для отображения</p>
            <p style={{ fontSize: '14px', color: '#aaa' }}>
              Попробуйте переключить вкладку
            </p>
          </div>
        ) : (
          <>
            {activeViewTab === 'compact' && (
              <CompactView 
                data={filteredData}
                mainTab={activeMainTab}
                outgoingRequests={[]}
                allShipments={data.shipments}
                allShipmentsForChart={data.shipments}
                selectedFactory={activeFactory}
                mode="iceberg"
              />
            )}

            {activeViewTab === 'list' && (
              <ListView 
                data={filteredData}
                mainTab={activeMainTab}
              />
            )}

            {activeViewTab === 'charts' && (
              <ChartsView 
                data={data.shipments} 
                mode="iceberg"
              />
            )}

            {activeViewTab === 'topCustomers' && (
              <TopCustomersView 
                data={data.shipments} 
                mode="iceberg"
              />
            )}
          </>
        )}
      </motion.div>

      {/* ← УБИРАЕМ нижний баннер, так как DemoLanding уже есть сверху */}
    </div>
  );
}



// // app/demo/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import Link from 'next/link'; // ← Добавляем импорт Link
// import { motion } from 'framer-motion';
// import CompactView from '@/app/components/CompactView';
// import ListView from '@/app/components/ListView';
// import ChartsView from '@/app/components/ChartsView';
// import TopCustomersView from '@/app/components/TopCustomersView';
// import Header from '@/app/components/header';
// import LoadingSpinner from '@/app/components/LoadingSpinner';
// import MainTabs from '@/app/components/MainTabs';
// import ViewTabs from '@/app/components/ViewTabs';
// import FactoryFilter from '@/app/components/FactoryFilter';
// // import DemoBanner from '@/app/components/DemoBanner';
// import { IncomingItem, ShipmentItem } from '@/app/page';
// import { getFactoryName, isConcreteMaterial, isSpecialMaterial } from '@/lib/utils';
// import { getDemoData } from '@/lib/demo-data';
// import DemoBanner from '../components/DemoBanner';

// type MainTab = 'incoming' | 'shipment' | 'shipmentConcrete';
// type ViewTab = 'compact' | 'list' | 'charts' | 'topCustomers';

// type UnifiedDataItem = IncomingItem | ShipmentItem;

// export default function DemoPage() {
//   const [loading, setLoading] = useState(true);
//   const [activeMainTab, setActiveMainTab] = useState<MainTab>('shipment');
//   const [activeViewTab, setActiveViewTab] = useState<ViewTab>('compact');
//   const [activeFactory, setActiveFactory] = useState<string>('all');
//   const [data, setData] = useState<{ incoming: IncomingItem[]; shipments: ShipmentItem[] }>({
//     incoming: [],
//     shipments: [],
//   });

//   useEffect(() => {
//     const loadDemoData = async () => {
//       try {
//         const [incomingRes, shipmentsRes] = await Promise.all([
//           fetch('/api/incoming?demo=true'),
//           fetch('/api/shipments?demo=true'),
//         ]);
        
//         let incoming = await incomingRes.json();
//         let shipments = await shipmentsRes.json();
        
//         if (!Array.isArray(incoming) || incoming.length === 0) {
//           console.log('🔄 Используем встроенные демо-данные для поступлений');
//           const demo = getDemoData();
//           incoming = demo.incoming;
//         }
        
//         if (!Array.isArray(shipments) || shipments.length === 0) {
//           console.log('🔄 Используем встроенные демо-данные для отгрузок');
//           const demo = getDemoData();
//           shipments = demo.shipments;
//         }
        
//         setData({
//           incoming: Array.isArray(incoming) ? incoming : [],
//           shipments: Array.isArray(shipments) ? shipments : [],
//         });
//       } catch (err) {
//         console.error('Error loading demo data from API, using fallback:', err);
//         const demo = getDemoData();
//         setData({
//           incoming: demo.incoming,
//           shipments: demo.shipments,
//         });
//       } finally {
//         setLoading(false);
//       }
//     };
    
//     loadDemoData();
//   }, []);

//   const getFilteredData = (): UnifiedDataItem[] => {
//     let filtered: UnifiedDataItem[] = [];
    
//     if (activeMainTab === 'incoming') {
//       filtered = data.incoming;
//     } else if (activeMainTab === 'shipment') {
//       filtered = data.shipments.filter(item => 
//         !isConcreteMaterial(item.material) && !isSpecialMaterial(item.material)
//       );
//     } else if (activeMainTab === 'shipmentConcrete') {
//       filtered = data.shipments.filter(item => 
//         isConcreteMaterial(item.material)
//       );
//     }
    
//     if (activeFactory !== 'all') {
//       filtered = filtered.filter(item => 
//         item.division === activeFactory
//       );
//     }
    
//     return filtered;
//   };

//   if (loading) {
//     return <LoadingSpinner message="Загрузка демо-данных..." size="large" fullScreen />;
//   }

//   const filteredData = getFilteredData();
//   const factories = ['ДЕМО-СП', 'ДЕМО-Щ'];
//   const totalIncoming = data.incoming.length;
//   const totalShipments = data.shipments.length;

//   return (
//     <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
//       <DemoBanner 
//         totalRecords={totalIncoming + totalShipments}
//         activeTab={activeMainTab}
//         companyName="АБЗ-ДЕМО"
//       />

//       <div className="header">
//         <Header 
//           refreshing={false} 
//           onRefresh={() => {
//             setLoading(true);
//             const demo = getDemoData();
//             setData({
//               incoming: demo.incoming,
//               shipments: demo.shipments,
//             });
//             setLoading(false);
//           }}
//           isDemoMode={true}
//           hideLogout={true}
//         />

//         <MainTabs 
//           activeTab={activeMainTab} 
//           onTabChange={(tab) => setActiveMainTab(tab as MainTab)}
//           futureRequestsCount={0}
//           newShipmentsCount={0}
//           newConcreteCount={0}
//           showConcreteTab={true}
//         />

//         <div className="sync-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//           <span className="sync-label">🏷️ Завод:</span>
//           <span className="sync-time" style={{ color: '#ffd93d' }}>🏭 АБЗ-ДЕМО (СП / Щ)</span>
//           <span style={{ fontSize: '12px', color: '#aaa' }}>
//             📊 {totalIncoming + totalShipments} записей
//           </span>
//         </div>

//         <FactoryFilter 
//           factories={factories} 
//           activeFactory={activeFactory} 
//           onFactoryChange={setActiveFactory} 
//         />

//         <ViewTabs 
//           activeTab={activeViewTab} 
//           onTabChange={(tab) => setActiveViewTab(tab as ViewTab)} 
//         />

//         <div className="stats">
//           Показано: <strong>{filteredData.length}</strong> записей
//           {activeFactory !== 'all' && ` (${getFactoryName(activeFactory)})`}
//         </div>
//       </div>

//       <motion.div
//         key={`${activeViewTab}-${activeMainTab}`}
//         initial={{ opacity: 0, y: 10 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.3 }}
//       >
//         {filteredData.length === 0 ? (
//           <div className="empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
//             <p style={{ fontSize: '18px', color: '#888' }}>📭 Нет данных для отображения</p>
//             <p style={{ fontSize: '14px', color: '#aaa' }}>
//               Попробуйте переключить вкладку
//             </p>
//           </div>
//         ) : (
//           <>
//             {activeViewTab === 'compact' && (
//               <CompactView 
//                 data={filteredData}
//                 mainTab={activeMainTab}
//                 outgoingRequests={[]}
//                 allShipments={data.shipments}
//                 allShipmentsForChart={data.shipments}
//                 selectedFactory={activeFactory}
//                 mode="iceberg"
//               />
//             )}

//             {activeViewTab === 'list' && (
//               <ListView 
//                 data={filteredData}
//                 mainTab={activeMainTab}
//               />
//             )}

//             {activeViewTab === 'charts' && (
//               <ChartsView 
//                 data={data.shipments} 
//                 mode="iceberg"
//               />
//             )}

//             {activeViewTab === 'topCustomers' && (
//               <TopCustomersView 
//                 data={data.shipments} 
//                 mode="iceberg"
//               />
//             )}
//           </>
//         )}
//       </motion.div>

//       {/* Нижний баннер с призывом */}
//       <div style={{ 
//         marginTop: 40, 
//         padding: '20px 24px', 
//         background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
//         borderRadius: 16,
//         textAlign: 'center',
//         border: '1px solid #333'
//       }}>
//         <p style={{ color: '#fff', fontSize: '16px', marginBottom: 8 }}>
//           🚀 <strong>Хотите такое же приложение для своего завода?</strong>
//         </p>
//         <p style={{ color: '#aaa', fontSize: '14px' }}>
//           📊 Контроль отгрузок и поступлений в реальном времени
//         </p>
//         <div style={{ marginTop: 12, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
//           <a 
//             href="mailto:your-email@example.com?subject=Запрос%20на%20внедрение%20АБЗ%20Контроль"
//             style={{ 
//               padding: '10px 28px', 
//               borderRadius: 8, 
//               background: '#ffd93d', 
//               color: '#1a1a2e', 
//               textDecoration: 'none',
//               fontWeight: 'bold',
//             }}
//           >
//             📧 Связаться с нами
//           </a>
//           {/* ← Заменяем <a> на <Link> */}
//           <Link 
//             href="/"
//             style={{ 
//               padding: '10px 28px', 
//               borderRadius: 8, 
//               background: 'transparent', 
//               color: '#fff', 
//               textDecoration: 'none',
//               border: '1px solid #555',
//               display: 'inline-block',
//             }}
//           >
//             🔐 Войти в систему
//           </Link>
//         </div>
//       </div>
//     </div>
//   );
// }




// // app/demo/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import { motion } from 'framer-motion';
// import CompactView from '@/app/components/CompactView';
// import ListView from '@/app/components/ListView';
// import ChartsView from '@/app/components/ChartsView';
// import TopCustomersView from '@/app/components/TopCustomersView';
// import Header from '@/app/components/header';
// import LoadingSpinner from '@/app/components/LoadingSpinner';
// import MainTabs from '@/app/components/MainTabs';
// import ViewTabs from '@/app/components/ViewTabs';
// import FactoryFilter from '@/app/components/FactoryFilter';
// import { IncomingItem, ShipmentItem } from '@/app/page';
// import { getFactoryName, isConcreteMaterial, isSpecialMaterial } from '@/lib/utils';

// type MainTab = 'incoming' | 'shipment' | 'shipmentConcrete';
// type ViewTab = 'compact' | 'list' | 'charts' | 'topCustomers';

// type UnifiedDataItem = IncomingItem | ShipmentItem;

// export default function DemoPage() {
//   const [loading, setLoading] = useState(true);
//   const [activeMainTab, setActiveMainTab] = useState<MainTab>('incoming');
//   const [activeViewTab, setActiveViewTab] = useState<ViewTab>('compact');
//   const [activeFactory, setActiveFactory] = useState<string>('all');
//   const [data, setData] = useState<{ incoming: IncomingItem[]; shipments: ShipmentItem[] }>({
//     incoming: [],
//     shipments: [],
//   });

//   useEffect(() => {
//     const loadDemoData = async () => {
//       try {
//         const [incomingRes, shipmentsRes] = await Promise.all([
//           fetch('/api/incoming?demo=true'),
//           fetch('/api/shipments?demo=true'),
//         ]);
        
//         const incoming = await incomingRes.json();
//         const shipments = await shipmentsRes.json();
        
//         setData({
//           incoming: Array.isArray(incoming) ? incoming : [],
//           shipments: Array.isArray(shipments) ? shipments : [],
//         });
//       } catch (err) {
//         console.error('Error loading demo data:', err);
//       } finally {
//         setLoading(false);
//       }
//     };
    
//     loadDemoData();
//   }, []);

//   // Фильтруем данные в зависимости от вкладки
//   const getFilteredData = (): UnifiedDataItem[] => {
//     let filtered: UnifiedDataItem[] = [];
    
//     if (activeMainTab === 'incoming') {
//       filtered = data.incoming;
//     } else if (activeMainTab === 'shipment') {
//       filtered = data.shipments.filter(item => 
//         !isConcreteMaterial(item.material) && !isSpecialMaterial(item.material)
//       );
//     } else if (activeMainTab === 'shipmentConcrete') {
//       filtered = data.shipments.filter(item => 
//         isConcreteMaterial(item.material)
//       );
//     }
    
//     // Фильтр по заводу (в демо только ДЕМО)
//     if (activeFactory !== 'all') {
//       filtered = filtered.filter(item => 
//         item.division === activeFactory
//       );
//     }
    
//     return filtered;
//   };

//   if (loading) {
//     return <LoadingSpinner message="Загрузка демо-данных..." size="large" fullScreen />;
//   }

//   const filteredData = getFilteredData();
//   const factories = ['ДЕМО']; // только демо

//   return (
//     <div className="container" style={{ paddingTop: 16 }}>
//       {/* ===== ВСЁ ВНУТРИ СИНЕГО ХЕДЕРА ===== */}
//       <div className="header">
//         {/* Шапка с логотипом и кнопками */}
//         <Header 
//           refreshing={false} 
//           onRefresh={() => {}}
//           isDemoMode={true}
//           hideLogout={true}
//         />

//         {/* ❌ ModeSwitch УБРАН — в демо не нужен */}

//         {/* Вкладки (Поступление, Отгрузка Асф, Отгрузка Бет, На будущее) */}
//         <MainTabs 
//           activeTab={activeMainTab} 
//           onTabChange={(tab) => setActiveMainTab(tab as MainTab)}
//           futureRequestsCount={0}
//           newShipmentsCount={0}
//           newConcreteCount={0}
//           showConcreteTab={true}
//         />

//         {/* Информация о синхронизации (для демо — всегда "Демо-режим") */}
//         <div className="sync-info">
//           <span className="sync-label">🔄 Режим:</span>
//           <span className="sync-time" style={{ color: '#ffd93d' }}>🎯 ДЕМО</span>
//         </div>

//         {/* Фильтр заводов (только ДЕМО) */}
//         <FactoryFilter 
//           factories={factories} 
//           activeFactory={activeFactory} 
//           onFactoryChange={setActiveFactory} 
//         />

//         {/* Вкладки просмотра (Компактно, Список, Графики, Топ-10) */}
//         <ViewTabs 
//           activeTab={activeViewTab} 
//           onTabChange={(tab) => setActiveViewTab(tab as ViewTab)} 
//         />

//         {/* Счётчик записей */}
//         <div className="stats">
//           Всего записей: <strong>{filteredData.length}</strong>
//           {activeFactory !== 'all' && ` (${getFactoryName(activeFactory)})`}
//         </div>
//       </div>
//       {/* ===== КОНЕЦ СИНЕГО ХЕДЕРА ===== */}

//       {/* Контент в зависимости от вкладки (БЕЛЫЙ ФОН) */}
//       <motion.div
//         key={activeViewTab}
//         initial={{ opacity: 0, x: -20 }}
//         animate={{ opacity: 1, x: 0 }}
//         transition={{ duration: 0.2 }}
//       >
//         {activeViewTab === 'compact' && (
//           <CompactView 
//             data={filteredData}
//             mainTab={activeMainTab}
//             outgoingRequests={[]}
//             allShipments={data.shipments}
//             allShipmentsForChart={data.shipments}
//             selectedFactory={activeFactory}
//             mode="tas"
//           />
//         )}

//         {activeViewTab === 'list' && (
//           <ListView 
//             data={filteredData}
//             mainTab={activeMainTab}
//           />
//         )}

//         {activeViewTab === 'charts' && (
//           <ChartsView 
//             data={data.shipments} 
//             mode="tas" 
//           />
//         )}

//         {activeViewTab === 'topCustomers' && (
//           <TopCustomersView 
//             data={data.shipments} 
//             mode="tas" 
//           />
//         )}
//       </motion.div>
//     </div>
//   );
// }




// // app/demo/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import CompactView from '@/app/components/CompactView';
// import Header from '@/app/components/header';
// import LoadingSpinner from '@/app/components/LoadingSpinner';
// import { IncomingItem, ShipmentItem } from '@/app/page';

// export default function DemoPage() {
//   const [loading, setLoading] = useState(true);
//   const [data, setData] = useState<{ incoming: IncomingItem[]; shipments: ShipmentItem[] }>({
//     incoming: [],
//     shipments: [],
//   });

//   useEffect(() => {
//     const loadDemoData = async () => {
//       try {
//         // ⚠️ ВАЖНО: API должны быть публичными для демо
//         // Нужно убрать проверку авторизации в /api/incoming и /api/shipments
//         // или добавить параметр ?demo=true
//         const [incomingRes, shipmentsRes] = await Promise.all([
//           fetch('/api/incoming'),
//           fetch('/api/shipments'),
//         ]);
        
//         const incoming = await incomingRes.json();
//         const shipments = await shipmentsRes.json();
        
//         setData({
//           incoming: incoming.filter((item: IncomingItem) => item.division === 'ДЕМО'),
//           shipments: shipments.filter((item: ShipmentItem) => item.division === 'ДЕМО'),
//         });
//       } catch (err) {
//         console.error('Error loading demo data:', err);
//       } finally {
//         setLoading(false);
//       }
//     };
    
//     loadDemoData();
//   }, []);

//   if (loading) {
//     return <LoadingSpinner message="Загрузка демо-данных..." size="large" fullScreen />;
//   }

//   return (
//     <div className="container">
//       <Header 
//         refreshing={false} 
//         onRefresh={() => {}}
//         isDemoMode={true}
//       />
      
//       <div className="stats" style={{ marginBottom: 16 }}>
//         🎯 ДЕМО-ВЕРСИЯ · Данные для ознакомления
//       </div>
      
//       <CompactView 
//         data={data.incoming}
//         mainTab="incoming"
//         allShipments={data.shipments}
//         allShipmentsForChart={data.shipments}
//         mode="tas"
//       />
//     </div>
//   );
// }