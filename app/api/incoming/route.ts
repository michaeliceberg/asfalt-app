// app/api/incoming/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { incomingMaterials } from '@/lib/db/schema';
import { getUserAccessibleFactories } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessibleFactories = await getUserAccessibleFactories(token);
    
    let allIncoming = await db.select().from(incomingMaterials);
    
    // Фильтруем по доступным заводам
    if (accessibleFactories.length > 0) {
      allIncoming = allIncoming.filter(item => {
        // Для поступлений определяем завод по номеру или по полю division
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
    
    return NextResponse.json(allIncoming);
  } catch (error) {
    console.error('Error fetching incoming:', error);
    return NextResponse.json({ error: 'Failed to fetch incoming' }, { status: 500 });
  }
}

