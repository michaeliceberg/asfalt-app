// app/api/send-plan/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, OutgoingRequest } from '@/lib/db/schema';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

const TELEGRAM_PROXY_URLS = [
    'https://tg-proxy.p.rapidapi.com/bot',
    'https://telegram-bot-api-proxy.herokuapp.com/bot',
    'https://tg-bot-proxy.deno.dev/bot',
];

async function sendDirect(chatId: string, message: string): Promise<boolean> {
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
        console.error('Direct send error:', error);
        return false;
    }
}

async function sendViaProxy(proxyUrl: string, chatId: string, message: string): Promise<boolean> {
    try {
        const url = `${proxyUrl}${TELEGRAM_BOT_TOKEN}/sendMessage`;
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
        console.error(`Proxy send error (${proxyUrl}):`, error);
        return false;
    }
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const tomorrowDisplay = tomorrow.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
        
        // Фильтруем незакрытые заявки, у которых deliveryDate = завтра
        const planRequests = allRequests.filter(req => {
            const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
            const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
            const isForTomorrow = deliveryDate === tomorrowStr;
            
            return isNotClosed && isForTomorrow;
        });
        
        // Группируем по подразделению и грузополучателю
        const byDivision = new Map();
        
        for (const req of planRequests) {
            const division = req.division || 'Другие';
            if (!byDivision.has(division)) {
                byDivision.set(division, new Map());
            }
            const byConsignee = byDivision.get(division);
            const consignee = req.consignee || req.customer || 'Неизвестно';
            if (!byConsignee.has(consignee)) {
                byConsignee.set(consignee, { total: 0, items: [] });
            }
            const group = byConsignee.get(consignee);
            group.total += req.quantity;
            group.items.push({ material: req.material, quantity: req.quantity });
        }
        
        let message = `📋 *ПЛАН ОТГРУЗОК НА ${tomorrowDisplay}*\n\n`;
        
        if (planRequests.length === 0) {
            message += '✅ Нет запланированных отгрузок на завтра.';
        } else {
            for (const [division, byConsignee] of byDivision) {
                const divisionName = division === 'Люберцы' ? '🏭 Люберецкий завод' : '🏭 Луховицкий завод';
                message += `*${divisionName}*\n`;
                for (const [consignee, data] of byConsignee) {
                    message += `▫️ *${consignee}* — ${data.total} т\n`;
                    for (const item of data.items) {
                        message += `   • ${item.material} — ${item.quantity} т\n`;
                    }
                }
                message += `\n`;
            }
        }
        
        message += `📌 Всего заявок: ${planRequests.length}\n`;
        message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
        
        let successCount = 0;
        
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_IDS.length > 0) {
            for (const chatId of TELEGRAM_CHAT_IDS) {
                let sent = false;
                sent = await sendDirect(chatId.trim(), message);
                if (!sent) {
                    for (const proxyUrl of TELEGRAM_PROXY_URLS) {
                        sent = await sendViaProxy(proxyUrl, chatId.trim(), message);
                        if (sent) break;
                    }
                }
                if (sent) successCount++;
            }
        }
        
        return NextResponse.json({
            success: true,
            planCount: planRequests.length,
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






// // app/api/send-plan/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { OutgoingRequest, outgoingRequests } from '@/lib/db/schema';

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
//         // Получаем завтрашнюю дату
//         const tomorrow = new Date();
//         tomorrow.setDate(tomorrow.getDate() + 1);
//         const tomorrowStr = tomorrow.toISOString().split('T')[0];
//         const tomorrowDisplay = tomorrow.toLocaleDateString('ru-RU', {
//             day: '2-digit',
//             month: '2-digit',
//             year: 'numeric'
//         });
        
//         // Получаем все заявки из БД
//         // const allRequests = await db.select().from(outgoingRequests);
        

//         const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);


//         // Фильтруем незакрытые заявки, у которых ДатаОтгрузки = завтра
//         const planRequests = allRequests.filter(req => {
//             const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
//             // Используем новое поле deliveryDate (ДатаОтгрузки)
//             const deliveryDate = (req as any).deliveryDate ? (req as any).deliveryDate.split('T')[0] : null;
//             const isForTomorrow = deliveryDate === tomorrowStr;
            
//             return isNotClosed && isForTomorrow;
//         });
        
//         // Группируем по подразделению (division) и грузополучателю
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
//             group.items.push({
//                 material: req.material,
//                 quantity: req.quantity
//             });
//         }
        
//         // Формируем сообщение
//         let message = `📋 *ПЛАН ОТГРУЗОК НА ${tomorrowDisplay}*\n\n`;
        
//         if (planRequests.length === 0) {
//             message += '✅ Нет запланированных отгрузок на завтра.';
//         } else {
//             for (const [division, byConsignee] of byDivision) {
//                 const divisionName = division === 'Люберцы' ? '🏭 Люберецкий завод' : '🏭 Луховицкий завод';
//                 message += `*${divisionName}*\n`;
                
//                 for (const [consignee, data] of byConsignee) {
//                     message += `▫️ *${consignee}* — ${data.total} т\n`;
//                     for (const item of data.items) {
//                         message += `   • ${item.material} — ${item.quantity} т\n`;
//                     }
//                 }
//                 message += `\n`;
//             }
//         }
        
//         message += `📌 Всего заявок: ${planRequests.length}\n`;
//         message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
        
//         // Отправляем во все чаты
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



// // app/api/send-plan/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { outgoingRequests } from '@/lib/db/schema';

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
//         // Получаем завтрашнюю дату
//         const tomorrow = new Date();
//         tomorrow.setDate(tomorrow.getDate() + 1);
//         const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
//         // Форматируем дату для отображения
//         const tomorrowDisplay = tomorrow.toLocaleDateString('ru-RU', {
//             day: '2-digit',
//             month: '2-digit',
//             year: 'numeric'
//         });
        
//         // Получаем все заявки из БД
//         const allRequests = await db.select().from(outgoingRequests);
        
//         // Фильтруем незакрытые заявки, у которых дата отгрузки = завтра
//         const planRequests = allRequests.filter(req => {
//             const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
//             const requestDate = req.date ? req.date.split('T')[0] : null;
//             const isForTomorrow = requestDate === tomorrowStr;
            
//             return isNotClosed && isForTomorrow;
//         });
        
//         // Группируем по подразделению (division) и грузополучателю
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
//             group.items.push({
//                 material: req.material,
//                 quantity: req.quantity
//             });
//         }
        
//         // Формируем сообщение
//         let message = `📋 *ПЛАН ОТГРУЗОК НА ${tomorrowDisplay}*\n\n`;
        
//         if (planRequests.length === 0) {
//             message += '✅ Нет запланированных отгрузок на завтра.';
//         } else {
//             for (const [division, byConsignee] of byDivision) {
//                 const divisionName = division === 'Люберцы' ? '🏭 Люберецкий завод' : '🏭 Луховицкий завод';
//                 message += `*${divisionName}*\n`;
                
//                 for (const [consignee, data] of byConsignee) {
//                     message += `▫️ *${consignee}* — ${data.total} т\n`;
//                     for (const item of data.items) {
//                         message += `   • ${item.material} — ${item.quantity} т\n`;
//                     }
//                 }
//                 message += `\n`;
//             }
//         }
        
//         message += `📌 Всего заявок: ${planRequests.length}\n`;
//         message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
        
//         // Отправляем во все чаты
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

