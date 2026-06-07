'use client';

interface MainTabsProps {
  activeTab: 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary';
  onTabChange: (tab: 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary') => void;
  futureRequestsCount?: number;
  newShipmentsCount?: number;
  newConcreteCount?: number;
  showConcreteTab?: boolean;  // ← добавить
  onShipmentClick?: () => void;
  onConcreteClick?: () => void;
}

export default function MainTabs({ 
  activeTab, 
  onTabChange, 
  futureRequestsCount = 0,
  newShipmentsCount = 0,
  newConcreteCount = 0,
  showConcreteTab = false,  // ← добавить
  onShipmentClick,
  onConcreteClick
}: MainTabsProps) {
  const hasFutureRequests = futureRequestsCount > 0;
  const hasNewShipments = newShipmentsCount > 0;
  const hasNewConcrete = newConcreteCount > 0;
  
  const handleShipmentClick = () => {
    onTabChange('shipment');
    if (hasNewShipments && onShipmentClick) {
      onShipmentClick();
    }
  };

  const handleConcreteClick = () => {
    onTabChange('shipmentConcrete');
    if (hasNewConcrete && onConcreteClick) {
      onConcreteClick();
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
      
      {/* Отгрузка Асфальт */}
      <button
        className={`main-tab ${activeTab === 'shipment' ? 'active' : ''} ${hasNewShipments ? 'has-new' : ''}`}
        onClick={handleShipmentClick}
      >
        <span className="tab-icon">🚛</span>
        <span className="tab-label">Отгрузка Асф</span>
        {hasNewShipments && (
          <div className="tab-badge">
            <span className="badge-dot"></span>
            <span className="badge-number">{newShipmentsCount}</span>
          </div>
        )}
      </button>
      
      {/* Отгрузка Бетон - показываем только в режиме Айсберг */}
      {showConcreteTab && (
        <button
          className={`main-tab ${activeTab === 'shipmentConcrete' ? 'active' : ''} ${hasNewConcrete ? 'has-new' : ''}`}
          onClick={handleConcreteClick}
        >
          <span className="tab-icon">🧱</span>
          <span className="tab-label">Отгрузка Бет</span>
          {hasNewConcrete && (
            <div className="tab-badge">
              <span className="badge-dot"></span>
              <span className="badge-number">{newConcreteCount}</span>
            </div>
          )}
        </button>
      )}

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



// 'use client';

// interface MainTabsProps {
//   activeTab: 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary';
//   onTabChange: (tab: 'incoming' | 'shipment' | 'shipmentConcrete' | 'summary') => void;
//   futureRequestsCount?: number;
//   newShipmentsCount?: number;
//   newConcreteCount?: number;
//   onShipmentClick?: () => void;
//   onConcreteClick?: () => void;
// }

// export default function MainTabs({ 
//   activeTab, 
//   onTabChange, 
//   futureRequestsCount = 0,
//   newShipmentsCount = 0,
//   newConcreteCount = 0,
//   onShipmentClick,
//   onConcreteClick
// }: MainTabsProps) {
//   const hasFutureRequests = futureRequestsCount > 0;
//   const hasNewShipments = newShipmentsCount > 0;
//   const hasNewConcrete = newConcreteCount > 0;
  
//   const handleShipmentClick = () => {
//     onTabChange('shipment');
//     if (hasNewShipments && onShipmentClick) {
//       onShipmentClick();
//     }
//   };

//   const handleConcreteClick = () => {
//     onTabChange('shipmentConcrete');
//     if (hasNewConcrete && onConcreteClick) {
//       onConcreteClick();
//     }
//   };
  
//   return (
//     <div className="main-tabs">
//       {/* Поступление */}
//       <button
//         className={`main-tab ${activeTab === 'incoming' ? 'active' : ''}`}
//         onClick={() => onTabChange('incoming')}
//       >
//         <span className="tab-icon">🚢</span>
//         <span className="tab-label">Поступление</span>
//       </button>
      
//       {/* Отгрузка Асфальт */}
//       <button
//         className={`main-tab ${activeTab === 'shipment' ? 'active' : ''} ${hasNewShipments ? 'has-new' : ''}`}
//         onClick={handleShipmentClick}
//       >
//         <span className="tab-icon">🚛</span>
//         <span className="tab-label">Отгрузка Асф</span>
//         {hasNewShipments && (
//           <div className="tab-badge">
//             <span className="badge-dot"></span>
//             <span className="badge-number">{newShipmentsCount}</span>
//           </div>
//         )}
//       </button>
      
//       {/* Отгрузка Бетон */}
//       <button
//         className={`main-tab ${activeTab === 'shipmentConcrete' ? 'active' : ''} ${hasNewConcrete ? 'has-new' : ''}`}
//         onClick={handleConcreteClick}
//       >
//         <span className="tab-icon">🧱</span>
//         <span className="tab-label">Отгрузка Бет</span>
//         {hasNewConcrete && (
//           <div className="tab-badge">
//             <span className="badge-dot"></span>
//             <span className="badge-number">{newConcreteCount}</span>
//           </div>
//         )}
//       </button>

//       {/* План на будущее */}
//       <button
//         className={`main-tab ${activeTab === 'summary' ? 'active' : ''} ${hasFutureRequests ? 'has-future' : ''}`}
//         onClick={() => onTabChange('summary')}
//       >
//         <span className="tab-icon">📋</span>
//         <span className="tab-label">На будущее</span>
//         {hasFutureRequests && (
//           <div className="tab-badge">
//             <span className="badge-dot"></span>
//             <span className="badge-number">{futureRequestsCount}</span>
//           </div>
//         )}
//       </button>
//     </div>
//   );
// }







// 'use client';

// interface MainTabsProps {
//   activeTab: 'incoming' | 'shipment' | 'summary';
//   onTabChange: (tab: 'incoming' | 'shipment' | 'summary') => void;
//   futureRequestsCount?: number;
//   newShipmentsCount?: number;
//   onShipmentClick?: () => void;
// }

// export default function MainTabs({ 
//   activeTab, 
//   onTabChange, 
//   futureRequestsCount = 0,
//   newShipmentsCount = 0,
//   onShipmentClick 
// }: MainTabsProps) {
//   const hasFutureRequests = futureRequestsCount > 0;
//   const hasNewShipments = newShipmentsCount > 0;
  
//   const handleShipmentClick = () => {
//     onTabChange('shipment');
//     if (hasNewShipments && onShipmentClick) {
//       onShipmentClick();
//     }
//   };
  
//   return (
//     <div className="main-tabs">
//       {/* Поступление */}
//       <button
//         className={`main-tab ${activeTab === 'incoming' ? 'active' : ''}`}
//         onClick={() => onTabChange('incoming')}
//       >
//         <span className="tab-icon">🚢</span>
//         <span className="tab-label">Поступление</span>
//       </button>
      
//       {/* Отгрузка */}
//       <button
//         className={`main-tab ${activeTab === 'shipment' ? 'active' : ''} ${hasNewShipments ? 'has-new' : ''}`}
//         onClick={handleShipmentClick}
//       >
//         <span className="tab-icon">🚛</span>
//         <span className="tab-label">Отгрузка</span>
//         {hasNewShipments && (
//           <div className="tab-badge">
//             <span className="badge-dot"></span>
//             <span className="badge-number">{newShipmentsCount}</span>
//           </div>
//         )}
//       </button>
      
//       {/* План-факт */}
      
      
      
//       {/* <button
//         className={`main-tab ${activeTab === 'summary' ? 'active' : ''} ${hasFutureRequests ? 'has-future' : ''}`}
//         onClick={() => onTabChange('summary')}
//       >
//         <span className="tab-icon">📋</span>
//         <span className="tab-label">План-факт</span>
//         {hasFutureRequests && (
//           <div className="tab-badge">
//             <span className="badge-dot"></span>
//             <span className="badge-number">{futureRequestsCount}</span>
//           </div>
//         )}
//       </button> */}

//       {/* План на будущее */}
// <button
//   className={`main-tab ${activeTab === 'summary' ? 'active' : ''} ${hasFutureRequests ? 'has-future' : ''}`}
//   onClick={() => onTabChange('summary')}
// >
//   <span className="tab-icon">📋</span>
//   <span className="tab-label">На будущее</span>
//   {hasFutureRequests && (
//     <div className="tab-badge">
//       <span className="badge-dot"></span>
//       <span className="badge-number">{futureRequestsCount}</span>
//     </div>
//   )}
// </button>





//     </div>
//   );
// }

