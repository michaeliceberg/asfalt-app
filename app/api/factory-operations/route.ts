import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '500');
  const offset = parseInt(searchParams.get('offset') || '0');
  const factory = searchParams.get('factory') || '';
  const type = searchParams.get('type') || '';
  
  // Вычисляем дату 30 дней назад
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDay = thirtyDaysAgo.getDate().toString().padStart(2, '0');
  const fromMonth = (thirtyDaysAgo.getMonth() + 1).toString().padStart(2, '0');
  const fromYear = thirtyDaysAgo.getFullYear();
  const fromDateStr = `${fromDay}.${fromMonth}.${fromYear}`;
  
  try {
    // Простой SQL запрос
    let sqlQuery = `
      SELECT * FROM factory_operations 
      WHERE date >= '${fromDateStr}'
    `;
    if (factory) sqlQuery += ` AND factory = '${factory}'`;
    if (type) sqlQuery += ` AND type = '${type}'`;
    sqlQuery += ` ORDER BY date DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const data = await db.all(sql.raw(sqlQuery));
    
    return NextResponse.json({
      data,
      total: data.length, // упрощённо: возвращаем количество в текущей выборке
      limit,
      offset,
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to load factory operations' },
      { status: 500 }
    );
  }
}


// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { factoryOperations } from '@/lib/db/schema';
// import { desc } from 'drizzle-orm';

// export async function GET() {
//   try {
//     const data = await db
//       .select()
//       .from(factoryOperations)
//       .orderBy(desc(factoryOperations.date));
    
//     return NextResponse.json(data);
//   } catch (error) {
//     console.error('Database error:', error);
//     return NextResponse.json(
//       { error: 'Failed to load factory operations' },
//       { status: 500 }
//     );
//   }
// }