// app/api/send-plan/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, OutgoingRequest, sentNotifications, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendPushNotification } from '@/lib/push-notifications';

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







// Получение плана по дате
async function getPlanByDate(dateStr: string | null, dateLabel: string): Promise<string> {
    const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
    
    // Убираем фильтр по closed, показываем все заявки (и закрытые, и открытые)
    const planRequests = allRequests.filter(req => {
        if (dateStr) {
            const deliveryDate = req.delivery_date ? req.delivery_date.split('T')[0] : null;            
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




    return allRequests.filter(req => {
        const isNotClosed = req.closed === false || req.closed === null || req.closed === undefined;
        const deliveryDate = req.delivery_date ? req.delivery_date.split('T')[0] : null;
        const isForTodayOrTomorrow = deliveryDate === todayStr || deliveryDate === tomorrowStr;
        return isNotClosed && isForTodayOrTomorrow && !sentNumbers.has(req.number);
    });
}

// Отправка новых заявок
// async function sendNewRequests(): Promise<number> {
//     const newRequests = await getNewRequests();
    
//     if (newRequests.length === 0) {
//         return 0;
//     }
    
//     const today = new Date();
//     const todayStr = today.toISOString().split('T')[0];
    
//     const byDivision = new Map();
//     for (const req of newRequests) {
//         const division = req.division || 'Другие';
//         if (!byDivision.has(division)) byDivision.set(division, new Map());
//         const byConsignee = byDivision.get(division);
//         const consignee = req.consignee || req.customer || 'Неизвестно';
//         if (!byConsignee.has(consignee)) byConsignee.set(consignee, { total: 0, items: [], deliveryDate: req.delivery_date });
//         const group = byConsignee.get(consignee);
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
    
//     // Сохраняем отправленные заявки
//     for (const req of newRequests) {
//         const existing = await db.select().from(sentNotifications).where(eq(sentNotifications.requestNumber, req.number));
//         if (existing.length === 0) {
//             await db.insert(sentNotifications).values({
//                 requestNumber: req.number,
//                 sentAt: Date.now(),
//             });
//         }
//     }
    
//     // Отправляем сообщение
//     let successCount = 0;
//     for (const chatId of TELEGRAM_CHAT_IDS) {
//         const sent = await sendMessage(chatId.trim(), message);
//         if (sent) successCount++;
//     }
    
//     return successCount;
// }





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
    if (!byConsignee.has(consignee)) byConsignee.set(consignee, { total: 0, items: [], deliveryDate: req.delivery_date });
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
  





//   // ✅ Отправляем push-уведомления
//   try {
//     // Отправляем всем администраторам
//     const adminUsers = await db
//       .select()
//       .from(users)
//       .where(eq(users.group_id, 1)); // Админы
    
//     for (const user of adminUsers) {
//       await sendPushNotification(user.id, {
//         title: `📋 Новые заявки (${newRequests.length})`,
//         body: `Появилось ${newRequests.length} новых заявок на сегодня/завтра`,
//         tag: `new-requests-${Date.now()}`,
//         url: '/',
//       });
//     }
//     console.log(`✅ Push-уведомления отправлены ${adminUsers.length} пользователям`);
//   } catch (error) {
//     console.error('❌ Ошибка отправки push-уведомлений о новых заявках:', error);
//   }
  
// Отправляем push-уведомления
try {
  const adminUsers = await db
    .select()
    .from(users)
    .where(eq(users.group_id, 1));
  
  // Группируем заявки по заводам для красивого сообщения
  const byDivision = new Map<string, { total: number; items: { consignee: string; material: string; quantity: number; deliveryDate: string }[] }>();
  for (const req of newRequests) {
    const division = req.division || 'Другие';
    if (!byDivision.has(division)) {
      byDivision.set(division, { total: 0, items: [] });
    }
    const group = byDivision.get(division)!;
    group.total += req.quantity;
    const consignee = (req.consignee || req.customer || 'Неизвестно').replace('ПК 25 ', '').replace('ПК 26 ', '');
    group.items.push({
      consignee,
      material: req.material || 'Асфальт',
      quantity: req.quantity,
      deliveryDate: req.delivery_date || '',
    });
  }
  
  // Отправляем каждому админу
  for (const admin of adminUsers) {
    // Первое уведомление — самое важное
    let firstBody = '';
    for (const [division, group] of byDivision) {
      const divisionName = division === 'Люберцы' ? 'ЛЮ' : 
                          division === 'Луховицы' ? 'ЛХ' : 
                          division === 'СП' ? 'СП' : 
                          division === 'Щ' ? 'Щ' : division;
      // Берём первую заявку для примера
      const firstItem = group.items[0];
      if (firstItem) {
        firstBody = `${divisionName} ${firstItem.quantity} т\n${firstItem.consignee}`;
      }
      break; // только первая заявка для краткости
    }
    
    if (newRequests.length === 1) {
      // Одна заявка — подробно
      const firstGroup = byDivision.values().next().value;
      const firstItem = firstGroup?.items[0];
      if (firstItem) {
        const divisionName = [...byDivision.keys()][0] === 'Люберцы' ? 'ЛЮ' : 'ЛХ';
        await sendPushNotification(admin.id, {
          title: `🟢 Новая заявка!`,
          body: `${divisionName} ${firstItem.quantity} т\n${firstItem.consignee}`,
          tag: `new-request-${Date.now()}`,
          url: '/',
        });
      }
    } else {
      // Несколько заявок — общая сводка
      let body = '';
      let count = 0;
      for (const [division, group] of byDivision) {
        if (count >= 3) {
          const remaining = newRequests.length - count;
          if (remaining > 0) body += `\n… и ещё ${remaining} заявок`;
          break;
        }
        const divisionName = division === 'Люберцы' ? 'ЛЮ' : 
                            division === 'Луховицы' ? 'ЛХ' : 
                            division === 'СП' ? 'СП' : 
                            division === 'Щ' ? 'Щ' : division;
        const firstItem = group.items[0];
        if (firstItem) {
          body += `${divisionName} ${firstItem.quantity} т → ${firstItem.consignee}`;
          if (group.items.length > 1) {
            body += ` (+${group.items.length - 1})`;
          }
          body += '\n';
          count += group.items.length;
        }
      }
      
      await sendPushNotification(admin.id, {
        title: `🟢 Новые заявки (${newRequests.length})`,
        body: body.trim() || `Появилось ${newRequests.length} новых заявок`,
        tag: `new-requests-${Date.now()}`,
        url: '/',
      });
    }
  }
  console.log(`✅ Push-уведомления отправлены ${adminUsers.length} пользователям`);
} catch (error) {
  console.error('❌ Ошибка отправки push-уведомлений о новых заявках:', error);
}













  // Отправляем Telegram сообщение
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
    //const authHeader = request.headers.get('authorization');
    //const cronSecret = process.env.CRON_SECRET;
    
    //if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    //    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    //}
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

