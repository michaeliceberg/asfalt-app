// app/api/send-plan/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests } from '@/lib/db/schema';

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
        // Получаем завтрашнюю дату
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        // Форматируем дату для отображения
        const tomorrowDisplay = tomorrow.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // Получаем все заявки из БД
        const allRequests = await db.select().from(outgoingRequests);
        
        // Фильтруем незакрытые заявки, у которых дата отгрузки = завтра
        const planRequests = allRequests.filter(req => {
            const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
            const requestDate = req.date ? req.date.split('T')[0] : null;
            const isForTomorrow = requestDate === tomorrowStr;
            
            return isNotClosed && isForTomorrow;
        });
        
        // Группируем по подразделению (division) и грузополучателю
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
            group.items.push({
                material: req.material,
                quantity: req.quantity
            });
        }
        
        // Формируем сообщение
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
        
        // Отправляем во все чаты
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
//         const tomorrowStr = tomorrow.toLocaleDateString('ru-RU', {
//             day: '2-digit',
//             month: '2-digit',
//             year: 'numeric'
//         });
        
//         // Получаем все заявки из БД
//         const allRequests = await db.select().from(outgoingRequests);
        
//         // Фильтруем незакрытые заявки
//         const activeRequests = allRequests.filter(req => {
//             const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
//             return isNotClosed;
//         });
        
//         // Группируем по подразделению (division) и грузополучателю
//         const byDivision = new Map();
        
//         for (const req of activeRequests) {
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
        
//         // Формируем сообщение (лаконичная версия)
//         let message = `📋 *ПЛАН ОТГРУЗОК НА ${tomorrowStr}*\n\n`;

//         if (activeRequests.length === 0) {
//             message += '✅ Нет активных заявок.';
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

//         message += `📌 Всего заявок: ${activeRequests.length}\n`;
//         message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;

//         // // Формируем сообщение
//         // let message = `📋 *ПЛАН ОТГРУЗОК НА ${tomorrowStr}*\n\n`;
        
//         // if (activeRequests.length === 0) {
//         //     message += '✅ Нет активных заявок.';
//         // } else {
//         //     for (const [division, byConsignee] of byDivision) {
//         //         // Название подразделения
//         //         const divisionName = division === 'Люберцы' ? '🏭 **Люберецкий завод**' : '🏭 **Луховицкий завод**';
//         //         message += `${divisionName}\n`;
//         //         message += `└── 📋 *ЗАКАЗЫ*\n`;
                
//         //         for (const [consignee, data] of byConsignee) {
//         //             message += `    ├── 📍 *${consignee}*\n`;
//         //             message += `    │   📦 Всего: ${data.total} т\n`;
//         //             for (const item of data.items) {
//         //                 message += `    │   └── • ${item.material} — ${item.quantity} т\n`;
//         //             }
//         //             message += `    │\n`;
//         //         }
//         //         message += `\n`;
//         //     }
//         // }
        
//         // message += `📌 *Статус:* Показаны все незакрытые заявки\n`;
//         // message += `🕐 *Сформировано:* ${new Date().toLocaleTimeString('ru-RU')}`;
        
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
//             planCount: activeRequests.length,
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

// // Список прокси для Telegram API (если прямой доступ заблокирован)
// const TELEGRAM_PROXY_URLS = [
//     'https://tg-proxy.p.rapidapi.com/bot',  // RapidAPI прокси
//     'https://telegram-bot-api-proxy.herokuapp.com/bot',  // Heroku прокси
//     'https://tg-bot-proxy.deno.dev/bot',  // Deno прокси
// ];

// // Функция прямой отправки
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

// // Функция отправки через прокси
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
//         tomorrow.setHours(0, 0, 0, 0);
//         const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
//         // Получаем сегодняшнюю дату
//         const today = new Date();
//         today.setHours(0, 0, 0, 0);
//         const todayStr = today.toISOString().split('T')[0];
        
//         // Получаем все заявки из БД
//         const allRequests = await db.select().from(outgoingRequests);
        
//         // Фильтруем незакрытые заявки (без привязки к дате)
//         const activeRequests = allRequests.filter(req => {
//             const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
//             return isNotClosed;
//         });
        
//         // Формируем сообщение
//         let message = `📋 *АКТИВНЫЕ ЗАЯВКИ*\n\n`;
//         message += `*Статус:* Все незакрытые заявки\n`;
//         message += `*Дата:* ${tomorrowStr}\n\n`;
        
//         if (activeRequests.length === 0) {
//             message += '✅ Нет активных заявок.';
//         } else {
//             // Группируем по грузополучателю
//             const grouped = new Map();
            
