// app/api/summary/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, shipments } from '@/lib/db/schema';

export async function GET() {
  try {
    const requests = await db.select().from(outgoingRequests);
    const allShipments = await db.select().from(shipments);
    
    const summary = requests.map(request => {
      // Связываем по номеру заявки (request.number) с client_request_number в отгрузках
      const relatedShipments = allShipments.filter(s => 
        s.clientRequestNumber === request.number
      );
      
      const factQuantity = relatedShipments.reduce((sum, s) => sum + s.quantity, 0);
      const remaining = request.quantity - factQuantity;
      const percent = request.quantity > 0 ? (factQuantity / request.quantity) * 100 : 0;
      
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
        },
        factQuantity,
        remaining,
        percentCompleted: Math.round(percent * 100) / 100,
        shipments: relatedShipments.map(s => ({
          number: s.number,
          date: s.date,
          quantity: s.quantity,
          driver: s.driver,
          licensePlate: s.licensePlate,
        })),
      };
    });
    
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 });
  }
}



// // app/api/summary/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { outgoingRequests, shipments } from '@/lib/db/schema';
// import { eq, and } from 'drizzle-orm';

// export async function GET() {
//   try {
//     // Получаем все заявки
//     const requests = await db.select().from(outgoingRequests);
    
//     // Для каждой заявки считаем фактические отгрузки
//     const summary = await Promise.all(requests.map(async (request) => {
//       // Ищем отгрузки, связанные с этой заявкой
//       const relatedShipments = await db
//         .select()
//         .from(shipments)
//         .where(
//           and(
//             eq(shipments.clientRequestNumber, request.clientRequestNumber || ''),
//             eq(shipments.clientRequestDate, request.clientRequestDate || '')
//           )
//         );
      
//       const factQuantity = relatedShipments.reduce((sum: number, s) => sum + s.quantity, 0);
//       const remaining = request.quantity - factQuantity;
//       const percent = request.quantity > 0 ? (factQuantity / request.quantity) * 100 : 0;
      
//       return {
//         request: {
//           number: request.number,
//           date: request.date,
//           division: request.division,
//           customer: request.customer,
//           consignee: request.consignee,
//           material: request.material,
//           planQuantity: request.quantity,
//           clientRequestNumber: request.clientRequestNumber,
//           clientRequestDate: request.clientRequestDate,
//         },
//         factQuantity,
//         remaining,
//         percentCompleted: Math.round(percent * 100) / 100,
//         shipments: relatedShipments.map(s => ({
//           number: s.number,
//           date: s.date,
//           quantity: s.quantity,
//           driver: s.driver,
//           licensePlate: s.licensePlate,
//         })),
//       };
//     }));
    
//     return NextResponse.json(summary);
//   } catch (error) {
//     console.error('Summary error:', error);
//     return NextResponse.json(
//       { error: 'Failed to load summary' },
//       { status: 500 }
//     );
//   }
// }