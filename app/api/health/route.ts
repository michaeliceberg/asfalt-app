import { NextResponse } from 'next/server';
import { db, sql } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const checks = {
    database: { status: 'ok' as const, details: '' },
    filesystem: { status: 'ok' as const, details: '' },
    sync: { status: 'ok' as const, details: '' },
    memory: { used: 0, total: 0, percent: 0 },
  };

  const alerts: string[] = [];

  // 1. Проверка базы данных
  try {
    await db.run(sql`SELECT 1`);
    checks.database.status = 'ok';
  } catch (error) {
    checks.database.status = 'error';
    checks.database.details = error instanceof Error ? error.message : 'Unknown error';
    alerts.push('❌ База данных не отвечает!');
  }

  // 2. Проверка файловой системы (права на запись)
  try {
    const testFile = path.join(process.cwd(), 'data', 'test-write.tmp');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    checks.filesystem.status = 'ok';
  } catch (error) {
    checks.filesystem.status = 'error';
    checks.filesystem.details = error instanceof Error ? error.message : 'Unknown error';
    alerts.push('❌ Нет прав на запись в папку data/');
  }

  // 3. Проверка синхронизации
  try {
    const syncFiles = ['last-sync-shipments.json', 'last-sync-requests.json', 'last-sync.json'];
    let syncOk = true;
    for (const file of syncFiles) {
      const filePath = path.join(process.cwd(), 'data', file);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data.lastSync) {
          const lastSyncTime = new Date(data.lastSync).getTime();
          const minutesAgo = Math.floor((Date.now() - lastSyncTime) / 1000 / 60);
          if (minutesAgo > 30) {
            syncOk = false;
            alerts.push(`⚠️ Синхронизация ${file} не обновлялась ${minutesAgo} минут`);
          }
        }
      }
    }
    checks.sync.status = syncOk ? 'ok' : 'warning';
  } catch (error) {
    checks.sync.status = 'warning';
    checks.sync.details = error instanceof Error ? error.message : 'Unknown error';
    alerts.push('⚠️ Ошибка проверки синхронизации');
  }

  // 4. Память
  const memoryUsage = process.memoryUsage();
  checks.memory = {
    used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    percent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
  };

  if (checks.memory.percent > 90) {
    alerts.push(`⚠️ Высокое использование памяти: ${checks.memory.percent}%`);
  }

  const status = alerts.some(a => a.includes('❌')) ? 'critical' 
    : alerts.length > 0 ? 'warning' 
    : 'healthy';

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    checks,
    alerts,
    uptime: Math.floor(process.uptime()),
  });
}
