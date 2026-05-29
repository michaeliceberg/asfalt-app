// app/api/telegram-setup/route.ts
import { NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://abziceberg.ru/api/telegram-webhook';

export async function GET() {
    try {
        // Устанавливаем вебхук
        const setWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}`;
        const response = await fetch(setWebhookUrl);
        const data = await response.json();
        
        // Получаем информацию о вебхуке
        const getWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
        const infoResponse = await fetch(getWebhookUrl);
        const infoData = await infoResponse.json();
        
        return NextResponse.json({
            success: true,
            setWebhook: data,
            webhookInfo: infoData
        });
    } catch (error) {
        console.error('Setup error:', error);
        return NextResponse.json({ error: 'Failed to setup webhook' }, { status: 500 });
    }
}