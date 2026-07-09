import { getFactoryName } from "@/lib/utils";
import { LayoutGrid } from "lucide-react";

interface FactoryFilterProps {
  factories: string[];
  activeFactory: string;
  onFactoryChange: (factory: string) => void;
}

export default function FactoryFilter({ factories, activeFactory, onFactoryChange }: FactoryFilterProps) {
  return (
    <div className="factory-switch">
      <button
        className={`factory-btn ${activeFactory === 'all' ? 'active' : ''}`}
        onClick={() => onFactoryChange('all')}
      >
        <LayoutGrid size={14} strokeWidth={2.2} style={{ marginRight: 4, verticalAlign: -2 }} />
        Все заводы
      </button>
      {factories.map(factory => (
        <button
          key={factory}
          className={`factory-btn ${activeFactory === factory ? 'active' : ''}`}
          onClick={() => onFactoryChange(factory)}
        >
          {getFactoryName(factory)}
        </button>
      ))}
    </div>
  );
}
