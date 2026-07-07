import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments } from '@/lib/db/schema';
import { isNotNull } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('🔄 Trucks-distances API called');
    
    // Получаем все отгрузки с расстояниями
    const allShipments = await db
      .select()
      .from(shipments)
      .where(isNotNull(shipments.distance_to_dest))
      .limit(200);

    console.log(`📡 Found ${allShipments.length} shipments with distances`);

    const result = allShipments.map(s => ({
      licensePlate: s.licensePlate || '',
      number: s.number || '',
      distance_to_dest: s.distance_to_dest,
      eta_minutes: s.eta_minutes,
      arrived: s.arrived || false,
      arrived_at: s.arrived_at,
      updated_at: s.updated_at,
    }));

    return NextResponse.json({
      success: true,
      count: result.length,
      shipments: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error fetching truck distances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch distances' },
      { status: 500 }
    );
  }
}
