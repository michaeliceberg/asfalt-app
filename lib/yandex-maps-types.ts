// lib/yandex-maps-types.ts
export interface YandexMap {
  geoObjects: {
    add: (object: unknown) => void;
    remove: (object: unknown) => void;
    removeAll: () => void;
  };
  setCenter: (center: [number, number], zoom: number) => void;
  destroy: () => void;
}

export interface YandexPlacemark {
  events: {
    add: (event: string, handler: () => void) => void;
  };
}

export interface YandexMaps {
  Map: new (element: HTMLElement, options: unknown) => YandexMap;
  Placemark: new (
    coordinates: [number, number],
    properties: Record<string, string>,
    options: Record<string, unknown>
  ) => YandexPlacemark;
  Polyline: new (
    coordinates: [number, number][],
    properties: Record<string, string>,
    options: Record<string, unknown>
  ) => unknown;
  ready: (callback: () => void) => void;
}

declare global {
  interface Window {
    ymaps: YandexMaps | undefined;
  }
}

// Экспортируем тип для использования в компонентах
export type YandexMapInstance = YandexMap;
export type YandexMapsInstance = YandexMaps;