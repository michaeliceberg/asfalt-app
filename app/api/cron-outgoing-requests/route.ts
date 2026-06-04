import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, sentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

// Функция для получения московской даты
const getMoscowDate = (daysOffset: number = 0): string => {
    const now = new Date();
    const mskTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    mskTime.setDate(mskTime.getDate() + daysOffset);
    return mskTime.toISOString().split('T')[0];
};

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

function formatNewRequestsMessage(newRequests: NewRequestForNotify[]): string {
    const todayStr = getMoscowDate(0);
    const tomorrowStr = getMoscowDate(1);

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
        
        // Используем московскую дату
        const today = getMoscowDate(0);
        const tomorrow = getMoscowDate(1);
        
        for (const record of data) {
            const existing = await db
                .select()
                .from(outgoingRequests)
                .where(eq(outgoingRequests.number, record.Номер))
                .limit(1);
            
            // Проверяем, нужно ли уведомление (только для незакрытых заявок)
            const isNotClosed = record.Закрыта === false || record.Закрыта === null || record.Закрыта === undefined;
            const deliveryDate = record.ДатаОтгрузки ? record.ДатаОтгрузки.split('T')[0] : null;
            
            const shouldNotify = isNotClosed && deliveryDate && (deliveryDate === today || deliveryDate === tomorrow);
            
            if (existing.length === 0) {
                // Новая заявка — сохраняем с deliveryDate (camelCase, как в схеме)
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
                delivery_date: record.ДатаОтгрузки || null,  // ← исправлено
                createdAt: Date.now(),
            });
                insertedCount++;
                
                if (shouldNotify) {
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
                // Обновление существующей заявки
                const existingReq = existing[0];
                
                if (existingReq.closed !== record.Закрыта) {
                    await db.update(outgoingRequests)
                        .set({ closed: record.Закрыта === true })
                        .where(eq(outgoingRequests.number, record.Номер));
                    updatedCount++;
                }
            }
        }
        
        if (newRequestsForNotify.length > 0) {
            const message = formatNewRequestsMessage(newRequestsForNotify);
            await sendTelegramMessage(message);
            console.log(`Sent ${newRequestsForNotify.length} notifications`);
        }
        
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