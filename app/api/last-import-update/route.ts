// app/api/last-import-update/route.ts

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getClientIp, isImportIpAllowed } from '@/lib/importAuth';

const IMPORT_LOG_FILE = path.join(process.cwd(), 'data', 'last-import.json');

export async function POST(request: Request) {
  try {
    if (!isImportIpAllowed(getClientIp(request))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { factory, type, records, timestamp } = body;
    
    const data = {
      lastImport: timestamp,
      totalRecords: records,
      factory: factory,
      type: type
    };
    
    fs.writeFileSync(IMPORT_LOG_FILE, JSON.stringify(data, null, 2));
    
    console.log(`✅ Импорт сохранён: ${factory}/${type}, ${records} записей, ${timestamp}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving import info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}