// import 'dotenv/config';
// import { db } from '../lib/db';
// import { factoryOperations, factoryRequests } from '../lib/db/schema';
// import fs from 'fs';

// function parseCSVLine(line: string): string[] {
//   const result: string[] = [];
//   let inQuotes = false;
//   let current = '';
//   for (let i = 0; i < line.length; i++) {
//     const char = line[i];
//     if (char === '"') inQuotes = !inQuotes;
//     else if (char === ',' && !inQuotes) {
//       result.push(current.trim());
//       current = '';
//     } else current += char;
//   }
//   result.push(current.trim());
//   return result;
// }

// function parseNumber(value: string): number {
//   if (!value || value === '') return 0;
//   const cleaned = value.replace(/"/g, '').replace(/\s/g, '').replace(',', '.');
//   const num = parseFloat(cleaned);
//   return isNaN(num) ? 0 : num;
// }

// async function loadData() {
//   try {
//     const inoutContent = fs.readFileSync('/tmp/inout.csv', 'utf-8');
//     const statusContent = fs.readFileSync('/tmp/status.csv', 'utf-8');
    
//     console.log('📄 Загрузка операций...');
//     const inoutLines = inoutContent.split('\n').slice(1);
//     let operationsInserted = 0;
//     for (const line of inoutLines) {
//       if (!line.trim()) continue;
//       const cols = parseCSVLine(line);
//       if (cols.length < 28) continue;
      
//       const factory = cols[27] || '';
//       if (factory !== 'Щ' && factory !== 'П') continue;
      
//       const quantity = parseNumber(cols[18]);
//       if (quantity === 0) continue;
      
//       await db.insert(factoryOperations).values({
//         type: cols[15] || '',
//         date: cols[16] || '',
//         material: cols[17] || '',
//         quantity: quantity,
//         customer: cols[19] || '',
//         shipmentNumber: cols[20] || '',
//         licensePlate: cols[21] || '',
//         clientRequestNumber: cols[24] || '',
//         clientRequestDate: cols[25] || '',
//         unit: cols[26] || '',
//         factory: factory,
//         createdAt: Date.now(),
//       }).onConflictDoNothing();
//       operationsInserted++;
//     }
//     console.log(`✅ Загружено операций: ${operationsInserted}`);
    
//     // Создаём кэш заводов по clientRequestNumber
//     const allOperations = await db.select().from(factoryOperations);
//     const factoryCache = new Map();
//     for (const op of allOperations) {
//       if (op.clientRequestNumber && !factoryCache.has(op.clientRequestNumber)) {
//         factoryCache.set(op.clientRequestNumber, op.factory);
//       }
//     }
//     console.log(`📊 Кэш заводов: ${factoryCache.size} уникальных заказов`);
    
//     console.log('📄 Загрузка заявок...');
//     const statusLines = statusContent.split('\n').slice(1);
//     let requestsInserted = 0;
//     let unknownFactory = 0;
//     let skippedNoPlan = 0;
    
//     for (const line of statusLines) {
//       if (!line.trim()) continue;
//       const cols = parseCSVLine(line);
//       if (cols.length < 11) continue;
      
//       const clientRequestNumber = cols[0] || '';
//       if (!clientRequestNumber || clientRequestNumber === '') continue;
//       if (clientRequestNumber === 'Заказ покупателя айс') continue;
      
//       const planQuantity = parseNumber(cols[4]); // индекс 4 — план
//       if (planQuantity === 0) {
//         skippedNoPlan++;
//         continue;
//       }
      
//       // Определяем завод из кэша
//       let factory = factoryCache.get(clientRequestNumber);
//       if (!factory) {
//         unknownFactory++;
//         factory = 'Щ'; // по умолчанию
//       }
      
//       await db.insert(factoryRequests).values({
//         clientRequestNumber: clientRequestNumber,
//         date: cols[2] || '',        // индекс 2 — дата
//         material: cols[3] || '',     // индекс 3 — материал
//         planQuantity: planQuantity,
//         factQuantity: parseNumber(cols[5]), // индекс 5 — факт
//         consignee: cols[6] || '',     // индекс 6 — объект
//         customer: cols[7] || '',      // индекс 7 — покупатель
//         factory: factory,
//         createdAt: Date.now(),
//       }).onConflictDoNothing();
//       requestsInserted++;
//     }
    
//     console.log(`✅ Загружено заявок: ${requestsInserted}`);
//     console.log(`⚠️ Неопределённых заводов: ${unknownFactory}`);
//     console.log(`⏭️ Пропущено (план = 0): ${skippedNoPlan}`);
//   } catch (error) {
//     console.error('Ошибка:', error);
//   }
// }

// loadData();
