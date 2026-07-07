// app/api/summary/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { outgoingRequests, shipments, type Shipment } from '@/lib/db/schema';
import { getUserAccessibleFactories } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessibleFactories = await getUserAccessibleFactories(token);
    
    // Получаем заявки
    let requests = await db.select().from(outgoingRequests);
    
    // Получаем отгрузки
    let allShipments = await db.select().from(shipments);
    
    // Фильтруем по доступным заводам
    if (accessibleFactories.length > 0) {
      requests = requests.filter(req => accessibleFactories.includes(req.division));
      allShipments = allShipments.filter(ship => accessibleFactories.includes(ship.division));
    }
    
    // Группируем отгрузки по заявкам
    const shipmentsByRequest = new Map<string, Shipment[]>();
    for (const shipment of allShipments) {
      const requestNumber = shipment.clientRequestNumber;
      if (requestNumber) {
        if (!shipmentsByRequest.has(requestNumber)) {
          shipmentsByRequest.set(requestNumber, []);
        }
        shipmentsByRequest.get(requestNumber)!.push(shipment);
      }
    }
    
    const result = requests.map(request => {
      const requestShipments = shipmentsByRequest.get(request.number) || [];
      const factQuantity = requestShipments.reduce((sum: number, s: Shipment) => sum + s.quantity, 0);
      const remaining = request.quantity - factQuantity;
      const percentCompleted = request.quantity > 0 ? (factQuantity / request.quantity) * 100 : 0;
      
      return {
        request: {
          number: request.number,
          date: request.date,
          division: request.division,
          customer: request.customer,
          consignee: request.consignee,
          material: request.material,
          planQuantity: request.quantity,
          clientRequestNumber: request.clientRequestNumber,
          clientRequestDate: request.clientRequestDate,
          delivery_date: request.delivery_date,
        },
        factQuantity,
        remaining,
        percentCompleted: Math.round(percentCompleted),
        shipments: requestShipments.map((s: Shipment) => ({
          number: s.number,
          date: s.date,
          quantity: s.quantity,
          driver: s.driver,
          licensePlate: s.licensePlate,
        })),
      };
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


