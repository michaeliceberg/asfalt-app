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

