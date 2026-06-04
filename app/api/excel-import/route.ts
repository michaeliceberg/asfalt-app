import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments, incomingMaterials, outgoingRequests } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Разрешённые IP адреса
const ALLOWED_IPS = ['89.31.82.106', '127.0.0.1', '::1'];

function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return 'unknown';
}

export async function POST(request: Request) {
    try {
        // Проверка IP
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
                const existing = await db.select().from(outgoingRequests).where(eq(outgoingRequests.number, record.number)).limit(1);
                if (existing.length === 0) {
                    await db.insert(outgoingRequests).values({
                        number: record.number,
                        date: record.date || new Date().toISOString(),
                        division: factory,
                        customer: record.customer || '',
                        consignee: record.consignee || null,
                        material: record.material || '',
                        quantity: record.quantity || 0,
                        clientRequestNumber: record.number,
                        clientRequestDate: record.date || null,
                        closed: false,
                        delivery_date: record.date || null,
                        createdAt: Date.now(),
                    });
                    processed++;
                }
            }
        }
        
        return NextResponse.json({ success: true, factory, type, processed, total: data?.length });
    } catch (error) {
        console.error('Excel import error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}





// // app/api/excel-import/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { shipments, incomingMaterials, outgoingRequests } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';

// const CRON_SECRET = process.env.CRON_SECRET;

// interface ExcelShipment {
//   number: string;
//   date?: string;
//   customer?: string;
//   consignee?: string;
//   material?: string;
//   quantity?: number;
//   driver?: string;
//   licensePlate?: string;
//   clientRequestNumber?: string;
// }

// interface ExcelIncoming {
//   number: string;
//   date?: string;
//   supplier?: string;
//   material?: string;
//   quantity?: number;
//   driver?: string;
//   licensePlate?: string;
// }

// interface ExcelRequest {
//   number: string;
//   date?: string;
//   customer?: string;
//   consignee?: string;
//   material?: string;
//   quantity?: number;
// }

// async function processShipments(data: ExcelShipment[], factory: string): Promise<number> {
//     let count = 0;
//     for (const record of data) {
//         if (!record.number) continue;
        
//         const existing = await db
//             .select()
//             .from(shipments)
//             .where(eq(shipments.number, record.number))
//             .limit(1);
        
//         if (existing.length === 0) {
//             await db.insert(shipments).values({
//                 number: record.number,
//                 date: record.date || new Date().toISOString(),
//                 division: factory,
//                 customer: record.customer || record.consignee || '',
//                 consignee: record.consignee || record.customer || null,
//                 material: record.material || '',
//                 quantity: record.quantity || 0,
//                 driver: record.driver || null,
//                 licensePlate: record.licensePlate || null,
//                 clientRequestNumber: record.clientRequestNumber || null,
//                 clientRequestDate: record.date || null,
//                 createdAt: Date.now(),
//             });
//             count++;
//         }
//     }
//     return count;
// }

// async function processIncoming(data: ExcelIncoming[], factory: string): Promise<number> {
//     let count = 0;
//     for (const record of data) {
//         if (!record.number) continue;
        
//         await db.insert(incomingMaterials).values({
//             number: record.number,
//             date: record.date || new Date().toISOString(),
//             division: factory,
//             supplier: record.supplier || '',
//             material: record.material || '',
//             quantity: record.quantity || 0,
//             driver: record.driver || null,
//             licensePlate: record.licensePlate || null,
//             createdAt: Date.now(),
//         });
//         count++;
//     }
//     return count;
// }

// async function processRequests(data: ExcelRequest[], factory: string): Promise<number> {
//     let count = 0;
//     for (const record of data) {
//         if (!record.number) continue;
        
//         const existing = await db
//             .select()
//             .from(outgoingRequests)
//             .where(eq(outgoingRequests.number, record.number))
//             .limit(1);
        
//         if (existing.length === 0) {
//             await db.insert(outgoingRequests).values({
//                 number: record.number,
//                 date: record.date || new Date().toISOString(),
//                 division: factory,
//                 customer: record.customer || '',
//                 consignee: record.consignee || null,
//                 material: record.material || '',
//                 quantity: record.quantity || 0,
//                 clientRequestNumber: record.number,
//                 clientRequestDate: record.date || null,
//                 closed: false,
//                 delivery_date: record.date || null,
//                 createdAt: Date.now(),
//             });
//             count++;
//         }
//     }
//     return count;
// }

// export async function POST(request: Request) {
//     try {
//         // Разрешить запросы без авторизации (только для теста с завода)
//         // В продакшене лучше убрать или ограничить по IP
       
//         // const url = new URL(request.url);
//         // const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        
//         // // Если запрос не с localhost, проверяем авторизацию
//         // if (!isLocalhost) {
//         //     const authHeader = request.headers.get('authorization');
//         //     if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
//         //         console.log('Auth failed:', { authHeader, expected: `Bearer ${CRON_SECRET}` });
//         //         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//         //     }
//         // }
        
//         const body = await request.json();
//         const { factory, type, data } = body;
        
//         console.log('Received:', { factory, type, dataLength: data.length });
        
//         let processedCount = 0;
//         switch (type) {
//             case 'shipments':
//                 processedCount = await processShipments(data as ExcelShipment[], factory);
//                 break;
//             case 'incoming':
//                 processedCount = await processIncoming(data as ExcelIncoming[], factory);
//                 break;
//             case 'requests':
//                 processedCount = await processRequests(data as ExcelRequest[], factory);
//                 break;
//             default:
//                 return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
//         }
        
//         return NextResponse.json({
//             success: true,
//             factory,
//             type,
//             processed: processedCount,
//             total: data.length,
//             timestamp: new Date().toISOString(),
//         });
//     } catch (error) {
//         console.error('Excel import error:', error);
//         return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//     }
// }




// // // app/api/excel-import/route.ts
// // import { NextResponse } from 'next/server';
// // import { db } from '@/lib/db';
// // import { shipments, incomingMaterials, outgoingRequests } from '@/lib/db/schema';
// // import { eq } from 'drizzle-orm';

// // const CRON_SECRET = process.env.CRON_SECRET;

// // // Типы для данных из Excel
// // interface ExcelShipment {
// //   number: string;
// //   date?: string;
// //   customer?: string;
// //   consignee?: string;
// //   material?: string;
// //   quantity?: number;
// //   driver?: string;
// //   licensePlate?: string;
// //   clientRequestNumber?: string;
// // }

// // interface ExcelIncoming {
// //   number: string;
// //   date?: string;
// //   supplier?: string;
// //   material?: string;
// //   quantity?: number;
// //   driver?: string;
// //   licensePlate?: string;
// // }

// // interface ExcelRequest {
// //   number: string;
// //   date?: string;
// //   customer?: string;
// //   consignee?: string;
// //   material?: string;
// //   quantity?: number;
// // }

// // async function processShipments(data: ExcelShipment[], factory: string): Promise<number> {
// //     let count = 0;
// //     for (const record of data) {
// //         if (!record.number) continue;
        
// //         const existing = await db
// //             .select()
// //             .from(shipments)
// //             .where(eq(shipments.number, record.number))
// //             .limit(1);
        
// //         if (existing.length === 0) {
// //             await db.insert(shipments).values({
// //                 number: record.number,
// //                 date: record.date || new Date().toISOString(),
// //                 division: factory,
// //                 customer: record.customer || record.consignee || '',
// //                 consignee: record.consignee || record.customer || null,
// //                 material: record.material || '',
// //                 quantity: record.quantity || 0,
// //                 driver: record.driver || null,
// //                 licensePlate: record.licensePlate || null,
// //                 clientRequestNumber: record.clientRequestNumber || null,
// //                 clientRequestDate: record.date || null,
// //                 createdAt: Date.now(),
// //             });
// //             count++;
// //         }
// //     }
// //     return count;
// // }

// // async function processIncoming(data: ExcelIncoming[], factory: string): Promise<number> {
// //     let count = 0;
// //     for (const record of data) {
// //         if (!record.number) continue;
        
// //         await db.insert(incomingMaterials).values({
// //             number: record.number,
// //             date: record.date || new Date().toISOString(),
// //             division: factory,
// //             supplier: record.supplier || '',
// //             material: record.material || '',
// //             quantity: record.quantity || 0,
// //             driver: record.driver || null,
// //             licensePlate: record.licensePlate || null,
// //             createdAt: Date.now(),
// //         });
// //         count++;
// //     }
// //     return count;
// // }

// // async function processRequests(data: ExcelRequest[], factory: string): Promise<number> {
// //     let count = 0;
// //     for (const record of data) {
// //         if (!record.number) continue;
        
// //         const existing = await db
// //             .select()
// //             .from(outgoingRequests)
// //             .where(eq(outgoingRequests.number, record.number))
// //             .limit(1);
        
// //         if (existing.length === 0) {
// //             await db.insert(outgoingRequests).values({
// //                 number: record.number,
// //                 date: record.date || new Date().toISOString(),
// //                 division: factory,
// //                 customer: record.customer || '',
// //                 consignee: record.consignee || null,
// //                 material: record.material || '',
// //                 quantity: record.quantity || 0,
// //                 clientRequestNumber: record.number,
// //                 clientRequestDate: record.date || null,
// //                 closed: false,
// //                 delivery_date: record.date || null,
// //                 createdAt: Date.now(),
// //             });
// //             count++;
// //         }
// //     }
// //     return count;
// // }

// // interface ImportBody {
// //   factory: string;
// //   type: 'shipments' | 'incoming' | 'requests';
// //   data: ExcelShipment[] | ExcelIncoming[] | ExcelRequest[];
// //   timestamp: string;
// // }

// // export async function POST(request: Request) {
// //     try {
// //         const authHeader = request.headers.get('authorization');
// //         if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
// //             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// //         }
        
// //         const body: ImportBody = await request.json();
// //         const { factory, type, data } = body;
        
// //         let processedCount = 0;
// //         switch (type) {
// //             case 'shipments':
// //                 processedCount = await processShipments(data as ExcelShipment[], factory);
// //                 break;
// //             case 'incoming':
// //                 processedCount = await processIncoming(data as ExcelIncoming[], factory);
// //                 break;
// //             case 'requests':
// //                 processedCount = await processRequests(data as ExcelRequest[], factory);
// //                 break;
// //             default:
// //                 return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
// //         }
        
// //         return NextResponse.json({
// //             success: true,
// //             factory,
// //             type,
// //             processed: processedCount,
// //             total: data.length,
// //             timestamp: new Date().toISOString(),
// //         });
// //     } catch (error) {
// //         console.error('Excel import error:', error);
// //         return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
// //     }
// // }