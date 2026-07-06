process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


// app/api/cron-shipments/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments, users, shipmentStartNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { sendPushNotification } from '@/lib/push-notifications';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-shipments.json');

interface ShipmentItem {
  Подразделение: string;
  Номер: string;
  Дата: string;
  Покупатель: string;
  Номенклатура: string;
  Брутто: number;
  Тара: number;
  Количество: number;
  Водитель: string;
  ГосНомер: string;
  Грузополучатель: string;
  ЗаявкаНаОтгрузкуНомер: string | null;
  ЗаявкаНаОтгрузкуДата: string | null;
  ПунктНазначения?: string | null;
}

// ============================================
// ФУНКЦИЯ ДЛЯ ОТСЛЕЖИВАНИЯ НОВЫХ ОТГРУЗОК
// ============================================



async function checkNewShipmentStarts(shipmentsData: ShipmentItem[]) {
  try {
    // Получаем уже отправленные уведомления
    const sentNotifications = await db
      .select()
      .from(shipmentStartNotifications);

    const sentRequestNumbers = new Set(sentNotifications.map(n => n.request_number));

    // Группируем отгрузки по заявкам
    const shipmentsByRequest = new Map<string, ShipmentItem[]>();
    for (const shipment of shipmentsData) {
      const requestNumber = shipment.ЗаявкаНаОтгрузкуНомер;
      if (!requestNumber) continue;
      
      // ✅ ПРОПУСКАЕМ, ЕСЛИ УВЕДОМЛЕНИЕ УЖЕ ОТПРАВЛЕНО
      if (sentRequestNumbers.has(requestNumber)) continue;
      
      if (!shipmentsByRequest.has(requestNumber)) {
        shipmentsByRequest.set(requestNumber, []);
      }
      shipmentsByRequest.get(requestNumber)!.push(shipment);
    }

    // Проверяем каждую заявку
    for (const [requestNumber, requestShipments] of shipmentsByRequest) {
      // ✅ Проверяем, есть ли уже отгрузки по этой заявке в БД
      const existingShipments = await db
        .select()
        .from(shipments)
        .where(eq(shipments.clientRequestNumber, requestNumber))
        .orderBy(shipments.date);

      // Если уже есть отгрузки в БД — пропускаем
      if (existingShipments.length > 0) {
        const existingNumbers = new Set(existingShipments.map(s => s.number));
        const newNumbers = new Set(requestShipments.map(s => s.Номер));
        const hasExisting = [...existingNumbers].some(id => !newNumbers.has(id));
        if (hasExisting) continue;
      }

      // ✅ Это первая отгрузка по заявке!
      const firstShipment = requestShipments[0];
      if (!firstShipment) continue;

      // ✅ ОПРЕДЕЛЯЕМ НАЗВАНИЕ ЗАВОДА
      let factoryName = '';
      const division = firstShipment.Подразделение;
      if (division === 'Луховицы') factoryName = 'ЛХ';
      else if (division === 'Люберцы') factoryName = 'ЛЮ';
      else if (division === 'Сергиев Посад') factoryName = 'СП';
      else if (division === 'Щёлково') factoryName = 'Щ';
      else continue; // Неизвестный завод — пропускаем

      // Определяем пункт назначения
      const consignee = firstShipment.Грузополучатель || 'ПК';
      const quantity = Math.round(firstShipment.Количество || 0);

      // Формируем сообщение
      const message = {
        title: '🚀 Началась отгрузка!',
        body: `${factoryName} ${quantity} т\n${consignee}`,
        tag: `start-${requestNumber}`,
        url: '/',
      };

      // Отправляем администраторам
      const adminUsers = await db
        .select()
        .from(users)
        .where(eq(users.group_id, 1));

      for (const admin of adminUsers) {
        await sendPushNotification(admin.id, message);
      }

      // ✅ Сохраняем, что уведомление отправлено
      await db.insert(shipmentStartNotifications).values({
        request_number: requestNumber,
        sent_at: Date.now(),
        factory: factoryName,
      });

      console.log(`📤 Уведомление о начале отгрузки по заявке ${requestNumber} (${factoryName})`);
    }
  } catch (error) {
    console.error('❌ Ошибка проверки новых отгрузок:', error);
  }
}



// async function checkNewShipmentStarts(shipmentsData: ShipmentItem[]) {
//   try {
//     // Получаем уже отправленные уведомления
//     const sentNotifications = await db
//       .select()
//       .from(shipmentStartNotifications);

//     const sentRequestNumbers = new Set(sentNotifications.map(n => n.request_number));

//     // Группируем отгрузки по заявкам
//     const shipmentsByRequest = new Map<string, ShipmentItem[]>();
//     for (const shipment of shipmentsData) {
//       const requestNumber = shipment.ЗаявкаНаОтгрузкуНомер;
//       if (!requestNumber) continue;
      
