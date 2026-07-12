// lib/yandex-maps-types.ts
export interface YandexMap {
  geoObjects: {
    add: (object: unknown) => void;
    remove: (object: unknown) => void;
    removeAll: () => void;
  };
  setCenter: (center: [number, number], zoom: number) => void;
  // Автомасштаб под область (используется, чтобы завод + вся колонна +
  // destination всегда помещались в видимую область карты одним взглядом).
  setBounds: (
    bounds: [[number, number], [number, number]],
    options?: { checkZoomRange?: boolean; zoomMargin?: number | number[]; duration?: number }
  ) => void;
  destroy: () => void;
  // Клик по "пустой" карте (не по метке) — используется, чтобы закрывать
  // карточку выбранной машины по тапу мимо неё.
  events: {
    add: (event: string, handler: () => void) => void;
  };
}

export interface YandexPlacemark {
  events: {
    add: (event: string, handler: () => void) => void;
  };
}

// Свойство объекта маршрута (distance/duration) — .get() возвращает
// {value: number, text: string} для реального расстояния/времени по дорогам.
export interface YandexRouteProperty {
  value: number;
  text: string;
}

export interface YandexMultiRouteActiveRoute {
  properties: {
    get: (key: 'distance' | 'duration') => YandexRouteProperty | undefined;
  };
}

export interface YandexMultiRoute {
  model: {
    events: {
      add: (event: string, handler: () => void) => void;
    };
  };
  getActiveRoute: () => YandexMultiRouteActiveRoute | null;
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
  // Прокладывает маршрут по РЕАЛЬНЫМ дорогам (а не "по прямой", как раньше
  // рисовала простая Polyline) — визуально понятнее, как машина едет.
  // Не используется сейчас (платный продукт, см. TruckMap.tsx), но тип
  // оставлен на случай если когда-нибудь подключим платную лицензию.
  multiRouter: {
    MultiRoute: new (
      params: {
        referencePoints: [number, number][];
        params?: Record<string, unknown>;
      },
      options: Record<string, unknown>
    ) => YandexMultiRoute;
  };
  // Фабрика полностью кастомных HTML-макетов меток (без стандартного
  // синего "пина" — в отличие от iconLayout: 'default#imageWithContent',
  // который ВСЕГДА рисует дефолтную форму позади вашего контента).
  // Второй (опциональный) аргумент createClass — переопределения методов
  // базового ymaps.Layout, в частности getShape() — без него область
  // клика по кастомному макету нулевая (см. комментарий в TruckMap.tsx
  // у buildTruckBadgeHtml/getShape).
  templateLayoutFactory: {
    createClass: (template: string, options?: Record<string, unknown>) => unknown;
  };
  // Используются в getShape(), чтобы явно задать кликабельную область
  // кастомной HTML-метки (см. templateLayoutFactory выше).
  shape: {
    Circle: new (geometry: unknown) => unknown;
    Rectangle: new (geometry: unknown) => unknown;
  };
  geometry: {
    pixel: {
      Circle: new (center: [number, number], radius: number) => unknown;
      Rectangle: new (bounds: [[number, number], [number, number]]) => unknown;
    };
  };
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