//             for (const req of activeRequests) {
//                 const key = req.consignee || req.customer;
//                 if (!grouped.has(key)) {
//                     grouped.set(key, { total: 0, items: [] });
//                 }
//                 const group = grouped.get(key);
//                 group.total += req.quantity;
//                 group.items.push(req);
//             }
            
//             for (const [consignee, data] of grouped) {
//                 message += `🏭 *${consignee}*\n`;
//                 message += `📦 Всего: ${data.total} т\n`;
//                 for (const item of data.items) {
//                     message += `   • ${item.material} — ${item.quantity} т\n`;
//                 }
//                 message += '\n';
//             }
//         }
        
//         // Отправляем во все чаты
//         let successCount = 0;
        
//         if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_IDS.length > 0) {
//             for (const chatId of TELEGRAM_CHAT_IDS) {
//                 let sent = false;
                
//                 // Сначала пробуем прямую отправку
//                 sent = await sendDirect(chatId.trim(), message);
                
//                 // Если не получилось, пробуем отправить через прокси
//                 if (!sent) {
//                     for (const proxyUrl of TELEGRAM_PROXY_URLS) {
//                         sent = await sendViaProxy(proxyUrl, chatId.trim(), message);
//                         if (sent) break;
//                     }
//                 }
                
//                 if (sent) {
//                     successCount++;
//                 } else {
//                     console.error(`Не удалось отправить сообщение в чат ${chatId} ни одним способом`);
//                 }
//             }
//         }
        
//         return NextResponse.json({
//             success: true,
//             planCount: activeRequests.length,
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
// // Разделяем chat_id через запятую
// const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

// export async function GET(request: Request) {
//   const authHeader = request.headers.get('authorization');
//   const cronSecret = process.env.CRON_SECRET;
  
//   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }

//   try {
//     // Получаем завтрашнюю дату
//     const tomorrow = new Date();
//     tomorrow.setDate(tomorrow.getDate() + 1);
//     tomorrow.setHours(0, 0, 0, 0);
//     const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
//     // Получаем сегодняшнюю дату
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const todayStr = today.toISOString().split('T')[0];
    
//     // Получаем все заявки из БД
//     const allRequests = await db.select().from(outgoingRequests);
    
//     // Фильтруем незакрытые заявки на завтра или созданные сегодня
//     const activeRequests = allRequests.filter(req => {
//       const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
//       const isForTomorrow = req.clientRequestDate && req.clientRequestDate.split('T')[0] === tomorrowStr;
//       const isCreatedToday = req.date && req.date.split('T')[0] === todayStr;
      
//       return isNotClosed && (isForTomorrow || isCreatedToday);
//     });
    
//     // Формируем сообщение
//     let message = `📋 *ПЛАН ЗАКАЗОВ НА ${tomorrowStr}*\n\n`;
    
//     if (activeRequests.length === 0) {
//       message += '✅ Нет активных заявок на завтра.\n';
//       message += '\n💡 *Пояснение:*\n';
//       message += 'Показываются только незакрытые заявки.';
//     } else {
//       // Группируем по грузополучателю
//       const grouped = new Map();
      
//       for (const req of activeRequests) {
//         const key = req.consignee || req.customer;
//         if (!grouped.has(key)) {
//           grouped.set(key, { total: 0, items: [] });
//         }
//         const group = grouped.get(key);
//         group.total += req.quantity;
//         group.items.push(req);
//       }
      
//       for (const [consignee, data] of grouped) {
//         message += `🏭 *${consignee}*\n`;
//         message += `📦 Всего: ${data.total} т\n`;
//         for (const item of data.items) {
//           message += `   • ${item.material} — ${item.quantity} т\n`;
//         }
//         message += '\n';
//       }
//     }
    
//     // Отправляем во все чаты
//     let successCount = 0;
    
//     if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_IDS.length > 0) {
//       for (const chatId of TELEGRAM_CHAT_IDS) {
//         const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
//         try {
//           const response = await fetch(telegramUrl, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//               chat_id: chatId.trim(),
//               text: message,
//               parse_mode: 'Markdown'
//             })
//           });
//           if (response.ok) successCount++;
//         } catch (err) {
//           console.error(`Ошибка отправки в чат ${chatId}:`, err);
//         }
//       }
//     }
    
//     return NextResponse.json({
//       success: true,
//       planCount: activeRequests.length,
//       telegramSent: successCount,
//       totalChats: TELEGRAM_CHAT_IDS.length,
//       message
//     });
    
//   } catch (error) {
//     console.error('Send plan error:', error);
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }