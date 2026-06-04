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
        if (update.callback_query) {
            await this.handleCallbackQuery(update.callback_query);
            return;
        }
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
                body: JSON.stringify({ callback_query_id: callbackQueryId })
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
    if (replyMarkup) body.reply_markup = replyMarkup;
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return response.ok;
    } catch (error) {
        logger.error('Error editing message:', error);
        return false;
    }
}

private getProgressEmoji(percent: number): string {
    if (percent === 0) return '⚪️';      // 0% — белый
    if (percent >= 94) return '⚫️';      // >=94% — чёрный
    return '🟢';                           // <94% — зелёный
}





// Получение плана с фактом - связываем по заводу + грузополучателю + материалу
private async getPlanWithFact(dateStr: string, title: string): Promise<string> {
    // Получаем заявки (план) - БЕЗ фильтра по closed
    const allRequests: OutgoingRequest[] = await db.select().from(outgoingRequests);
    const planRequests = allRequests.filter(req => {
        const deliveryDate = req.delivery_date ? req.delivery_date.split('T')[0] : null;
        return deliveryDate === dateStr;
    });
    
    // Получаем фактические отгрузки
    const allShipments: Shipment[] = await db.select().from(shipments);
    const todayShipments = allShipments.filter(s => {
        const shipmentDate = s.date ? s.date.split('T')[0] : null;
        return shipmentDate === dateStr;
    });
    
    // Группируем ПЛАН по: заводу + грузополучателю + материалу
    const planMap = new Map<string, { total: number; materials: Map<string, number> }>();
    for (const req of planRequests) {
        const division = req.division || 'Другие';
        const consignee = req.consignee || req.customer || 'Неизвестно';
        const material = req.material || '';
        const key = `${division}_${consignee}`;
        
        if (!planMap.has(key)) {
            planMap.set(key, { total: 0, materials: new Map() });
        }
        const entry = planMap.get(key)!;
        entry.total += req.quantity;
        entry.materials.set(material, (entry.materials.get(material) || 0) + req.quantity);
    }
    
    // Группируем ФАКТ по: заводу + грузополучателю + материалу
    const factMap = new Map<string, Map<string, number>>();
    for (const shipment of todayShipments) {
        const division = shipment.division || 'Другие';
        const consignee = shipment.consignee || shipment.customer || 'Неизвестно';
        const material = shipment.material || '';
        const key = `${division}_${consignee}`;
        
        if (!factMap.has(key)) {
            factMap.set(key, new Map());
        }
        const materialMap = factMap.get(key)!;
        materialMap.set(material, (materialMap.get(material) || 0) + shipment.quantity);
    }
    
    // Объединяем все уникальные ключи
    const allKeys = new Set([...planMap.keys(), ...factMap.keys()]);
    
    // Группируем по заводам для вывода
    const byDivision = new Map<string, Array<{ 
        consignee: string; 
        materials: Map<string, { plan: number; fact: number }> 
    }>>();
    
    for (const key of allKeys) {
        const [division, consignee] = key.split('_');
        const planData = planMap.get(key);
        const factData = factMap.get(key);
        
        // Собираем все материалы
        const allMaterials = new Set([
            ...(planData?.materials.keys() || []),
            ...(factData?.keys() || [])
        ]);
        
        const materialsMap = new Map<string, { plan: number; fact: number }>();
        for (const material of allMaterials) {
            materialsMap.set(material, {
                plan: planData?.materials.get(material) || 0,
                fact: factData?.get(material) || 0
            });
        }
        
        if (!byDivision.has(division)) {
            byDivision.set(division, []);
        }
        byDivision.get(division)!.push({ consignee, materials: materialsMap });
    }
    
    // Форматируем сообщение
    let message = `📋 *${title}*\n\n`;
    
    // Сортируем заводы
    const sortedDivisions = Array.from(byDivision.keys()).sort();
    
    for (const division of sortedDivisions) {
        const items = byDivision.get(division)!;
        
        // Считаем итоги по заводу
        let divisionPlanTotal = 0;
        let divisionFactTotal = 0;
        for (const item of items) {
            for (const { plan, fact } of item.materials.values()) {
                divisionPlanTotal += plan;
                divisionFactTotal += fact;
            }
        }
        
        const divisionPercent = divisionPlanTotal > 0 ? (divisionFactTotal / divisionPlanTotal) * 100 : 0;
        const divisionEmoji = this.getProgressEmoji(divisionPercent);
        const divisionName = division === 'Люберцы' ? 'ЛЮБЕРЕЦКИЙ' : 'ЛУХОВИЦКИЙ';
        
        message += `🏭 ${divisionName} ${divisionEmoji} ${divisionFactTotal.toFixed(1)}/${divisionPlanTotal.toFixed(0)} т\n`;
        
        // Сортируем грузополучателей по проценту выполнения
        items.sort((a, b) => {
            const aPlan = Array.from(a.materials.values()).reduce((sum, { plan }) => sum + plan, 0);
            const aFact = Array.from(a.materials.values()).reduce((sum, { fact }) => sum + fact, 0);
            const bPlan = Array.from(b.materials.values()).reduce((sum, { plan }) => sum + plan, 0);
            const bFact = Array.from(b.materials.values()).reduce((sum, { fact }) => sum + fact, 0);
            const aPercent = aPlan > 0 ? (aFact / aPlan) * 100 : 0;
            const bPercent = bPlan > 0 ? (bFact / bPlan) * 100 : 0;
            return bPercent - aPercent;
        });
        
        for (const item of items) {
            // Считаем итоги по грузополучателю
            let consigneePlanTotal = 0;
            let consigneeFactTotal = 0;
            for (const { plan, fact } of item.materials.values()) {
                consigneePlanTotal += plan;
                consigneeFactTotal += fact;
            }
            
            if (consigneePlanTotal > 0) {
                const percent = (consigneeFactTotal / consigneePlanTotal) * 100;
                const emoji = this.getProgressEmoji(percent);
                message += `   ${emoji} *${item.consignee}* ${consigneeFactTotal.toFixed(1)}/${consigneePlanTotal.toFixed(0)} т\n`;
            } else {
                // Без плана — всегда зелёный
                message += `   🟢 *${item.consignee}* ${consigneeFactTotal.toFixed(1)} т (без плана)\n`;
            }
            
            // Показываем первый материал
            const firstMaterial = Array.from(item.materials.keys())[0];
            if (firstMaterial) {
                const material = firstMaterial.length > 35 ? firstMaterial.substring(0, 32) + '...' : firstMaterial;
                message += `      ${material}\n`;
            }
        }
        message += `\n`;
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
        
        await this.answerCallbackQuery(callbackId);
        

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
• ЛЮБЕРЕЦКИЙ АБЗ
• ЛУХОВИЦКИЙ АБЗ

---
*Обозначения:*
⚪️ — ещё не начали
🟢 — в процессе
⚫️ — выполнено/перевыполнено`;

    await this.sendMessage(chatId, welcomeMessage, this.getMainKeyboard());
}




        else if (text === '/help') {
            const helpMessage = `🔍 *Справка по командам*

/start - начать работу с ботом
/help - показать эту справку
/today - план и факт на сегодня
/tomorrow - план и факт на завтра

*Обозначения:*
⚪️ — ещё не начали
🟢 — в процессе
⚫️ — выполнено/перевыполнено

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

export const telegramPolling = new TelegramPollingService();


