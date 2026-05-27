// app/api/telegram-webhook/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, OutgoingRequest } from '@/lib/db/schema';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramKeyboard {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

async function sendMessage(chatId: number | string, text: string, replyMarkup?: TelegramKeyboard): Promise<void> {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const body: {
        chat_id: number | string;
        text: string;
        parse_mode: string;
        reply_markup?: TelegramKeyboard;
    } = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
    };
    if (replyMarkup) {
        body.reply_markup = replyMarkup;
    }

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

function formatPlanMessage(requests: OutgoingRequest[], title: string): string {
    let message = `📋 *${title}*\n\n`;
    
    if (requests.length === 0) {
        message += '✅ Нет запланированных отгрузок.';
        return message;
    }
    
    const byDivision = new Map<string, Map<string, { total: number; items: { material: string; quantity: number }[] }>>();
    
    for (const req of requests) {
        const division = req.division || 'Другие';
        if (!byDivision.has(division)) {
            byDivision.set(division, new Map());
        }
        const byConsignee = byDivision.get(division)!;
        const consignee = req.consignee || req.customer || 'Неизвестно';
        if (!byConsignee.has(consignee)) {
            byConsignee.set(consignee, { total: 0, items: [] });
        }
        const group = byConsignee.get(consignee)!;
        group.total += req.quantity;
        group.items.push({ material: req.material, quantity: req.quantity });
    }
    
    for (const [division, byConsignee] of byDivision) {
        let divisionTotal = 0;
        for (const [, data] of byConsignee) {
            divisionTotal += data.total;
        }
        const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
        message += `*${divisionName}* 🟢${divisionTotal} т\n`;
        
        for (const [consignee, data] of byConsignee) {
            message += `▫️ ${consignee} — ${data.total} т\n`;
            if (data.items.length === 1 && data.items[0].material) {
                message += `   • ${data.items[0].material}\n`;
            }
        }
        message += `\n`;
    }
    
    message += `📌 Всего заявок: ${requests.length}\n`;
    message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
    return message;
}

async function getPlan(dateStr: string | null, title: string): Promise<string> {
    const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
    
    const filtered = allRequests.filter(req => {
        const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
        if (dateStr) {
            const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
            return isNotClosed && deliveryDate === dateStr;
        }
        return isNotClosed;
    });

    return formatPlanMessage(filtered, title);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const callbackData = body.callback_query?.data;
        const chatId = body.callback_query?.message?.chat?.id;
        
        if (!callbackData || !chatId) {
            return NextResponse.json({ ok: true });
        }
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        let message = '';
        
        switch (callbackData) {
            case 'plan_today':
                message = await getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
                break;
            case 'plan_tomorrow':
                message = await getPlan(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
                break;
            default:
                return NextResponse.json({ ok: true });
        }
        
        await sendMessage(chatId, message);
        return NextResponse.json({ ok: true });
        
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({ ok: true });
    }
}

export async function GET() {
    const keyboard: TelegramKeyboard = {
        inline_keyboard: [
            [
                { text: "📅 Отгрузки на СЕГОДНЯ", callback_data: "plan_today" },
                { text: "📋 Отгрузки на ЗАВТРА", callback_data: "plan_tomorrow" }
            ]
        ]
    };
    
    const message = "🤖 *Бот готов к работе*\n\nНажмите на кнопку, чтобы получить план отгрузок.";
    
    // Отправляем в первый чат из списка (или укажите конкретный ID)
    const chatIds = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);
    if (chatIds.length > 0) {
        await sendMessage(chatIds[0].trim(), message, keyboard);
    }
    
    return NextResponse.json({ ok: true });
}



// // app/api/telegram-webhook/route.ts
// import { NextResponse } from 'next/server';

// export async function POST(request: Request) {
//     try {
//         const body = await request.json();
//         // Перенаправляем на наш основной обработчик
//         const response = await fetch('https://abziceberg.ru/api/send-plan', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(body)
//         });
//         return NextResponse.json({ ok: true });
//     } catch (error) {
//         console.error('Webhook error:', error);
//         return NextResponse.json({ ok: true });
//     }
// }

// export async function GET() {
//     // Установка webhook
//     const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
//     const webhookUrl = 'https://abziceberg.ru/api/telegram-webhook';
    
//     const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
//     const data = await response.json();
    
//     return NextResponse.json(data);
// }