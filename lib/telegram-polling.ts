// lib/telegram-polling.ts
import { db } from '@/lib/db';
import { outgoingRequests, OutgoingRequest } from '@/lib/db/schema';
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
    total: number;
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

    // ОТВЕТ НА CALLBACK (чтобы Telegram не повторял запрос)
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

    // РЕДАКТИРОВАНИЕ СУЩЕСТВУЮЩЕГО СООБЩЕНИЯ (вместо отправки нового)
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

    // ОБРАБОТКА НАЖАТИЯ НА КНОПКУ
    private async handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;
        const callbackId = callbackQuery.id;
        
        logger.info(`Callback query from ${chatId}: ${data}`);
        
        // ВАЖНО: Сразу отвечаем на callback, чтобы Telegram не повторял его
        await this.answerCallbackQuery(callbackId);
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        let message = '';
        
        switch (data) {
            case 'plan_today':
                message = await this.getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
                break;
            case 'plan_tomorrow':
                message = await this.getPlan(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
                break;
            default:
                return;
        }

        // Редактируем существующее сообщение вместо отправки нового
        await this.editMessageText(chatId, messageId, message, this.getMainKeyboard());
    }

    private async handleMessage(message: TelegramMessage): Promise<void> {
        const chatId = message.chat.id;
        const text = message.text || '';
        
        logger.info(`Message from ${chatId}: ${text}`);



//         if (text === '/start') {
//             const welcomeMessage = `🤖 *Добро пожаловать в бот АБЗ!*

// Я помогаю отслеживать отгрузки асфальта.

// 📊 *Доступные команды:*
// • Нажмите кнопку "Сегодня" - план на текущий день
// • Нажмите кнопку "Завтра" - план на следующий день
// • /help - показать это сообщение

// 📅 *Данные обновляются:* автоматически каждые 10 мин

// 🏭 *Доступные заводы:*
// • Люберецкий АБЗ
// • Луховицкий АБЗ`;

//             await this.sendMessage(chatId, welcomeMessage, this.getMainKeyboard());
//         } 


if (text === '/start') {
    const welcomeMessage = `🤖 *Добро пожаловать в бот АБЗ!*

Я помогаю отслеживать отгрузки асфальта.

📊 *Доступные команды:*
• Нажмите кнопку "Сегодня" - план на текущий день
• Нажмите кнопку "Завтра" - план на следующий день
• /help - показать это сообщение

📅 *Данные обновляются:* автоматически каждые 10 мин

🏭 *Доступные заводы:*
• Люберецкий АБЗ
• Луховицкий АБЗ

---
💡 *Быстрый доступ:* /today - план на сегодня, /tomorrow - план на завтра`;

    await this.sendMessage(chatId, welcomeMessage, this.getMainKeyboard());
}



        else if (text === '/help') {
            const helpMessage = `🔍 *Справка по командам*

/start - начать работу с ботом
/help - показать эту справку
/today - план отгрузок на сегодня
/tomorrow - план отгрузок на завтра

*Или используйте кнопки ниже* 👇`;
            
            await this.sendMessage(chatId, helpMessage, this.getMainKeyboard());
        }
        else if (text === '/today') {
            const todayStr = new Date().toISOString().split('T')[0];
            const message = await this.getPlan(todayStr, 'ПЛАН ОТГРУЗОК НА СЕГОДНЯ');
            await this.sendMessage(chatId, message, this.getMainKeyboard());
        }
        else if (text === '/tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            const message = await this.getPlan(tomorrowStr, 'ПЛАН ОТГРУЗОК НА ЗАВТРА');
            await this.sendMessage(chatId, message, this.getMainKeyboard());
        }
        else {
            await this.sendMessage(chatId, 'Используйте кнопки или команды:\n/today - сегодня\n/tomorrow - завтра\n/help - помощь');
        }
    }

    private async getPlan(dateStr: string | null, title: string): Promise<string> {
        const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
        
        const filtered = allRequests.filter(req => {
            const isNotClosed = !req.closed;
            if (dateStr) {
                const deliveryDate = req.deliveryDate ? req.deliveryDate.split('T')[0] : null;
                return isNotClosed && deliveryDate === dateStr;
            }
            return isNotClosed;
        });

        return this.formatPlanMessage(filtered, title);
    }

    
    
    
    
    // private formatPlanMessage(requests: OutgoingRequest[], title: string): string {
    //     let message = `📋 *${title}*\n\n`;
        
    //     if (requests.length === 0) {
    //         message += '✅ Нет запланированных отгрузок.';
    //         return message;
    //     }
        
    //     const byDivision = new Map<string, Map<string, GroupData>>();
        
    //     for (const req of requests) {
    //         const division = req.division || 'Другие';
    //         if (!byDivision.has(division)) {
    //             byDivision.set(division, new Map());
    //         }
    //         const byConsignee = byDivision.get(division)!;
    //         const consignee = req.consignee || req.customer || 'Неизвестно';
    //         if (!byConsignee.has(consignee)) {
    //             byConsignee.set(consignee, { total: 0, items: [] });
    //         }
    //         const group = byConsignee.get(consignee)!;
    //         group.total += req.quantity;
    //         group.items.push({ material: req.material, quantity: req.quantity });
    //     }
        
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
    //         message += `\n`;
    //     }
        
    //     message += `📌 Всего заявок: ${requests.length}\n`;
    //     message += `🕐 ${new Date().toLocaleTimeString('ru-RU')}`;
    //     return message;
    // }

private formatPlanMessage(requests: OutgoingRequest[], title: string): string {
    let message = `📋 *${title}*\n\n`;
    
    if (requests.length === 0) {
        message += '✅ Нет запланированных отгрузок.';
    } else {
        const byDivision = new Map<string, Map<string, GroupData>>();
        
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
    }
    
    // Добавляем подсказку в конце
    message += `\n\n---\n💡 *Быстрый доступ:* /today - план на сегодня, /tomorrow - план на завтра`;
    
    return message;
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