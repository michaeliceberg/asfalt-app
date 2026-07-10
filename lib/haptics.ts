// lib/haptics.ts
//
// Тонкая обёртка над @capacitor/haptics. В обычном браузере (сайт/PWA)
// плагин просто не срабатывает — Capacitor сам определяет платформу и
// на вебе делает Haptics.impact() no-op'ом, но на всякий случай оборачиваем
// в try/catch, чтобы ни при каких обстоятельствах вызов не уронил UI.
'use client';

import { Haptics, ImpactStyle } from '@capacitor/haptics';

type HapticLevel = 'light' | 'medium' | 'heavy';

const STYLE_MAP: Record<HapticLevel, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

/**
 * Лёгкая тактильная отдача ("Дззз") на тап по кнопке — переключение
 * завода, вкладки и т.п. Безопасно вызывать где угодно: в браузере
 * (сайт/PWA) просто ничего не произойдёт.
 */
export function tapHaptic(level: HapticLevel = 'light'): void {
  try {
    void Haptics.impact({ style: STYLE_MAP[level] });
  } catch {
    // На вебе (не Capacitor-обёртка) плагин может быть недоступен —
    // это ожидаемо и не является ошибкой.
  }
}
