// api/outgoing-requests/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const data = await db
      .select()
      .from(outgoingRequests)
      .orderBy(desc(outgoingRequests.date));
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to load outgoing requests' },
      { status: 500 }
    );
  }
}
