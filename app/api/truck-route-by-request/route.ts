// app/api/truck-route-by-request/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments, outgoingRequests } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getDestinationCoords, getFactoryCoords } from '@/lib/constants';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestNumber = searchParams.get('requestNumber');

  if (!requestNumber) {
    return NextResponse.json(
      { error: 'Missing requestNumber parameter' },
      { status: 400 }
    );
  }

  try {
    // Получаем все отгрузки по этой заявке
    const shipmentsForRequest = await db
      .select()
      .from(shipments)
      .where(eq(shipments.clientRequestNumber, requestNumber));

    if (shipmentsForRequest.length === 0) {
      return NextResponse.json({
        success: true,
        route: null,
        message: 'No shipments found for this request',
      });
    }

    // Получаем информацию о заявке
    const requestInfo = await db
      .select()
      .from(outgoingRequests)
      .where(eq(outgoingRequests.number, requestNumber))
      .limit(1);

    const consignee = shipmentsForRequest[0]?.consignee || 
                      requestInfo[0]?.consignee || 
                      'Неизвестно';
    const division = shipmentsForRequest[0]?.division || 
                     requestInfo[0]?.division || 
                     'ЛХ';

    // Собираем информацию о машинах
    const trucks = shipmentsForRequest.map(s => ({
      licensePlate: s.licensePlate,
      driver: s.driver,
      quantity: s.quantity,
      time: s.date,
      material: s.material,
    }));

    // Уникальные номера машин
    const uniquePlates = [...new Set(trucks.map(t => t.licensePlate).filter(Boolean))];

    const destCoords = getDestinationCoords(consignee);
    const factoryCoords = getFactoryCoords(division);

    return NextResponse.json({
      success: true,
      route: {
        destination: consignee,
        factory: division,
        count: uniquePlates.length,
        requestNumber: requestNumber,
        totalQuantity: shipmentsForRequest.reduce((sum, s) => sum + s.quantity, 0),
        trucks: trucks,
        destCoords: destCoords,
        factoryCoords: factoryCoords,
        licensePlates: uniquePlates,
      },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch route' },
      { status: 500 }
    );
  }
}