// lib/telegram-polling.ts
import { db } from '@/lib/db';
import { outgoingRequests, OutgoingRequest } from '@/lib/db/schema';
import { shipments, Shipment } from '@/lib/db/schema';
// import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import { logger } from './db/logger';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramUser {
    id: number;
    first_name: string;
}

interface TelegramChat {
    id: number;
    type: string;
}

interface TelegramMessage {
    message_id: number;
    from: TelegramUser;
    chat: TelegramChat;
    text?: string;
    date: number;
}

interface TelegramCallbackQuery {
    id: string;
    from: TelegramUser;
    message: {
        message_id: number;
        chat: TelegramChat;
        text?: string;
    };
    data: string;
}

interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
    callback_query?: TelegramCallbackQuery;
}

interface TelegramKeyboard {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

interface GroupData {
    planTotal: number;
    items: Array<{ material: string; quantity: number }>;
}

class TelegramPollingService {
    private lastUpdateId: number = 0;
    private isPolling: boolean = false;
    private pollInterval: NodeJS.Timeout | null = null;

    async startPolling(): Promise<void> {
        if (this.isPolling) {
            logger.warn('Polling already started');
            return;
        }

        this.isPolling = true;
        logger.info('Starting Telegram polling service...');
        
        // Загружаем последний update_id
        try {
            const lastUpdateFile = path.join(process.cwd(), 'data', 'last-telegram-update.json');
            if (fs.existsSync(lastUpdateFile)) {
                const data = JSON.parse(fs.readFileSync(lastUpdateFile, 'utf-8'));
                this.lastUpdateId = data.lastUpdateId || 0;
                logger.info(`Loaded last update_id: ${this.lastUpdateId}`);
            }
        } catch (error) {
            logger.info('No saved update_id, starting from 0');
        }

        // Запускаем polling каждые 2 секунды
        this.pollInterval = setInterval(async () => {
            await this.pollUpdates();
        }, 2000);

        logger.info('Telegram polling service started');
    }

    stopPolling(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isPolling = false;
        logger.info('Telegram polling service stopped');
    }

