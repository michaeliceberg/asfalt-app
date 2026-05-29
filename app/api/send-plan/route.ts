// app/api/send-plan/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, OutgoingRequest, sentNotifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

// Клавиатура с кнопками
function getKeyboardMarkup() {
    return {
        inline_keyboard: [
            [
                { text: "📅 Отгрузки на СЕГОДНЯ", callback_data: "plan_today" },
                { text: "📋 Отгрузки на ЗАВТРА", callback_data: "plan_tomorrow" }
            ],
            [
                { text: "📊 Полный план на неделю", callback_data: "plan_week" }
            ]
        ]
    };
}

// Отправка сообщения с клавиатурой
async function sendWithKeyboard(chatId: string, message: string): Promise<boolean> {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: getKeyboardMarkup()
            })
        });
        return response.ok;
    } catch (error) {
        console.error('Send error:', error);
        return false;
    }
}

// Отправка обычного сообщения (без клавиатуры)
async function sendMessage(chatId: string, message: string): Promise<boolean> {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        return response.ok;
    } catch (error) {
        console.error('Send error:', error);
        return false;
    }
}




// // Формирование сообщения с планом
// async function getPlanMessage(requests: OutgoingRequest[], title: string): Promise<string> {
//     let message = `📋 *${title}*\n\n`;
    
//     if (requests.length === 0) {
//         message += '✅ Нет запланированных отгрузок.';
//     } else {
//         const byDivision = new Map();
        
//         for (const req of requests) {
//             const division = req.division || 'Другие';
//             if (!byDivision.has(division)) {
//                 byDivision.set(division, new Map());
//             }
//             const byConsignee = byDivision.get(division);
//             const consignee = req.consignee || req.customer || 'Неизвестно';
            
//             if (!byConsignee.has(consignee)) {
//                 byConsignee.set(consignee, { total: 0, items: [] });
//             }
//             const group = byConsignee.get(consignee);
//             group.total += req.quantity;
//             group.items.push({ material: req.material, quantity: req.quantity });
//         }
        
//         for (const [division, byConsignee] of byDivision) {
//             let divisionTotal = 0;
//             for (const [, data] of byConsignee) {
//                 divisionTotal += data.total;
//             }
//             const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
//             message += `*${divisionName}* 🟢${divisionTotal} т\n`;
            
//             for (const [consignee, data] of byConsignee) {
//                 message += `▫️ ${consignee} — ${data.total} т\n`;
//                 if (data.items.length === 1 && data.items[0].material) {
//                     message += `   • ${data.items[0].material}\n`;
//                 }
//             }
//             message += `\n`;
//         }
//     }
    
//     message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
//     return message;
// }


// app/api/send-plan/route.ts

