import { LayoutGrid } from "lucide-react";

interface FactoryFilterProps {
  factories: string[];
  activeFactory: string;
  onFactoryChange: (factory: string) => void;
}

// Короткие подписи без emoji и без кавычек — специально для кнопок
// переключателя заводов, чтобы текст помещался в кнопку. getFactoryName()
// из lib/utils.ts здесь намеренно не используется — он возвращает
// "🏭 АБЗ «Северный»", что не влезает в узкую кнопку.
function getShortFactoryLabel(factory: string): string {
  switch (factory) {
    case 'ЛХ': return 'АБЗ Луховицкий';
    case 'ЛЮ': return 'АБЗ Люберецкий';
    case 'СП': return 'АБЗ Сергиев Посад';
    case 'Щ': return 'АБЗ Щёлково';
    case 'ДЕМО-СЕВ': return 'АБЗ Северный';
    case 'ДЕМО-ЮГ': return 'АБЗ Южный';
    default: return factory;
  }
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
          {getShortFactoryLabel(factory)}
        </button>
      ))}
    </div>
  );
}
