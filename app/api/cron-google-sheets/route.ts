// app/api/cron-google-sheets/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { factoryOperations, factoryRequests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-factory.json');
const INOUT_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQLfWUkr0Alts--4TXfQU8mi2cAbpFxZOIZnnKjQpoJx9dwu0JxsUFBk6Udn-eNDU0yrhArol762-tC/pub?gid=1654180509&single=true&output=csv';
const STATUS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQLfWUkr0Alts--4TXfQU8mi2cAbpFxZOIZnnKjQpoJx9dwu0JxsUFBk6Udn-eNDU0yrhArol762-tC/pub?gid=582522648&single=true&output=csv';
// Вместо старых URL, используйте:
// const INOUT_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQLfWUkr0Alts--4TXfQU8mi2cAbpFxZOIZnnKjQpoJx9dwu0JxsUFBk6Udn-eNDU0yrhArol762-tC/export?gid=1654180509&format=csv';
// const STATUS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQLfWUkr0Alts--4TXfQU8mi2cAbpFxZOIZnnKjQpoJx9dwu0JxsUFBk6Udn-eNDU0yrhArol762-tC/export?gid=582522648&format=csv';


async function fetchCSV(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.text();
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNumber(value: string): number {
  if (!value || value === '') return 0;
  const cleaned = value.replace(/"/g, '').replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Загружаем и парсим INOUT (столбцы P-AB: индексы 15-27)
    const inoutCsv = await fetchCSV(INOUT_URL);
    const inoutLines = inoutCsv.split('\n').slice(1);
    let operationsInserted = 0;
    
    for (const line of inoutLines) {
      if (!line.trim()) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 28) continue;
      
      const factory = cols[27] || '';
      if (factory !== 'Щ' && factory !== 'П') continue;
      
      const quantity = parseNumber(cols[18]);
      if (quantity === 0) continue;
      
      const clientRequestNumber = cols[24] || '';
      const shipmentNumber = cols[20] || '';
      
      const existing = await db
        .select()
        .from(factoryOperations)
        .where(eq(factoryOperations.shipmentNumber, shipmentNumber))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(factoryOperations).values({
          type: cols[15] || '',
          date: cols[16] || '',
          material: cols[17] || '',
          quantity: quantity,
          customer: cols[19] || '',
          shipmentNumber: shipmentNumber,
          licensePlate: cols[21] || '',
          clientRequestNumber: clientRequestNumber,
          clientRequestDate: cols[25] || '',
          unit: cols[26] || '',
          factory: factory,
          createdAt: Date.now(),
        });
        operationsInserted++;
      }
    }
    
    // 2. Загружаем и парсим STATUS (столбцы B-K: индексы 0-10)
    const statusCsv = await fetchCSV(STATUS_URL);
    const statusLines = statusCsv.split('\n').slice(1);
    let requestsInserted = 0;
    
    for (const line of statusLines) {
      if (!line.trim()) continue;
      const cols = parseCSVLine(line);
      if (cols.length < 11) continue;
      
      const clientRequestNumber = cols[0] || '';
      if (!clientRequestNumber || clientRequestNumber === '') continue;
      if (clientRequestNumber === 'Заказ покупателя айс') continue;
      
      const planQuantity = parseNumber(cols[4]);
      if (planQuantity === 0) continue;
      
      const existing = await db
        .select()
        .from(factoryRequests)
        .where(eq(factoryRequests.clientRequestNumber, clientRequestNumber))
        .limit(1);
      
      if (existing.length === 0) {
        // Определяем завод из операций или по умолчанию
        let factory = 'Щ';
        const relatedOp = await db
          .select()
          .from(factoryOperations)
          .where(eq(factoryOperations.clientRequestNumber, clientRequestNumber))
          .limit(1);
        
        if (relatedOp.length > 0) {
          factory = relatedOp[0].factory;
        }
        
        await db.insert(factoryRequests).values({
          clientRequestNumber: clientRequestNumber,
          date: cols[2] || '',
          material: cols[3] || '',
          planQuantity: planQuantity,
          factQuantity: parseNumber(cols[5]),
          consignee: cols[6] || '',
          customer: cols[7] || '',
          factory: factory,
          createdAt: Date.now(),
        });
        requestsInserted++;
      }
    }
    
    // Сохраняем время последней синхронизации
    fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({
      lastSync: new Date().toISOString(),
    }));
    
    return NextResponse.json({
      success: true,
      operations: operationsInserted,
      requests: requestsInserted,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Google Sheets cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}




// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { factoryOperations, factoryRequests } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';

// const INOUT_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQLfWUkr0Alts--4TXfQU8mi2cAbpFxZOIZnnKjQpoJx9dwu0JxsUFBk6Udn-eNDU0yrhArol762-tC/pub?gid=1654180509&single=true&output=csv';
// const STATUS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQLfWUkr0Alts--4TXfQU8mi2cAbpFxZOIZnnKjQpoJx9dwu0JxsUFBk6Udn-eNDU0yrhArol762-tC/pub?gid=582522648&single=true&output=csv';

// async function fetchCSV(url: string): Promise<string> {
//   const response = await fetch(url, { redirect: 'follow' });
//   if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
//   return response.text();
// }

// function parseCSVLine(line: string): string[] {
//   const result = [];
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

// export async function GET(request: Request) {
//   const authHeader = request.headers.get('authorization');
//   const cronSecret = process.env.CRON_SECRET;
//   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }

//   try {
//     // Парсим INOUT (столбцы P-AB: индексы 0-12)
//     const inoutCsv = await fetchCSV(INOUT_URL);
//     const inoutLines = inoutCsv.split('\n').slice(1);
//     let operationsInserted = 0;
    
//     for (const line of inoutLines) {
//       if (!line.trim()) continue;
//       const cols = parseCSVLine(line);
//       const type = cols[0];
//       const date = cols[1];
//       const material = cols[2];
//       const quantity = parseFloat(cols[3]?.replace(',', '.') || '0');
//       const customer = cols[4] || '';
//       const shipmentNumber = cols[5] || '';
//       const licensePlate = cols[6] || '';
//       const clientRequestNumber = cols[9] || '';
//       const clientRequestDate = cols[10] || '';
//       const unit = cols[11] || '';
//       const factory = cols[12] || '';
      
//       if (!date || !material || isNaN(quantity)) continue;
      
//       const existing = await db.select().from(factoryOperations).where(eq(factoryOperations.shipmentNumber, shipmentNumber)).limit(1);
//       if (existing.length === 0) {
//         await db.insert(factoryOperations).values({
//           type, date, material, quantity, customer, shipmentNumber, licensePlate,
//           clientRequestNumber, clientRequestDate, unit, factory, createdAt: Date.now(),
//         });
//         operationsInserted++;
//       }
//     }
    
//     // Парсим STATUS (столбцы B-K: индексы 0-9)
//     const statusCsv = await fetchCSV(STATUS_URL);
//     const statusLines = statusCsv.split('\n').slice(1);
//     let requestsInserted = 0;
    
//     for (const line of statusLines) {
//       if (!line.trim()) continue;
//       const cols = parseCSVLine(line);
//       const clientRequestNumber = cols[0];
//       const date = cols[1];
//       const material = cols[2];
//       const planQuantity = parseFloat(cols[3]?.replace(',', '.') || '0');
//       const factQuantity = parseFloat(cols[4]?.replace(',', '.') || '0');
//       const consignee = cols[5] || '';
//       const customer = cols[6] || '';
//       const factory = cols[9] || '';
      
//       if (!clientRequestNumber || !date || isNaN(planQuantity)) continue;
      
//       const existing = await db.select().from(factoryRequests).where(eq(factoryRequests.clientRequestNumber, clientRequestNumber)).limit(1);
//       if (existing.length === 0) {
//         await db.insert(factoryRequests).values({
//           clientRequestNumber, date, material, planQuantity, factQuantity, consignee, customer, factory, createdAt: Date.now(),
//         });
//         requestsInserted++;
//       }
//     }
    
//     return NextResponse.json({ success: true, operations: operationsInserted, requests: requestsInserted });
//   } catch (error) {
//     console.error('Google Sheets cron error:', error);
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//   }
// }