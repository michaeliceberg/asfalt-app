import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments, incomingMaterials, outgoingRequests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Разрешённые IP адреса
// const ALLOWED_IPS = ['89.31.82.106', '127.0.0.1', '::1'];

const ALLOWED_IPS = [
    '89.31.82.106', 
    '127.0.0.1', 
    '::1', 
    'localhost',
    '::ffff:127.0.0.1',
    '192.168.0.86',  // ваш локальный IP из логов сервера
];


function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return 'unknown';
}

export async function POST(request: Request) {
    try {
        const clientIp = getClientIp(request);
        console.log(`📡 Запрос с IP: ${clientIp}`);
        
        if (!ALLOWED_IPS.includes(clientIp)) {
            console.log(`❌ Доступ запрещён для IP: ${clientIp}`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const body = await request.json();
        const { factory, type, data } = body;
        
        console.log('📥 Received:', { factory, type, count: data?.length, from: clientIp });
        
        let processed = 0;
        
        if (type === 'shipments') {
            for (const record of data) {
                if (!record.number) continue;
                const existing = await db.select().from(shipments).where(eq(shipments.number, record.number)).limit(1);
                if (existing.length === 0) {
                    await db.insert(shipments).values({
                        number: record.number,
                        date: record.date || new Date().toISOString(),
                        division: factory,
                        customer: record.customer || record.consignee || '',
                        consignee: record.consignee || record.customer || null,
                        material: record.material || '',
                        quantity: record.quantity || 0,
                        driver: record.driver || null,
                        licensePlate: record.licensePlate || null,
                        clientRequestNumber: record.clientRequestNumber || null,
                        clientRequestDate: record.date || null,
                        createdAt: Date.now(),
                    });
                    processed++;
                }
            }
        } else if (type === 'incoming') {
            for (const record of data) {
                if (!record.number) continue;
                await db.insert(incomingMaterials).values({
                    number: record.number,
                    date: record.date || new Date().toISOString(),
                    division: factory,
                    supplier: record.supplier || '',
                    material: record.material || '',
                    quantity: record.quantity || 0,
                    driver: record.driver || null,
                    licensePlate: record.licensePlate || null,
                    createdAt: Date.now(),
                });
                processed++;
            }
        } else if (type === 'requests') {
            for (const record of data) {
                if (!record.number) continue;
                
                const existing = await db.select()
                    .from(outgoingRequests)
                    .where(eq(outgoingRequests.number, record.number))
                    .limit(1);
                
                const planQty = record.plan_quantity || record.quantity || 0;
                
                const values = {
                    number: record.number,
                    date: record.date || new Date().toISOString(),
                    division: factory,
                    customer: record.customer || '',
                    consignee: record.consignee || null,
                    material: record.material || '',
                    quantity: planQty,
                    clientRequestNumber: record.number,
                    clientRequestDate: record.date || null,
                    closed: false,
                    delivery_date: record.date ? record.date.split(' ')[0] : null,
                    createdAt: Date.now(),
                };
                
                if (existing.length === 0) {
                    await db.insert(outgoingRequests).values(values);
                } else {
                    await db.update(outgoingRequests)
                        .set(values)
                        .where(eq(outgoingRequests.number, record.number));
                }
                processed++;
            }
        }
        
        return NextResponse.json({ success: true, factory, type, processed, total: data?.length });
    } catch (error) {
        console.error('Excel import error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}