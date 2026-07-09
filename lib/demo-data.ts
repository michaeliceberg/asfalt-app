// lib/demo-data.ts
import { IncomingItem, ShipmentItem } from '@/app/page';
import { OutgoingRequest } from '@/lib/db/schema'; // ← Правильный импорт
import { recentShipmentsRaw, recentRequestsRaw, recentIncomingRaw } from './demo-recent-data';

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
// Исходные исторические данные (demo-raw-data.ts) были рукописным экспортом
// на фиксированную дату и со временем "протухали" (не двигались вместе с
// "сегодня"), да ещё и не содержали привязки отгрузок к заявкам. Теперь
// базовый массив демо-данных — реальный анонимизированный снимок последних
// 3 дней из боевой БД (lib/demo-recent-data.ts, сгенерирован скриптом из
// data/sqlite.db). Даты в нём хранятся как смещение в днях (dayOffset) и
// пересчитываются здесь через daysAgo(), поэтому демо всегда "сегодняшнее".

function fmtRuDateTime(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${day}.${month}.${year} ${hh}:${mm}:${ss}`;
}

function daysAgo(n: number, hour: number, minute: number, second: number = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, second, 0);
  return d;
}

function daysAhead(n: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const CONCRETE_MATERIALS = [
  'БСТ В22,5 П4 F150 W4',
  'БСТ В25 П3 F200 W6',
  'Бетон В30 П4 F300 W8',
  'БСМ В15 П2 F100',
];

const CONCRETE_CONSIGNEES_SEV = ['ЖК «Северный Парк»', 'Мостоотряд-14', 'ДСУ «Магистраль»'];
const CONCRETE_CONSIGNEES_YUG = ['ЖК «Южные Ворота»', 'СК «Фундамент»'];

const DEMO_DRIVERS = ['Кузнецов А.А.', 'Смирнов В.В.', 'Попов Д.С.', 'Соколов Н.И.', 'Морозов Е.П.'];
const DEMO_PLATES = ['У317МХ190', 'О552НК150', 'Т884АР750', 'Х119ВЕ190', 'М440КТ150', 'Е705СУ190'];

export const demoConcreteShipments: ShipmentItem[] = (() => {
  const items: ShipmentItem[] = [];
  const plan: Array<{ division: string; consignees: string[]; count: number; dayOffsets: number[] }> = [
    { division: 'ДЕМО-СЕВ', consignees: CONCRETE_CONSIGNEES_SEV, count: 9, dayOffsets: [0, 0, 0, 0, 1, 1, 1, 2, 2] },
    { division: 'ДЕМО-ЮГ', consignees: CONCRETE_CONSIGNEES_YUG, count: 7, dayOffsets: [0, 0, 0, 1, 1, 2, 2] },
  ];

  let idx = 1;
  plan.forEach(({ division, consignees, count, dayOffsets }) => {
    for (let i = 0; i < count; i++) {
      const dayOffset = dayOffsets[i] ?? 0;
      const hour = 7 + (i * 2) % 12;
      const minute = (i * 17) % 60;
      const date = daysAgo(dayOffset, hour, minute);
      const material = CONCRETE_MATERIALS[i % CONCRETE_MATERIALS.length];
      const quantity = 8 + ((i * 3) % 12); // м³, 8–19
      const requestNumber = `${division}-З${100 + idx}`;

      items.push({
        id: 0,
        number: `${division}-Б${1000 + idx}`,
        date: fmtRuDateTime(date),
        division,
        customer: 'ООО «СтройТех»',
        consignee: consignees[i % consignees.length],
        material,
        gross: null,
        tara: null,
        quantity,
        driver: DEMO_DRIVERS[idx % DEMO_DRIVERS.length],
        licensePlate: DEMO_PLATES[idx % DEMO_PLATES.length],
        clientRequestNumber: requestNumber,
        clientRequestDate: fmtRuDateTime(date),
        destinationPoint: null,
        createdAt: Date.now(),
      });
      idx++;
    }
  });

  return items;
})();

// ============================================
// КУРИРОВАННАЯ ГРУППА — САМАЯ СВЕЖАЯ ДАТА (сегодня)
// ============================================
// Реальные данные уже показывают связь Вып/Заяв корректно, но добавляем
// ещё и рукописную "витрину" на сегодня — это гарантирует красивую
// демонстрацию независимо от того, что реально отгружалось сегодня:
// (1) показывает работающую колонку "Заяв", (2) даёт "самую верхнюю"
// дату (т.к. остальные даты — исторические, из прошлого), (3) даёт
// пример полностью выполненной заявки (зелёная строка) и одной активной
// незавершённой (мигающая точка + верное число машин при раскрытии).

interface TopDateRequestPlan {
  division: string;
  consignee: string;
  material: string;
  planQuantity: number;
  truckLoads: number[];
  closed: boolean;
  startHour: number;
}

const TOP_DATE_PLAN: TopDateRequestPlan[] = [
  {
    division: 'ДЕМО-СЕВ',
    consignee: 'ДСУ-2 Зарайский',
    material: 'А-16 Вн МОСАВТОДОР',
    planQuantity: 725,
    truckLoads: [38.99, 35.31, 36.81, 36.5, 39.58, 39.22, 40.51, 35.68, 37.69, 35.34, 36.47, 38.19, 35.32, 36.35, 39.06, 38.43, 36.48, 38.69, 50.38],
    closed: true,
    startHour: 6,
  },
  {
    division: 'ДЕМО-СЕВ',
    consignee: 'ДСУ-5 Луховицкий',
    material: 'ЩМА-20',
    planQuantity: 815,
    truckLoads: [39.26, 34.44, 39.23, 38.59, 36.44, 35.33, 40.14, 36.42, 34.96, 39.19],
    closed: false, // ← активная, ещё не выполнена (374 из 815)
    startHour: 8,
  },
  {
    division: 'ДЕМО-ЮГ',
    consignee: 'ГУП "МосДор"',
    material: 'Асфальт МЗ тип Б м I',
    planQuantity: 540,
    truckLoads: [36.15, 40.66, 39.19, 40.41, 39.95, 38.79, 41.41, 37.84, 38.88, 40.55, 39.28, 40.74, 39.04, 27.11],
    closed: true,
    startHour: 6,
  },
  {
    division: 'ДЕМО-СЕВ',
    consignee: 'ДСУ-1 Шатурский',
    material: 'А-16 Вн МОСАВТОДОР',
    planQuantity: 320,
    truckLoads: [41.23, 37.27, 38.37, 38.74, 37.48, 38.4, 37.61, 50.9],
    closed: true,
    startHour: 7,
  },
  {
    division: 'ДЕМО-ЮГ',
    consignee: 'ДСУ-6 Коломенский',
    material: 'ЩМА-15',
    planQuantity: 266,
    truckLoads: [36.67, 38.81, 37.19, 37.22, 36.26, 36.6, 43.25],
    closed: true,
    startHour: 9,
  },
];

export const demoTopDateShipments: ShipmentItem[] = (() => {
  const items: ShipmentItem[] = [];
  let globalIdx = 0;

  TOP_DATE_PLAN.forEach((plan, reqIdx) => {
    const requestNumber = `${plan.division}-З3${(reqIdx + 1).toString().padStart(2, '0')}`;

    plan.truckLoads.forEach((qty, i) => {
      const hour = plan.startHour + Math.floor((i * 25) / 60);
      const minute = (i * 25) % 60;
      const date = daysAgo(0, hour, minute);

      items.push({
        id: 0,
        number: `${plan.division}-А30${(globalIdx + 1).toString().padStart(3, '0')}`,
        date: fmtRuDateTime(date),
        division: plan.division,
        customer: 'ООО «СтройТех»',
        consignee: plan.consignee,
        material: plan.material,
        gross: null,
        tara: null,
        quantity: Math.round(qty * 100) / 100,
        driver: DEMO_DRIVERS[globalIdx % DEMO_DRIVERS.length],
        licensePlate: DEMO_PLATES[globalIdx % DEMO_PLATES.length],
        clientRequestNumber: requestNumber,
        clientRequestDate: fmtRuDateTime(daysAgo(0, plan.startHour, 0)),
        destinationPoint: null,
        createdAt: Date.now(),
      });
      globalIdx++;
    });
  });

  return items;
})();

export const demoTopDateRequests: OutgoingRequest[] = TOP_DATE_PLAN.map((plan, reqIdx) => {
  const requestNumber = `${plan.division}-З3${(reqIdx + 1).toString().padStart(2, '0')}`;
  return {
    id: 0,
    number: requestNumber,
    date: fmtRuDateTime(daysAgo(0, plan.startHour, 0)),
    division: plan.division,
    customer: 'ООО «СтройТех»',
    consignee: plan.consignee,
    material: plan.material,
    quantity: plan.planQuantity,
    unit: null,
    clientRequestNumber: null,
    clientRequestDate: null,
    closed: plan.closed,
    delivery_date: fmtRuDateTime(daysAgo(0, plan.startHour, 0)),
    destinationPoint: null,
    createdAt: Date.now(),
  };
});

// ============================================
// "НА БУДУЩЕЕ" — запланированные заявки
// ============================================

export const demoFutureRequests: OutgoingRequest[] = (() => {
  const plan: Array<{ division: string; consignee: string; material: string; quantity: number; dayOffset: number; hour: number; minute: number }> = [
    { division: 'ДЕМО-СЕВ', consignee: 'ДСУ-2 Зарайский', material: 'Асфальтобетон А16 тип Б', quantity: 420, dayOffset: 1, hour: 8, minute: 0 },
    { division: 'ДЕМО-СЕВ', consignee: 'ДСУ-5 Луховицкий', material: 'ЩМА-20', quantity: 380, dayOffset: 2, hour: 9, minute: 30 },
    { division: 'ДЕМО-СЕВ', consignee: 'Мостоотряд-14', material: 'БСТ В25 П3 F200 W6', quantity: 60, dayOffset: 3, hour: 10, minute: 0 },
    { division: 'ДЕМО-ЮГ', consignee: 'ГУП «МосДор»', material: 'Асфальтобетон А16 тип А', quantity: 500, dayOffset: 1, hour: 7, minute: 45 },
    { division: 'ДЕМО-ЮГ', consignee: 'СК «Фундамент»', material: 'Бетон В30 П4 F300 W8', quantity: 45, dayOffset: 4, hour: 11, minute: 15 },
  ];

  return plan.map((p, i) => {
    const created = daysAgo(1, 12, 0);
    const delivery = daysAhead(p.dayOffset, p.hour, p.minute);
    const requestNumber = `${p.division}-З${200 + i}`;
    return {
      id: 0,
      number: requestNumber,
      date: fmtRuDateTime(created),
      division: p.division,
      customer: 'ООО «СтройТех»',
      consignee: p.consignee,
      material: p.material,
      quantity: p.quantity,
      unit: null,
      clientRequestNumber: null,
      clientRequestDate: null,
      closed: false,
      delivery_date: delivery.toISOString(),
      destinationPoint: null,
      createdAt: Date.now(),
    };
  });
})();

// ============================================
// РЕАЛЬНЫЕ ДАННЫЕ ЗА ПОСЛЕДНИЕ 3 ДНЯ (анонимизированные)
// ============================================

const demoRecentShipments: ShipmentItem[] = recentShipmentsRaw.map((r) => {
  const date = daysAgo(r.dayOffset, r.hour, r.minute, r.second);
  return {
    id: 0,
    number: r.number,
    date: fmtRuDateTime(date),
    division: r.division,
    customer: r.customer,
    consignee: r.consignee,
    material: r.material,
    gross: null,
    tara: null,
    quantity: r.quantity,
    driver: r.driver,
    licensePlate: r.licensePlate,
    clientRequestNumber: r.clientRequestNumber,
    clientRequestDate: r.clientRequestNumber ? fmtRuDateTime(date) : null,
    destinationPoint: null,
    createdAt: Date.now(),
  };
});

const demoRecentRequests: OutgoingRequest[] = recentRequestsRaw.map((r) => {
  const date = daysAgo(r.dayOffset, r.hour, r.minute, r.second);
  return {
    id: 0,
    number: r.number,
    date: fmtRuDateTime(date),
    division: r.division,
    customer: r.customer,
    consignee: r.consignee,
    material: r.material,
    quantity: r.quantity,
    unit: null,
    clientRequestNumber: null,
    clientRequestDate: null,
    closed: r.closed,
    delivery_date: fmtRuDateTime(date),
    destinationPoint: null,
    createdAt: Date.now(),
  };
});

const demoRecentIncoming: IncomingItem[] = recentIncomingRaw.map((r) => {
  const date = daysAgo(r.dayOffset, r.hour, r.minute, r.second);
  return {
    id: 0,
    number: r.number,
    date: fmtRuDateTime(date),
    division: r.division,
    supplier: r.supplier,
    material: r.material,
    gross: r.gross,
    tara: r.tara,
    quantity: r.quantity,
    driver: r.driver,
    licensePlate: r.licensePlate,
    clientRequestNumber: null,
    createdAt: Date.now(),
  };
});

// ============================================
// ЭКСПОРТ
// ============================================

export const demoIncoming: IncomingItem[] = demoRecentIncoming;
export const demoShipments: ShipmentItem[] = [
  ...demoRecentShipments,
  ...demoConcreteShipments,
  ...demoTopDateShipments,
];
export const demoRequests: OutgoingRequest[] = [
  ...demoRecentRequests,
  ...demoTopDateRequests,
  ...demoFutureRequests,
];

export function getDemoData() {
  return {
    incoming: demoIncoming,
    shipments: demoShipments,
    requests: demoRequests,
    futureRequests: demoFutureRequests,
  };
}
