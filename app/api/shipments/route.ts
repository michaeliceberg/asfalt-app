// app/api/shipments/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { shipments } from '@/lib/db/schema';
import { getUserAccessibleFactories } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isDemo = searchParams.get('demo') === 'true';
    
    // Если демо-режим — возвращаем только ДЕМО-данные из основной БД
    if (isDemo) {
      const demoData = await db
        .select()
        .from(shipments)
        .where(eq(shipments.division, 'ДЕМО'));
      
      return NextResponse.json(demoData);
    }
    
    // Обычный режим — требуется авторизация
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessibleFactories = await getUserAccessibleFactories(token);
    
    let allShipments = await db.select().from(shipments);
    
    if (accessibleFactories.length > 0) {
      allShipments = allShipments.filter(shipment => 
        accessibleFactories.includes(shipment.division)
      );
    }
    
    return NextResponse.json(allShipments);
  } catch (error) {
    console.error('Error fetching shipments:', error);
    return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 });
  }
}





// // app/api/shipments/route.ts
// import { NextResponse } from 'next/server';
// import { cookies } from 'next/headers';
// import { db } from '@/lib/db';
// import { shipments } from '@/lib/db/schema';
// import { getUserAccessibleFactories } from '@/lib/auth';

// export async function GET(request: Request) {
//   try {
//     const cookieStore = await cookies();
//     const token = cookieStore.get('token')?.value;
    
    
//     if (!token) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }
    
//     const accessibleFactories = await getUserAccessibleFactories(token);
    
//     // Получаем все отгрузки
//     let allShipments = await db.select().from(shipments);
    
//     // Фильтруем по доступным заводам
//     if (accessibleFactories.length > 0) {
//       allShipments = allShipments.filter(shipment => 
//         accessibleFactories.includes(shipment.division)
//       );
//     }
    
//     // Если нет данных, вернём пустой массив
//     return NextResponse.json(allShipments);
//   } catch (error) {
//     console.error('Error fetching shipments:', error);
//     return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 });
//   }
// }



