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
import SummaryView from '@/app/components/SummaryView';
import { IncomingItem, ShipmentItem } from '@/app/page';
import { getFactoryName, isConcreteMaterial, isSpecialMaterial } from '@/lib/utils';
import { getDemoData, demoRequests, demoFutureRequests } from '@/lib/demo-data';
import { Tag, Factory, BarChart3, Inbox } from 'lucide-react';

type MainTab = 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary';
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
    // ⚠️ Раньше здесь ходили в /api/incoming?demo=true и /api/shipments?demo=true —
    // они читают строки с division='ДЕМО' из БОЕВОЙ базы напрямую, в обход
    // анонимизации из lib/demo-data.ts. Это утекало реальные отгрузки
    // (настоящие грузополучатели, номера) в публичное демо без авторизации.
    // Демо теперь ВСЕГДА использует только синтетические данные ниже.
    const demo = getDemoData();
    setData({
      incoming: demo.incoming,
      shipments: demo.shipments,
    });
    setLoading(false);
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
  const factories = ['ДЕМО-СЕВ', 'ДЕМО-ЮГ'];
  const totalIncoming = data.incoming.length;
  const totalShipments = data.shipments.length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureRequestsCount = demoFutureRequests.filter((req) => {
    if (req.closed) return false;
    if (!req.delivery_date) return false;
    const deliveryDate = new Date(req.delivery_date);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate >= today;
  }).length;

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

        <div className="sync-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="sync-label"><Tag size={12} strokeWidth={2.2} style={{ marginRight: 3, verticalAlign: -2 }} />Завод:</span>
          <span className="sync-time" style={{ color: '#ffd93d', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Factory size={13} strokeWidth={2.2} />АБЗ-ДЕМО («Северный» / «Южный»)
          </span>
          <span style={{ fontSize: '12px', color: '#aaa', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <BarChart3 size={12} strokeWidth={2.2} />{totalIncoming + totalShipments} записей
          </span>
        </div>

        <MainTabs
          activeTab={activeMainTab}
          onTabChange={(tab) => setActiveMainTab(tab as MainTab)}
          futureRequestsCount={futureRequestsCount}
          newShipmentsCount={0}
          newConcreteCount={0}
          showConcreteTab={true}
        />

        {activeMainTab !== 'summary' && (
          <>
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
          </>
        )}
      </div>

      {activeMainTab === 'summary' ? (
        <SummaryView
          mode="iceberg"
          demoRequests={demoFutureRequests.map((r) => ({
            number: r.number,
            date: r.date,
            division: r.division,
            customer: r.customer,
            consignee: r.consignee || r.customer,
            material: r.material,
            quantity: r.quantity,
            delivery_date: r.delivery_date || '',
            clientRequestNumber: r.clientRequestNumber || '',
            clientRequestDate: r.clientRequestDate || '',
            closed: r.closed || false,
          }))}
        />
      ) : (
      <motion.div
        key={`${activeViewTab}-${activeMainTab}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {filteredData.length === 0 ? (
          <div className="empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '18px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Inbox size={18} strokeWidth={2.2} />Нет данных для отображения
            </p>
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
                outgoingRequests={demoRequests.map((r) => ({
                  number: r.number,
                  date: r.date,
                  division: r.division,
                  quantity: r.quantity,
                  consignee: r.consignee || r.customer,
                  material: r.material,
                  closed: r.closed,
                }))}
                allShipments={data.shipments}
                allShipmentsForChart={data.shipments}
                selectedFactory={activeFactory}
                mode="iceberg"
                demoMode
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
      )}

      {/* ← УБИРАЕМ нижний баннер, так как DemoLanding уже есть сверху */}
    </div>
  );
}

