// lib/constants.ts

// ============================================
// КООРДИНАТЫ ЗАВОДОВ
// ============================================

export const FACTORIES = {
  'ЛХ': { lat: 54.961524, lng: 38.839336, name: 'Луховицы' },
  'ЛЮ': { lat: 55.702066, lng: 37.995442, name: 'Люберцы' },
  'СП': { lat: 56.363355, lng: 38.175478, name: 'Сергиев Посад' },
  'Щ': { lat: 55.917957, lng: 38.027629, name: 'Щёлково' },
} as const;

export type FactoryCode = keyof typeof FACTORIES;


// ============================================
// КООРДИНАТЫ ОБЪЕКТОВ (ПК)
// ============================================

export const DESTINATIONS_FALLBACK: Record<string, { lat: number; lng: number; name: string }> = {
  'ПК 25 Луховицкий': { lat: 54.9653, lng: 39.0269, name: 'ПК 25 Луховицкий' },
  'ПК 25 Зарайский': { lat: 54.7625, lng: 38.8836, name: 'ПК 25 Зарайский' },
  'ПК 25 Каширский': { lat: 54.8411, lng: 38.1653, name: 'ПК 25 Каширский' },
  'ПК 25 Воскресенский': { lat: 55.3208, lng: 38.6525, name: 'ПК 25 Воскресенский' },
  'ПК 25 Шатурский': { lat: 55.5775, lng: 39.5442, name: 'ПК 25 Шатурский' },
  'ПК 25 Коломенский': { lat: 55.1028, lng: 38.7531, name: 'ПК 25 Коломенский' },
  'ПК 25 Серпуховский': { lat: 54.9125, lng: 37.4153, name: 'ПК 25 Серпуховский' },
  'ПК 25 Орехово-Зуевский': { lat: 55.8116, lng: 38.9622, name: 'ПК 25 Орехово-Зуевский' },
  'ПК 25 Егорьевский': { lat: 55.3833, lng: 39.0333, name: 'ПК 25 Егорьевский' },
  
  // ПК 26
  'ПК 26 Серпуховский': { lat: 54.9125, lng: 37.4153, name: 'ПК 26 Серпуховский' },
  'ПК 26 Чеховский': { lat: 55.1522, lng: 37.4641, name: 'ПК 26 Чеховский' },
  'ПК 26 Воскресенский': { lat: 55.3208, lng: 38.6525, name: 'ПК 26 Воскресенский' },
  'ПК 26 Егорьевский': { lat: 55.3833, lng: 39.0333, name: 'ПК 26 Егорьевский' },
  'ПК 26 Каширский': { lat: 54.8411, lng: 38.1653, name: 'ПК 26 Каширский' },
  'ПК 26 Коломенский': { lat: 55.1028, lng: 38.7531, name: 'ПК 26 Коломенский' },
  'ПК 26 Серебряно-Прудский': { lat: 54.4803, lng: 38.7317, name: 'ПК 26 Серебряно-Прудский' },
  'ПК 26 Луховицкий': { lat: 54.9653, lng: 39.0269, name: 'ПК 26 Луховицкий' },
  
  // Организации
  'АЙСБЕРГ ООО': { lat: 55.7585, lng: 37.6191, name: 'АЙСБЕРГ ООО' },
  'ДКС ООО': { lat: 55.7585, lng: 37.6191, name: 'ДКС ООО' },
  'ДМ ГРУПП ООО': { lat: 55.7585, lng: 37.6191, name: 'ДМ ГРУПП ООО' },
};



// ============================================
// ЦВЕТА ДЛЯ ЗАВОДОВ
// ============================================

// export const FACTORY_COLORS: Record<FactoryCode, string> = {
//   'ЛХ': '#22c55e',
//   'ЛЮ': '#3b82f6',
//   'СП': '#eab308',
//   'Щ': '#ef4444',
// };

export const FACTORY_COLORS: Record<FactoryCode, string> = {
  'ЛХ': '#166534',   // очень тёмно-зелёный
  'ЛЮ': '#3b82f6',
  'СП': '#713f12',   // очень тёмно-жёлтый
  'Щ': '#7f1d1d',    // очень тёмно-красный
};


export function getFactoryColor(factory: string): string {
  return FACTORY_COLORS[factory as FactoryCode] || '#888888';
}

export function getFactoryCoords(factory: string): { lat: number; lng: number; name: string } | null {
  return FACTORIES[factory as FactoryCode] || null;
}

// ============================================
// ПАРСИНГ КООРДИНАТ ИЗ destinationPoint
// ============================================

export function parseDestinationPoint(destinationPoint: string | null): { 
  lat: number; 
  lng: number; 
  address: string;
} | null {
  if (!destinationPoint) return null;
  
  // Ищем координаты в конце строки
  const coordMatch = destinationPoint.match(/(\d+\.\d+),\s*(\d+\.\d+)\s*$/);
  if (!coordMatch) return null;
  
  const lat = parseFloat(coordMatch[1]);
  const lng = parseFloat(coordMatch[2]);
  const address = destinationPoint.replace(/\s*\d+\.\d+,\s*\d+\.\d+\s*$/, '').trim();
  
  return { lat, lng, address };
}



export function getDestinationCoords(destination: string): { lat: number; lng: number; name: string } | null {
  // Сначала пробуем распарсить координаты из строки
  const parsed = parseDestinationPoint(destination);
  if (parsed) {
    return { lat: parsed.lat, lng: parsed.lng, name: parsed.address };
  }
  
  // Если не получилось, используем fallback (для обратной совместимости)
  return DESTINATIONS_FALLBACK[destination] || null;
}



