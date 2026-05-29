// app/api/cron-outgoing-requests/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, sentNotifications } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-requests.json');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

interface OutgoingRequestItem {
  Подразделение: string;
  Номер: string;
  Дата: string;
  Покупатель: string;
  Грузополучатель: string;
  Номенклатура: string;
  Количество: number;
  НомерЗаявкиКлиента: string;
  ДатаЗаявкиКлиента: string;
  Закрыта: boolean;
  ДатаОтгрузки: string;
}

interface NewRequestForNotify {
  number: string;
  division: string;
  consignee: string | null;
  customer: string;
  material: string;
  quantity: number;
  deliveryDate: string;
}

async function sendTelegramMessage(message: string): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_CHAT_IDS.length === 0) return false;
    
    let successCount = 0;
    for (const chatId of TELEGRAM_CHAT_IDS) {
        try {
            const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId.trim(),
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
            if (response.ok) successCount++;
        } catch (error) {
            console.error(`Ошибка отправки в чат ${chatId}:`, error);
        }
    }
    return successCount > 0;
}







// function formatNewRequestsMessage(newRequests: NewRequestForNotify[]): string {
//     const today = new Date();
//     const todayStr = today.toISOString().split('T')[0];
//     const tomorrow = new Date();
//     tomorrow.setDate(tomorrow.getDate() + 1);
//     const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
//     const byDivision = new Map<string, Map<string, { total: number; items: { material: string; quantity: number }[]; deliveryDate: string }>>();
    
//     for (const req of newRequests) {
//         const division = req.division || 'Другие';
//         if (!byDivision.has(division)) {
//             byDivision.set(division, new Map());
//         }
//         const byConsignee = byDivision.get(division)!;
//         const consignee = req.consignee || req.customer || 'Неизвестно';
//         if (!byConsignee.has(consignee)) {
//             byConsignee.set(consignee, { total: 0, items: [], deliveryDate: req.deliveryDate });
//         }
//         const group = byConsignee.get(consignee)!;
//         group.total += req.quantity;
//         group.items.push({ material: req.material, quantity: req.quantity });
//     }
    
//     let message = `🆕 *НОВЫЕ ЗАЯВКИ*\n\n`;
//     for (const [division, byConsignee] of byDivision) {
//         const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
//         message += `*${divisionName}*\n`;
//         for (const [consignee, data] of byConsignee) {
//             let dateLabel = '';
//             const deliveryDateStr = data.deliveryDate?.split('T')[0];
//             if (deliveryDateStr === todayStr) {
//                 dateLabel = '🚨 СЕГОДНЯ 🚨';
//             } else if (deliveryDateStr === tomorrowStr) {
//                 dateLabel = '⏰ НА ЗАВТРА';
//             } else {
//                 dateLabel = `📅 ${deliveryDateStr}`;
//             }
//             message += `▫️ ${consignee} — ${data.total} т ${dateLabel}\n`;
//             if (data.items.length === 1 && data.items[0].material) {
//                 message += `   • ${data.items[0].material}\n`;
//             } else if (data.items.length > 1) {
//                 const materials = new Map<string, number>();
//                 for (const item of data.items) {
//                     materials.set(item.material, (materials.get(item.material) || 0) + item.quantity);
//                 }
//                 for (const [material, qty] of materials) {
//                     message += `   • ${material} — ${qty} т\n`;
//                 }
//             }
//         }
//         message += '\n';
//     }
//     message += `📌 Всего новых: ${newRequests.length}\n`;
//     message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
//     return message;
// }

