// app/api/outgoing-requests/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { outgoingRequests } from '@/lib/db/schema';
import { getUserAccessibleFactories } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessibleFactories = await getUserAccessibleFactories(token);
    
    let allRequests = await db.select().from(outgoingRequests);
    
    // Фильтруем по доступным заводам
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




// // api/outgoing-requests/route.ts

// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { outgoingRequests } from '@/lib/db/schema';
// import { desc } from 'drizzle-orm';

// export async function GET() {
//   try {
//     const data = await db
//       .select()
//       .from(outgoingRequests)
//       .orderBy(desc(outgoingRequests.date));
    
//     return NextResponse.json(data);
//   } catch (error) {
//     console.error('Database error:', error);
//     return NextResponse.json(
//       { error: 'Failed to load outgoing requests' },
//       { status: 500 }
//     );
//   }
// }
