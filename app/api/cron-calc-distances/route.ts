import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🔄 1. API вызван');
  
  try {
    console.log('🔄 2. Начинаем запрос к GPS...');
    
    const AUTH_TOKEN = 'XBNlAqRnZxU3Q%2BSLHe3qKZSIIYiSGWym3mN8%2BbXmbSZE74YqB3bYf4TLIWAzLPyg%2BR9qd2Mf9AxDn2K3f4j5lA%3D%3D';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch('https://xptr.geoinformer.com/service/monitoring', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        idList: ['25611', '22957'], // Только 2 машины для теста
        ud: AUTH_TOKEN
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log('🔄 3. GPS ответ получен, статус:', response.status);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'GPS error', status: response.status });
    }
    
    const data = await response.json();
    console.log('🔄 4. Данные GPS получены, positions:', Object.keys(data.positions || {}).length);
    
    return NextResponse.json({
      success: true,
      positions: Object.keys(data.positions || {}).length,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
