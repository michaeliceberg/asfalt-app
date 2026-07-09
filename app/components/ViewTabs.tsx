// components/ViewTabs.tsx
'use client';

import { LayoutGrid, List, BarChart2, Trophy } from 'lucide-react';

type ViewTab = 'compact' | 'grouped' | 'list' | 'charts' | 'topCustomers';

interface ViewTabsProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

export default function ViewTabs({ activeTab, onTabChange }: ViewTabsProps) {
  return (
    <div className="tabs">
      <button
        className={`tab ${activeTab === 'compact' ? 'active' : ''}`}
        onClick={() => onTabChange('compact')}
      >
        <LayoutGrid size={15} strokeWidth={2.2} /> Компактно
      </button>

      <button
        className={`tab ${activeTab === 'list' ? 'active' : ''}`}
        onClick={() => onTabChange('list')}
      >
        <List size={15} strokeWidth={2.2} /> Список
      </button>

      <button
        className={`tab ${activeTab === 'charts' ? 'active' : ''}`}
        onClick={() => onTabChange('charts')}
      >
        <BarChart2 size={15} strokeWidth={2.2} /> Графики
      </button>

      <button
        className={`tab ${activeTab === 'topCustomers' ? 'active' : ''}`}
        onClick={() => onTabChange('topCustomers')}
      >
        <Trophy size={15} strokeWidth={2.2} /> Топ-10
      </button>
    </div>
  );
}