//       // Пропускаем, если уведомление уже отправлено
//       if (sentRequestNumbers.has(requestNumber)) continue;
      
//       if (!shipmentsByRequest.has(requestNumber)) {
//         shipmentsByRequest.set(requestNumber, []);
//       }
//       shipmentsByRequest.get(requestNumber)!.push(shipment);
//     }

//     // Проверяем каждую заявку
//     for (const [requestNumber, requestShipments] of shipmentsByRequest) {
//       // Проверяем, есть ли уже отгрузки по этой заявке в БД
//       const existingShipments = await db
//         .select()
//         .from(shipments)
//         .where(eq(shipments.clientRequestNumber, requestNumber))
//         .orderBy(shipments.date);

//       // Если уже есть отгрузки в БД — пропускаем
//       if (existingShipments.length > 0) {
//         const existingNumbers = new Set(existingShipments.map(s => s.number));
//         const newNumbers = new Set(requestShipments.map(s => s.Номер));
//         const hasExisting = [...existingNumbers].some(id => !newNumbers.has(id));
//         if (hasExisting) continue;
//       }

//       // ✅ Это первая отгрузка по заявке!
//       const firstShipment = requestShipments[0];
//       if (!firstShipment) continue;

//       // Определяем название завода
//       let factoryName = '';
//       const division = firstShipment.Подразделение;
//       if (division === 'Луховицы') factoryName = 'ЛХ';
//       else if (division === 'Люберцы') factoryName = 'ЛЮ';
//       else if (division === 'Сергиев Посад') factoryName = 'СП';
//       else if (division === 'Щёлково') factoryName = 'Щ';
//       else continue;

//       // Определяем пункт назначения
//       const consignee = firstShipment.Грузополучатель || 'ПК';
//       const quantity = Math.round(firstShipment.Количество || 0);

//       // Формируем сообщение
//       const message = {
//         title: '🚀 Началась отгрузка!',
//         body: `${factoryName} ${quantity} т\n${consignee}`,
//         tag: `start-${requestNumber}`,
//         url: '/',
//       };

//       // Отправляем администраторам
//       const adminUsers = await db
//         .select()
//         .from(users)
//         .where(eq(users.group_id, 1));

//       for (const admin of adminUsers) {
//         await sendPushNotification(admin.id, message);
//       }

//       // Сохраняем, что уведомление отправлено
//       await db.insert(shipmentStartNotifications).values({
//         request_number: requestNumber,
//         sent_at: Date.now(),
//         factory: factoryName,
//       });

//       console.log(`📤 Уведомление о начале отгрузки по заявке ${requestNumber} (${factoryName})`);
//     }
//   } catch (error) {
//     console.error('❌ Ошибка проверки новых отгрузок:', error);
//   }
// }

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ СИНХРОНИЗАЦИИ
// ============================================

