import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments, outgoingRequests, incomingMaterials } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    // ✅ БЕЗ ЛИМИТА — все данные
    const [allShipments, allRequests, allIncoming] = await Promise.all([
      db.select().from(shipments).orderBy(desc(shipments.date)),
      db.select().from(outgoingRequests).orderBy(desc(outgoingRequests.date)),
      db.select().from(incomingMaterials).orderBy(desc(incomingMaterials.date)),
    ]);
    
    console.log(`📦 Отгрузок: ${allShipments.length}`);
    console.log(`📋 Заявок: ${allRequests.length}`);
    console.log(`📥 Поступлений: ${allIncoming.length}`);
    
    return NextResponse.json({
      shipments: allShipments,
      outgoingRequests: allRequests,
      incoming: allIncoming,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error loading all data:', error);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}




// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { shipments, outgoingRequests, incomingMaterials } from '@/lib/db/schema';
// import { desc } from 'drizzle-orm';

// export async function GET() {
//   try {
//     // ✅ БЕЗ ФИЛЬТРАЦИИ — все данные
//     const [allShipments, allRequests, allIncoming] = await Promise.all([
//       db.select().from(shipments).orderBy(desc(shipments.date)).limit(500),
//       db.select().from(outgoingRequests).orderBy(desc(outgoingRequests.date)).limit(500),
//       db.select().from(incomingMaterials).orderBy(desc(incomingMaterials.date)).limit(500),
//     ]);
    
//     console.log(`📦 Отгрузок: ${allShipments.length}`);
//     console.log(`📋 Заявок: ${allRequests.length}`);
//     console.log(`📥 Поступлений: ${allIncoming.length}`);
    
//     return NextResponse.json({
//       shipments: allShipments,
//       outgoingRequests: allRequests,
//       incoming: allIncoming,
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     console.error('❌ Error loading all data:', error);
//     return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
//   }
// }




// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { shipments, outgoingRequests, incomingMaterials } from '@/lib/db/schema';
// import { desc } from 'drizzle-orm';

// export async function GET() {
//   try {
//     // ⚠️ ВРЕМЕННО ДЛЯ ТЕСТА: убрана проверка авторизации
//     // const cookieStore = await cookies();
//     // const token = cookieStore.get('token')?.value;
//     // if (!token) {
//     //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     // }
//     // const accessibleFactories = await getUserAccessibleFactories(token);
    
//     // Временно все заводы
//     const accessibleFactories = ['ЛХ', 'ЛЮ', 'СП', 'Щ'];
    
//     console.log('🔵 Доступные заводы (все):', accessibleFactories);
    
//     const [allShipments, allRequests, allIncoming] = await Promise.all([
//       db.select().from(shipments).orderBy(desc(shipments.date)).limit(500),
//       db.select().from(outgoingRequests).orderBy(desc(outgoingRequests.date)).limit(500),
//       db.select().from(incomingMaterials).orderBy(desc(incomingMaterials.date)).limit(500),
//     ]);
    
//     console.log(`📦 Всего отгрузок: ${allShipments.length}`);
//     console.log(`📋 Всего заявок: ${allRequests.length}`);
//     console.log(`📥 Всего поступлений: ${allIncoming.length}`);
    
//     const filterByFactory = <T extends { division: string | null }>(
//       items: T[],
//       factories: string[]
//     ): T[] => {
//       if (factories.length === 0) return items;
//       return items.filter(item => 
//         item.division !== null && factories.includes(item.division)
//       );
//     };
    
//     const filteredShipments = filterByFactory(allShipments, accessibleFactories);
//     const filteredRequests = filterByFactory(allRequests, accessibleFactories);
//     const filteredIncoming = filterByFactory(allIncoming, accessibleFactories);
    
//     console.log(`✅ Отфильтровано отгрузок: ${filteredShipments.length}`);
//     console.log(`✅ Отфильтровано заявок: ${filteredRequests.length}`);
//     console.log(`✅ Отфильтровано поступлений: ${filteredIncoming.length}`);
    
//     return NextResponse.json({
//       shipments: filteredShipments,
//       outgoingRequests: filteredRequests,
//       incoming: filteredIncoming,
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     console.error('❌ Error loading all data:', error);
//     return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
//   }
// }







// // app/api/all-data/route.ts

// import { NextResponse } from 'next/server';
// import { cookies } from 'next/headers';
// import { db } from '@/lib/db';
// import { shipments, outgoingRequests, incomingMaterials } from '@/lib/db/schema';
// import { getUserAccessibleFactories } from '@/lib/auth';
// import { desc } from 'drizzle-orm';

// export async function GET() {
//   try {
//     const cookieStore = await cookies();
//     const token = cookieStore.get('token')?.value;
    
//     if (!token) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }
    
//     const accessibleFactories = await getUserAccessibleFactories(token);
//     console.log('🔵 Доступные заводы:', accessibleFactories);
    
//     // Увеличиваем лимиты для загрузки всех данных
//     const [allShipments, allRequests, allIncoming] = await Promise.all([
//       db.select().from(shipments).orderBy(desc(shipments.date)).limit(500),
//       db.select().from(outgoingRequests).orderBy(desc(outgoingRequests.date)).limit(500),
//       db.select().from(incomingMaterials).orderBy(desc(incomingMaterials.date)).limit(500),
//     ]);
    
//     console.log(`📦 Всего отгрузок: ${allShipments.length}`);
//     console.log(`📋 Всего заявок: ${allRequests.length}`);
//     console.log(`📥 Всего поступлений: ${allIncoming.length}`);
    
//     // Фильтруем по доступным заводам
//     const filterByFactory = <T extends { division: string | null }>(
//       items: T[],
//       factories: string[]
//     ): T[] => {
//       if (factories.length === 0) return items;
//       return items.filter(item => 
//         item.division !== null && factories.includes(item.division)
//       );
//     };
    
//     const filteredShipments = filterByFactory(allShipments, accessibleFactories);
//     const filteredRequests = filterByFactory(allRequests, accessibleFactories);
//     const filteredIncoming = filterByFactory(allIncoming, accessibleFactories);
    
//     console.log(`✅ Отфильтровано отгрузок: ${filteredShipments.length}`);
//     console.log(`✅ Отфильтровано заявок: ${filteredRequests.length}`);
//     console.log(`✅ Отфильтровано поступлений: ${filteredIncoming.length}`);
    
//     return NextResponse.json({
//       shipments: filteredShipments,
//       outgoingRequests: filteredRequests,
//       incoming: filteredIncoming,
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     console.error('❌ Error loading all data:', error);
//     return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
//   }
// }