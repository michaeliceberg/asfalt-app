// app/components/compact/IncomingRow.tsx
import { getFactoryBadgeClass, formatWithUnit } from '@/lib/utils';
import { VehicleDetails } from './VehicleDetails';
import { GroupedItem } from './types';

interface IncomingRowProps {
  item: GroupedItem;
  idx: number;
  date: string;
  isExpanded: boolean;
  onToggle: () => void;
}

export function IncomingRow({ item, idx, date, isExpanded, onToggle }: IncomingRowProps) {
  const { value: factValue } = formatWithUnit(item.factQuantity, item.unit ?? null, item.material);
  const displayFact = Math.round(factValue);

  return (
    <div key={idx}>
      <div 
        className="compact-row compact-clickable"
        style={{ fontWeight: 'bold', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <span className="col-time">{item.time}</span>
        <span className="col-fact">{displayFact}</span>
        <span className="col-material-header" style={{ fontSize: '13px' }}>{item.material}</span>
        <span className="col-supplier" style={{ fontSize: '12px' }}>{item.consignee}</span>
        <span className="col-factory">
          <div className="factory-badges-group">
            {item.factories.map((factory, i) => (
              <div key={i} className={getFactoryBadgeClass(factory)}>
                {factory}
              </div>
            ))}
          </div>
        </span>
        <span className="col-trucks">{item.truckCount}</span>
      </div>
      
      <VehicleDetails 
        isExpanded={isExpanded} 
        item={{
          material: item.material,
          division: item.factories[0] || '—', // ← берём первый завод из массива
          truckCount: item.truckCount,
          unit: item.unit,
          vehicles: item.vehicles,
        }} 
      />
    </div>
  );
}