// app/api/incoming/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { incomingMaterials } from '@/lib/db/schema';
import { getUserAccessibleFactories } from '@/lib/auth';
import { sql, eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isDemo = searchParams.get('demo') === 'true';
    
    // Если демо-режим — возвращаем только ДЕМО-данные из основной БД
    if (isDemo) {
      const demoData = await db
        .select({
          id: incomingMaterials.id,
          number: incomingMaterials.number,
          date: incomingMaterials.date,
          division: incomingMaterials.division,
          supplier: incomingMaterials.supplier,
          material: incomingMaterials.material,
          gross: incomingMaterials.gross,
          tara: incomingMaterials.tara,
          quantity: incomingMaterials.quantity,
          unit: incomingMaterials.unit,
          driver: incomingMaterials.driver,
          licensePlate: incomingMaterials.licensePlate,
          clientRequestNumber: incomingMaterials.clientRequestNumber,
          createdAt: incomingMaterials.createdAt,
        })
        .from(incomingMaterials)
        .where(eq(incomingMaterials.division, 'ДЕМО'));
      
      return NextResponse.json(demoData);
    }
    
    // Обычный режим — требуется авторизация
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessibleFactories = await getUserAccessibleFactories(token);
    
    const allIncoming = await db
      .select({
        id: sql<number>`MIN(${incomingMaterials.id})`,
        number: incomingMaterials.number,
        date: incomingMaterials.date,
        division: incomingMaterials.division,
        supplier: incomingMaterials.supplier,
        material: incomingMaterials.material,
        gross: incomingMaterials.gross,
        tara: incomingMaterials.tara,
        quantity: incomingMaterials.quantity,
        unit: incomingMaterials.unit,
        driver: incomingMaterials.driver,
        licensePlate: incomingMaterials.licensePlate,
        clientRequestNumber: incomingMaterials.clientRequestNumber,
        createdAt: incomingMaterials.createdAt,
      })
      .from(incomingMaterials)
      .orderBy(desc(incomingMaterials.date))
      .limit(200)
      .groupBy(
        incomingMaterials.number,
        incomingMaterials.date,
        incomingMaterials.division,
        incomingMaterials.supplier,
        incomingMaterials.material,
        incomingMaterials.unit,
        incomingMaterials.driver,
        incomingMaterials.licensePlate,
        incomingMaterials.clientRequestNumber
      );
    
    // Фильтруем по доступным заводам
    let filteredIncoming = allIncoming;
    if (accessibleFactories.length > 0) {
      filteredIncoming = allIncoming.filter(item => {
        let division = item.division;
        if (!division && item.number) {
          if (item.number.startsWith('ЛХ')) division = 'ЛХ';
          else if (item.number.startsWith('ЛЮ')) division = 'ЛЮ';
          else if (item.number.startsWith('СП')) division = 'СП';
          else if (item.number.startsWith('Щ')) division = 'Щ';
        }
        return division && accessibleFactories.includes(division);
      });
    }
    
    return NextResponse.json(filteredIncoming);
  } catch (error) {
    console.error('Error fetching incoming:', error);
    return NextResponse.json({ error: 'Failed to fetch incoming' }, { status: 500 });
  }
}







// import { NextResponse } from 'next/server';
// import { cookies } from 'next/headers';
// import { db } from '@/lib/db';
// import { incomingMaterials } from '@/lib/db/schema';
// import { getUserAccessibleFactories } from '@/lib/auth';
// import { sql } from 'drizzle-orm';

// export async function GET(request: Request) {
//   try {
//     const cookieStore = await cookies();
//     const token = cookieStore.get('token')?.value;
    
//     if (!token) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }
    
//     const accessibleFactories = await getUserAccessibleFactories(token);
    
//     // ✅ Берем первую запись из дубликатов (минимальный id), не суммируем quantity
//     const allIncoming = await db
//       .select({
//         id: sql<number>`MIN(${incomingMaterials.id})`,
//         number: incomingMaterials.number,
//         date: incomingMaterials.date,
//         division: incomingMaterials.division,
//         supplier: incomingMaterials.supplier,
//         material: incomingMaterials.material,
//         gross: incomingMaterials.gross,
//         tara: incomingMaterials.tara,
//         quantity: incomingMaterials.quantity,
//         unit: incomingMaterials.unit,
//         driver: incomingMaterials.driver,
//         licensePlate: incomingMaterials.licensePlate,
//         clientRequestNumber: incomingMaterials.clientRequestNumber,
//         createdAt: incomingMaterials.createdAt,
//       })
//       .from(incomingMaterials)
//       .groupBy(
//         incomingMaterials.number,
//         incomingMaterials.date,
//         incomingMaterials.division,
//         incomingMaterials.supplier,
//         incomingMaterials.material,
//         incomingMaterials.unit,
//         incomingMaterials.driver,
//         incomingMaterials.licensePlate,
//         incomingMaterials.clientRequestNumber
//       );
    
//     // Фильтруем по доступным заводам
//     let filteredIncoming = allIncoming;
//     if (accessibleFactories.length > 0) {
//       filteredIncoming = allIncoming.filter(item => {
//         let division = item.division;
//         if (!division && item.number) {
//           if (item.number.startsWith('ЛХ')) division = 'ЛХ';
//           else if (item.number.startsWith('ЛЮ')) division = 'ЛЮ';
//           else if (item.number.startsWith('СП')) division = 'СП';
//           else if (item.number.startsWith('Щ')) division = 'Щ';
//         }
//         return division && accessibleFactories.includes(division);
//       });
//     }
    
//     return NextResponse.json(filteredIncoming);
//   } catch (error) {
//     console.error('Error fetching incoming:', error);
//     return NextResponse.json({ error: 'Failed to fetch incoming' }, { status: 500 });
//   }
// }
