import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { shipments, outgoingRequests, incomingMaterials } from '@/lib/db/schema';
import { getUserAccessibleFactories } from '@/lib/auth';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessibleFactories = await getUserAccessibleFactories(token);
    
    // Загружаем все данные параллельно, но на сервере
    const [allShipments, allRequests, allIncoming] = await Promise.all([
      db.select().from(shipments).orderBy(desc(shipments.date)).limit(300),
      db.select().from(outgoingRequests).orderBy(desc(outgoingRequests.date)).limit(300),
      db.select().from(incomingMaterials).orderBy(desc(incomingMaterials.date)).limit(200),
    ]);
    
    // Фильтруем по доступным заводам
    const filterByFactory = <T extends { division: string | null }>(
      items: T[],
      factories: string[]
    ): T[] => {
      if (factories.length === 0) return items;
      return items.filter(item => 
        item.division !== null && factories.includes(item.division)
      );
    };
    
    return NextResponse.json({
      shipments: filterByFactory(allShipments, accessibleFactories),
      outgoingRequests: filterByFactory(allRequests, accessibleFactories),
      incoming: filterByFactory(allIncoming, accessibleFactories),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading all data:', error);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}