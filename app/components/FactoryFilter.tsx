// app/components/FactoryFilter.tsx

// const getFactoryName = (code: string): string => {
//   switch (code) {
//     case 'ЛХ': return '🏭 Луховицкий';
//     case 'ЛЮ': return '🏭 Люберецкий';
//     default: return '📦 Все заводы';
//   }
// };

const getFactoryName = (code: string): string => {
  switch (code) {
    case 'ЛХ': return '🏭 Луховицкий';
    case 'ЛЮ': return '🏭 Люберецкий';
    case 'СП': return '🏭 Сергиев Посад';
    case 'Щ': return '🏭 Щёлково';
    default: return '📦 Все заводы';
  }
};

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
        📦 Все заводы
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