// app/api/cron-shipments/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-shipments.json');

interface ShipmentItem {
  Подразделение: string;
  Номер: string;
  Дата: string;
  Покупатель: string;
  Номенклатура: string;
  Брутто: number;
  Тара: number;
  Количество: number;
  Водитель: string;
  ГосНомер: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const UNF_BASE_URL = process.env.UNF_BASE_URL;
    const LOGIN = process.env.UNF_LOGIN;
    const PASSWORD = process.env.UNF_PASSWORD;
    
    // Получаем ВСЕ данные (без фильтра по дате)
    const response = await fetch(`${UNF_BASE_URL}/hs/WebData-API/outgoing`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: ShipmentItem[] = await response.json();
    
    let insertedCount = 0;
    for (const record of data) {
      const existing = await db
        .select()
        .from(shipments)
        .where(eq(shipments.number, record.Номер))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(shipments).values({
          number: record.Номер,
          date: record.Дата,
          division: record.Подразделение,
          customer: record.Покупатель,
          material: record.Номенклатура,
          gross: record.Брутто || null,
          tara: record.Тара || null,
          quantity: record.Количество,
          driver: record.Водитель || null,
          licensePlate: record.ГосНомер || null,
          createdAt: Date.now(),
        });
        insertedCount++;
      }
    }
    
    // Сохраняем время последней синхронизации
    fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({
      lastSync: new Date().toISOString(),
    }));
    
    return NextResponse.json({
      success: true,
      total: data.length,
      newRecords: insertedCount,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}