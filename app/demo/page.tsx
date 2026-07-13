// app/demo/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import CompactView from '@/app/components/CompactView';
import ListView from '@/app/components/ListView';
import ChartsView from '@/app/components/ChartsView';
import Header from '@/app/components/header';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import MainTabs from '@/app/components/MainTabs';
import ViewTabs from '@/app/components/ViewTabs';
import FactoryFilter from '@/app/components/FactoryFilter';
import DemoLanding from '@/app/components/DemoLanding'; // ← Новый компонент
import PricingSection from '@/app/components/PricingSection';
import SummaryView from '@/app/components/SummaryView';
import OnboardingTour from '@/app/components/OnboardingTour';
import DemoPushSimulator from '@/app/components/DemoPushSimulator';
import DemoTruckColonna from '@/app/components/DemoTruckColonna';
import { IncomingItem, ShipmentItem } from '@/app/page';
import { getFactoryName, isConcreteMaterial, isSpecialMaterial } from '@/lib/utils';
import { getDemoData, demoRequests, demoFutureRequests } from '@/lib/demo-data';
import { Inbox } from 'lucide-react';

type MainTab = 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary';
type ViewTab = 'compact' | 'list' | 'charts' | 'gps';

type UnifiedDataItem = IncomingItem | ShipmentItem;

export default function DemoPage() {
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('shipment');
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('compact');
  const [activeFactory, setActiveFactory] = useState<string>('all');
  const [pushHighlight, setPushHighlight] = useState(false);
  // Колокольчик в шапке — вкл/выкл демо push-уведомлений (фидбек дизайнера:
  // если пушей будет "овер до фига", хочется иметь возможность их выключить).
  const [pushEnabled, setPushEnabled] = useState(true);
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
      <OnboardingTour highlightPushTrigger={pushHighlight} />
      <DemoPushSimulator onFirstShown={() => setPushHighlight(true)} enabled={pushEnabled} />

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
          demoPushEnabled={pushEnabled}
          onToggleDemoPush={() => setPushEnabled((v) => !v)}
        />

        <MainTabs
          activeTab={activeMainTab}
          onTabChange={(tab) => {
            const nextTab = tab as MainTab;
            setActiveMainTab(nextTab);
            // "Графики"/"GPS" скрыты для "Поступления" — если
            // была активна одна из них, возвращаемся на "Компактно",
            // иначе останется выбрана вкладка, которой не видно кнопки.
            if (nextTab === 'incoming' && (activeViewTab === 'charts' || activeViewTab === 'gps')) {
              setActiveViewTab('compact');
            }
          }}
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
              showGps
              hideAnalytics={activeMainTab === 'incoming'}
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
        {activeViewTab === 'gps' ? (
          <DemoTruckColonna />
        ) : filteredData.length === 0 ? (
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
                onShowOnMap={() => {
                  // В демо всего одна синтетическая колонна — фильтровать
                  // по госномеру не нужно, просто открываем вкладку GPS.
                  setActiveMainTab('shipment');
                  setActiveViewTab('gps');
                }}
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

          </>
        )}
      </motion.div>
      )}

      {/* ← УБИРАЕМ нижний баннер, так как DemoLanding уже есть сверху */}

      {/* Раньше тут была разделительная плашка "Демо-данные закончились" —
          но прямо под ней лежит кнопка "скачать Excel-отчёт" по этим же
          демо-данным, и получалось противоречиво: "данные закончились" →
          "скачайте отчёт по данным". Просто убрали плашку — у самого
          PricingSection достаточно собственного отступа и заголовка
          "Тарифы", чтобы граница секции читалась и без неё. */}

      <PricingSection incoming={data.incoming} shipments={data.shipments} />
    </div>
  );
}

