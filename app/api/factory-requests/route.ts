import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { factoryRequests } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const data = await db
      .select()
      .from(factoryRequests)
      .orderBy(desc(factoryRequests.date));
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to load factory requests' },
      { status: 500 }
    );
  }
}