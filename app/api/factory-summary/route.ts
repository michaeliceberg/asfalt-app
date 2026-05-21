// api/factory-summary/route.ts


import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { factoryRequests, factoryOperations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const factory = searchParams.get('factory') || 'all';
  
  try {
    let requests = await db.select().from(factoryRequests);
    if (factory !== 'all') requests = requests.filter(r => r.factory === factory);
    
    const allOperations = await db.select().from(factoryOperations);
    
    const summary = requests.map(request => {
      const relatedOps = allOperations.filter(op => op.clientRequestNumber === request.clientRequestNumber);
      const factQuantity = relatedOps.reduce((sum, op) => sum + op.quantity, 0);
      const remaining = request.planQuantity - factQuantity;
      const percent = request.planQuantity > 0 ? (factQuantity / request.planQuantity) * 100 : 0;
      
      return {
        request: {
          clientRequestNumber: request.clientRequestNumber,
          date: request.date,
          material: request.material,
          planQuantity: request.planQuantity,
          factQuantity: request.factQuantity,
          consignee: request.consignee,
          customer: request.customer,
          factory: request.factory,
        },
        factQuantity,
        remaining,
        percentCompleted: Math.round(percent * 100) / 100,
        operations: relatedOps.map(op => ({
          date: op.date,
          quantity: op.quantity,
          customer: op.customer,
          licensePlate: op.licensePlate,
          type: op.type,
        })),
      };
    });
    
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Factory summary error:', error);
    return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 });
  }
}