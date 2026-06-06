'use client';

interface MainTabsProps {
  activeTab: 'incoming' | 'shipment' | 'summary';
  onTabChange: (tab: 'incoming' | 'shipment' | 'summary') => void;
  futureRequestsCount?: number;
  newShipmentsCount?: number;
  onShipmentClick?: () => void;
}

export default function MainTabs({ 
  activeTab, 
  onTabChange, 
  futureRequestsCount = 0,
  newShipmentsCount = 0,
  onShipmentClick 
}: MainTabsProps) {
  const hasFutureRequests = futureRequestsCount > 0;
  const hasNewShipments = newShipmentsCount > 0;
  
  const handleShipmentClick = () => {
    onTabChange('shipment');
    if (hasNewShipments && onShipmentClick) {
      onShipmentClick();
    }
  };
  
  return (
    <div className="main-tabs">
      {/* Поступление */}
      <button
        className={`main-tab ${activeTab === 'incoming' ? 'active' : ''}`}
        onClick={() => onTabChange('incoming')}
      >
        <span className="tab-icon">🚢</span>
        <span className="tab-label">Поступление</span>
      </button>
      
      {/* Отгрузка */}
      <button
        className={`main-tab ${activeTab === 'shipment' ? 'active' : ''} ${hasNewShipments ? 'has-new' : ''}`}
        onClick={handleShipmentClick}
      >
        <span className="tab-icon">🚛</span>
        <span className="tab-label">Отгрузка</span>
        {hasNewShipments && (
          <div className="tab-badge">
            <span className="badge-dot"></span>
            <span className="badge-number">{newShipmentsCount}</span>
          </div>
        )}
      </button>
      
      {/* План-факт */}
      
      
      
      {/* <button
        className={`main-tab ${activeTab === 'summary' ? 'active' : ''} ${hasFutureRequests ? 'has-future' : ''}`}
        onClick={() => onTabChange('summary')}
      >
        <span className="tab-icon">📋</span>
        <span className="tab-label">План-факт</span>
        {hasFutureRequests && (
          <div className="tab-badge">
            <span className="badge-dot"></span>
            <span className="badge-number">{futureRequestsCount}</span>
          </div>
        )}
      </button> */}

      {/* План на будущее */}
<button
  className={`main-tab ${activeTab === 'summary' ? 'active' : ''} ${hasFutureRequests ? 'has-future' : ''}`}
  onClick={() => onTabChange('summary')}
>
  <span className="tab-icon">📋</span>
  <span className="tab-label">На будущее</span>
  {hasFutureRequests && (
    <div className="tab-badge">
      <span className="badge-dot"></span>
      <span className="badge-number">{futureRequestsCount}</span>
    </div>
  )}
</button>





    </div>
  );
}