export async function GET(request: Request) {
  try {
    const UNF_BASE_URL = process.env.UNF_BASE_URL;
    const LOGIN = process.env.UNF_LOGIN;
    const PASSWORD = process.env.UNF_PASSWORD;
    
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    const response = await fetch(`${UNF_BASE_URL}/hs/WebData-API/outgoing`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: ShipmentItem[] = await response.json();
    
    let insertedCount = 0;
    let updatedCount = 0;
    
    for (const record of data) {
      const existing = await db
        .select()
        .from(shipments)
        .where(eq(shipments.number, record.Номер))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(shipments).values({
          number: record.Номер,
          date: record.Дата,
          division: record.Подразделение === 'Луховицы' ? 'ЛХ' : record.Подразделение === 'Люберцы' ? 'ЛЮ' : record.Подразделение,
          customer: record.Покупатель,
          consignee: record.Грузополучатель || null,
          material: record.Номенклатура,
          gross: record.Брутто || null,
          tara: record.Тара || null,
          quantity: record.Количество,
          driver: record.Водитель || null,
          licensePlate: record.ГосНомер || null,
          clientRequestNumber: record.ЗаявкаНаОтгрузкуНомер || null,
          clientRequestDate: record.ЗаявкаНаОтгрузкуДата || null,
          destinationPoint: record.ПунктНазначения || null,
          createdAt: Date.now(),
        });
        insertedCount++;
      } else {
        await db.update(shipments)
          .set({
            date: record.Дата,
            division: record.Подразделение === 'Луховицы' ? 'ЛХ' : record.Подразделение === 'Люберцы' ? 'ЛЮ' : record.Подразделение,
            customer: record.Покупатель,
            consignee: record.Грузополучатель || null,
            material: record.Номенклатура,
            gross: record.Брутто || null,
            tara: record.Тара || null,
            quantity: record.Количество,
            driver: record.Водитель || null,
            licensePlate: record.ГосНомер || null,
            clientRequestNumber: record.ЗаявкаНаОтгрузкуНомер || null,
            clientRequestDate: record.ЗаявкаНаОтгрузкуДата || null,
            createdAt: Date.now(),
          })
          .where(eq(shipments.number, record.Номер));
        updatedCount++;
      }
    }
    
    // ✅ Проверяем новые отгрузки и отправляем уведомления
    if (insertedCount > 0 || updatedCount > 0) {
      await checkNewShipmentStarts(data);
    }
    
    fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({
      lastSync: new Date().toISOString(),
      totalRecords: data.length,
      newRecords: insertedCount,
      updatedRecords: updatedCount,
    }));
    
    return NextResponse.json({
      success: true,
      total: data.length,
      newRecords: insertedCount,
      updatedRecords: updatedCount,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}






// // app/api/cron-shipments/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { shipments } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';
// import fs from 'fs';
// import path from 'path';

// const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync-shipments.json');

// interface ShipmentItem {
//   Подразделение: string;
//   Номер: string;
//   Дата: string;
//   Покупатель: string;
//   Номенклатура: string;
//   Брутто: number;
//   Тара: number;
//   Количество: number;
//   Водитель: string;
//   ГосНомер: string;
//   Грузополучатель: string;
//   ЗаявкаНаОтгрузкуНомер: string | null;
//   ЗаявкаНаОтгрузкуДата: string | null;
//   ПунктНазначения?: string | null; // ✅ ДОБАВЛЯЕМ
// }

// export async function GET(request: Request) {

//   try {
//     const UNF_BASE_URL = process.env.UNF_BASE_URL;
//     const LOGIN = process.env.UNF_LOGIN;
//     const PASSWORD = process.env.UNF_PASSWORD;
    
//     process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
//     const response = await fetch(`${UNF_BASE_URL}/hs/WebData-API/outgoing`, {
//       headers: {
//         'Authorization': 'Basic ' + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64'),
//       },
//     });
    
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
    
//     const data: ShipmentItem[] = await response.json();
    
//     let insertedCount = 0;
//     let updatedCount = 0;
    
//     for (const record of data) {
//       const existing = await db
//         .select()
//         .from(shipments)
//         .where(eq(shipments.number, record.Номер))
//         .limit(1);
      
//       if (existing.length === 0) {
//         await db.insert(shipments).values({
//           number: record.Номер,
//           date: record.Дата,
//           division: record.Подразделение === 'Луховицы' ? 'ЛХ' : record.Подразделение === 'Люберцы' ? 'ЛЮ' : record.Подразделение,
//           customer: record.Покупатель,
//           consignee: record.Грузополучатель || null,
//           material: record.Номенклатура,
//           gross: record.Брутто || null,
//           tara: record.Тара || null,
//           quantity: record.Количество,
//           driver: record.Водитель || null,
//           licensePlate: record.ГосНомер || null,
//           clientRequestNumber: record.ЗаявкаНаОтгрузкуНомер || null,
//           clientRequestDate: record.ЗаявкаНаОтгрузкуДата || null,
//           destinationPoint: record.ПунктНазначения || null,
//           createdAt: Date.now(),
//         });
//         insertedCount++;
//       } else {
//         await db.update(shipments)
//           .set({
//             date: record.Дата,
//             division: record.Подразделение === 'Луховицы' ? 'ЛХ' : record.Подразделение === 'Люберцы' ? 'ЛЮ' : record.Подразделение,
//             customer: record.Покупатель,
//             consignee: record.Грузополучатель || null,
//             material: record.Номенклатура,
//             gross: record.Брутто || null,
//             tara: record.Тара || null,
//             quantity: record.Количество,
//             driver: record.Водитель || null,
//             licensePlate: record.ГосНомер || null,
//             clientRequestNumber: record.ЗаявкаНаОтгрузкуНомер || null,
//             clientRequestDate: record.ЗаявкаНаОтгрузкуДата || null,
//             createdAt: Date.now(),
//           })
//           .where(eq(shipments.number, record.Номер));
//         updatedCount++;
//       }
//     }
    
//     fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({
//       lastSync: new Date().toISOString(),
//       totalRecords: data.length,
//       newRecords: insertedCount,
//       updatedRecords: updatedCount,
//     }));
    
//     return NextResponse.json({
//       success: true,
//       total: data.length,
//       newRecords: insertedCount,
//       updatedRecords: updatedCount,
//       timestamp: new Date().toISOString(),
//     });
    
//   } catch (error) {
//     console.error('Cron error:', error);
//     return NextResponse.json(
//       { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
//       { status: 500 }
//     );
//   }
// }


