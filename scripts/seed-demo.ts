// scripts/seed-demo.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { 
  incomingMaterials, 
  shipments, 
  outgoingRequests,
} from '../lib/db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// ПОДКЛЮЧЕНИЕ К ДЕМО-БД
// ============================================

const sqlite = new Database('data/demo.db');
const db = drizzle(sqlite, { schema: { incomingMaterials, shipments, outgoingRequests } });

// ============================================
// ДЕМО-ДАННЫЕ
// ============================================

const demoSuppliers = [
  'Транс-Авто-Сервис',
  'Айсберг Логистик',
  'Дорожный Экспресс',
  'СтройТехСервис',
  'АвтоКомплект'
];

const demoMaterials = [
  'Асфальтобетонная смесь А-11',
  'Асфальтобетонная смесь ЩМА-16',
  'Асфальтобетонная смесь В-14',
  'Щебень гранитный фр. 5-20',
  'Песок мытый крупный',
  'Битум ПБВ 60',
  'Минеральный порошок МП-2'
];

const demoCustomers = [
  'ПК 25 Луховицкий',
  'ПК 25 Люберецкий',
  'ПК 26 Чеховский',
  'ООО "Рокс-Центр"',
  'ООО "Альба Торг"',
  'ООО "СК Модерн"',
  'ООО "Строительная Компания"'
];

const demoLicensePlates = [
  'А123ВВ777', 'В727ВС790', 'М448ВТ790', 'Х580АУ790',
  'Е100ВК250', 'М414ВТ790', 'Н456ХК790', 'С285ВН790',
  'А544МК750', 'У233ТН790', 'М335ВТ790', 'В864ВС790'
];

const demoDrivers = [
  'Иванов И.И.', 'Петров П.П.', 'Сидоров С.С.',
  'Кузнецов А.А.', 'Смирнов В.В.', 'Попов Д.Д.'
];

// Генерация случайной даты в пределах последних 7 дней
function randomDate(): string {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 7);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function randomWeight(): number {
  return Math.round((20 + Math.random() * 30) * 100) / 100;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================
// ГЕНЕРАЦИЯ ДАННЫХ
// ============================================

async function generateDemoData() {
  console.log('🚀 Начало генерации демо-данных...');
  
  // 1. Очистка старых демо-данных
  console.log('🧹 Очистка старых демо-данных...');
  await db.delete(incomingMaterials).where(eq(incomingMaterials.division, 'ДЕМО'));
  await db.delete(shipments).where(eq(shipments.division, 'ДЕМО'));
  await db.delete(outgoingRequests).where(eq(outgoingRequests.division, 'ДЕМО'));
  
  // 2. Создание заявок
  console.log('📋 Генерация заявок...');
  const requests = [];
  for (let i = 1; i <= 30; i++) {
    const customer = demoCustomers[randomInt(0, demoCustomers.length - 1)];
    const material = demoMaterials[randomInt(0, demoMaterials.length - 1)];
    const quantity = Math.round((50 + Math.random() * 150) * 10) / 10;
    const deliveryDate = new Date(randomDate());
    deliveryDate.setHours(8 + Math.floor(Math.random() * 12), 0, 0, 0);
    
    requests.push({
      number: `ДЕМО-ЗАЯВКА-${String(i).padStart(3, '0')}`,
      date: randomDate(),
      division: 'ДЕМО',
      customer: customer,
      consignee: demoCustomers[randomInt(0, demoCustomers.length - 1)],
      material: material,
      quantity: quantity,
      clientRequestNumber: `ДЕМО-ЗАЯВКА-${String(i).padStart(3, '0')}`,
      clientRequestDate: randomDate(),
      closed: Math.random() > 0.7,
      delivery_date: deliveryDate.toISOString(),
      createdAt: Date.now(),
    });
  }
  
  for (const req of requests) {
    await db.insert(outgoingRequests).values(req);
  }
  console.log(`✅ Создано ${requests.length} заявок`);
  
  // 3. Создание отгрузок
  console.log('🚛 Генерация отгрузок...');
  const shipmentsData = [];
  for (let i = 1; i <= 80; i++) {
    const request = requests[randomInt(0, requests.length - 1)];
    const quantity = randomWeight();
    
    shipmentsData.push({
      number: `ДЕМО-ОТГР-${String(i).padStart(3, '0')}`,
      date: randomDate(),
      division: 'ДЕМО',
      customer: request.customer,
      consignee: request.consignee,
      material: request.material,
      gross: Math.round((quantity + 15) * 100) / 100,
      tara: 15,
      quantity: quantity,
      driver: demoDrivers[randomInt(0, demoDrivers.length - 1)],
      licensePlate: demoLicensePlates[randomInt(0, demoLicensePlates.length - 1)],
      clientRequestNumber: request.number,
      clientRequestDate: request.date,
      createdAt: Date.now(),
    });
  }
  
  for (const ship of shipmentsData) {
    await db.insert(shipments).values(ship);
  }
  console.log(`✅ Создано ${shipmentsData.length} отгрузок`);
  
  // 4. Создание поступлений
  console.log('📦 Генерация поступлений...');
  const incomingData = [];
  for (let i = 1; i <= 50; i++) {
    const supplier = demoSuppliers[randomInt(0, demoSuppliers.length - 1)];
    const material = demoMaterials[randomInt(0, demoMaterials.length - 1)];
    const quantity = randomWeight();
    const licensePlate = demoLicensePlates[randomInt(0, demoLicensePlates.length - 1)];
    
    incomingData.push({
      number: `ДЕМО-ПРИХ-${String(i).padStart(3, '0')}`,
      date: randomDate(),
      division: 'ДЕМО',
      supplier: supplier,
      material: material,
      gross: Math.round((quantity + 15) * 100) / 100,
      tara: 15,
      quantity: quantity,
      driver: demoDrivers[randomInt(0, demoDrivers.length - 1)],
      licensePlate: licensePlate,
      clientRequestNumber: `ДЕМО-ПРИХ-${String(i).padStart(3, '0')}`,
      createdAt: Date.now(),
    });
  }
  
  for (const inc of incomingData) {
    await db.insert(incomingMaterials).values(inc);
  }
  console.log(`✅ Создано ${incomingData.length} поступлений`);
  
  console.log('🎉 Демо-данные успешно созданы!');
}

// ============================================
// ЗАПУСК
// ============================================

generateDemoData()
  .then(() => {
    console.log('✅ Готово!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Ошибка:', err);
    process.exit(1);
  });