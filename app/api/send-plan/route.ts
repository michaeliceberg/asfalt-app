// app/api/send-plan/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests } from '@/lib/db/schema';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Разделяем chat_id через запятую
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Получаем завтрашнюю дату
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Получаем сегодняшнюю дату
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    // Получаем все заявки из БД
    const allRequests = await db.select().from(outgoingRequests);
    
    // Фильтруем незакрытые заявки на завтра или созданные сегодня
    const activeRequests = allRequests.filter(req => {
      const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
      const isForTomorrow = req.clientRequestDate && req.clientRequestDate.split('T')[0] === tomorrowStr;
      const isCreatedToday = req.date && req.date.split('T')[0] === todayStr;
      
      return isNotClosed && (isForTomorrow || isCreatedToday);
    });
    
    // Формируем сообщение
    let message = `📋 *ПЛАН ЗАКАЗОВ НА ${tomorrowStr}*\n\n`;
    
    if (activeRequests.length === 0) {
      message += '✅ Нет активных заявок на завтра.\n';
      message += '\n💡 *Пояснение:*\n';
      message += 'Показываются только незакрытые заявки.';
    } else {
      // Группируем по грузополучателю
      const grouped = new Map();
      
      for (const req of activeRequests) {
        const key = req.consignee || req.customer;
        if (!grouped.has(key)) {
          grouped.set(key, { total: 0, items: [] });
        }
        const group = grouped.get(key);
        group.total += req.quantity;
        group.items.push(req);
      }
      
      for (const [consignee, data] of grouped) {
        message += `🏭 *${consignee}*\n`;
        message += `📦 Всего: ${data.total} т\n`;
        for (const item of data.items) {
          message += `   • ${item.material} — ${item.quantity} т\n`;
        }
        message += '\n';
      }
    }
    
    // Отправляем во все чаты
    let successCount = 0;
    
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_IDS.length > 0) {
      for (const chatId of TELEGRAM_CHAT_IDS) {
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        try {
          const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId.trim(),
              text: message,
              parse_mode: 'Markdown'
            })
          });
          if (response.ok) successCount++;
        } catch (err) {
          console.error(`Ошибка отправки в чат ${chatId}:`, err);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      planCount: activeRequests.length,
      telegramSent: successCount,
      totalChats: TELEGRAM_CHAT_IDS.length,
      message
    });
    
  } catch (error) {
    console.error('Send plan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}