import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, shipments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isConcreteMaterial } from '@/lib/utils';

// ============================================
// ТИПЫ
// ============================================

interface VehicleData {
  time: string;
  fullDateTime: string;
  licensePlate: string;
  driver: string;
  quantity: number;
}

interface ShipmentDataType {
  factQuantity: number;
  truckCount: number;
  uniqueTrucks: Set<string>;
  lastTime: Date | null;
  lastDate: Date | null;
  vehicles: VehicleData[];
}

interface OutgoingRequestData {
  id: number;
  number: string;
  date: string;
  division: string;
  customer: string;
  consignee: string | null;
  material: string;
  quantity: number;
  closed: boolean | null;
  delivery_date: string | null;
}

// ============================================
// ФУНКЦИИ
// ============================================

// Функция для парсинга русской даты
function parseRussianDate(dateString: string): Date {
  if (!dateString) return new Date();
  
  if (dateString.includes('T') && !dateString.includes('.')) {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;
  }
  
  const parts = dateString.split(' ');
  const dateParts = parts[0].split('.');
  
  let hour = 0, minute = 0;
  if (parts[1]) {
    const timeParts = parts[1].split(':');
    hour = parseInt(timeParts[0], 10);
    minute = parseInt(timeParts[1], 10);
  }
  
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const year = parseInt(dateParts[2], 10);
  
  return new Date(year, month, day, hour, minute);
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ GET
// ============================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let factory = searchParams.get('factory');
    
    if (factory) {
      try {
        factory = decodeURIComponent(factory);
      } catch (e) {
        // ignore decode error
      }
    }
    
    const validFactories = ['СП', 'Щ'];
    if (!factory || !validFactories.includes(factory)) {
      return NextResponse.json({ error: 'Invalid factory' }, { status: 400 });
    }
    
    console.log(`Processing factory: ${factory}`);
    
    // Получаем заявки для указанного завода
    const requests = await db.select()
      .from(outgoingRequests)
      .where(eq(outgoingRequests.division, factory));
    
    // Получаем отгрузки для указанного завода
    const allShipments = await db.select()
      .from(shipments)
      .where(eq(shipments.division, factory));
    
    // Группируем отгрузки по номеру заявки
    const shipmentsByRequest = new Map<string, ShipmentDataType>();
    
    for (const shipment of allShipments) {
      const requestNumber = shipment.clientRequestNumber;
      if (!requestNumber) continue;
      
      if (!shipmentsByRequest.has(requestNumber)) {
        shipmentsByRequest.set(requestNumber, {
          factQuantity: 0,
          truckCount: 0,
          uniqueTrucks: new Set(),
          lastTime: null,
          lastDate: null,
          vehicles: []
        });
      }
      
      const data = shipmentsByRequest.get(requestNumber)!;
      data.factQuantity += shipment.quantity;
      
      if (shipment.licensePlate) {
        data.uniqueTrucks.add(shipment.licensePlate);
      }
      
      const shipmentDate = parseRussianDate(shipment.date);
      if (!data.lastTime || shipmentDate > data.lastTime) {
        data.lastTime = shipmentDate;
        data.lastDate = shipmentDate;
      }
      
      const hours = shipmentDate.getHours();
      const minutes = shipmentDate.getMinutes();
      const timeOnly = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const fullDateTime = `${shipmentDate.getDate().toString().padStart(2, '0')}.${(shipmentDate.getMonth() + 1).toString().padStart(2, '0')}.${shipmentDate.getFullYear()} ${timeOnly}`;
      
      data.vehicles.push({
        time: timeOnly,
        fullDateTime: fullDateTime,
        licensePlate: shipment.licensePlate || '—',
        driver: shipment.driver || '—',
        quantity: shipment.quantity,  // уже в м³
      });
      
      data.truckCount = data.vehicles.length;
    }
    
    // Формируем результат
    const result = requests.map((req: OutgoingRequestData) => {
      const shipmentData = shipmentsByRequest.get(req.number) || {
        factQuantity: 0,
        truckCount: 0,
        uniqueTrucks: new Set(),
        lastTime: null,
        lastDate: null,
        vehicles: []
      };
      
      // Определяем, является ли материал бетоном
      const isConcrete = isConcreteMaterial(req.material);
      
      // Конвертируем ТОЛЬКО план (тонны → кубометры)
      // Факт уже в кубометрах, его не трогаем
      let planQuantity = req.quantity;
      const factQuantity = shipmentData.factQuantity;  // уже в м³, не делим
      
      if (isConcrete) {
        planQuantity = req.quantity / 2.4;  // только план переводим
        // factQuantity оставляем как есть
      }
      
      let lastShipmentTime = null;
      let lastShipmentFullDate = null;
      let effectiveDeliveryDate = req.delivery_date;
      
      if (shipmentData.lastTime && !isNaN(shipmentData.lastTime.getTime())) {
        const hours = shipmentData.lastTime.getHours();
        const minutes = shipmentData.lastTime.getMinutes();
        lastShipmentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        lastShipmentFullDate = `${shipmentData.lastTime.getDate().toString().padStart(2, '0')}.${(shipmentData.lastTime.getMonth() + 1).toString().padStart(2, '0')}.${shipmentData.lastTime.getFullYear()}`;
        effectiveDeliveryDate = lastShipmentFullDate;
      }
      
      return {
        requestNumber: req.number,
        requestDate: req.date,
        material: req.material,
        planQuantity: parseFloat(planQuantity.toFixed(1)),
        factQuantity: parseFloat(factQuantity.toFixed(1)),
        consignee: req.consignee || req.customer,
        division: req.division,
        closed: req.closed,
        delivery_date: effectiveDeliveryDate,
        lastShipmentTime: lastShipmentTime,
        lastShipmentFullDate: lastShipmentFullDate,
        truckCount: shipmentData.truckCount,
        vehicles: shipmentData.vehicles.map((v: VehicleData) => ({
          ...v,
          quantity: v.quantity  // уже в м³, не делим
        })),
        unit: isConcrete ? 'м³' : 'т',
      };
    });
    
    // Сортируем по дате доставки (новые сверху)
    result.sort((a, b) => {
      const dateA = a.delivery_date ? parseRussianDate(a.delivery_date) : new Date(0);
      const dateB = b.delivery_date ? parseRussianDate(b.delivery_date) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Combined requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}





// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { outgoingRequests, shipments } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';
// import { isConcreteMaterial } from '@/lib/utils';

// // ============================================
// // ТИПЫ
// // ============================================

// interface VehicleData {
//   time: string;
//   fullDateTime: string;
//   licensePlate: string;
//   driver: string;
//   quantity: number;
// }

// interface ShipmentDataType {
//   factQuantity: number;
//   truckCount: number;
//   uniqueTrucks: Set<string>;
//   lastTime: Date | null;
//   lastDate: Date | null;
//   vehicles: VehicleData[];
// }

// interface OutgoingRequestData {
//   id: number;
//   number: string;
//   date: string;
//   division: string;
//   customer: string;
//   consignee: string | null;
//   material: string;
//   quantity: number;
//   closed: boolean | null;
//   delivery_date: string | null;
// }

// // ============================================
// // ФУНКЦИИ
// // ============================================

// // Функция для парсинга русской даты
// function parseRussianDate(dateString: string): Date {
//   if (!dateString) return new Date();
  
//   if (dateString.includes('T') && !dateString.includes('.')) {
//     const date = new Date(dateString);
//     if (!isNaN(date.getTime())) return date;
//   }
  
//   const parts = dateString.split(' ');
//   const dateParts = parts[0].split('.');
  
//   let hour = 0, minute = 0;
//   if (parts[1]) {
//     const timeParts = parts[1].split(':');
//     hour = parseInt(timeParts[0], 10);
//     minute = parseInt(timeParts[1], 10);
//   }
  
//   const day = parseInt(dateParts[0], 10);
//   const month = parseInt(dateParts[1], 10) - 1;
//   const year = parseInt(dateParts[2], 10);
  
//   return new Date(year, month, day, hour, minute);
// }

// // ============================================
// // ОСНОВНАЯ ФУНКЦИЯ GET
// // ============================================

// export async function GET(request: Request) {
//   try {
//     const { searchParams } = new URL(request.url);
//     let factory = searchParams.get('factory');
    
//     if (factory) {
//       try {
//         factory = decodeURIComponent(factory);
//       } catch (e) {
//         // ignore decode error
//       }
//     }
    
//     const validFactories = ['СП', 'Щ'];
//     if (!factory || !validFactories.includes(factory)) {
//       return NextResponse.json({ error: 'Invalid factory' }, { status: 400 });
//     }
    
//     console.log(`Processing factory: ${factory}`);
    
//     // Получаем заявки для указанного завода
//     const requests = await db.select()
//       .from(outgoingRequests)
//       .where(eq(outgoingRequests.division, factory));
    
//     // Получаем отгрузки для указанного завода
//     const allShipments = await db.select()
//       .from(shipments)
//       .where(eq(shipments.division, factory));
    
//     // Группируем отгрузки по номеру заявки
//     const shipmentsByRequest = new Map<string, ShipmentDataType>();
    
//     for (const shipment of allShipments) {
//       const requestNumber = shipment.clientRequestNumber;
//       if (!requestNumber) continue;
      
//       if (!shipmentsByRequest.has(requestNumber)) {
//         shipmentsByRequest.set(requestNumber, {
//           factQuantity: 0,
//           truckCount: 0,
//           uniqueTrucks: new Set(),
//           lastTime: null,
//           lastDate: null,
//           vehicles: []
//         });
//       }
      
//       const data = shipmentsByRequest.get(requestNumber)!;
//       data.factQuantity += shipment.quantity;
      
//       if (shipment.licensePlate) {
//         data.uniqueTrucks.add(shipment.licensePlate);
//       }
      
//       const shipmentDate = parseRussianDate(shipment.date);
//       if (!data.lastTime || shipmentDate > data.lastTime) {
//         data.lastTime = shipmentDate;
//         data.lastDate = shipmentDate;
//       }
      
//       const hours = shipmentDate.getHours();
//       const minutes = shipmentDate.getMinutes();
//       const timeOnly = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
//       const fullDateTime = `${shipmentDate.getDate().toString().padStart(2, '0')}.${(shipmentDate.getMonth() + 1).toString().padStart(2, '0')}.${shipmentDate.getFullYear()} ${timeOnly}`;
      
//       data.vehicles.push({
//         time: timeOnly,
//         fullDateTime: fullDateTime,
//         licensePlate: shipment.licensePlate || '—',
//         driver: shipment.driver || '—',
//         quantity: shipment.quantity,
//       });
      
//       data.truckCount = data.vehicles.length;
//     }
    
//     // Формируем результат
//     const result = requests.map((req: OutgoingRequestData) => {
//       const shipmentData = shipmentsByRequest.get(req.number) || {
//         factQuantity: 0,
//         truckCount: 0,
//         uniqueTrucks: new Set(),
//         lastTime: null,
//         lastDate: null,
//         vehicles: []
//       };
      
//       // Определяем, является ли материал бетоном
//       const isConcrete = isConcreteMaterial(req.material);
      
//       // Конвертация тонн в кубометры для бетона (1 м³ = 2.4 т)
//       let planQuantity = req.quantity;
//       let factQuantity = shipmentData.factQuantity;
      
//       if (isConcrete) {
//         planQuantity = req.quantity / 2.4;
//         factQuantity = shipmentData.factQuantity / 2.4;
//       }
      
//       let lastShipmentTime = null;
//       let lastShipmentFullDate = null;
//       let effectiveDeliveryDate = req.delivery_date;
      
//       if (shipmentData.lastTime && !isNaN(shipmentData.lastTime.getTime())) {
//         const hours = shipmentData.lastTime.getHours();
//         const minutes = shipmentData.lastTime.getMinutes();
//         lastShipmentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
//         lastShipmentFullDate = `${shipmentData.lastTime.getDate().toString().padStart(2, '0')}.${(shipmentData.lastTime.getMonth() + 1).toString().padStart(2, '0')}.${shipmentData.lastTime.getFullYear()}`;
//         effectiveDeliveryDate = lastShipmentFullDate;
//       }
      
//       return {
//         requestNumber: req.number,
//         requestDate: req.date,
//         material: req.material,
//         planQuantity: parseFloat(planQuantity.toFixed(1)),
//         factQuantity: parseFloat(factQuantity.toFixed(1)),
//         consignee: req.consignee || req.customer,
//         division: req.division,
//         closed: req.closed,
//         delivery_date: effectiveDeliveryDate,
//         lastShipmentTime: lastShipmentTime,
//         lastShipmentFullDate: lastShipmentFullDate,
//         truckCount: shipmentData.truckCount,
//         vehicles: shipmentData.vehicles.map((v: VehicleData) => ({
//           ...v,
//           quantity: isConcrete ? v.quantity / 2.4 : v.quantity
//         })),
//         unit: isConcrete ? 'м³' : 'т',
//       };
//     });
    
//     // Сортируем по дате доставки (новые сверху)
//     result.sort((a, b) => {
//       const dateA = a.delivery_date ? parseRussianDate(a.delivery_date) : new Date(0);
//       const dateB = b.delivery_date ? parseRussianDate(b.delivery_date) : new Date(0);
//       return dateB.getTime() - dateA.getTime();
//     });
    
//     return NextResponse.json(result);
//   } catch (error) {
//     console.error('Combined requests error:', error);
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//   }
// }





// // app/api/combined-request/route.ts

// import { NextResponse } from 'next/server';
// import { db } from '@/lib/db';
// import { outgoingRequests, shipments } from '@/lib/db/schema';
// import { eq } from 'drizzle-orm';
// import { isConcreteMaterial, parseRussianDate } from '@/lib/utils';


// // В начале файла app/api/combined-request/route.ts, после импортов

// interface VehicleData {
//   time: string;
//   fullDateTime: string;
//   licensePlate: string;
//   driver: string;
//   quantity: number;
// }

// interface ShipmentDataType {
//   factQuantity: number;
//   truckCount: number;
//   uniqueTrucks: Set<string>;
//   lastTime: Date | null;
//   lastDate: Date | null;
//   vehicles: VehicleData[];
// }


// export async function GET(request: Request) {
//   try {
//     const { searchParams } = new URL(request.url);
//     let factory = searchParams.get('factory');
    
//     if (factory) {
//       try {
//         factory = decodeURIComponent(factory);
//       } catch (e) {}
//     }
    
//     const validFactories = ['СП', 'Щ'];
//     if (!factory || !validFactories.includes(factory)) {
//       return NextResponse.json({ error: 'Invalid factory' }, { status: 400 });
//     }
    
//     console.log(`Processing factory: ${factory}`);
    
//     // Получаем заявки для указанного завода
//     const requests = await db.select()
//       .from(outgoingRequests)
//       .where(eq(outgoingRequests.division, factory));
    
//     // Получаем отгрузки для указанного завода
//     const allShipments = await db.select()
//       .from(shipments)
//       .where(eq(shipments.division, factory));
    
//     // Группируем отгрузки по номеру заявки
//     const shipmentsByRequest = new Map();
//     for (const shipment of allShipments) {
//       const requestNumber = shipment.clientRequestNumber;
//       if (!requestNumber) continue;
      
//       if (!shipmentsByRequest.has(requestNumber)) {
//         shipmentsByRequest.set(requestNumber, {
//           factQuantity: 0,
//           truckCount: 0,
//           uniqueTrucks: new Set(),
//           lastTime: null,
//           lastDate: null,
//           vehicles: []
//         });
//       }
      
//       const data = shipmentsByRequest.get(requestNumber);
//       data.factQuantity += shipment.quantity;
      
//       if (shipment.licensePlate) {
//         data.uniqueTrucks.add(shipment.licensePlate);
//       }
      
//       const shipmentDate = parseRussianDate(shipment.date);
//       if (!data.lastTime || shipmentDate > data.lastTime) {
//         data.lastTime = shipmentDate;
//         data.lastDate = shipmentDate;
//       }
      
//       const hours = shipmentDate.getHours();
//       const minutes = shipmentDate.getMinutes();
//       const timeOnly = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
//       const fullDateTime = `${shipmentDate.getDate().toString().padStart(2, '0')}.${(shipmentDate.getMonth() + 1).toString().padStart(2, '0')}.${shipmentDate.getFullYear()} ${timeOnly}`;
      
//       data.vehicles.push({
//         time: timeOnly,
//         fullDateTime: fullDateTime,
//         licensePlate: shipment.licensePlate || '—',
//         driver: shipment.driver || '—',
//         quantity: shipment.quantity,
//       });
      
//       // data.truckCount = data.uniqueTrucks.size;
//       data.truckCount = data.vehicles.length; 
//     }
    
//   // Формируем результат
// // const result = requests.map(req => {
// //   const shipmentData = shipmentsByRequest.get(req.number) || {
// //     factQuantity: 0,
// //     truckCount: 0,
// //     lastTime: null,
// //     lastDate: null,
// //     vehicles: []
// //   };
  
// //   // Автоматическая конвертация кг в тонны
// //   let planQuantity = req.quantity;
// //   if (planQuantity > 1000 && !isConcreteMaterial(req.material)) {
// //     planQuantity = planQuantity / 1000;
// //   }
  
// //   let lastShipmentTime = null;
// //   let lastShipmentFullDate = null;
// //   let effectiveDeliveryDate = req.delivery_date;
  
// //   if (shipmentData.lastTime && !isNaN(shipmentData.lastTime.getTime())) {
// //     const hours = shipmentData.lastTime.getHours();
// //     const minutes = shipmentData.lastTime.getMinutes();
// //     lastShipmentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
// //     lastShipmentFullDate = `${shipmentData.lastTime.getDate().toString().padStart(2, '0')}.${(shipmentData.lastTime.getMonth() + 1).toString().padStart(2, '0')}.${shipmentData.lastTime.getFullYear()}`;
// //     effectiveDeliveryDate = lastShipmentFullDate;
// //   }
  
// //   return {
// //     requestNumber: req.number,
// //     requestDate: req.date,
// //     material: req.material,
// //     planQuantity: parseFloat(planQuantity.toFixed(1)),
// //     factQuantity: parseFloat(shipmentData.factQuantity.toFixed(1)),
// //     consignee: req.consignee || req.customer,
// //     division: req.division,
// //     closed: req.closed,
// //     delivery_date: effectiveDeliveryDate,
// //     lastShipmentTime: lastShipmentTime,
// //     lastShipmentFullDate: lastShipmentFullDate,
// //     truckCount: shipmentData.truckCount,
// //     vehicles: shipmentData.vehicles,
// //     unit: isConcreteMaterial(req.material) ? 'м³' : 'т',
// //   };
// // });


// // Найдите функцию GET и внутри неё, где формируется result:

// const result = requests.map(req => {
//   const shipmentData = shipmentsByRequest.get(req.number) || {
//     factQuantity: 0,
//     truckCount: 0,
//     lastTime: null,
//     lastDate: null,
//     vehicles: []
//   };
  
//   // === ДОБАВЬТЕ ЭТУ КОНВЕРТАЦИЮ ===
//   const isConcrete = isConcreteMaterial(req.material);
  
//   let planQuantity = req.quantity;
//   let factQuantity = shipmentData.factQuantity;
  
//   if (isConcrete) {
//     planQuantity = req.quantity / 2.4;      // тонны → м³
//     factQuantity = shipmentData.factQuantity / 2.4;
//   }
//   // ================================
  
//   let lastShipmentTime = null;
//   let lastShipmentFullDate = null;
//   let effectiveDeliveryDate = req.delivery_date;
  
//   if (shipmentData.lastTime && !isNaN(shipmentData.lastTime.getTime())) {
//     const hours = shipmentData.lastTime.getHours();
//     const minutes = shipmentData.lastTime.getMinutes();
//     lastShipmentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
//     lastShipmentFullDate = `${shipmentData.lastTime.getDate().toString().padStart(2, '0')}.${(shipmentData.lastTime.getMonth() + 1).toString().padStart(2, '0')}.${shipmentData.lastTime.getFullYear()}`;
//     effectiveDeliveryDate = lastShipmentFullDate;
//   }
  
//   return {
//     requestNumber: req.number,
//     requestDate: req.date,
//     material: req.material,
//     planQuantity: parseFloat(planQuantity.toFixed(1)),
//     factQuantity: parseFloat(factQuantity.toFixed(1)),
//     consignee: req.consignee || req.customer,
//     division: req.division,
//     closed: req.closed,
//     delivery_date: effectiveDeliveryDate,
//     lastShipmentTime: lastShipmentTime,
//     lastShipmentFullDate: lastShipmentFullDate,
//     truckCount: shipmentData.truckCount,
//     vehicles: shipmentData.vehicles.map((v: any) => ({
//       ...v,
//       quantity: isConcrete ? v.quantity / 2.4 : v.quantity
//     })),
//     unit: isConcrete ? 'м³' : 'т',
//   };
// });





    
//     // Сортируем по дате доставки (новые сверху)
//     result.sort((a, b) => {
//       const dateA = a.delivery_date ? parseRussianDate(a.delivery_date) : new Date(0);
//       const dateB = b.delivery_date ? parseRussianDate(b.delivery_date) : new Date(0);
//       return dateB.getTime() - dateA.getTime();
//     });
    
//     return NextResponse.json(result);
//   } catch (error) {
//     console.error('Combined requests error:', error);
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//   }
// }


