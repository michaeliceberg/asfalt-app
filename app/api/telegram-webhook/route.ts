// app/api/telegram-webhook/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, OutgoingRequest } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramKeyboard {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

async function sendMessage(chatId: number | string, text: string, replyMarkup?: TelegramKeyboard): Promise<boolean> {
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
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return response.ok;
    } catch (error) {
        console.error('Error sending message:', error);
        return false;
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
            } else if (data.items.length > 1) {
                // Группируем материалы
                const materials = new Map<string, number>();
                for (const item of data.items) {
                    materials.set(item.material, (materials.get(item.material) || 0) + item.quantity);
                }
                for (const [material, qty] of materials) {
                    message += `   • ${material} — ${qty} т\n`;
                }
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
        const isNotClosed = !req.closed; // closed === false или null/undefined
        if (dateStr) {
            const deliveryDate = req.delivery_date ? req.delivery_date.split('T')[0] : null;            
            return isNotClosed && deliveryDate === dateStr;
        }
        return isNotClosed;
    });

    return formatPlanMessage(filtered, title);
}

function getMainKeyboard(): TelegramKeyboard {
    return {
        inline_keyboard: [
            [
                { text: "📅 Сегодня", callback_data: "plan_today" },
                { text: "📋 Завтра", callback_data: "plan_tomorrow" }
            ],
            [
                { text: "🔄 Обновить", callback_data: "refresh" }
            ]
        ]
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // Обработка callback query (нажатие на кнопки)
        if (body.callback_query) {
            const callbackData = body.callback_query.data;
            const chatId = body.callback_query.message?.chat?.id;
            
            if (!callbackData || !chatId) {
                return NextResponse.json({ ok: true });
            }
                
            // Стало (московское время):
            const getMoscowDate = (daysOffset: number = 0): string => {
                const now = new Date();
                // Прибавляем 3 часа для московского времени
                const mskTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
                mskTime.setDate(mskTime.getDate() + daysOffset);
                return mskTime.toISOString().split('T')[0];
            };

            const todayStr = getMoscowDate(0);
            const tomorrowStr = getMoscowDate(1);






            let message = '';
            
            switch (callbackData) {
                case 'plan_today':
                    message = await getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
                    break;
                case 'plan_tomorrow':
                    message = await getPlan(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
                    break;
                case 'refresh':
                    message = await getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ (ОБНОВЛЕН)');
                    break;
                default:
                    return NextResponse.json({ ok: true });
            }
            
            // Отправляем новое сообщение, а не редактируем старое
            await sendMessage(chatId, message, getMainKeyboard());
            return NextResponse.json({ ok: true });
        }
        
        // Обработка команды /start
        if (body.message && body.message.text === '/start') {
            const chatId = body.message.chat.id;
            const welcomeMessage = `🤖 *Добро пожаловать в бот АБЗ!*

Я помогу вам отслеживать отгрузки асфальта.

📊 *Доступные команды:*
• Нажмите кнопку "Сегодня" - план на текущий день
• Нажмите кнопку "Завтра" - план на следующий день
• "Обновить" - получить актуальные данные

📅 *Данные обновляются:* автоматически каждый час

Если у вас есть вопросы, обратитесь к администратору.`;

            await sendMessage(chatId, welcomeMessage, getMainKeyboard());
            return NextResponse.json({ ok: true });
        }
        
        // Обработка обычных текстовых сообщений
        if (body.message && body.message.text) {
            const chatId = body.message.chat.id;
            const text = body.message.text;
            
            if (text === '/help') {
                await sendMessage(chatId, '🔍 *Доступные команды:*\n/start - начать работу\n/help - помощь\n/today - план на сегодня\n/tomorrow - план на завтра', getMainKeyboard());
            } else if (text === '/today') {
                const todayStr = new Date().toISOString().split('T')[0];
                const message = await getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
                await sendMessage(chatId, message, getMainKeyboard());
            } else if (text === '/tomorrow') {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                const message = await getPlan(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
                await sendMessage(chatId, message, getMainKeyboard());
            } else {
                await sendMessage(chatId, 'Используйте кнопки или команды:\n/today - сегодня\n/tomorrow - завтра');
            }
        }
        
        return NextResponse.json({ ok: true });
        
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({ ok: true });
    }
}

// GET метод для проверки работоспособности
export async function GET() {
    return NextResponse.json({ 
        status: 'ok', 
        message: 'Telegram webhook is running',
        timestamp: new Date().toISOString()
    });
}


