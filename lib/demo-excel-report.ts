// lib/demo-excel-report.ts
//
// Демонстрация PRO-фичи "Excel отчёты" на /demo: собирает приход и
// отгрузки за сегодня из демо-данных и формирует .xlsx с двумя листами
// прямо в браузере (без похода на сервер — это ведь просто демо-витрина).
// Библиотека 'xlsx' подключается динамически (import()), чтобы не
// раздувать основной бандл ради фичи, которой пользуется меньшинство.
import type { IncomingItem, ShipmentItem } from '@/app/page';
import { parseRussianDate, getFactoryName } from '@/lib/utils';

function isToday(dateStr: string): boolean {
  const d = parseRussianDate(dateStr);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function fmtDateForFile(): string {
  const d = new Date();
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

interface ReportOptions {
  incoming: IncomingItem[];
  shipments: ShipmentItem[];
}

export async function generateDemoExcelReport({ incoming, shipments }: ReportOptions): Promise<void> {
  const XLSX = await import('xlsx');

  const todayIncoming = incoming.filter((r) => isToday(r.date));
  const todayShipments = shipments.filter((r) => isToday(r.date));

  const incomingRows = todayIncoming.map((r) => ({
    'Дата/время': r.date,
    'Завод': getFactoryName(r.division).replace(/^\S+\s/, ''), // без эмодзи-иконки завода
    'Поставщик': r.supplier,
    'Материал': r.material,
    'Гросс, т': r.gross ?? '',
    'Тара, т': r.tara ?? '',
    'Нетто, т': r.quantity,
    'Водитель': r.driver ?? '',
    'Госномер': r.licensePlate ?? '',
    '№ заявки': r.clientRequestNumber ?? '',
  }));
  const incomingTotal = todayIncoming.reduce((s, r) => s + (r.quantity || 0), 0);
  incomingRows.push({
    'Дата/время': '',
    'Завод': '',
    'Поставщик': '',
    'Материал': 'ИТОГО за сегодня',
    'Гросс, т': '',
    'Тара, т': '',
    'Нетто, т': Math.round(incomingTotal * 100) / 100,
    'Водитель': '',
    'Госномер': '',
    '№ заявки': '',
  } as (typeof incomingRows)[number]);

  const shipmentRows = todayShipments.map((r) => ({
    'Дата/время': r.date,
    'Завод': getFactoryName(r.division).replace(/^\S+\s/, ''),
    'Заказчик': r.customer,
    'Грузополучатель': r.consignee || r.customer,
    'Материал': r.material,
    'Кол-во, т': r.quantity,
    'Водитель': r.driver ?? '',
    'Госномер': r.licensePlate ?? '',
    '№ заявки': r.clientRequestNumber ?? '',
  }));
  const shipmentTotal = todayShipments.reduce((s, r) => s + (r.quantity || 0), 0);
  shipmentRows.push({
    'Дата/время': '',
    'Завод': '',
    'Заказчик': '',
    'Грузополучатель': 'ИТОГО за сегодня',
    'Материал': '',
    'Кол-во, т': Math.round(shipmentTotal * 100) / 100,
    'Водитель': '',
    'Госномер': '',
    '№ заявки': '',
  } as (typeof shipmentRows)[number]);

  const wsIncoming = XLSX.utils.json_to_sheet(incomingRows);
  wsIncoming['!cols'] = [
    { wch: 18 }, { wch: 10 }, { wch: 20 }, { wch: 26 }, { wch: 9 },
    { wch: 9 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
  ];

  const wsShipments = XLSX.utils.json_to_sheet(shipmentRows);
  wsShipments['!cols'] = [
    { wch: 18 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 26 },
    { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsShipments, 'Отгрузка');
  XLSX.utils.book_append_sheet(wb, wsIncoming, 'Приход');

  XLSX.writeFile(wb, `АБЗ Контроль — отчёт за ${fmtDateForFile()}.xlsx`);
}