// Формирование сообщения с планом
async function getPlanMessage(requests: OutgoingRequest[], title: string): Promise<string> {
    let message = `📋 *${title}*\n\n`;
    
    if (requests.length === 0) {
        message += '✅ Нет запланированных отгрузок.';
    } else {
        const byDivision = new Map<string, Map<string, { total: number; items: { material: string; quantity: number }[] }>>();
        
        for (const req of requests) {
            const division = req.division || 'Другие';
            if (!byDivision.has(division)) {
                byDivision.set(division, new Map());
            }
            const byConsignee = byDivision.get(division)!;
            const consignee = req.consignee || req.customer || 'Неизвестно';
            
            // КЛЮЧ: объединяем division + consignee
            const key = `${division}_${consignee}`;
            if (!byConsignee.has(key)) {
                byConsignee.set(key, { total: 0, items: [] });
            }
            const group = byConsignee.get(key)!;
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
            
            for (const [key, data] of byConsignee) {
                // Разбираем ключ на division и consignee
                const [divCode, consignee] = key.split('_');
                const divisionIcon = divCode === 'Люберцы' ? '🏭 ЛЮ' : '🏭 ЛХ';
                message += `▫️ ${divisionIcon} ${consignee} — ${data.total} т\n`;
                
                if (data.items.length === 1 && data.items[0].material) {
                    message += `   • ${data.items[0].material}\n`;
                } else if (data.items.length > 1) {
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
    }
    
    // Московское время
    const mskTime = new Date().toLocaleTimeString('ru-RU', { 
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    message += `🕐 ${mskTime}`;
    
    message += `\n\n---\n💡 *Быстрый доступ:* /today - план на сегодня, /tomorrow - план на завтра`;
    
    return message;
}







// // Получение плана по дате
// async function getPlanByDate(dateStr: string | null, dateLabel: string): Promise<string> {
//     const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
    
//     const planRequests = allRequests.filter(req => {
//         const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
//         if (dateStr) {
//             const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
//             return isNotClosed && deliveryDate === dateStr;
//         }
//         return isNotClosed;
//     });

    
    
//     return getPlanMessage(planRequests, dateLabel);
// }


// Получение плана по дате
async function getPlanByDate(dateStr: string | null, dateLabel: string): Promise<string> {
    const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
    
    // Убираем фильтр по closed, показываем все заявки (и закрытые, и открытые)
    const planRequests = allRequests.filter(req => {
        if (dateStr) {
            const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
            return deliveryDate === dateStr;
        }
        return true; // если нет даты, возвращаем все заявки
    });
    
    return getPlanMessage(planRequests, dateLabel);
}



// Получение новых заявок (которых не было в рассылке)
async function getNewRequests(): Promise<OutgoingRequest[]> {
    const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
    const sentRecords = await db.select().from(sentNotifications);
    const sentNumbers = new Set(sentRecords.map(r => r.requestNumber));
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    return allRequests.filter(req => {
        const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
        const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
        const isForTodayOrTomorrow = deliveryDate === todayStr || deliveryDate === tomorrowStr;
        return isNotClosed && isForTodayOrTomorrow && !sentNumbers.has(req.number);
    });
}

// Отправка новых заявок
async function sendNewRequests(): Promise<number> {
    const newRequests = await getNewRequests();
    
    if (newRequests.length === 0) {
        return 0;
    }
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const byDivision = new Map();
    for (const req of newRequests) {
        const division = req.division || 'Другие';
        if (!byDivision.has(division)) byDivision.set(division, new Map());
        const byConsignee = byDivision.get(division);
        const consignee = req.consignee || req.customer || 'Неизвестно';
        if (!byConsignee.has(consignee)) byConsignee.set(consignee, { total: 0, items: [], deliveryDate: req.deliveryDate });
        const group = byConsignee.get(consignee);
        group.total += req.quantity;
        group.items.push({ material: req.material, quantity: req.quantity });
    }
    
    let message = `🆕 *НОВЫЕ ЗАЯВКИ*\n\n`;
    for (const [division, byConsignee] of byDivision) {
        const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
        message += `*${divisionName}*\n`;
        for (const [consignee, data] of byConsignee) {
            const dateLabel = data.deliveryDate && data.deliveryDate.split('T')[0] === todayStr ? '🚨 СЕГОДНЯ' : '📅 НА ЗАВТРА';
            message += `▫️ ${consignee} — ${data.total} т ${dateLabel}\n`;
            if (data.items.length === 1 && data.items[0].material) {
                message += `   • ${data.items[0].material}\n`;
            }
        }
    }
    message += `\n📌 Всего новых: ${newRequests.length}\n🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
    
    // Сохраняем отправленные заявки
    for (const req of newRequests) {
        const existing = await db.select().from(sentNotifications).where(eq(sentNotifications.requestNumber, req.number));
        if (existing.length === 0) {
            await db.insert(sentNotifications).values({
                requestNumber: req.number,
                sentAt: Date.now(),
            });
        }
    }
    
    // Отправляем сообщение
    let successCount = 0;
    for (const chatId of TELEGRAM_CHAT_IDS) {
        const sent = await sendMessage(chatId.trim(), message);
        if (sent) successCount++;
    }
    
    return successCount;
}

// Обработка callback-запросов от кнопок
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
                message = await getPlanByDate(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
                break;
            case 'plan_tomorrow':
                message = await getPlanByDate(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
                break;
            case 'plan_week':
                message = await getPlanByDate(null, 'ПЛАН ОТГРУЗОК НА НЕДЕЛЮ (ВСЕ АКТИВНЫЕ)');
                break;
            default:
                return NextResponse.json({ ok: true });
        }
        
        await sendWithKeyboard(chatId, message);
        return NextResponse.json({ ok: true });
        
    } catch (error) {
        console.error('Callback error:', error);
        return NextResponse.json({ ok: true });
    }
}

// GET запрос для проверки новых заявок и первоначальной отправки
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Проверяем и отправляем новые заявки
        const newSentCount = await sendNewRequests();
        
        // Получаем завтрашнюю дату для информации
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDisplay = tomorrow.toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        
        // Отправляем приветственное сообщение с клавиатурой (только если новые заявки не отправлялись)
        if (newSentCount === 0) {
            const message = `🤖 *Бот готов к работе*\n\nНажмите на кнопку, чтобы получить актуальный план отгрузок.\n\n📅 Сегодня: ${new Date().toLocaleDateString('ru-RU')}\n📋 Завтра: ${tomorrowDisplay}`;
            
            for (const chatId of TELEGRAM_CHAT_IDS) {
                await sendWithKeyboard(chatId.trim(), message);
            }
        }
        
        return NextResponse.json({
            success: true,
            newSent: newSentCount,
            totalChats: TELEGRAM_CHAT_IDS.length
        });
        
    } catch (error) {
        console.error('Send plan error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}



// // app/api/send-plan/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { outgoingRequests, OutgoingRequest } from '@/lib/db/schema';

// const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

// const TELEGRAM_PROXY_URLS = [
//     'https://tg-proxy.p.rapidapi.com/bot',
//     'https://telegram-bot-api-proxy.herokuapp.com/bot',
//     'https://tg-bot-proxy.deno.dev/bot',
// ];

// async function sendDirect(chatId: string, message: string): Promise<boolean> {
//     try {
//         const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
//         const response = await fetch(url, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 chat_id: chatId,
//                 text: message,
//                 parse_mode: 'Markdown'
//             })
//         });
//         return response.ok;
//     } catch (error) {
//         console.error('Direct send error:', error);
//         return false;
//     }
// }

// async function sendViaProxy(proxyUrl: string, chatId: string, message: string): Promise<boolean> {
//     try {
//         const url = `${proxyUrl}${TELEGRAM_BOT_TOKEN}/sendMessage`;
//         const response = await fetch(url, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 chat_id: chatId,
//                 text: message,
//                 parse_mode: 'Markdown'
//             })
//         });
//         return response.ok;
//     } catch (error) {
//         console.error(`Proxy send error (${proxyUrl}):`, error);
//         return false;
//     }
// }

// export async function GET(request: Request) {
//     const authHeader = request.headers.get('authorization');
//     const cronSecret = process.env.CRON_SECRET;
    
//     if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
//         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     try {
//         const tomorrow = new Date();
//         tomorrow.setDate(tomorrow.getDate() + 1);
//         const tomorrowStr = tomorrow.toISOString().split('T')[0];
//         const tomorrowDisplay = tomorrow.toLocaleDateString('ru-RU', {
//             day: '2-digit',
//             month: '2-digit',
//             year: 'numeric'
//         });
        
//         const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
        
//         // Фильтруем незакрытые заявки, у которых deliveryDate = завтра
//         const planRequests = allRequests.filter(req => {
//             const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
//             const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
//             const isForTomorrow = deliveryDate === tomorrowStr;
            
//             return isNotClosed && isForTomorrow;
//         });
        
//         // Группируем по подразделению и грузополучателю
//         const byDivision = new Map();
        
//         for (const req of planRequests) {
//             const division = req.division || 'Другие';
//             if (!byDivision.has(division)) {
//                 byDivision.set(division, new Map());
//             }
//             const byConsignee = byDivision.get(division);
//             const consignee = req.consignee || req.customer || 'Неизвестно';
//             if (!byConsignee.has(consignee)) {
//                 byConsignee.set(consignee, { total: 0, items: [] });
//             }
//             const group = byConsignee.get(consignee);
//             group.total += req.quantity;
//             group.items.push({ material: req.material, quantity: req.quantity });
//         }
        
//        // Формируем сообщение (новая версия — компактная)
// let message = `📋 *ПЛАН ОТГРУЗОК НА ${tomorrowDisplay}*\n\n`;

// if (planRequests.length === 0) {
//     message += '✅ Нет запланированных отгрузок на завтра.';
// } else {
//     for (const [division, byConsignee] of byDivision) {
//         let divisionTotal = 0;
//         for (const [, data] of byConsignee) {
//             divisionTotal += data.total;
//         }
        
//         const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
//         message += `*${divisionName}* 🟢${divisionTotal} т\n`;
        
//         for (const [consignee, data] of byConsignee) {
//             message += `▫️ ${consignee} — ${data.total} т\n`;
//             if (data.items.length === 1 && data.items[0].material) {
//                 message += `   • ${data.items[0].material}\n`;
//             }
//         }
//         message += `\n`;
//     }
// }

// message += `📌 Всего заявок: ${planRequests.length}\n`;
// message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
        
//         let successCount = 0;
        
//         if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_IDS.length > 0) {
//             for (const chatId of TELEGRAM_CHAT_IDS) {
//                 let sent = false;
//                 sent = await sendDirect(chatId.trim(), message);
//                 if (!sent) {
//                     for (const proxyUrl of TELEGRAM_PROXY_URLS) {
//                         sent = await sendViaProxy(proxyUrl, chatId.trim(), message);
//                         if (sent) break;
//                     }
//                 }
//                 if (sent) successCount++;
//             }
//         }
        
//         return NextResponse.json({
//             success: true,
//             planCount: planRequests.length,
//             telegramSent: successCount,
//             totalChats: TELEGRAM_CHAT_IDS.length,
//             message
//         });
        
//     } catch (error) {
//         console.error('Send plan error:', error);
//         return NextResponse.json(
//             { error: 'Internal server error' },
//             { status: 500 }
//         );
//     }
// }



