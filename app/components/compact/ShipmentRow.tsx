// app/components/compact/ShipmentRow.tsx
import { getFactoryBadgeClass, formatWithUnit, isSpecialMaterial } from '@/lib/utils';
import { VehicleDetails } from './VehicleDetails';
import { CombinedRequest } from './types';
import { ShipmentItem } from '@/app/page';

interface ShipmentRowProps {
  item: CombinedRequest;
  idx: number;
  date: string;
  isExpanded: boolean;
  onToggle: () => void;
  allShipments: ShipmentItem[]; // ← заменить any[] на ShipmentItem[]
}

export function ShipmentRow({ item, idx, date, isExpanded, onToggle, allShipments }: ShipmentRowProps) {
  const percentComplete = item.planQuantity > 0 ? (item.factQuantity / item.planQuantity) * 100 : 0;
  const isWarning = percentComplete < 90 && percentComplete > 0;
  const isCompleted = percentComplete >= 90 && item.planQuantity > 0;
  const displayTime = item.lastShipmentTime || '—';
  const isSpecial = isSpecialMaterial(item.material);

  const { value: factValue } = formatWithUnit(item.factQuantity, item.unit ?? null, item.material);
  const { value: planValue } = formatWithUnit(item.planQuantity, item.unit ?? null, item.material);

  const displayFact = Math.round(factValue);
  const displayPlan = Math.round(planValue);

  return (
    <div key={idx}>
      <div 
        className={`compact-row compact-clickable ${isCompleted ? 'completed-row' : ''}`}
        style={{ fontWeight: 'bold', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <span className="col-time">{displayTime}</span>
        <span className={`col-fact ${isWarning ? 'warning' : ''}`}>
          {displayFact}
        </span>
        <span className="col-slash">/</span>
        <span className="col-plan">
          {displayPlan > 0 ? (
            <span style={{ whiteSpace: 'nowrap' }}>
              {displayPlan}
              {item.closed ? (
                <span className="closed-lock"> 🔒</span>
              ) : (
                !isCompleted && item.factQuantity > 0 && percentComplete < 90 && (
                  <span className="active-dot" title="Идут отгрузки"></span>
                )
              )}
            </span>
          ) : '—'}
        </span>
        <span className="col-consignee" style={{ fontSize: '12px' }}>
          {item.consignee}
          {isSpecial && <span className="special-badge">ИНЕРТНЫЕ</span>}
        </span>
        <span className="col-factory">
          <div className="factory-badges-group">
            <div className={getFactoryBadgeClass(item.division)}>{item.division}</div>
          </div>
        </span>
        <span className="col-trucks">{item.truckCount}</span>
      </div>
      
    <VehicleDetails 
    isExpanded={isExpanded} 
    item={{
        material: item.material,
        division: item.division,
        truckCount: item.truckCount,
        unit: item.unit,
        vehicles: item.vehicles,
    }} 
    />

    </div>
  );
}