// app/components/compact/DateGroup.tsx
import { CompactHeader } from './CompactHeader';
import { ShipmentRow } from './ShipmentRow';
import { IncomingRow } from './IncomingRow';
import { CombinedRequest, GroupedItem } from './types';
import { ShipmentItem } from '@/app/page'; // ← добавить импорт

interface DateGroupProps {
  dateKey: string;
  items: (CombinedRequest | GroupedItem)[];
  isShipment: boolean;
  isToday: boolean;
  unitLabel: string;
  dateLabel: string;
  dayTotal?: number;
  allShipments: ShipmentItem[]; // ← заменить any[]
  expandedId: string | null;
  onToggle: (id: string | null) => void; // ← изменить тип
}

export function DateGroup({
  dateKey,
  items,
  isShipment,
  isToday,
  unitLabel,
  dateLabel,
  dayTotal,
  allShipments,
  expandedId,
  onToggle,
}: DateGroupProps) {
  return (
    <div className="compact-date-group">
      <div className="compact-date-header">
        <div className="date-wrapper">
          <span className="date-text" style={{ fontWeight: 'bold' }}>{dateLabel}</span>
          {isToday && <span className="today-badge">СЕГОДНЯ</span>}
        </div>
        {isShipment && dayTotal !== undefined && (
          <span className="date-total" style={{ fontWeight: 'bold' }}>{Math.round(dayTotal)} т</span>
        )}
      </div>
      
      <div className="compact-table">
        <CompactHeader isShipment={isShipment} unitLabel={unitLabel} />
        
        {items.map((item, idx) => {
          const itemKey = `${dateKey}_${idx}`;
          const isExpanded = expandedId === itemKey;

          if (isShipment) {
            return (
              <ShipmentRow
                key={idx}
                item={item as CombinedRequest}
                idx={idx}
                date={dateKey}
                isExpanded={isExpanded}
                onToggle={() => onToggle(isExpanded ? null : itemKey)}
                allShipments={allShipments}
              />
            );
          }

          return (
            <IncomingRow
              key={idx}
              item={item as GroupedItem}
              idx={idx}
              date={dateKey}
              isExpanded={isExpanded}
              onToggle={() => onToggle(isExpanded ? null : itemKey)}
            />
          );
        })}
      </div>
    </div>
  );
}