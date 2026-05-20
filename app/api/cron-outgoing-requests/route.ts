// app/api/cron-outgoing-requests/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-requests.json');

interface OutgoingRequestItem {
  Подразделение: string;
  Номер: string;
  Дата: string;
  Покупатель: string;
  Грузополучатель: string;
  Номенклатура: string;
  Количество: number;
  НомерЗаявкиКлиента: string;
  ДатаЗаявкиКлиента: string;
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
    
    const response = await fetch(`${UNF_BASE_URL}/hs/WebData-API/OutgoingRequest`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: OutgoingRequestItem[] = await response.json();
    
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
          division: record.Подразделение,
          customer: record.Покупатель,
          consignee: record.Грузополучатель || null,
          material: record.Номенклатура,
          quantity: record.Количество,
          clientRequestNumber: record.НомерЗаявкиКлиента || null,
          clientRequestDate: record.ДатаЗаявкиКлиента || null,
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