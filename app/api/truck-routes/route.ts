// app/api/truck-routes/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments } from '@/lib/db/schema';
import { DESTINATIONS, FACTORIES } from '@/lib/constants';



// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

export async function GET() {
  try {
    // Получаем сегодняшние отгрузки
    const todayShipments = await db
      .select()
      .from(shipments);

    // Группируем по заявкам
    const truckDestinations: Record<string, string> = {};
    const requestGroups: Record<string, { 
      consignee: string; 
      division: string; 
      quantity: number;
      licensePlates: string[];
    }> = {};

    for (const shipment of todayShipments) {
      const requestNumber = shipment.clientRequestNumber;
      if (!requestNumber) continue;
      
      const consignee = shipment.consignee || shipment.customer || 'Неизвестно';
      
      if (!requestGroups[requestNumber]) {
        requestGroups[requestNumber] = {
          consignee: consignee,
          division: shipment.division,
          quantity: 0,
          licensePlates: [],
        };
      }
      
      requestGroups[requestNumber].quantity += shipment.quantity;
      if (shipment.licensePlate) {
        requestGroups[requestNumber].licensePlates.push(shipment.licensePlate);
      }
    }

    // Для каждой машины определяем пункт назначения
    for (const [requestNumber, group] of Object.entries(requestGroups)) {
      const uniquePlates = [...new Set(group.licensePlates)];
      for (const plate of uniquePlates) {
        const normalizedPlate = plate
          .toUpperCase()
          .replace(/\s/g, '')
          .replace(/[^A-Z0-9]/g, '');
        truckDestinations[normalizedPlate] = group.consignee;
      }
    }

    // Формируем маршруты
    const routes = Object.entries(requestGroups)
      .filter(([_, group]) => group.licensePlates.length > 0)
      .map(([requestNumber, group]) => {
        const destCoords = DESTINATIONS[group.consignee] || null;
        const factoryCoords = FACTORIES[group.division as keyof typeof FACTORIES] || null;
        
        return {
          destination: group.consignee,
          factory: group.division,
          count: [...new Set(group.licensePlates)].length,
          requestNumber: requestNumber,
          totalQuantity: group.quantity,
          destCoords: destCoords,
          factoryCoords: factoryCoords,
          licensePlates: [...new Set(group.licensePlates)],
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


// // app/api/truck-routes/route.ts
// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { shipments, outgoingRequests } from '@/lib/db/schema';
// import { eq, and, desc, gte } from 'drizzle-orm';

// // ============================================
// // КООРДИНАТЫ ОБЪЕКТОВ (ДОБАВЛЯЕМ ВСЕ НЕДОСТАЮЩИЕ)
// // ============================================

// const DESTINATIONS: Record<string, { lat: number; lng: number; name: string }> = {
//   // Существующие
//   'ПК 25 Луховицкий': { lat: 54.9653, lng: 39.0269, name: 'ПК 25 Луховицкий' },
//   'ПК 25 Зарайский': { lat: 54.7625, lng: 38.8836, name: 'ПК 25 Зарайский' },
//   'ПК 25 Каширский': { lat: 54.8411, lng: 38.1653, name: 'ПК 25 Каширский' },
//   'ПК 25 Воскресенский': { lat: 55.3208, lng: 38.6525, name: 'ПК 25 Воскресенский' },
//   'ПК 25 Шатурский': { lat: 55.5775, lng: 39.5442, name: 'ПК 25 Шатурский' },
//   'ПК 25 Коломенский': { lat: 55.1028, lng: 38.7531, name: 'ПК 25 Коломенский' },
//   'ПК 25 Серпуховский': { lat: 54.9125, lng: 37.4153, name: 'ПК 25 Серпуховский' },
//   'АЙСБЕРГ ООО': { lat: 55.7585, lng: 37.6191, name: 'АЙСБЕРГ ООО' },
  
//   // ✅ НОВЫЕ ОБЪЕКТЫ (из ваших данных)
//   'ПК 26 Чеховский': { lat: 55.1522, lng: 37.4641, name: 'ПК 26 Чеховский' },
//   'ПК 26 Серпуховский': { lat: 54.9125, lng: 37.4153, name: 'ПК 26 Серпуховский' },
//   'ПК 26 Воскресенский': { lat: 55.3208, lng: 38.6525, name: 'ПК 26 Воскресенский' },
//   'ПК 26 Егорьевский': { lat: 55.3833, lng: 39.0333, name: 'ПК 26 Егорьевский' },
//   'ПК 26 Каширский': { lat: 54.8411, lng: 38.1653, name: 'ПК 26 Каширский' },
//   'ПК 26 Коломенский': { lat: 55.1028, lng: 38.7531, name: 'ПК 26 Коломенский' },
//   'ПК 26 Серебряно-Прудский': { lat: 54.4803, lng: 38.7317, name: 'ПК 26 Серебряно-Прудский' },
//   'ПК 25 Орехово-Зуевский': { lat: 55.8116, lng: 38.9622, name: 'ПК 25 Орехово-Зуевский' },
//   'ПК 25 Егорьевский': { lat: 55.3833, lng: 39.0333, name: 'ПК 25 Егорьевский' },
//   'ДКС ООО': { lat: 55.7585, lng: 37.6191, name: 'ДКС ООО' },
//   'ДМ ГРУПП ООО': { lat: 55.7585, lng: 37.6191, name: 'ДМ ГРУПП ООО' },
// };

// // Координаты заводов
// const FACTORIES = {
//   'ЛХ': { lat: 54.9653, lng: 39.0269, name: 'Луховицы' },
//   'ЛЮ': { lat: 55.6779, lng: 37.9150, name: 'Люберцы' },
//   'СП': { lat: 56.3626, lng: 38.1755, name: 'Сергиев Посад' },
//   'Щ': { lat: 55.9174, lng: 38.0283, name: 'Щёлково' },
// };

// export async function GET() {
//   try {
//     // Получаем сегодняшние отгрузки
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const todayStr = today.toISOString().split('T')[0];

//     // Получаем все отгрузки за сегодня
//     const todayShipments = await db
//       .select()
//       .from(shipments);
//       // .where(
//       //   and(
//       //     // Фильтр по дате (адаптируйте под вашу структуру)
//       //     gte(shipments.date, todayStr)
//       //   )
//       // );

//     // Группируем по заявкам
//     const truckDestinations: Record<string, string> = {};
//     const requestGroups: Record<string, { 
//       consignee: string; 
//       division: string; 
//       quantity: number;
//       licensePlates: string[];
//     }> = {};

//     for (const shipment of todayShipments) {
//       const requestNumber = shipment.clientRequestNumber;
//       if (!requestNumber) continue;
      
//       const consignee = shipment.consignee || shipment.customer || 'Неизвестно';
      
//       if (!requestGroups[requestNumber]) {
//         requestGroups[requestNumber] = {
//           consignee: consignee,
//           division: shipment.division,
//           quantity: 0,
//           licensePlates: [],
//         };
//       }
      
//       requestGroups[requestNumber].quantity += shipment.quantity;
//       if (shipment.licensePlate) {
//         requestGroups[requestNumber].licensePlates.push(shipment.licensePlate);
//       }
//     }

//     // Для каждой машины определяем пункт назначения
//     for (const [requestNumber, group] of Object.entries(requestGroups)) {
//       const uniquePlates = [...new Set(group.licensePlates)];
//       for (const plate of uniquePlates) {
//         const normalizedPlate = plate
//           .toUpperCase()
//           .replace(/\s/g, '')
//           .replace(/[^A-Z0-9]/g, '');
//         truckDestinations[normalizedPlate] = group.consignee;
//       }
//     }

//     // Формируем маршруты
//     const routes = Object.entries(requestGroups)
//       .filter(([_, group]) => group.licensePlates.length > 0)
//       .map(([requestNumber, group]) => {
//         const destCoords = DESTINATIONS[group.consignee] || null;
//         const factoryCoords = FACTORIES[group.division as keyof typeof FACTORIES] || null;
        
//         return {
//           destination: group.consignee,
//           factory: group.division,
//           count: [...new Set(group.licensePlates)].length,
//           requestNumber: requestNumber,
//           totalQuantity: group.quantity,
//           destCoords: destCoords,
//           factoryCoords: factoryCoords,
//           licensePlates: [...new Set(group.licensePlates)],
//         };
//       });

//     return NextResponse.json({
//       success: true,
//       routes: routes,
//       truckDestinations: truckDestinations,
//       timestamp: new Date().toISOString(),
//     });

//   } catch (error) {
//     console.error('❌ Error fetching truck routes:', error);
//     return NextResponse.json(
//       { success: false, error: 'Failed to fetch routes', routes: [], truckDestinations: {} },
//       { status: 500 }
//     );
//   }
// }