import { NextResponse } from 'next/server';
import { sendToAdmins } from '@/lib/push-notifications';

export async function GET() {
  console.log('🔵 Test push API started');
  
  try {
    const result = await sendToAdmins({
      title: '🧪 Тестовое уведомление',
      body: 'Если вы это видите — всё работает! 🎉',
      tag: 'test-' + Date.now(),
      url: '/',
    });
    
    console.log('✅ Result:', result);
    
    return NextResponse.json({ 
      success: true, 
      sent: result.sent,
    });
    
  } catch (error) {
    console.error('❌ Test push error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
