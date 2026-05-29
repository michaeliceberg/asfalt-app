// app/api/cron-info-shipments/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments } from '@/lib/db/schema';
import fs from 'fs';
import path from 'path';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-shipments.json');

export async function GET() {
  try {
    let lastSync = null;
    if (fs.existsSync(LAST_SYNC_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAST_SYNC_FILE, 'utf-8'));
      lastSync = data.lastSync;
    }
    
    const allRecords = await db.select().from(shipments);
    
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
