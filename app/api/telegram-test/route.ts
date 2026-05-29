// app/api/telegram-test/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests } from '@/lib/db/schema';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

interface TestResults {
    botInfo: unknown;
    database: {
        totalRequests: number;
        sample: Array<{
            number: string;
            material: string;
            quantity: number;
            deliveryDate: string | null;
            closed: boolean | null;
        }>;
    };
    testMessageSent?: boolean;
}

export async function GET() {
    try {
        const results: TestResults = {
            botInfo: null,
            database: {
                totalRequests: 0,
                sample: []
            }
        };

        // 1. Проверяем токен бота
        const meResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
        const meData = await meResponse.json();
        results.botInfo = meData.ok ? meData.result : { error: 'Invalid token' };

        // 2. Проверяем базу данных
        const requestsCount = await db.select().from(outgoingRequests);
        results.database = {
            totalRequests: requestsCount.length,
            sample: requestsCount.slice(0, 3).map(r => ({
                number: r.number,
                material: r.material,
                quantity: r.quantity,
                deliveryDate: r.deliveryDate,
                closed: r.closed
            }))
        };

        // 3. Отправляем тестовое сообщение
        if (TELEGRAM_CHAT_IDS.length > 0) {
            const testMessage = `🧪 *Тестовое сообщение*

Бот работает корректно!

📊 *Статистика:*
• Всего заявок в БД: ${requestsCount.length}
• Заявок на сегодня: ${requestsCount.filter(r => {
    const today = new Date().toISOString().split('T')[0];
    return !r.closed && r.deliveryDate?.split('T')[0] === today;
}).length}

🕐 ${new Date().toLocaleString('ru-RU')}`;

            const sendResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_IDS[0],
                    text: testMessage,
                    parse_mode: 'Markdown'
                })
            });
            results.testMessageSent = sendResponse.ok;
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('Test error:', error);
        return NextResponse.json({ error: 'Test failed' }, { status: 500 });
    }
}