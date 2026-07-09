// app/api/cron/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { incomingMaterials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { normalizePlate } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync.json');

// Временно отключаем проверку SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

interface IncomingItem {
  Подразделение: string;
  Номер: string;
  Дата: string;
  Поставщик: string;
  Номенклатура: string;
  Брутто: number;
  Тара: number;
  Количество: number;
  Водитель: string;
  ГосНомер: string;
}

export async function GET() {
  try {
    const UNF_BASE_URL = process.env.UNF_BASE_URL;
    const LOGIN = process.env.UNF_LOGIN;
    const PASSWORD = process.env.UNF_PASSWORD;
    
    console.log('Fetching incoming from 1C (SSL verification disabled)...');
    
    const response = await fetch(`${UNF_BASE_URL}/hs/WebData-API/incoming`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: IncomingItem[] = await response.json();
    console.log(`Received ${data.length} records from 1C`);
    
    let insertedCount = 0;
    for (const record of data) {
      const existing = await db
        .select()
        .from(incomingMaterials)
        .where(eq(incomingMaterials.number, record.Номер))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(incomingMaterials).values({
          number: record.Номер,
          date: record.Дата,
          division: record.Подразделение === 'Луховицы' ? 'ЛХ' : record.Подразделение === 'Люберцы' ? 'ЛЮ' : record.Подразделение,
          supplier: record.Поставщик,
          material: record.Номенклатура,
          gross: record.Брутто || null,
          tara: record.Тара || null,
          quantity: record.Количество,
          driver: record.Водитель || null,
          licensePlate: record.ГосНомер ? normalizePlate(record.ГосНомер) : null,
          createdAt: Date.now(),
          
        });
        insertedCount++;
      }
    }
    
    fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({
      lastSync: new Date().toISOString(),
    }));
    
    return NextResponse.json({
      success: true,
      total: data.length,
      newRecords: insertedCount,
      source: "1c",
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
