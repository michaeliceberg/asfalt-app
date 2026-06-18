// lib/truck-icons.ts

// Базовые цвета для разных статусов
const COLORS = {
  moving: '#4ade80',
  loading: '#facc15',
  idle: '#f87171',
  offline: '#9ca3af',
};

// Создаём SVG-иконки для разных типов ТС
export const TRUCK_ICONS = {
  // Самосвал (для асфальта)
  dumpTruck: (color: string) => `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <!-- Кузов -->
      <rect x="6" y="12" width="20" height="10" rx="2" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <!-- Кабина -->
      <rect x="4" y="14" width="6" height="6" rx="1" fill="${color}" stroke="#fff" stroke-width="1.5" opacity="0.8"/>
      <!-- Колёса -->
      <circle cx="10" cy="24" r="4" fill="#333" stroke="#fff" stroke-width="1"/>
      <circle cx="22" cy="24" r="4" fill="#333" stroke="#fff" stroke-width="1"/>
      <circle cx="10" cy="24" r="2" fill="#666"/>
      <circle cx="22" cy="24" r="2" fill="#666"/>
    </svg>
  `,

  // Тонар (для щебня/песка)
  tipper: (color: string) => `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <!-- Кузов с поднятием -->
      <polygon points="6,14 26,14 22,22 10,22" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <!-- Кабина -->
      <rect x="4" y="16" width="6" height="4" rx="1" fill="${color}" stroke="#fff" stroke-width="1.5" opacity="0.8"/>
      <!-- Колёса -->
      <circle cx="10" cy="24" r="4" fill="#333" stroke="#fff" stroke-width="1"/>
      <circle cx="22" cy="24" r="4" fill="#333" stroke="#fff" stroke-width="1"/>
      <circle cx="10" cy="24" r="2" fill="#666"/>
      <circle cx="22" cy="24" r="2" fill="#666"/>
    </svg>
  `,

  // Миксер (для бетона)
  mixer: (color: string) => `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <!-- Кабина -->
      <rect x="4" y="12" width="8" height="6" rx="2" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <!-- Бочка-миксер -->
      <ellipse cx="20" cy="14" rx="8" ry="6" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <!-- Лопасти (вращающийся барабан) -->
      <line x1="14" y1="12" x2="22" y2="16" stroke="#fff" stroke-width="1.5" opacity="0.5"/>
      <line x1="14" y1="16" x2="22" y2="12" stroke="#fff" stroke-width="1.5" opacity="0.5"/>
      <!-- Колёса -->
      <circle cx="10" cy="22" r="4" fill="#333" stroke="#fff" stroke-width="1"/>
      <circle cx="22" cy="22" r="4" fill="#333" stroke="#fff" stroke-width="1"/>
      <circle cx="10" cy="22" r="2" fill="#666"/>
      <circle cx="22" cy="22" r="2" fill="#666"/>
    </svg>
  `,

  // Бетоновоз (альтернативный вариант)
  concreteTruck: (color: string) => `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <!-- Кабина -->
      <rect x="4" y="12" width="8" height="6" rx="2" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <!-- Цистерна -->
      <path d="M12,14 Q18,8 24,14 L24,18 Q18,22 12,18 Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <!-- Колёса -->
      <circle cx="10" cy="22" r="4" fill="#333" stroke="#fff" stroke-width="1"/>
      <circle cx="22" cy="22" r="4" fill="#333" stroke="#fff" stroke-width="1"/>
    </svg>
  `,
};

// Определяем тип ТС по номеру или имени
export function getTruckType(name: string): 'dumpTruck' | 'tipper' | 'mixer' | 'concreteTruck' {
  const lower = name.toLowerCase();
  
  // Миксеры (бетон)
  if (lower.includes('мк') || lower.includes('миксер')) {
    return 'mixer';
  }
  
  // Тонары (щебень, песок)
  if (lower.includes('р28') || lower.includes('р27') || lower.includes('р29')) {
    return 'tipper';
  }
  
  // По умолчанию - самосвал
  return 'dumpTruck';
}

// Получаем цвет в зависимости от статуса
export function getStatusColor(vel: number, lastUpdate: string | null): string {
  if (!lastUpdate) return COLORS.offline;
  
  const now = Date.now();
  const lastUpdateTime = new Date(lastUpdate).getTime();
  const minutesSinceUpdate = (now - lastUpdateTime) / 1000 / 60;
  
  if (minutesSinceUpdate > 60) return COLORS.offline;
  if (vel === 0 && minutesSinceUpdate > 30) return COLORS.idle;
  if (vel === 0) return COLORS.loading;
  return COLORS.moving;
}