// app/api/cron-info/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { incomingMaterials } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync.json');

export async function GET() {
  try {
    // Читаем время последней синхронизации
    let lastSync = null;
    if (fs.existsSync(LAST_SYNC_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAST_SYNC_FILE, 'utf-8'));
      lastSync = data.lastSync;
    }
    
    // Получаем общее количество записей
    const allRecords = await db.select().from(incomingMaterials);
    
    return NextResponse.json({
      lastSync,
      totalRecords: allRecords.length,
    });
  } catch (error) {
    console.error('Error getting cron info:', error);
    return NextResponse.json(
      { lastSync: null, totalRecords: 0 },
      { status: 500 }
    );
  }
}