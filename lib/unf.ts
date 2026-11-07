// lib/unf.ts
// Запросы к 1С:УНФ (ТАС) идут с dateFrom: без него сервис отдавал застывший
// срез (отгрузки ТАС остановились на 11.09.2026). Записи не удаляются, поэтому
// окно не обязано покрывать всю историю; запас нужен, чтобы подтягивать правки.
export const UNF_WINDOW_DAYS = 90;

export function unfDateFrom(now: Date = new Date()): string {
  const from = new Date(now.getTime() - UNF_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return `${from.toISOString().slice(0, 10)}T00:00:00`;
}
