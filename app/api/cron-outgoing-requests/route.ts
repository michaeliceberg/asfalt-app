import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-requests.json');

export async function GET(request: Request) {
  try {
    // Отключаем проверку SSL для Node.js
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    const UNF_BASE_URL = process.env.UNF_BASE_URL;
    const LOGIN = process.env.UNF_LOGIN;
    const PASSWORD = process.env.UNF_PASSWORD;
    
    console.log('Fetching data from 1C...');
    
    const url = `${UNF_BASE_URL}/hs/WebData-API/OutgoingRequest`;
    const auth = 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Received ${data.length} records from 1C`);
    
    let insertedCount = 0;
    
    for (const record of data) {
      const existing = await db
        .select()
        .from(outgoingRequests)
        .where(eq(outgoingRequests.number, record.Номер))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(outgoingRequests).values({
          number: record.Номер,
          date: record.Дата,
          division: record.Подразделение === 'Луховицы' ? 'ЛХ' : 'ЛЮ',
          customer: record.Покупатель,
          consignee: record.Грузополучатель || null,
          material: record.Номенклатура,
          quantity: record.Количество,
          clientRequestNumber: record.НомерЗаявкиКлиента || null,
          clientRequestDate: record.ДатаЗаявкиКлиента || null,
          closed: record.Закрыта === true,
          delivery_date: record.ДатаОтгрузки || null,
          destinationPoint: record.ПунктНазначения || null,
          createdAt: Date.now(),
        });
        insertedCount++;
      }
    }
    
    fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({
      lastSync: new Date().toISOString(),
      totalRecords: data.length,
      newRecords: insertedCount,
    }));
    
    return NextResponse.json({
      success: true,
      total: data.length,
      newRecords: insertedCount,
    });
    
//   } catch (error: any) {
//     console.error('Cron error:', error);
//     return NextResponse.json(
//       { error: 'Internal server error', details: error.message },
//       { status: 500 }
//     );
//   }
// }
} catch (error) {
    // ← Убрали ": any"
    console.error('Cron error:', error);
    
    // Проверяем тип ошибки
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
