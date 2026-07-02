// app/api/outgoing-requests/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { outgoingRequests } from '@/lib/db/schema';
import { getUserAccessibleFactories } from '@/lib/auth';
import { desc } from 'drizzle-orm'; // ✅ Добавляем desc

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessibleFactories = await getUserAccessibleFactories(token);
    
    // ✅ Добавляем лимит и сортировку
    let allRequests = await db
      .select()
      .from(outgoingRequests)
      .orderBy(desc(outgoingRequests.date)) // Сначала новые
      .limit(300); // Ограничиваем количество
    
    if (accessibleFactories.length > 0) {
      allRequests = allRequests.filter(req => 
        accessibleFactories.includes(req.division)
      );
    }
    
    return NextResponse.json(allRequests);
  } catch (error) {
    console.error('Error fetching outgoing requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}



// // app/api/outgoing-requests/route.ts
// import { NextResponse } from 'next/server';
// import { cookies } from 'next/headers';
// import { db } from '@/lib/db';
// import { outgoingRequests } from '@/lib/db/schema';
// import { getUserAccessibleFactories } from '@/lib/auth';

// export async function GET(request: Request) {
//   try {
//     const cookieStore = await cookies();
//     const token = cookieStore.get('token')?.value;
    
//     if (!token) {
//       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//     }
    
//     const accessibleFactories = await getUserAccessibleFactories(token);
    
//     let allRequests = await db.select().from(outgoingRequests);
    
//     // Фильтруем по доступным заводам
//     if (accessibleFactories.length > 0) {
//       allRequests = allRequests.filter(req => 
//         accessibleFactories.includes(req.division)
//       );
//     }
    
//     return NextResponse.json(allRequests);
//   } catch (error) {
//     console.error('Error fetching outgoing requests:', error);
//     return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
//   }
// }