function formatNewRequestsMessage(newRequests: NewRequestForNotify[]): string {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const byDivision = new Map<string, Map<string, { total: number; items: { material: string; quantity: number }[]; deliveryDate: string }>>();
    
    for (const req of newRequests) {
        const division = req.division || 'Другие';
        if (!byDivision.has(division)) {
            byDivision.set(division, new Map());
        }
        const byConsignee = byDivision.get(division)!;
        const consignee = req.consignee || req.customer || 'Неизвестно';
        if (!byConsignee.has(consignee)) {
            byConsignee.set(consignee, { total: 0, items: [], deliveryDate: req.deliveryDate });
        }
        const group = byConsignee.get(consignee)!;
        group.total += req.quantity;
        group.items.push({ material: req.material, quantity: req.quantity });
    }
    
    let message = `🆕 *НОВЫЕ ЗАЯВКИ*\n\n`;
    for (const [division, byConsignee] of byDivision) {
        const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
        message += `*${divisionName}*\n`;
        for (const [consignee, data] of byConsignee) {
            let dateLabel = '';
            const deliveryDateStr = data.deliveryDate?.split('T')[0];
            if (deliveryDateStr === todayStr) {
                dateLabel = '🚨 СЕГОДНЯ 🚨';
            } else if (deliveryDateStr === tomorrowStr) {
                dateLabel = '⏰ НА ЗАВТРА';
            } else {
                dateLabel = `📅 ${deliveryDateStr}`;
            }
            message += `▫️ ${consignee} — ${data.total} т ${dateLabel}\n`;
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
        message += '\n';
    }
    message += `📌 Всего новых: ${newRequests.length}\n`;
    // message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;

    // Стало:
const mskTime = new Date().toLocaleTimeString('ru-RU', { 
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});
message += `🕐 ${mskTime}`;

    
    // Добавляем подсказку в конце
    message += `\n\n---\n💡 *Быстрый доступ:* /today - план на сегодня, /tomorrow - план на завтра`;
    
    return message;
}







export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const UNF_BASE_URL = process.env.UNF_BASE_URL;
        const LOGIN = process.env.UNF_LOGIN;
        const PASSWORD = process.env.UNF_PASSWORD;
        
        console.log('Fetching data from 1C...');
        const response = await fetch(`${UNF_BASE_URL}/hs/WebData-API/OutgoingRequest`, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: OutgoingRequestItem[] = await response.json();
        console.log(`Received ${data.length} records from 1C`);
        
        let insertedCount = 0;
        let updatedCount = 0;
        const newRequestsForNotify: NewRequestForNotify[] = [];
        
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        for (const record of data) {
            const existing = await db
                .select()
                .from(outgoingRequests)
                .where(eq(outgoingRequests.number, record.Номер))
                .limit(1);
            
            // Проверяем, нужно ли уведомление
            const isNotClosed = record.Закрыта === false || record.Закрыта === null || record.Закрыта === undefined;
            const deliveryDate = record.ДатаОтгрузки ? record.ДатаОтгрузки.split('T')[0] : null;
            const shouldNotify = isNotClosed && deliveryDate && (deliveryDate === today || deliveryDate === tomorrowStr);
            
            if (existing.length === 0) {
                // Новая заявка
                await db.insert(outgoingRequests).values({
                    number: record.Номер,
                    date: record.Дата,
                    division: record.Подразделение,
                    customer: record.Покупатель,
                    consignee: record.Грузополучатель || null,
                    material: record.Номенклатура,
                    quantity: record.Количество,
                    clientRequestNumber: record.НомерЗаявкиКлиента || null,
                    clientRequestDate: record.ДатаЗаявкиКлиента || null,
                    closed: record.Закрыта === true,
                    deliveryDate: record.ДатаОтгрузки || null,
                    createdAt: Date.now(),
                });
                insertedCount++;
                
                // Отправляем уведомление для новой заявки
                if (shouldNotify) {
                    // Проверяем, не отправляли ли уже уведомление
                    const alreadySent = await db
                        .select()
                        .from(sentNotifications)
                        .where(eq(sentNotifications.requestNumber, record.Номер))
                        .limit(1);
                    
                    if (alreadySent.length === 0) {
                        newRequestsForNotify.push({
                            number: record.Номер,
                            division: record.Подразделение,
                            consignee: record.Грузополучатель,
                            customer: record.Покупатель,
                            material: record.Номенклатура,
                            quantity: record.Количество,
                            deliveryDate: record.ДатаОтгрузки,
                        });
                        
                        await db.insert(sentNotifications).values({
                            requestNumber: record.Номер,
                            sentAt: Date.now(),
                        });
                    }
                }
            } else {
                // Существующая заявка - проверяем изменения
                const existingReq = existing[0];
                let needsUpdate = false;
                
                if (existingReq.closed !== record.Закрыта) {
                    needsUpdate = true;
                    await db.update(outgoingRequests)
                        .set({ closed: record.Закрыта === true })
                        .where(eq(outgoingRequests.number, record.Номер));
                    updatedCount++;
                }
                
                // Если заявка была закрыта, но уведомление ещё не отправлено - не отправляем
                if (shouldNotify && !needsUpdate) {
                    const alreadySent = await db
                        .select()
                        .from(sentNotifications)
                        .where(eq(sentNotifications.requestNumber, record.Номер))
                        .limit(1);
                    
                    if (alreadySent.length === 0) {
                        newRequestsForNotify.push({
                            number: record.Номер,
                            division: record.Подразделение,
                            consignee: record.Грузополучатель,
                            customer: record.Покупатель,
                            material: record.Номенклатура,
                            quantity: record.Количество,
                            deliveryDate: record.ДатаОтгрузки,
                        });
                        
                        await db.insert(sentNotifications).values({
                            requestNumber: record.Номер,
                            sentAt: Date.now(),
                        });
                    }
                }
            }
        }
        
        // Отправляем уведомления о новых заявках
        if (newRequestsForNotify.length > 0) {
            const message = formatNewRequestsMessage(newRequestsForNotify);
            await sendTelegramMessage(message);
            console.log(`Sent ${newRequestsForNotify.length} notifications`);
        }
        
        // Сохраняем время последней синхронизации
        fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({
            lastSync: new Date().toISOString(),
            totalRecords: data.length,
            newRecords: insertedCount,
            updatedRecords: updatedCount,
        }));
        
        return NextResponse.json({
            success: true,
            total: data.length,
            newRecords: insertedCount,
            updatedRecords: updatedCount,
            newNotifications: newRequestsForNotify.length,
            timestamp: new Date().toISOString(),
        });
        
    } catch (error) {
        console.error('Cron error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}










// // app/api/cron-outgoing-requests/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { outgoingRequests, sentNotifications } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';
// import fs from 'fs';
// import path from 'path';

// const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-requests.json');
// const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

// interface OutgoingRequestItem {
//   Подразделение: string;
//   Номер: string;
//   Дата: string;
//   Покупатель: string;
//   Грузополучатель: string;
//   Номенклатура: string;
//   Количество: number;
//   НомерЗаявкиКлиента: string;
//   ДатаЗаявкиКлиента: string;
//   Закрыта: boolean;
//   ДатаОтгрузки: string;
// }

// interface NewRequestForNotify {
//   number: string;
//   division: string;
//   consignee: string | null;
//   customer: string;
//   material: string;
//   quantity: number;
//   deliveryDate: string;
// }

// // Отправка сообщения в Telegram
// async function sendTelegramMessage(message: string): Promise<boolean> {
//     if (!TELEGRAM_BOT_TOKEN || TELEGRAM_CHAT_IDS.length === 0) return false;
    
//     let successCount = 0;
//     for (const chatId of TELEGRAM_CHAT_IDS) {
//         try {
//             const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
//             const response = await fetch(url, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     chat_id: chatId.trim(),
//                     text: message,
//                     parse_mode: 'Markdown'
//                 })
//             });
//             if (response.ok) successCount++;
//         } catch (error) {
//             console.error(`Ошибка отправки в чат ${chatId}:`, error);
//         }
//     }
//     return successCount > 0;
// }

// // Формирование сообщения о новых заявках
// function formatNewRequestsMessage(newRequests: NewRequestForNotify[]): string {
//     const today = new Date();
//     const todayStr = today.toISOString().split('T')[0];
    
//     const byDivision = new Map<string, Map<string, { total: number; items: { material: string; quantity: number }[]; deliveryDate: string }>>();
    
//     for (const req of newRequests) {
//         const division = req.division || 'Другие';
//         if (!byDivision.has(division)) {
//             byDivision.set(division, new Map());
//         }
//         const byConsignee = byDivision.get(division)!;
//         const consignee = req.consignee || req.customer || 'Неизвестно';
//         if (!byConsignee.has(consignee)) {
//             byConsignee.set(consignee, { total: 0, items: [], deliveryDate: req.deliveryDate });
//         }
//         const group = byConsignee.get(consignee)!;
//         group.total += req.quantity;
//         group.items.push({ material: req.material, quantity: req.quantity });
//     }
    
//     let message = `🆕 *НОВЫЕ ЗАЯВКИ*\n\n`;
//     for (const [division, byConsignee] of byDivision) {
//         const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
//         message += `*${divisionName}*\n`;
//         for (const [consignee, data] of byConsignee) {
//             const dateLabel = data.deliveryDate && data.deliveryDate.split('T')[0] === todayStr ? '🚨 СЕГОДНЯ' : '📅 НА ЗАВТРА';
//             message += `▫️ ${consignee} — ${data.total} т ${dateLabel}\n`;
//             if (data.items.length === 1 && data.items[0].material) {
//                 message += `   • ${data.items[0].material}\n`;
//             }
//         }
//     }
//     message += `\n📌 Всего новых: ${newRequests.length}\n🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
//     return message;
// }

// export async function GET(request: Request) {
//     const authHeader = request.headers.get('authorization');
//     const cronSecret = process.env.CRON_SECRET;
    
//     if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
//         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }

//     try {
//         const UNF_BASE_URL = process.env.UNF_BASE_URL;
//         const LOGIN = process.env.UNF_LOGIN;
//         const PASSWORD = process.env.UNF_PASSWORD;
        
//         const response = await fetch(`${UNF_BASE_URL}/hs/WebData-API/OutgoingRequest`, {
//             headers: {
//                 'Authorization': 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
//             },
//         });
        
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
        
//         const data: OutgoingRequestItem[] = await response.json();
        
//         // Получаем уже отправленные заявки
//         const sentRecords = await db.select().from(sentNotifications);
//         const sentNumbers = new Set(sentRecords.map(r => r.requestNumber));
        
//         let insertedCount = 0;
//         const newRequestsForNotify: NewRequestForNotify[] = [];
        
//         for (const record of data) {
//             const existing = await db
//                 .select()
//                 .from(outgoingRequests)
//                 .where(eq(outgoingRequests.number, record.Номер))
//                 .limit(1);
            
//             if (existing.length === 0) {
//                 await db.insert(outgoingRequests).values({
//                     number: record.Номер,
//                     date: record.Дата,
//                     division: record.Подразделение,
//                     customer: record.Покупатель,
//                     consignee: record.Грузополучатель || null,
//                     material: record.Номенклатура,
//                     quantity: record.Количество,
//                     clientRequestNumber: record.НомерЗаявкиКлиента || null,
//                     clientRequestDate: record.ДатаЗаявкиКлиента || null,
//                     closed: record.Закрыта === true, // || record.Закрыта === 'true',
//                     deliveryDate: record.ДатаОтгрузки || null,
//                     createdAt: Date.now(),
//                 });
//                 insertedCount++;
                
//                 // Проверяем, нужно ли отправить уведомление о новой заявке
//                 const isNotClosed = record.Закрыта === false || record.Закрыта === null || record.Закрыта === undefined;
//                 if (isNotClosed && record.ДатаОтгрузки) {
//                     const deliveryDate = record.ДатаОтгрузки.split('T')[0];
//                     const today = new Date().toISOString().split('T')[0];
//                     const tomorrow = new Date();
//                     tomorrow.setDate(tomorrow.getDate() + 1);
//                     const tomorrowStr = tomorrow.toISOString().split('T')[0];
                    
//                     // Если заявка на сегодня или завтра и ещё не отправлена
//                     if ((deliveryDate === today || deliveryDate === tomorrowStr) && !sentNumbers.has(record.Номер)) {
//                         newRequestsForNotify.push({
//                             number: record.Номер,
//                             division: record.Подразделение,
//                             consignee: record.Грузополучатель,
//                             customer: record.Покупатель,
//                             material: record.Номенклатура,
//                             quantity: record.Количество,
//                             deliveryDate: record.ДатаОтгрузки,
//                         });
                        
//                         // Сохраняем в sent_notifications
//                         await db.insert(sentNotifications).values({
//                             requestNumber: record.Номер,
//                             sentAt: Date.now(),
//                         });
//                     }
//                 }
//             }
//         }
        
//         // Отправляем уведомления о новых заявках
//         if (newRequestsForNotify.length > 0) {
//             const message = formatNewRequestsMessage(newRequestsForNotify);
//             await sendTelegramMessage(message);
//         }
        
//         fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({
//             lastSync: new Date().toISOString(),
//         }));
        
//         return NextResponse.json({
//             success: true,
//             total: data.length,
//             newRecords: insertedCount,
//             newNotifications: newRequestsForNotify.length,
//             timestamp: new Date().toISOString(),
//         });
        
//     } catch (error) {
//         console.error('Cron error:', error);
//         return NextResponse.json(
//             { error: 'Internal server error' },
//             { status: 500 }
//         );
//     }
// }









































// // app/api/cron-outgoing-requests/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { outgoingRequests } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';
// import fs from 'fs';
// import path from 'path';

// const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-requests.json');

// interface OutgoingRequestItem {
//   Подразделение: string;
//   Номер: string;
//   Дата: string;
//   Покупатель: string;
//   Грузополучатель: string;
//   Номенклатура: string;
//   Количество: number;
//   НомерЗаявкиКлиента: string;
//   ДатаЗаявкиКлиента: string;
//   Закрыта: boolean;  // ← измените на boolean
//   ДатаОтгрузки: string;  // ← Добавить
// }


// export async function GET(request: Request) {
//   const authHeader = request.headers.get('authorization');
//   const cronSecret = process.env.CRON_SECRET;
  
//   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }

//   try {
//     const UNF_BASE_URL = process.env.UNF_BASE_URL;
//     const LOGIN = process.env.UNF_LOGIN;
//     const PASSWORD = process.env.UNF_PASSWORD;
    
//     const response = await fetch(`${UNF_BASE_URL}/hs/WebData-API/OutgoingRequest`, {
//       headers: {
//         'Authorization': 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
//       },
//     });
    
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
    
//     const data: OutgoingRequestItem[] = await response.json();
    
//     let insertedCount = 0;
//     for (const record of data) {
//       const existing = await db
//         .select()
//         .from(outgoingRequests)
//         .where(eq(outgoingRequests.number, record.Номер))
//         .limit(1);
      
//       if (existing.length === 0) {
// await db.insert(outgoingRequests).values({
//   number: record.Номер,
//   date: record.Дата,
//   division: record.Подразделение,
//   customer: record.Покупатель,
//   consignee: record.Грузополучатель || null,
//   material: record.Номенклатура,
//   quantity: record.Количество,
//   clientRequestNumber: record.НомерЗаявкиКлиента || null,
//   clientRequestDate: record.ДатаЗаявкиКлиента || null,
//   closed: record.Закрыта === true, // || record.Закрыта === 'true',  // ← добавить
//   deliveryDate: record.ДатаОтгрузки || null,
//   createdAt: Date.now(),
// });
//         insertedCount++;
//       }
//     }
    
//     fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({
//       lastSync: new Date().toISOString(),
//     }));
    
//     return NextResponse.json({
//       success: true,
//       total: data.length,
//       newRecords: insertedCount,
//       timestamp: new Date().toISOString(),
//     });
    
//   } catch (error) {
//     console.error('Cron error:', error);
//     return NextResponse.json(
//       { error: 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }