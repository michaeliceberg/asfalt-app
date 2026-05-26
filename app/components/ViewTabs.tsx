// components/ViewTabs.tsx

// type ViewTab = 'grouped' | 'list' | 'compact';
// type ViewTab = 'compact' | 'grouped' | 'list';

type ViewTab = 'compact' | 'grouped' | 'list' | 'charts';

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
        📋 Компактно
      </button>

      <button 
  className={`tab ${activeTab === 'list' ? 'active' : ''}`}
  onClick={() => onTabChange('list')}
>
  📋 Список
</button>


<button 
  className={`tab ${activeTab === 'charts' ? 'active' : ''}`}
  onClick={() => onTabChange('charts')}
>
  📊 Графики
</button>


      {/* <button 
        className={`tab ${activeTab === 'list' ? 'active' : ''}`}
        onClick={() => onTabChange('list')}
      >
        📋 Список
      </button> */}
      {/* <button 
        className={`tab ${activeTab === 'grouped' ? 'active' : ''}`}
        onClick={() => onTabChange('grouped')}
      >
        📊 Итоги по дням
      </button> */}
    </div>
  );
}