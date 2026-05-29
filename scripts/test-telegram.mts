// scripts/test-telegram.ts
import { config } from 'dotenv';
import path from 'path';

// Загружаем .env.local
config({ path: path.join(process.cwd(), '.env.local') });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = process.env.TELEGRAM_CHAT_IDS || '';
const CHAT_ID = TELEGRAM_CHAT_IDS.split(',')[0];

interface TelegramResponse {
    ok: boolean;
    result?: {
        username: string;
        first_name: string;
    };
    description?: string;
}

async function testTelegram(): Promise<void> {
    console.log('🧪 Testing Telegram bot...\n');
    
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN not found in .env.local');
        process.exit(1);
    }
    
    console.log('✅ Token found:', TELEGRAM_BOT_TOKEN.substring(0, 15) + '...');
    console.log('✅ Chat ID:', CHAT_ID);
    
    // 1. Проверяем бота
    console.log('\n1. Checking bot...');
    try {
        const meRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
        const meData: TelegramResponse = await meRes.json();
        
        if (meData.ok && meData.result) {
            console.log('✅ Bot found:', meData.result.username);
            console.log('   Name:', meData.result.first_name);
        } else {
            console.error('❌ Bot error:', meData);
            return;
        }
    } catch (error) {
        console.error('❌ Network error:', error instanceof Error ? error.message : 'Unknown error');
        return;
    }
    
    // 2. Удаляем вебхук если есть
    console.log('\n2. Removing webhook...');
    try {
        const delRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`);
        const delData: TelegramResponse = await delRes.json();
        console.log(delData.ok ? '✅ Webhook removed' : '⚠️ No webhook');
    } catch (error) {
        console.error('⚠️ Could not check webhook:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // 3. Отправляем тестовое сообщение
    console.log('\n3. Sending test message...');
    try {
        const sendRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: '✅ *Тест бота АБЗ*\n\nБот готов к работе!\n\nОтправьте /start чтобы начать.',
                parse_mode: 'Markdown'
            })
        });
        const sendData: TelegramResponse = await sendRes.json();
        
        if (sendData.ok) {
            console.log('✅ Test message sent successfully!');
            console.log('   Check your Telegram now 📱');
        } else {
            console.error('❌ Send error:', sendData);
            if (sendData.description) {
                console.error('   Error description:', sendData.description);
            }
        }
    } catch (error) {
        console.error('❌ Failed to send message:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    console.log('\n✨ Next steps:');
    console.log('1. Start your app: npm run dev');
    console.log('2. Visit: http://localhost:3000/api/telegram-start');
    console.log('3. Send /start to your bot in Telegram');
}

testTelegram().catch(console.error);