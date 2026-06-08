import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const IMPORT_LOG_FILE = path.join(process.cwd(), 'data', 'last-import.json');

export async function GET() {
  try {
    let lastImport = null;
    let totalRecords = 0;
    
    if (fs.existsSync(IMPORT_LOG_FILE)) {
      const data = JSON.parse(fs.readFileSync(IMPORT_LOG_FILE, 'utf-8'));
      lastImport = data.lastImport;
      totalRecords = data.totalRecords;
    }
    
    return NextResponse.json({ lastImport, totalRecords });
  } catch (error) {
    console.error('Error getting import info:', error);
    return NextResponse.json({ lastImport: null, totalRecords: 0 }, { status: 500 });
  }
}