    private async pollUpdates(): Promise<void> {
        try {
            const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?timeout=30&offset=${this.lastUpdateId + 1}`;
            const response = await fetch(url);
            const data = await response.json() as { ok: boolean; result: TelegramUpdate[] };

            if (!data.ok) {
                logger.error('Telegram API error:', data);
                return;
            }

            const updates: TelegramUpdate[] = data.result;
            
            for (const update of updates) {
                await this.handleUpdate(update);
                this.lastUpdateId = update.update_id;
                await this.saveLastUpdateId();
            }
        } catch (error) {
            logger.error('Polling error:', error);
        }
    }

    private async saveLastUpdateId(): Promise<void> {
        try {
            const dataDir = path.join(process.cwd(), 'data');
            const lastUpdateFile = path.join(dataDir, 'last-telegram-update.json');
            
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            fs.writeFileSync(lastUpdateFile, JSON.stringify({
                lastUpdateId: this.lastUpdateId,
                timestamp: Date.now()
            }));
        } catch (error) {
            logger.error('Error saving last update_id:', error);
        }
    }

    private async handleUpdate(update: TelegramUpdate): Promise<void> {
        // Обработка callback query (нажатие на кнопки)
        if (update.callback_query) {
            await this.handleCallbackQuery(update.callback_query);
            return;
        }

        // Обработка текстовых сообщений
        if (update.message?.text) {
            await this.handleMessage(update.message);
        }
    }

    private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    callback_query_id: callbackQueryId,
                })
            });
        } catch (error) {
            logger.error('Error answering callback query:', error);
        }
    }

    private async editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: TelegramKeyboard): Promise<boolean> {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
        const body: {
            chat_id: number;
            message_id: number;
            text: string;
            parse_mode: string;
            reply_markup?: TelegramKeyboard;
        } = {
            chat_id: chatId,
            message_id: messageId,
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
            logger.error('Error editing message:', error);
            return false;
        }
    }

    // Функция для определения цвета по проценту выполнения
    private getProgressEmoji(percent: number): string {
        if (percent === 0) return '⚪️';      // 0% - ещё не начали
        if (percent < 100) return '🟠';       // 1-99% - в процессе
        return '🟢';                          // 100% и выше - выполнено/перевыполнено
    }

    // Получение плана с фактом
    private async getPlanWithFact(dateStr: string, title: string): Promise<string> {
        // Получаем заявки (план)
        const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
        const planRequests = allRequests.filter(req => {
            const isNotClosed = !req.closed;
            const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
            return isNotClosed && deliveryDate === dateStr;
        });
        
        // Получаем фактические отгрузки за сегодня
        const allShipments: Shipment[] = await db.select().from(shipments);
        const todayShipments = allShipments.filter(s => {
            const shipmentDate = s.date ? s.date.split('T')[0] : null;
            return shipmentDate === dateStr;
        });
        
        // Группируем факт по грузополучателю и заводу
        const factMap = new Map<string, number>();
        for (const shipment of todayShipments) {
            const consignee = shipment.consignee || shipment.customer || 'Неизвестно';
            const division = shipment.division || 'Другие';
            const key = `${division}_${consignee}`;
            const current = factMap.get(key) || 0;
            factMap.set(key, current + shipment.quantity);
        }
        
        return this.formatPlanWithFactMessage(planRequests, factMap, title, dateStr);
    }






    // // Форматирование сообщения с планом и фактом
    // private formatPlanWithFactMessage(
    //     requests: OutgoingRequest[], 
    //     factMap: Map<string, number>,
    //     title: string, 
    //     dateStr: string
    // ): string {
    //     let message = `📋 *${title}*\n\n`;
        
    //     if (requests.length === 0 && factMap.size === 0) {
    //         message += '✅ Нет отгрузок';
    //     } else {
    //         const byDivision = new Map<string, Map<string, GroupData>>();
            
    //         // Группируем плановые заявки
    //         for (const req of requests) {
    //             const division = req.division || 'Другие';
    //             if (!byDivision.has(division)) {
    //                 byDivision.set(division, new Map());
    //             }
    //             const byConsignee = byDivision.get(division)!;
    //             const consignee = req.consignee || req.customer || 'Неизвестно';
    //             const key = `${division}_${consignee}`;
                
    //             if (!byConsignee.has(key)) {
    //                 byConsignee.set(key, { planTotal: 0, items: [] });
    //             }
    //             const group = byConsignee.get(key)!;
    //             group.planTotal += req.quantity;
    //             group.items.push({ material: req.material, quantity: req.quantity });
    //         }
            
    //         for (const [division, byConsignee] of byDivision) {
    //             let divisionPlanTotal = 0;
    //             let divisionFactTotal = 0;
    //             const itemsWithFact: Array<{ consignee: string; planTotal: number; factTotal: number; items: { material: string; quantity: number }[] }> = [];
                
    //             for (const [key, data] of byConsignee) {
    //                 const [, consignee] = key.split('_');
    //                 const factTotal = factMap.get(key) || 0;
    //                 divisionPlanTotal += data.planTotal;
    //                 divisionFactTotal += factTotal;
    //                 itemsWithFact.push({ consignee, planTotal: data.planTotal, factTotal, items: data.items });
    //             }
                
    //             // Добавляем факт без плана
    //             for (const [key, factTotal] of factMap) {
    //                 const [factDivision, consignee] = key.split('_');
    //                 if (factDivision === division && !byConsignee.has(key)) {
    //                     divisionFactTotal += factTotal;
    //                     itemsWithFact.push({ consignee, planTotal: 0, factTotal, items: [] });
    //                 }
    //             }
                
    //             // Сортируем по проценту выполнения
    //             itemsWithFact.sort((a, b) => {
    //                 const aPercent = a.planTotal > 0 ? (a.factTotal / a.planTotal) * 100 : 0;
    //                 const bPercent = b.planTotal > 0 ? (b.factTotal / b.planTotal) * 100 : 0;
    //                 return bPercent - aPercent;
    //             });
                
    //             const divisionPercent = divisionPlanTotal > 0 ? (divisionFactTotal / divisionPlanTotal) * 100 : 0;
    //             const divisionEmoji = this.getProgressEmoji(divisionPercent);
                
    //             const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
    //             message += `*${divisionName}* ${divisionEmoji} ${divisionFactTotal.toFixed(0)}/${divisionPlanTotal} т\n`;
                
    //             for (const item of itemsWithFact) {
    //                 const percent = item.planTotal > 0 ? (item.factTotal / item.planTotal) * 100 : 0;
    //                 const emoji = this.getProgressEmoji(percent);
                    
    //                 if (item.planTotal > 0) {
    //                     message += `   ${emoji} *${item.consignee}* — ${item.factTotal.toFixed(0)}/${item.planTotal} т\n`;
    //                 } else {
    //                     message += `   🟠 *${item.consignee}* — ${item.factTotal.toFixed(0)} т (без плана)\n`;
    //                 }
                    
    //                 // Показываем материал если он один
    //                 if (item.items.length === 1 && item.items[0].material) {
    //                     const material = item.items[0].material;
    //                     // Обрезаем длинные названия
    //                     const shortMaterial = material.length > 35 ? material.substring(0, 32) + '...' : material;
    //                     message += `      📦 ${shortMaterial}\n`;
    //                 }
    //             }
    //             message += `\n`;
    //         }
    //     }
        
    //     const mskTime = new Date().toLocaleTimeString('ru-RU', { 
    //         timeZone: 'Europe/Moscow',
    //         hour: '2-digit',
    //         minute: '2-digit'
    //     });
    //     message += `📅 ${dateStr} | 🕐 ${mskTime}`;
        
    //     return message;
    // }
private formatPlanWithFactMessage(
    requests: OutgoingRequest[], 
    factMap: Map<string, number>,
    title: string, 
    dateStr: string
): string {
    let message = `📋 *${title}*\n\n`;
    
    if (requests.length === 0 && factMap.size === 0) {
        message += '✅ Нет отгрузок';
    } else {
        const byDivision = new Map<string, Map<string, GroupData>>();
        
        // Группируем плановые заявки
        for (const req of requests) {
            const division = req.division || 'Другие';
            if (!byDivision.has(division)) {
                byDivision.set(division, new Map());
            }
            const byConsignee = byDivision.get(division)!;
            const consignee = req.consignee || req.customer || 'Неизвестно';
            const key = `${division}_${consignee}`;
            
            if (!byConsignee.has(key)) {
                byConsignee.set(key, { planTotal: 0, items: [] });
            }
            const group = byConsignee.get(key)!;
            group.planTotal += req.quantity;
            group.items.push({ material: req.material, quantity: req.quantity });
        }
        
        for (const [division, byConsignee] of byDivision) {
            let divisionPlanTotal = 0;
            let divisionFactTotal = 0;
            const itemsWithFact: Array<{ consignee: string; planTotal: number; factTotal: number; items: { material: string; quantity: number }[] }> = [];
            
            for (const [key, data] of byConsignee) {
                const [, consignee] = key.split('_');
                const factTotal = factMap.get(key) || 0;
                divisionPlanTotal += data.planTotal;
                divisionFactTotal += factTotal;
                itemsWithFact.push({ consignee, planTotal: data.planTotal, factTotal, items: data.items });
            }
            
            // Добавляем факт без плана
            for (const [key, factTotal] of factMap) {
                const [factDivision, consignee] = key.split('_');
                if (factDivision === division && !byConsignee.has(key)) {
                    divisionFactTotal += factTotal;
                    itemsWithFact.push({ consignee, planTotal: 0, factTotal, items: [] });
                }
            }
            
            // Сортируем по проценту выполнения
            itemsWithFact.sort((a, b) => {
                const aPercent = a.planTotal > 0 ? (a.factTotal / a.planTotal) * 100 : 0;
                const bPercent = b.planTotal > 0 ? (b.factTotal / b.planTotal) * 100 : 0;
                return bPercent - aPercent;
            });
            
            const divisionPercent = divisionPlanTotal > 0 ? (divisionFactTotal / divisionPlanTotal) * 100 : 0;
            const divisionEmoji = this.getProgressEmoji(divisionPercent);
            
            const divisionName = division === 'Люберцы' ? 'ЛЮБЕРЕЦКИЙ' : 'ЛУХОВИЦКИЙ';
            // Тоннаж завода жирным
            message += `🏭 ${divisionName} ${divisionEmoji} *${divisionFactTotal.toFixed(0)}/${divisionPlanTotal} т*\n`;
            
            for (const item of itemsWithFact) {
                const percent = item.planTotal > 0 ? (item.factTotal / item.planTotal) * 100 : 0;
                const emoji = this.getProgressEmoji(percent);
                
                if (item.planTotal > 0) {
                    // Тоннаж грузополучателя жирным
                    message += `   ${emoji} *${item.consignee}* *${item.factTotal.toFixed(0)}/${item.planTotal} т*\n`;
                } else {
                    message += `   🟠 *${item.consignee}* *${item.factTotal.toFixed(0)} т* (без плана)\n`;
                }
                
                // Материал
                if (item.items.length === 1 && item.items[0].material) {
                    const material = item.items[0].material;
                    message += `      ${material}\n`;
                }
            }
            message += `\n`;
        }
    }
    
    const mskTime = new Date().toLocaleTimeString('ru-RU', { 
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit'
    });
    message += `📅 ${dateStr} | 🕐 ${mskTime}`;
    
    return message;
}







    private async handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const callbackId = callbackQuery.id;
        
        logger.info(`Callback query from ${chatId}: ${data}`);
        
        // Отвечаем на callback
        await this.answerCallbackQuery(callbackId);
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        let message = '';
        
        switch (data) {
            case 'plan_today':
                message = await this.getPlanWithFact(todayStr, 'ПЛАН И ФАКТ ОТГРУЗОК НА СЕГОДНЯ');
                break;
            case 'plan_tomorrow':
                message = await this.getPlanWithFact(tomorrowStr, 'ПЛАН И ФАКТ ОТГРУЗОК НА ЗАВТРА');
                break;
            default:
                return;
        }

        await this.editMessageText(chatId, messageId, message, this.getMainKeyboard());
    }

    private async handleMessage(message: TelegramMessage): Promise<void> {
        const chatId = message.chat.id;
        const text = message.text || '';
        
        logger.info(`Message from ${chatId}: ${text}`);

        if (text === '/start') {
            const welcomeMessage = `🤖 *Добро пожаловать в бот АБЗ!*

Я помогаю отслеживать отгрузки асфальта.

📊 *Доступные команды:*
• Нажмите кнопку "Сегодня" - план и факт на текущий день
• Нажмите кнопку "Завтра" - план и факт на следующий день
• /help - показать это сообщение

📅 *Данные обновляются:* автоматически каждый час

🏭 *Доступные заводы:*
• Люберецкий АБЗ
• Луховицкий АБЗ

---
⚪️ — ещё не начали
🟠 — в процессе
🟢 — выполнено`;

            await this.sendMessage(chatId, welcomeMessage, this.getMainKeyboard());
        } 
        else if (text === '/help') {
            const helpMessage = `🔍 *Справка по командам*

/start - начать работу с ботом
/help - показать эту справку
/today - план и факт на сегодня
/tomorrow - план и факт на завтра

*Обозначения:*
⚪️ — 0% (ещё не начали)
🟠 — 1-99% (в процессе)
🟢 — 100%+ (выполнено)

*Или используйте кнопки ниже* 👇`;
            
            await this.sendMessage(chatId, helpMessage, this.getMainKeyboard());
        }
        else if (text === '/today') {
            const todayStr = new Date().toISOString().split('T')[0];
            const message = await this.getPlanWithFact(todayStr, 'ПЛАН И ФАКТ ОТГРУЗОК НА СЕГОДНЯ');
            await this.sendMessage(chatId, message, this.getMainKeyboard());
        }
        else if (text === '/tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            const message = await this.getPlanWithFact(tomorrowStr, 'ПЛАН И ФАКТ ОТГРУЗОК НА ЗАВТРА');
            await this.sendMessage(chatId, message, this.getMainKeyboard());
        }
        else {
            await this.sendMessage(chatId, 'Используйте кнопки или команды:\n/today - сегодня\n/tomorrow - завтра\n/help - помощь');
        }
    }

    private getMainKeyboard(): TelegramKeyboard {
        return {
            inline_keyboard: [
                [
                    { text: "📅 Сегодня", callback_data: "plan_today" },
                    { text: "📋 Завтра", callback_data: "plan_tomorrow" }
                ]
            ]
        };
    }

    private async sendMessage(chatId: number, text: string, replyMarkup?: TelegramKeyboard): Promise<boolean> {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const body: {
            chat_id: number;
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
            const data = await response.json() as { ok: boolean };
            
            if (!response.ok) {
                logger.error('Telegram send error:', data);
                return false;
            }
            return true;
        } catch (error) {
            logger.error('Error sending message:', error);
            return false;
        }
    }
}

// Создаём singleton экземпляр
export const telegramPolling = new TelegramPollingService();



// // lib/telegram-polling.ts
// import { db } from '@/lib/db';
// import { outgoingRequests, OutgoingRequest } from '@/lib/db/schema';
// // import { logger } from '@/lib/logger';
// import fs from 'fs';
// import path from 'path';
// import { logger } from './db/logger';

// const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// interface TelegramUser {
//     id: number;
//     first_name: string;
// }

// interface TelegramChat {
//     id: number;
//     type: string;
// }

// interface TelegramMessage {
//     message_id: number;
//     from: TelegramUser;
//     chat: TelegramChat;
//     text?: string;
//     date: number;
// }

// interface TelegramCallbackQuery {
//     id: string;
//     from: TelegramUser;
//     message: {
//         message_id: number;
//         chat: TelegramChat;
//         text?: string;
//     };
//     data: string;
// }

// interface TelegramUpdate {
//     update_id: number;
//     message?: TelegramMessage;
//     callback_query?: TelegramCallbackQuery;
// }

// interface TelegramKeyboard {
//     inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
// }

// interface GroupData {
//     total: number;
//     items: Array<{ material: string; quantity: number }>;
// }

// class TelegramPollingService {
//     private lastUpdateId: number = 0;
//     private isPolling: boolean = false;
//     private pollInterval: NodeJS.Timeout | null = null;

//     async startPolling(): Promise<void> {
//         if (this.isPolling) {
//             logger.warn('Polling already started');
//             return;
//         }

//         this.isPolling = true;
//         logger.info('Starting Telegram polling service...');
        
//         // Загружаем последний update_id
//         try {
//             const lastUpdateFile = path.join(process.cwd(), 'data', 'last-telegram-update.json');
//             if (fs.existsSync(lastUpdateFile)) {
//                 const data = JSON.parse(fs.readFileSync(lastUpdateFile, 'utf-8'));
//                 this.lastUpdateId = data.lastUpdateId || 0;
//                 logger.info(`Loaded last update_id: ${this.lastUpdateId}`);
//             }
//         } catch (error) {
//             logger.info('No saved update_id, starting from 0');
//         }

//         // Запускаем polling каждые 2 секунды
//         this.pollInterval = setInterval(async () => {
//             await this.pollUpdates();
//         }, 2000);

//         logger.info('Telegram polling service started');
//     }

//     stopPolling(): void {
//         if (this.pollInterval) {
//             clearInterval(this.pollInterval);
//             this.pollInterval = null;
//         }
//         this.isPolling = false;
//         logger.info('Telegram polling service stopped');
//     }

//     private async pollUpdates(): Promise<void> {
//         try {
//             const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?timeout=30&offset=${this.lastUpdateId + 1}`;
//             const response = await fetch(url);
//             const data = await response.json() as { ok: boolean; result: TelegramUpdate[] };

//             if (!data.ok) {
//                 logger.error('Telegram API error:', data);
//                 return;
//             }

//             const updates: TelegramUpdate[] = data.result;
            
//             for (const update of updates) {
//                 await this.handleUpdate(update);
//                 this.lastUpdateId = update.update_id;
//                 await this.saveLastUpdateId();
//             }
//         } catch (error) {
//             logger.error('Polling error:', error);
//         }
//     }

//     private async saveLastUpdateId(): Promise<void> {
//         try {
//             const dataDir = path.join(process.cwd(), 'data');
//             const lastUpdateFile = path.join(dataDir, 'last-telegram-update.json');
            
//             if (!fs.existsSync(dataDir)) {
//                 fs.mkdirSync(dataDir, { recursive: true });
//             }
            
//             fs.writeFileSync(lastUpdateFile, JSON.stringify({
//                 lastUpdateId: this.lastUpdateId,
//                 timestamp: Date.now()
//             }));
//         } catch (error) {
//             logger.error('Error saving last update_id:', error);
//         }
//     }

//     private async handleUpdate(update: TelegramUpdate): Promise<void> {
//         // Обработка callback query (нажатие на кнопки)
//         if (update.callback_query) {
//             await this.handleCallbackQuery(update.callback_query);
//             return;
//         }

//         // Обработка текстовых сообщений
//         if (update.message?.text) {
//             await this.handleMessage(update.message);
//         }
//     }

//     // ОТВЕТ НА CALLBACK (чтобы Telegram не повторял запрос)
//     private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
//         const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
//         try {
//             await fetch(url, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     callback_query_id: callbackQueryId,
//                 })
//             });
//         } catch (error) {
//             logger.error('Error answering callback query:', error);
//         }
//     }

//     // РЕДАКТИРОВАНИЕ СУЩЕСТВУЮЩЕГО СООБЩЕНИЯ (вместо отправки нового)
//     private async editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: TelegramKeyboard): Promise<boolean> {
//         const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
//         const body: {
//             chat_id: number;
//             message_id: number;
//             text: string;
//             parse_mode: string;
//             reply_markup?: TelegramKeyboard;
//         } = {
//             chat_id: chatId,
//             message_id: messageId,
//             text: text,
//             parse_mode: 'Markdown',
//         };
        
//         if (replyMarkup) {
//             body.reply_markup = replyMarkup;
//         }

//         try {
//             const response = await fetch(url, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(body)
//             });
//             return response.ok;
//         } catch (error) {
//             logger.error('Error editing message:', error);
//             return false;
//         }
//     }

//     // ОБРАБОТКА НАЖАТИЯ НА КНОПКУ
//     private async handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
//         const chatId = callbackQuery.message.chat.id;
//         const messageId = callbackQuery.message.message_id;
//         const data = callbackQuery.data;
//         const callbackId = callbackQuery.id;
        
//         logger.info(`Callback query from ${chatId}: ${data}`);
        
//         // ВАЖНО: Сразу отвечаем на callback, чтобы Telegram не повторял его
//         await this.answerCallbackQuery(callbackId);
        
//         const today = new Date();
//         const todayStr = today.toISOString().split('T')[0];
//         const tomorrow = new Date();
//         tomorrow.setDate(tomorrow.getDate() + 1);
//         const tomorrowStr = tomorrow.toISOString().split('T')[0];

//         let message = '';
        
//         switch (data) {
//             case 'plan_today':
//                 message = await this.getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
//                 break;
//             case 'plan_tomorrow':
//                 message = await this.getPlan(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
//                 break;
//             default:
//                 return;
//         }

//         // Редактируем существующее сообщение вместо отправки нового
//         await this.editMessageText(chatId, messageId, message, this.getMainKeyboard());
//     }

//     private async handleMessage(message: TelegramMessage): Promise<void> {
//         const chatId = message.chat.id;
//         const text = message.text || '';
        
//         logger.info(`Message from ${chatId}: ${text}`);



// //         if (text === '/start') {
// //             const welcomeMessage = `🤖 *Добро пожаловать в бот АБЗ!*

// // Я помогаю отслеживать отгрузки асфальта.

// // 📊 *Доступные команды:*
// // • Нажмите кнопку "Сегодня" - план на текущий день
// // • Нажмите кнопку "Завтра" - план на следующий день
// // • /help - показать это сообщение

// // 📅 *Данные обновляются:* автоматически каждые 10 мин

// // 🏭 *Доступные заводы:*
// // • Люберецкий АБЗ
// // • Луховицкий АБЗ`;

// //             await this.sendMessage(chatId, welcomeMessage, this.getMainKeyboard());
// //         } 


// if (text === '/start') {
//     const welcomeMessage = `🤖 *Добро пожаловать в бот АБЗ!*

// Я помогаю отслеживать отгрузки асфальта.

// 📊 *Доступные команды:*
// • Нажмите кнопку "Сегодня" - план на текущий день
// • Нажмите кнопку "Завтра" - план на следующий день
// • /help - показать это сообщение

// 📅 *Данные обновляются:* автоматически каждые 10 мин

// 🏭 *Доступные заводы:*
// • Люберецкий АБЗ
// • Луховицкий АБЗ

// ---
// 💡 *Быстрый доступ:* /today - план на сегодня, /tomorrow - план на завтра`;

//     await this.sendMessage(chatId, welcomeMessage, this.getMainKeyboard());
// }



//         else if (text === '/help') {
//             const helpMessage = `🔍 *Справка по командам*

// /start - начать работу с ботом
// /help - показать эту справку
// /today - план отгрузок на сегодня
// /tomorrow - план отгрузок на завтра

// *Или используйте кнопки ниже* 👇`;
            
//             await this.sendMessage(chatId, helpMessage, this.getMainKeyboard());
//         }
//         else if (text === '/today') {
//             const todayStr = new Date().toISOString().split('T')[0];
//             const message = await this.getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
//             await this.sendMessage(chatId, message, this.getMainKeyboard());
//         }
//         else if (text === '/tomorrow') {
//             const tomorrow = new Date();
//             tomorrow.setDate(tomorrow.getDate() + 1);
//             const tomorrowStr = tomorrow.toISOString().split('T')[0];
//             const message = await this.getPlan(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
//             await this.sendMessage(chatId, message, this.getMainKeyboard());
//         }
//         else {
//             await this.sendMessage(chatId, 'Используйте кнопки или команды:\n/today - сегодня\n/tomorrow - завтра\n/help - помощь');
//         }
//     }

//     private async getPlan(dateStr: string | null, title: string): Promise<string> {
//         const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
        
//         const filtered = allRequests.filter(req => {
//             const isNotClosed = !req.closed;
//             if (dateStr) {
//                 const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
//                 return isNotClosed && deliveryDate === dateStr;
//             }
//             return isNotClosed;
//         });

//         return this.formatPlanMessage(filtered, title);
//     }

    
    
    
    
//     // private formatPlanMessage(requests: OutgoingRequest[], title: string): string {
//     //     let message = `📋 *${title}*\n\n`;
        
//     //     if (requests.length === 0) {
//     //         message += '✅ Нет запланированных отгрузок.';
//     //         return message;
//     //     }
        
//     //     const byDivision = new Map<string, Map<string, GroupData>>();
        
//     //     for (const req of requests) {
//     //         const division = req.division || 'Другие';
//     //         if (!byDivision.has(division)) {
//     //             byDivision.set(division, new Map());
//     //         }
//     //         const byConsignee = byDivision.get(division)!;
//     //         const consignee = req.consignee || req.customer || 'Неизвестно';
//     //         if (!byConsignee.has(consignee)) {
//     //             byConsignee.set(consignee, { total: 0, items: [] });
//     //         }
//     //         const group = byConsignee.get(consignee)!;
//     //         group.total += req.quantity;
//     //         group.items.push({ material: req.material, quantity: req.quantity });
//     //     }
        
//     //     for (const [division, byConsignee] of byDivision) {
//     //         let divisionTotal = 0;
//     //         for (const [, data] of byConsignee) {
//     //             divisionTotal += data.total;
//     //         }
//     //         const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
//     //         message += `*${divisionName}* 🟢${divisionTotal} т\n`;
            
//     //         for (const [consignee, data] of byConsignee) {
//     //             message += `▫️ ${consignee} — ${data.total} т\n`;
//     //             if (data.items.length === 1 && data.items[0].material) {
//     //                 message += `   • ${data.items[0].material}\n`;
//     //             } else if (data.items.length > 1) {
//     //                 const materials = new Map<string, number>();
//     //                 for (const item of data.items) {
//     //                     materials.set(item.material, (materials.get(item.material) || 0) + item.quantity);
//     //                 }
//     //                 for (const [material, qty] of materials) {
//     //                     message += `   • ${material} — ${qty} т\n`;
//     //                 }
//     //             }
//     //         }
//     //         message += `\n`;
//     //     }
        
//     //     message += `📌 Всего заявок: ${requests.length}\n`;
//     //     message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
//     //     return message;
//     // }

// // private formatPlanMessage(requests: OutgoingRequest[], title: string): string {
// //     let message = `📋 *${title}*\n\n`;
    
// //     if (requests.length === 0) {
// //         message += '✅ Нет запланированных отгрузок.';
// //     } else {
// //         const byDivision = new Map<string, Map<string, GroupData>>();
        
// //         // for (const req of requests) {
// //         //     const division = req.division || 'Другие';
// //         //     if (!byDivision.has(division)) {
// //         //         byDivision.set(division, new Map());
// //         //     }
// //         //     const byConsignee = byDivision.get(division)!;
// //         //     const consignee = req.consignee || req.customer || 'Неизвестно';
// //         //     if (!byConsignee.has(consignee)) {
// //         //         byConsignee.set(consignee, { total: 0, items: [] });
// //         //     }
// //         //     const group = byConsignee.get(consignee)!;
// //         //     group.total += req.quantity;
// //         //     group.items.push({ material: req.material, quantity: req.quantity });
// //         // }
        

// //         for (const req of requests) {
// //     const division = req.division || 'Другие';
// //     if (!byDivision.has(division)) {
// //         byDivision.set(division, new Map());
// //     }
// //     const byConsignee = byDivision.get(division)!;
// //     const consignee = req.consignee || req.customer || 'Неизвестно';
// //     // Добавляем завод в ключ группировки
// //     const key = `${division}_${consignee}`;  // <-- вот это изменение
// //     if (!byConsignee.has(key)) {
// //         byConsignee.set(key, { total: 0, items: [] });
// //     }
// //     const group = byConsignee.get(key)!;
// //     group.total += req.quantity;
// //     group.items.push({ material: req.material, quantity: req.quantity });
// // }


// //         for (const [division, byConsignee] of byDivision) {
// //             let divisionTotal = 0;
// //             for (const [, data] of byConsignee) {
// //                 divisionTotal += data.total;
// //             }
// //             const divisionName = division === 'Люберцы' ? '🏭 Люберецкий' : '🏭 Луховицкий';
// //             message += `*${divisionName}* 🟢${divisionTotal} т\n`;
            
// //             for (const [consignee, data] of byConsignee) {
// //                 message += `▫️ ${consignee} — ${data.total} т\n`;
// //                 if (data.items.length === 1 && data.items[0].material) {
// //                     message += `   • ${data.items[0].material}\n`;
// //                 } else if (data.items.length > 1) {
// //                     const materials = new Map<string, number>();
// //                     for (const item of data.items) {
// //                         materials.set(item.material, (materials.get(item.material) || 0) + item.quantity);
// //                     }
// //                     for (const [material, qty] of materials) {
// //                         message += `   • ${material} — ${qty} т\n`;
// //                     }
// //                 }
// //             }
// //             message += `\n`;
// //         }
        
// //         message += `📌 Всего заявок: ${requests.length}\n`;
// //         message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
// //     }
    
// //     // Добавляем подсказку в конце
// //     message += `\n\n---\n💡 *Быстрый доступ:* /today - план на сегодня, /tomorrow - план на завтра`;
    
// //     return message;
// // }


// private formatPlanMessage(requests: OutgoingRequest[], title: string): string {
//     let message = `📋 *${title}*\n\n`;
    
//     if (requests.length === 0) {
//         message += '✅ Нет запланированных отгрузок.';
//     } else {
//         const byDivision = new Map<string, Map<string, { total: number; items: { material: string; quantity: number }[] }>>();
        
//         for (const req of requests) {
//             const division = req.division || 'Другие';
//             if (!byDivision.has(division)) {
//                 byDivision.set(division, new Map());
//             }
//             const byConsignee = byDivision.get(division)!;
//             const consignee = req.consignee || req.customer || 'Неизвестно';
            
//             // КЛЮЧ: объединяем division + consignee
//             const key = `${division}_${consignee}`;
//             if (!byConsignee.has(key)) {
//                 byConsignee.set(key, { total: 0, items: [] });
//             }
//             const group = byConsignee.get(key)!;
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
            
//             for (const [key, data] of byConsignee) {
//                 // Разбираем ключ на division и consignee
//                 const [divCode, consignee] = key.split('_');
//                 const divisionIcon = divCode === 'Люберцы' ? '🏭 ЛЮ' : '🏭 ЛХ';
//                 message += `▫️ ${divisionIcon} ${consignee} — ${data.total} т\n`;
                
//                 if (data.items.length === 1 && data.items[0].material) {
//                     message += `   • ${data.items[0].material}\n`;
//                 } else if (data.items.length > 1) {
//                     const materials = new Map<string, number>();
//                     for (const item of data.items) {
//                         materials.set(item.material, (materials.get(item.material) || 0) + item.quantity);
//                     }
//                     for (const [material, qty] of materials) {
//                         message += `   • ${material} — ${qty} т\n`;
//                     }
//                 }
//             }
//             message += `\n`;
//         }
        
//         message += `📌 Всего заявок: ${requests.length}\n`;
        
//         // Московское время
//         const mskTime = new Date().toLocaleTimeString('ru-RU', { 
//             timeZone: 'Europe/Moscow',
//             hour: '2-digit',
//             minute: '2-digit',
//             second: '2-digit'
//         });
//         message += `🕐 ${mskTime}`;
//     }
    
//     message += `\n\n---\n💡 *Быстрый доступ:* /today - план на сегодня, /tomorrow - план на завтра`;
    
//     return message;
// }




//     private getMainKeyboard(): TelegramKeyboard {
//         return {
//             inline_keyboard: [
//                 [
//                     { text: "📅 Сегодня", callback_data: "plan_today" },
//                     { text: "📋 Завтра", callback_data: "plan_tomorrow" }
//                 ]
//             ]
//         };
//     }

//     private async sendMessage(chatId: number, text: string, replyMarkup?: TelegramKeyboard): Promise<boolean> {
//         const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
//         const body: {
//             chat_id: number;
//             text: string;
//             parse_mode: string;
//             reply_markup?: TelegramKeyboard;
//         } = {
//             chat_id: chatId,
//             text: text,
//             parse_mode: 'Markdown',
//         };
        
//         if (replyMarkup) {
//             body.reply_markup = replyMarkup;
//         }

//         try {
//             const response = await fetch(url, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(body)
//             });
//             const data = await response.json() as { ok: boolean };
            
//             if (!response.ok) {
//                 logger.error('Telegram send error:', data);
//                 return false;
//             }
//             return true;
//         } catch (error) {
//             logger.error('Error sending message:', error);
//             return false;
//         }
//     }
// }

// // Создаём singleton экземпляр
// export const telegramPolling = new TelegramPollingService();





// // lib/telegram-polling.ts
// import { db } from '@/lib/db';
// import { outgoingRequests, OutgoingRequest } from '@/lib/db/schema';
// // import { logger } from '@/lib/logger';
// import fs from 'fs';
// import path from 'path';
// import { logger } from './db/logger';

// const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// interface TelegramUser {
//     id: number;
//     first_name: string;
// }

// interface TelegramChat {
//     id: number;
//     type: string;
// }

// interface TelegramMessage {
//     message_id: number;
//     from: TelegramUser;
//     chat: TelegramChat;
//     text?: string;
//     date: number;
// }

// interface TelegramCallbackQuery {
//     id: string;
//     from: TelegramUser;
//     message: {
//         message_id: number;
//         chat: TelegramChat;
//         text?: string;
//     };
//     data: string;
// }

// interface TelegramUpdate {
//     update_id: number;
//     message?: TelegramMessage;
//     callback_query?: TelegramCallbackQuery;
// }

// interface TelegramKeyboard {
//     inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
// }

// interface GroupData {
//     total: number;
//     items: Array<{ material: string; quantity: number }>;
// }

// class TelegramPollingService {
//     private lastUpdateId: number = 0;
//     private isPolling: boolean = false;
//     private pollInterval: NodeJS.Timeout | null = null;

//     async startPolling(): Promise<void> {
//         if (this.isPolling) {
//             logger.warn('Polling already started');
//             return;
//         }

//         this.isPolling = true;
//         logger.info('Starting Telegram polling service...');
        
//         // Загружаем последний update_id
//         try {
//             const lastUpdateFile = path.join(process.cwd(), 'data', 'last-telegram-update.json');
//             if (fs.existsSync(lastUpdateFile)) {
//                 const data = JSON.parse(fs.readFileSync(lastUpdateFile, 'utf-8'));
//                 this.lastUpdateId = data.lastUpdateId || 0;
//                 logger.info(`Loaded last update_id: ${this.lastUpdateId}`);
//             }
//         } catch (error) {
//             logger.info('No saved update_id, starting from 0');
//         }

//         // Запускаем polling каждые 2 секунды
//         this.pollInterval = setInterval(async () => {
//             await this.pollUpdates();
//         }, 2000);

//         logger.info('Telegram polling service started');
//     }

//     stopPolling(): void {
//         if (this.pollInterval) {
//             clearInterval(this.pollInterval);
//             this.pollInterval = null;
//         }
//         this.isPolling = false;
//         logger.info('Telegram polling service stopped');
//     }

//     private async pollUpdates(): Promise<void> {
//         try {
//             const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?timeout=30&offset=${this.lastUpdateId + 1}`;
//             const response = await fetch(url);
//             const data = await response.json() as { ok: boolean; result: TelegramUpdate[] };

//             if (!data.ok) {
//                 logger.error('Telegram API error:', data);
//                 return;
//             }

//             const updates: TelegramUpdate[] = data.result;
            
//             for (const update of updates) {
//                 await this.handleUpdate(update);
//                 this.lastUpdateId = update.update_id;
//                 await this.saveLastUpdateId();
//             }
//         } catch (error) {
//             logger.error('Polling error:', error);
//         }
//     }

//     private async saveLastUpdateId(): Promise<void> {
//         try {
//             const dataDir = path.join(process.cwd(), 'data');
//             const lastUpdateFile = path.join(dataDir, 'last-telegram-update.json');
            
//             if (!fs.existsSync(dataDir)) {
//                 fs.mkdirSync(dataDir, { recursive: true });
//             }
            
//             fs.writeFileSync(lastUpdateFile, JSON.stringify({
//                 lastUpdateId: this.lastUpdateId,
//                 timestamp: Date.now()
//             }));
//         } catch (error) {
//             logger.error('Error saving last update_id:', error);
//         }
//     }

//     private async handleUpdate(update: TelegramUpdate): Promise<void> {
//         // Обработка callback query (нажатие на кнопки)
//         if (update.callback_query) {
//             await this.handleCallbackQuery(update.callback_query);
//             return;
//         }

//         // Обработка текстовых сообщений
//         if (update.message?.text) {
//             await this.handleMessage(update.message);
//         }
//     }

//     private async handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
//         const chatId = callbackQuery.message.chat.id;
//         const data = callbackQuery.data;
        
//         logger.info(`Callback query from ${chatId}: ${data}`);

//         const today = new Date();
//         const todayStr = today.toISOString().split('T')[0];
//         const tomorrow = new Date();
//         tomorrow.setDate(tomorrow.getDate() + 1);
//         const tomorrowStr = tomorrow.toISOString().split('T')[0];

//         let message = '';
        
//         switch (data) {
//             case 'plan_today':
//                 message = await this.getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
//                 break;
//             case 'plan_tomorrow':
//                 message = await this.getPlan(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
//                 break;
//             default:
//                 return;
//         }

//         await this.sendMessage(chatId, message, this.getMainKeyboard());
//     }

//     private async handleMessage(message: TelegramMessage): Promise<void> {
//         const chatId = message.chat.id;
//         const text = message.text || '';
        
//         logger.info(`Message from ${chatId}: ${text}`);

//         if (text === '/start') {
//             const welcomeMessage = `🤖 *Добро пожаловать в бот АБЗ!*

// Я помогаю отслеживать отгрузки асфальта.

// 📊 *Доступные команды:*
// • Нажмите кнопку "Сегодня" - план на текущий день
// • Нажмите кнопку "Завтра" - план на следующий день
// • /help - показать это сообщение

// 📅 *Данные обновляются:* автоматически каждый час

// 🏭 *Доступные заводы:*
// • Люберецкий АБЗ
// • Луховицкий АБЗ`;

//             await this.sendMessage(chatId, welcomeMessage, this.getMainKeyboard());
//         } 
//         else if (text === '/help') {
//             const helpMessage = `🔍 *Справка по командам*

// /start - начать работу с ботом
// /help - показать эту справку
// /today - план отгрузок на сегодня
// /tomorrow - план отгрузок на завтра

// *Или используйте кнопки ниже* 👇`;
            
//             await this.sendMessage(chatId, helpMessage, this.getMainKeyboard());
//         }
//         else if (text === '/today') {
//             const todayStr = new Date().toISOString().split('T')[0];
//             const message = await this.getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
//             await this.sendMessage(chatId, message, this.getMainKeyboard());
//         }
//         else if (text === '/tomorrow') {
//             const tomorrow = new Date();
//             tomorrow.setDate(tomorrow.getDate() + 1);
//             const tomorrowStr = tomorrow.toISOString().split('T')[0];
//             const message = await this.getPlan(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
//             await this.sendMessage(chatId, message, this.getMainKeyboard());
//         }
//         else {
//             await this.sendMessage(chatId, 'Используйте кнопки или команды:\n/today - сегодня\n/tomorrow - завтра\n/help - помощь');
//         }
//     }

//     private async getPlan(dateStr: string | null, title: string): Promise<string> {
//         const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
        
//         const filtered = allRequests.filter(req => {
//             const isNotClosed = !req.closed;
//             if (dateStr) {
//                 const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
//                 return isNotClosed && deliveryDate === dateStr;
//             }
//             return isNotClosed;
//         });

//         return this.formatPlanMessage(filtered, title);
//     }

//     private formatPlanMessage(requests: OutgoingRequest[], title: string): string {
//         let message = `📋 *${title}*\n\n`;
        
//         if (requests.length === 0) {
//             message += '✅ Нет запланированных отгрузок.';
//             return message;
//         }
        
//         const byDivision = new Map<string, Map<string, GroupData>>();
        
//         for (const req of requests) {
//             const division = req.division || 'Другие';
//             if (!byDivision.has(division)) {
//                 byDivision.set(division, new Map());
//             }
//             const byConsignee = byDivision.get(division)!;
//             const consignee = req.consignee || req.customer || 'Неизвестно';
//             if (!byConsignee.has(consignee)) {
//                 byConsignee.set(consignee, { total: 0, items: [] });
//             }
//             const group = byConsignee.get(consignee)!;
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
//                 } else if (data.items.length > 1) {
//                     const materials = new Map<string, number>();
//                     for (const item of data.items) {
//                         materials.set(item.material, (materials.get(item.material) || 0) + item.quantity);
//                     }
//                     for (const [material, qty] of materials) {
//                         message += `   • ${material} — ${qty} т\n`;
//                     }
//                 }
//             }
//             message += `\n`;
//         }
        
//         message += `📌 Всего заявок: ${requests.length}\n`;
//         message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
//         return message;
//     }

//     private getMainKeyboard(): TelegramKeyboard {
//         return {
//             inline_keyboard: [
//                 [
//                     { text: "📅 Сегодня", callback_data: "plan_today" },
//                     { text: "📋 Завтра", callback_data: "plan_tomorrow" }
//                 ]
//             ]
//         };
//     }

//     private async sendMessage(chatId: number, text: string, replyMarkup?: TelegramKeyboard): Promise<boolean> {
//         const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
//         const body: {
//             chat_id: number;
//             text: string;
//             parse_mode: string;
//             reply_markup?: TelegramKeyboard;
//         } = {
//             chat_id: chatId,
//             text: text,
//             parse_mode: 'Markdown',
//         };
        
//         if (replyMarkup) {
//             body.reply_markup = replyMarkup;
//         }

//         try {
//             const response = await fetch(url, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(body)
//             });
//             const data = await response.json() as { ok: boolean };
            
//             if (!response.ok) {
//                 logger.error('Telegram send error:', data);
//                 return false;
//             }
//             return true;
//         } catch (error) {
//             logger.error('Error sending message:', error);
//             return false;
//         }
//     }
// }

// // Создаём singleton экземпляр
// export const telegramPolling = new TelegramPollingService();