// app/api/incoming/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { incomingMaterials } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const data = await db
      .select()
      .from(incomingMaterials)
      .orderBy(desc(incomingMaterials.date));
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to load data' },
      { status: 500 }
    );
  }
}



// // app/api/incoming/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { incomingMaterials } from '@/lib/db/schema';
// import { desc } from 'drizzle-orm';

// export async function GET() {
//   try {
//     // Берём данные из БД, сортируем по дате (новые сверху)
//     const data = await db
//       .select()
//       .from(incomingMaterials)
//       .orderBy(desc(incomingMaterials.date));
    
//     return NextResponse.json(data);
//   } catch (error) {
//     console.error('Database error:', error);
//     return NextResponse.json(
//       { error: 'Failed to load data' },
//       { status: 500 }
//     );
//   }
// }




// // app/api/incoming/route.ts
// import { NextResponse } from 'next/server';

// // Тип для данных из 1С
// interface IncomingItem {
//   Номер: string;
//   Дата: string;
//   Поставщик: string;
//   Номенклатура: string;
//   Брутто: number;
//   Tapa: number;
//   Количество: number;
//   Водитель: string;
//   ГосНомер: string;
// }

// export async function GET(): Promise<NextResponse> {
//   const UNF_BASE_URL = process.env.UNF_BASE_URL;
//   const LOGIN = process.env.UNF_LOGIN;
//   const PASSWORD = process.env.UNF_PASSWORD;
  
//   // Проверяем наличие переменных окружения
//   if (!UNF_BASE_URL || !LOGIN || !PASSWORD) {
//     console.error('Отсутствуют переменные окружения');
//     return NextResponse.json(
//       { error: 'Ошибка конфигурации сервера' },
//       { status: 500 }
//     );
//   }
  
//   const url = `${UNF_BASE_URL}/hs/WebData-API/incoming`;
  
//   try {
//     const response = await fetch(url, {
//       headers: {
//         'Authorization': 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
//         'Content-Type': 'application/json',
//       },
//     });
    
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
    
//     const data: IncomingItem[] = await response.json();
//     return NextResponse.json(data);
//   } catch (error) {
//     console.error('Ошибка при запросе к 1С:', error);
//     return NextResponse.json(
//       { error: 'Не удалось загрузить данные' },
//       { status: 500 }
//     );
//   }
// }