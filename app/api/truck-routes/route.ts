// app/api/truck-routes/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments } from '@/lib/db/schema';
import { FACTORIES, getFactoryCoords, getDestinationCoords, parseDestinationPoint } from '@/lib/constants';

export async function GET() {
  try {
    // Получаем отгрузки
    const allShipments = await db.select().from(shipments);

    const truckDestinations: Record<string, string> = {};
    const requestGroups: Record<string, { 
      consignee: string; 
      division: string; 
      quantity: number;
      licensePlates: string[];
      destinationPoint: string | null;
    }> = {};

    for (const shipment of allShipments) {
      const requestNumber = shipment.clientRequestNumber;
      if (!requestNumber) continue;
      
      if (!requestGroups[requestNumber]) {
        requestGroups[requestNumber] = {
          consignee: shipment.consignee || shipment.customer || 'Неизвестно',
          division: shipment.division,
          quantity: 0,
          licensePlates: [],
          destinationPoint: shipment.destinationPoint || null,
        };
      }
      
      requestGroups[requestNumber].quantity += shipment.quantity;
      if (shipment.licensePlate) {
        requestGroups[requestNumber].licensePlates.push(shipment.licensePlate);
      }
    }

    // Формируем маршруты
    const routes = Object.entries(requestGroups)
      .filter(([_, group]) => group.licensePlates.length > 0)
      .map(([requestNumber, group]) => {
        // Получаем координаты из destinationPoint или из consignee (fallback)
        let destCoords = null;
        
        // Сначала пробуем распарсить destinationPoint
        if (group.destinationPoint) {
          const parsed = parseDestinationPoint(group.destinationPoint);
          if (parsed) {
            destCoords = { lat: parsed.lat, lng: parsed.lng, name: parsed.address };
          }
        }
        
        // Если не получилось, пробуем по названию consignee
        if (!destCoords) {
          destCoords = getDestinationCoords(group.consignee);
        }
        
        const factoryCoords = getFactoryCoords(group.division);

        return {
          destination: group.consignee,
          factory: group.division,
          count: [...new Set(group.licensePlates)].length,
          requestNumber: requestNumber,
          totalQuantity: group.quantity,
          destCoords: destCoords,
          factoryCoords: factoryCoords,
          licensePlates: [...new Set(group.licensePlates)],
          destinationPoint: group.destinationPoint, // для отладки
        };
      });

    return NextResponse.json({
      success: true,
      routes: routes,
      truckDestinations: truckDestinations,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Error fetching truck routes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch routes', routes: [], truckDestinations: {} },
      { status: 500 }
    );
  }
}





