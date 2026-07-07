// app/api/check-sync/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LAST_SYNC_FILE_REQUESTS = path.join(process.cwd(), 'data', 'last-sync-requests.json');
const LAST_SYNC_FILE_SHIPMENTS = path.join(process.cwd(), 'data', 'last-sync-shipments.json');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean);

const SYNC_TIMEOUT_MINUTES = 22;

async function sendTelegramAlert(message: string): Promise<void> {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_CHAT_IDS.length === 0) return;
    
    for (const chatId of TELEGRAM_CHAT_IDS) {
        try {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId.trim(),
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
        } catch (error) {
            console.error('Ошибка отправки алерта:', error);
        }
    }
}

function getLastSyncTime(filePath: string): Date | null {
    try {
        if (!fs.existsSync(filePath)) return null;
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return data.lastSync ? new Date(data.lastSync) : null;
    } catch (error) {
        return null;
    }
}

export async function GET() {
    const results = [];
    const alerts = [];

    // Проверяем заявки
    const lastRequestsSync = getLastSyncTime(LAST_SYNC_FILE_REQUESTS);
    const lastShipmentsSync = getLastSyncTime(LAST_SYNC_FILE_SHIPMENTS);

    const now = new Date();
    
    if (lastRequestsSync) {
        const minutesSince = (now.getTime() - lastRequestsSync.getTime()) / 1000 / 60;
        if (minutesSince > SYNC_TIMEOUT_MINUTES) {
            alerts.push(`⚠️ *Заявки (OutgoingRequests)* не синхронизируются ${Math.round(minutesSince)} минут. Последняя синхронизация: ${lastRequestsSync.toLocaleString('ru-RU')}`);
        }
        results.push({ type: 'requests', lastSync: lastRequestsSync, minutesSince: Math.round(minutesSince), ok: minutesSince <= SYNC_TIMEOUT_MINUTES });
    } else {
        alerts.push(`⚠️ *Заявки (OutgoingRequests)* — нет данных о синхронизации`);
    }

    if (lastShipmentsSync) {
        const minutesSince = (now.getTime() - lastShipmentsSync.getTime()) / 1000 / 60;
        if (minutesSince > SYNC_TIMEOUT_MINUTES) {
            alerts.push(`⚠️ *Отгрузки (Shipments)* не синхронизируются ${Math.round(minutesSince)} минут. Последняя синхронизация: ${lastShipmentsSync.toLocaleString('ru-RU')}`);
        }
        results.push({ type: 'shipments', lastSync: lastShipmentsSync, minutesSince: Math.round(minutesSince), ok: minutesSince <= SYNC_TIMEOUT_MINUTES });
    } else {
        alerts.push(`⚠️ *Отгрузки (Shipments)* — нет данных о синхронизации`);
    }

    // Отправляем алерты в Telegram
    if (alerts.length > 0) {
        const alertMessage = `🚨 *КРИТИЧЕСКОЕ ОПОВЕЩЕНИЕ!*\n\nСинхронизация с 1С не обновляется более ${SYNC_TIMEOUT_MINUTES} минут!\n\n` + alerts.join('\n\n');
        await sendTelegramAlert(alertMessage);
    }

    return NextResponse.json({
        status: alerts.length === 0 ? 'ok' : 'alert',
        checks: results,
        alerts: alerts
    });
}