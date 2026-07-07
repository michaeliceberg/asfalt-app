// app/components/compact/CompactHeader.tsx
interface CompactHeaderProps {
  isShipment: boolean;
  unitLabel?: string;
}

export function CompactHeader({ isShipment, unitLabel }: CompactHeaderProps) {
  if (isShipment) {
    return (
      <div className="compact-header" style={{ fontWeight: 'bold' }}>
        <span className="col-time">Время</span>
        <span className="col-fact">Вып</span>
        <span className="col-slash"></span>
        <span className="col-plan">Заяв {unitLabel || '(тонннннн)'}</span>
        <span className="col-consignee">Грузополучатель</span>
        <span className="col-factory">🏭</span>
        <span className="col-trucks">🚛</span>
      </div>
    );
  }

  return (
    <div className="compact-header" style={{ fontWeight: 'bold' }}>
      <span className="col-time">Время</span>
      <span className="col-fact">Вып</span>
      <span className="col-material-header">Материал</span>
      <span className="col-supplier">Контрагент</span>
      <span className="col-factory">🏭</span>
      <span className="col-trucks">🚛</span>
    </div>
  );
}