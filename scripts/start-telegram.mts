// scripts/start-telegram.js
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function startPolling() {
    console.log('🤖 Starting Telegram polling...');
    
    // Проверяем, не установлен ли вебхук
    const webhookInfo = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const webhookData = await webhookInfo.json();
    
    if (webhookData.ok && webhookData.result?.url) {
        console.log('⚠️ Webhook is set to:', webhookData.result.url);
        console.log('Removing webhook...');
        
        // Удаляем вебхук
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`);
        console.log('✅ Webhook removed');
    }
    
    console.log('✅ Ready to use polling mode');
    console.log('Start your Next.js app and visit: http://localhost:3000/api/telegram-start');
}

startPolling().catch(console.error);