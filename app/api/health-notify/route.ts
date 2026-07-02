import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendPushNotification } from '@/lib/push-notifications';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // 1. Проверяем здоровье системы
    let dbStatus = 'ok';
    try {
      await db.run(sql`SELECT 1`);
    } catch {
      dbStatus = 'error';
    }

    // 2. Находим администратора (вас)
    const adminUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, 'tas'))
      .limit(1);

    if (adminUsers.length === 0) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const adminId = adminUsers[0].id;

    // 3. Формируем сообщение в зависимости от статуса
    const status = dbStatus === 'ok' ? '✅' : '❌';
    const statusText = dbStatus === 'ok' ? 'ВСЁ ХОРОШО' : 'ПРОБЛЕМА С БД';

    // 4. Отправляем уведомление
    await sendPushNotification(adminId, {
      title: `🩺 Health Check: ${statusText}`,
      body: `${status} Система работает стабильно\n🕐 ${new Date().toLocaleString('ru-RU')}`,
      tag: `health-${Date.now()}`,
      url: '/api/health',
    });

    return NextResponse.json({
      success: true,
      adminId,
      status: dbStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health notify error:', error);
    return NextResponse.json(
      { error: 'Failed to send health notification' },
      { status: 500 }
    );
  }
}
