// app/components/compact/VehicleDetails.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { VehicleItem } from './types';

interface VehicleDetailsProps {
  isExpanded: boolean;
  item: {
    material: string;
    division: string;
    truckCount: number;
    unit?: string;
    vehicles: VehicleItem[];
  };
}

export function VehicleDetails({ isExpanded, item }: VehicleDetailsProps) {
  const sortedVehicles = [...item.vehicles].sort((a, b) => {
    const dateA = a.fullDateTime || a.time;
    const dateB = b.fullDateTime || b.time;
    return dateB.localeCompare(dateA);
  });

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          className="compact-details"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="detail-row">
            <span className="detail-label">📦 Материал:</span>
            <span className="detail-value">{item.material}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">🏭 Завод:</span>
            <span className="detail-value">{item.division}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">🚛 Машин:</span>
            <span className="detail-value">{item.truckCount}</span>
          </div>
          {sortedVehicles.length > 0 && (
            <div className="vehicles-list">
              <div className="vehicles-title">🚛 Транспорт:</div>
              {sortedVehicles.map((vehicle, i) => (
                <div key={i} className="vehicle-item">
                  <span className="vehicle-time">{vehicle.fullDateTime || vehicle.time}</span>
                  <span className="vehicle-license">{vehicle.licensePlate}</span>
                  <span className="vehicle-driver-inline">👤 {vehicle.driver}</span>
                  <span className="vehicle-quantity">
                    {Math.round(vehicle.quantity)} {item.unit === 'м³' ? 'м³' : 'т'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}