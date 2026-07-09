// lib/demo-data.ts
import { IncomingItem, ShipmentItem } from '@/app/page';
import { OutgoingRequest } from '@/lib/db/schema'; // ← Правильный импорт
import { RawIncomingItem, RawShipmentItem, RawRequestItem } from './demo-types';
import { rawIncomingData, rawShipmentData, rawRequestData } from './demo-raw-data';

// ============================================
// МАППИНГИ ДЛЯ КОНВЕРТАЦИИ
// ============================================

const supplierMap: Record<string, string> = {
  'ТТК ВЕКТОР ООО': 'ООО "ДорСнаб"',
  'ЛУХОВИЦКИЙ ГОК ООО': 'ООО "Горная Компания"',
  'АЙСБЕРГ ООО': 'ООО "СтройТех"',
};

const consigneeMap: Record<string, string> = {
  'ПК 25 Шатурский': 'ДСУ-1 Шатурский',
  'ПК 25 Зарайский': 'ДСУ-2 Зарайский',
  'ПК 25 Каширский': 'ДСУ-3 Каширский',
  'ПК 25 Воскресенский': 'ДСУ-4 Воскресенский',
  'ПК 25 Луховицкий': 'ДСУ-5 Луховицкий',
  'ПК 25 Коломенский': 'ДСУ-6 Коломенский',
  'ПК 25 Серпуховский': 'ДСУ-7 Серпуховский',
  'МОСКОВСКИЙ МЕТРОПОЛИТЕН ГУП': 'ГУП "МосДор"',
  'АЙСБЕРГ ООО': 'ООО "СтройТех"',
};

const numberMap: Record<string, string> = {
  'ЛХ': 'ДЕМО-СЕВ',
  'ЛЮ': 'ДЕМО-ЮГ',
};

const divisionMap: Record<string, string> = {
  'Луховицы': 'ДЕМО-СЕВ',
  'Люберцы': 'ДЕМО-ЮГ',
  'ЛХ': 'ДЕМО-СЕВ',
  'ЛЮ': 'ДЕМО-ЮГ',
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function replaceNumberPrefix(number: string): string {
  for (const [prefix, replacement] of Object.entries(numberMap)) {
    if (number.startsWith(prefix)) {
      return number.replace(prefix, replacement);
    }
  }
  return number;
}

function getDemoDivision(division: string): string {
  return divisionMap[division] || 'ДЕМО-СЕВ';
}

function getDemoSupplier(supplier: string): string {
  return supplierMap[supplier] || supplier;
}

function getDemoConsignee(consignee: string): string {
  return consigneeMap[consignee] || consignee;
}

function getDemoCustomer(customer: string): string {
  return supplierMap[customer] || customer;
}

// ============================================
// ФУНКЦИИ КОНВЕРТАЦИИ
// ============================================

function convertIncoming(raw: RawIncomingItem): IncomingItem {
  return {
    id: 0,
    number: replaceNumberPrefix(raw.Номер),
    date: raw.Дата,
    division: getDemoDivision(raw.Подразделение),
    supplier: getDemoSupplier(raw.Поставщик),
    material: raw.Номенклатура,
    gross: raw.Брутто ?? null,
    tara: raw.Тара ?? null,
    quantity: raw.Количество,
    driver: raw.Водитель ?? null,
    licensePlate: raw.ГосНомер ?? null,
    clientRequestNumber: null,
    createdAt: Date.now(),
  };
}

function convertShipment(raw: RawShipmentItem): ShipmentItem {
  return {
    id: 0,
    number: replaceNumberPrefix(raw.Номер),
    date: raw.Дата,
    division: getDemoDivision(raw.Подразделение),
    customer: getDemoCustomer(raw.Покупатель),
    consignee: getDemoConsignee(raw.Грузополучатель),
    material: raw.Номенклатура,
    gross: raw.Брутто ?? null,
    tara: raw.Тара ?? null,
    quantity: raw.Количество,
    driver: raw.Водитель ?? null,
    licensePlate: raw.ГосНомер ?? null,
    clientRequestNumber: raw.ЗаявкаНаОтгрузкуНомер ?? null,
    clientRequestDate: raw.ЗаявкаНаОтгрузкуДата ?? null,
    destinationPoint: null, // ✅ ДОБАВЛЯЕМ
    createdAt: Date.now(),
  };
}

function convertRequest(raw: RawRequestItem): OutgoingRequest {
  return {
    id: 0,
    number: replaceNumberPrefix(raw.Номер),
    date: raw.Дата,
    division: getDemoDivision(raw.Подразделение),
    customer: getDemoCustomer(raw.Покупатель),
    consignee: getDemoConsignee(raw.Грузополучатель),
    material: raw.Номенклатура,
    quantity: raw.Количество,
    unit: null, // ← OK, тип из схемы содержит это поле
    clientRequestNumber: null,
    clientRequestDate: null,
    closed: raw.Закрыта ?? false,
    delivery_date: raw.ДатаОтгрузки ?? null,
    destinationPoint: null, // ✅ ДОБАВЛЯЕМ
    createdAt: Date.now(),
  };
}

// ============================================
// ЭКСПОРТ
// ============================================

export const demoIncoming: IncomingItem[] = rawIncomingData.map(convertIncoming);
export const demoShipments: ShipmentItem[] = rawShipmentData.map(convertShipment);
export const demoRequests: OutgoingRequest[] = rawRequestData.map(convertRequest);

export function getDemoData() {
  return {
    incoming: demoIncoming,
    shipments: demoShipments,
    requests: demoRequests,
  };
}
