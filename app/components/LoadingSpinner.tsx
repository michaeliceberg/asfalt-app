'use client';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  message = 'Загрузка данных...', 
  size = 'medium',
  fullScreen = false 
}: LoadingSpinnerProps) {
  
  const sizeMap = {
    small: { wrapper: 48, ring: 48 },
    medium: { wrapper: 48, ring: 48 },
    large: { wrapper: 56, ring: 56 }
  };
  
  const dimensions = sizeMap[size];
  
  return (
    <div className={`loading-spinner-wrapper ${fullScreen ? 'fullscreen' : ''}`}>
      <div 
        className="premium-spinner"
        style={{ width: dimensions.wrapper, height: dimensions.wrapper }}
      >
        <div className="premium-spinner-ring" style={{ width: dimensions.ring, height: dimensions.ring }}></div>
        <div className="premium-spinner-ring" style={{ width: dimensions.ring, height: dimensions.ring }}></div>
        <div className="premium-spinner-ring"></div>
      </div>
      {message && <p className="loading-text">{message}</p>}
    </div>
  );
}


// // components/LoadingSpinner.tsx
// 'use client';

// interface LoadingSpinnerProps {
//   message?: string;
//   size?: 'small' | 'medium' | 'large';
//   fullScreen?: boolean;
// }

// export default function LoadingSpinner({ 
//   message = 'Загрузка данных...', 
//   size = 'medium',
//   fullScreen = false 
// }: LoadingSpinnerProps) {
  
//   const sizeMap = {
//     small: { wrapper: 40, ring: 40 },
//     medium: { wrapper: 60, ring: 60 },
//     large: { wrapper: 80, ring: 80 }
//   };
  
//   const dimensions = sizeMap[size];
  
//   return (
//     <div className={`loading-spinner-wrapper ${fullScreen ? 'fullscreen' : ''}`}>
//       <div 
//         className="loading-spinner" 
//         style={{ width: dimensions.wrapper, height: dimensions.wrapper }}
//       >
//         <div className="spinner-ring" style={{ width: dimensions.ring, height: dimensions.ring }}></div>
//         <div className="spinner-ring" style={{ width: dimensions.ring, height: dimensions.ring }}></div>
//         <div className="spinner-ring" style={{ width: dimensions.ring, height: dimensions.ring }}></div>
//       </div>
//       {message && <p className="loading-text">{message}</p>}
//     </div>
//   );
// }