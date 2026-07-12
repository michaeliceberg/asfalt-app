// components/ViewTabs.tsx
'use client';

import { LayoutGrid, List, BarChart2, Trophy, Satellite } from 'lucide-react';
import { tapHaptic } from '@/lib/haptics';

type ViewTab = 'compact' | 'grouped' | 'list' | 'charts' | 'topCustomers' | 'gps';

interface ViewTabsProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  // Вкладка "GPS" — только там, где явно попросили её показать (сейчас
  // только /demo, для витрины PRO-фичи "GPS-навигация"). В боевом
  // приложении GPS живёт на отдельной странице /trucks, вкладку сюда
  // не добавляем, чтобы не менять привычный UI без явного запроса.
  showGps?: boolean;
  // "Графики"/"Топ-10"/"GPS" не имеют смысла для вкладки "Поступление" —
  // это аналитика по отгрузкам грузополучателям, к приходу сырья от
  // поставщиков отношения не имеет.
  hideAnalytics?: boolean;
}

export default function ViewTabs({ activeTab, onTabChange, showGps = false, hideAnalytics = false }: ViewTabsProps) {
  const handleChange = (tab: ViewTab) => {
    tapHaptic();
    onTabChange(tab);
  };

  return (
    <div id="onboarding-view-tabs" className="tabs">
      <button
        className={`tab ${activeTab === 'compact' ? 'active' : ''}`}
        onClick={() => handleChange('compact')}
      >
        <LayoutGrid size={15} strokeWidth={2.2} /> Компактно
      </button>

      <button
        className={`tab ${activeTab === 'list' ? 'active' : ''}`}
        onClick={() => handleChange('list')}
      >
        <List size={15} strokeWidth={2.2} /> Список
      </button>

      {!hideAnalytics && (
        <button
          className={`tab ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => handleChange('charts')}
        >
          <BarChart2 size={15} strokeWidth={2.2} /> Графики
        </button>
      )}

      {!hideAnalytics && (
        <button
          className={`tab ${activeTab === 'topCustomers' ? 'active' : ''}`}
          onClick={() => handleChange('topCustomers')}
        >
          <Trophy size={15} strokeWidth={2.2} /> Топ-10
        </button>
      )}

      {showGps && !hideAnalytics && (
        <button
          className={`tab ${activeTab === 'gps' ? 'active' : ''}`}
          onClick={() => handleChange('gps')}
        >
          <Satellite size={15} strokeWidth={2.2} /> GPS
        </button>
      )}
    </div>
  );
}
