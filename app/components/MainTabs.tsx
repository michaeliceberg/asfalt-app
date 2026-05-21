type MainTab = 'incoming' | 'shipment' | 'summary';

interface MainTabsProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export default function MainTabs({ activeTab, onTabChange }: MainTabsProps) {
  return (
    <div className="main-tabs">
      <button
        className={`main-tab ${activeTab === 'incoming' ? 'active' : ''}`}
        onClick={() => onTabChange('incoming')}
      >
        📦 Поступление
      </button>
      <button
        className={`main-tab ${activeTab === 'shipment' ? 'active' : ''}`}
        onClick={() => onTabChange('shipment')}
      >
        🚛 Отгрузка
      </button>
      <button
        className={`main-tab ${activeTab === 'summary' ? 'active' : ''}`}
        onClick={() => onTabChange('summary')}
      >
        📊 План-факт
      </button>
    </div>
  );
}