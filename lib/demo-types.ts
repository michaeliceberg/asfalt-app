// lib/demo-types.ts

// Тип для сырых данных поступлений из 1С
export interface RawIncomingItem {
  Номер: string;
  Дата: string;
  Поставщик: string;
  Номенклатура: string;
  Количество: number;
  Подразделение: string;
  Водитель?: string;
  ГосНомер?: string;
  Брутто?: number;
  Тара?: number;
}

// Тип для сырых данных отгрузок из 1С
export interface RawShipmentItem {
  Номер: string;
  Дата: string;
  Покупатель: string;
  Грузополучатель: string;
  Номенклатура: string;
  Количество: number;
  Подразделение: string;
  Водитель?: string;
  ГосНомер?: string;
  Брутто?: number;
  Тара?: number;
  ЗаявкаНаОтгрузкуНомер?: string | null;
  ЗаявкаНаОтгрузкуДата?: string | null;
}

// Тип для сырых данных заявок из 1С
export interface RawRequestItem {
  Номер: string;
  Дата: string;
  Покупатель: string;
  Грузополучатель: string;
  Номенклатура: string;
  Количество: number;
  Подразделение: string;
  Закрыта?: boolean;
  ДатаОтгрузки?: string | null;
}

// Демо-тип для заявок (если нужен отдельный)
export interface DemoOutgoingRequest {
  id: number;
  number: string;
  date: string;
  division: string;
  customer: string;
  consignee: string | null;
  material: string;
  quantity: number;
  clientRequestNumber: string | null;
  clientRequestDate: string | null;
  closed: boolean | null;
  delivery_date: string | null;
  createdAt: number;
}