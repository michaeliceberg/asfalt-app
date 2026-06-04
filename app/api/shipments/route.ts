// app/api/shipments/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { shipments } from '@/lib/db/schema';
import { getUserAccessibleFactories } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    console.log('🔑 Token from cookie:', token ? 'present' : 'missing');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessibleFactories = await getUserAccessibleFactories(token);
    console.log('🏭 Accessible factories:', accessibleFactories);
    
    // Получаем все отгрузки
    let allShipments = await db.select().from(shipments);
    console.log('📦 Total shipments in DB:', allShipments.length);
    
    // Фильтруем по доступным заводам
    if (accessibleFactories.length > 0) {
      allShipments = allShipments.filter(shipment => 
        accessibleFactories.includes(shipment.division)
      );
      console.log('🔍 Filtered shipments:', allShipments.length);
    }
    
    // Если нет данных, вернём пустой массив
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
//     // Получаем токен из cookie с помощью next/headers
//     const cookieStore = await cookies();
//     const token = cookieStore.get('token')?.value;
    
//     if (!token) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }
    
//     // Получаем доступные заводы для пользователя
//     const accessibleFactories = await getUserAccessibleFactories(token);
    
//     // Получаем все отгрузки
//     let allShipments = await db.select().from(shipments);
    
//     // Фильтруем по доступным заводам
//     if (accessibleFactories.length > 0) {
//       allShipments = allShipments.filter(shipment => 
//         accessibleFactories.includes(shipment.division)
//       );
//     }
    
//     return NextResponse.json(allShipments);
//   } catch (error) {
//     console.error('Error fetching shipments:', error);
//     return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 });
//   }
// }





// // app/api/shipments/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { shipments } from '@/lib/db/schema';
// import { desc } from 'drizzle-orm';

// export async function GET() {
//   try {
//     const data = await db
//       .select()
//       .from(shipments)
//       .orderBy(desc(shipments.date));
    
//     return NextResponse.json(data);
//   } catch (error) {
//     console.error('Database error:', error);
//     return NextResponse.json(
//       { error: 'Failed to load shipments' },
//       { status: 500 }
//     );
//   }
// }
