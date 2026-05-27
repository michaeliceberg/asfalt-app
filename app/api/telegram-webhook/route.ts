// app/api/telegram-webhook/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Перенаправляем на наш основной обработчик
        const response = await fetch('https://abziceberg.ru/api/send-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({ ok: true });
    }
}

export async function GET() {
    // Установка webhook
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = 'https://abziceberg.ru/api/telegram-webhook';
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    const data = await response.json();
    
    return NextResponse.json(data);
}