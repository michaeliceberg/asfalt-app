import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { outgoingRequests, shipments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

function parseRussianDate(dateString: string): Date {
  if (!dateString) return new Date(0);
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

// Функция для конвертации кг в тонны
function ensureTons(value: number): number {
  // Если значение больше 1000, вероятно это килограммы
  if (value > 1000) {
    return value / 1000;
  }
  return value;
}











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
//       }
      
//       const timeStr = !isNaN(shipmentDate.getTime()) && shipmentDate.getHours() > 0
//         ? shipmentDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
//         : (shipment.date ? shipment.date.split(' ')[1]?.substring(0, 5) || '—' : '—');
      



        



//       data.vehicles.push({
//         time: timeStr,
//         licensePlate: shipment.licensePlate || '—',
//         driver: shipment.driver || '—',
//         quantity: shipment.quantity,
//       });
      
//       data.truckCount = data.uniqueTrucks.size;
//     }
    
//     // Формируем результат с конвертацией в тонны
//     const result = requests.map(req => {
//       // Конвертируем плановое количество из кг в тонны если нужно
//       let planQuantity = req.quantity;
//       if (planQuantity > 1000) {
//         planQuantity = planQuantity / 1000;
//       }
      
//       const shipmentData = shipmentsByRequest.get(req.number) || {
//         factQuantity: 0,
//         truckCount: 0,
//         lastTime: null,
//         vehicles: []
//       };
      
//       const lastTime = shipmentData.lastTime && !isNaN(shipmentData.lastTime.getTime())
//         ? shipmentData.lastTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
//         : null;
      
//       return {
//         requestNumber: req.number,
//         requestDate: req.date,
//         material: req.material,
//         planQuantity: parseFloat(planQuantity.toFixed(1)),
//         factQuantity: parseFloat(shipmentData.factQuantity.toFixed(1)),
//         consignee: req.consignee || req.customer,
//         division: req.division,
//         closed: req.closed,
//         delivery_date: req.delivery_date,
//         lastShipmentTime: lastTime,
//         truckCount: shipmentData.truckCount,
//         vehicles: shipmentData.vehicles,
//       };
//     });
    
//     // Сортируем по дате доставки (НОВЫЕ СВЕРХУ)
//     result.sort((a, b) => {
//       const dateA = a.delivery_date ? parseRussianDate(a.delivery_date) : new Date(0);
//       const dateB = b.delivery_date ? parseRussianDate(b.delivery_date) : new Date(0);
//       // Сортировка от новых к старым (b - a)
//       return dateB.getTime() - dateA.getTime();
//     });
    
//     return NextResponse.json(result);
//   } catch (error) {
//     console.error('Combined requests error:', error);
//     return NextResponse.json({ error: String(error) }, { status: 500 });
//   }
// }


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let factory = searchParams.get('factory');
    
    if (factory) {
      try {
        factory = decodeURIComponent(factory);
      } catch (e) {}
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
    const shipmentsByRequest = new Map();
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
      
      const data = shipmentsByRequest.get(requestNumber);
      data.factQuantity += shipment.quantity;
      
      if (shipment.licensePlate) {
        data.uniqueTrucks.add(shipment.licensePlate);
      }
      
      const shipmentDate = parseRussianDate(shipment.date);
      if (!data.lastTime || shipmentDate > data.lastTime) {
        data.lastTime = shipmentDate;
        // Сохраняем полную дату для группировки
        data.lastDate = shipmentDate;
      }
      
      // Форматируем время и дату
      const hours = shipmentDate.getHours();
      const minutes = shipmentDate.getMinutes();
      const timeOnly = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const fullDateTime = `${shipmentDate.getDate().toString().padStart(2, '0')}.${(shipmentDate.getMonth() + 1).toString().padStart(2, '0')}.${shipmentDate.getFullYear()} ${timeOnly}`;
      
      data.vehicles.push({
        time: timeOnly,           // только время для компактного отображения
        fullDateTime: fullDateTime, // полная дата+время для развёрнутого вида
        licensePlate: shipment.licensePlate || '—',
        driver: shipment.driver || '—',
        quantity: shipment.quantity,
      });
      
      data.truckCount = data.uniqueTrucks.size;
    }
    
    // Формируем результат
    const result = requests.map(req => {
      const shipmentData = shipmentsByRequest.get(req.number) || {
        factQuantity: 0,
        truckCount: 0,
        lastTime: null,
        lastDate: null,
        vehicles: []
      };
      
      // Форматируем время последней отгрузки (только время)
      let lastShipmentTime = null;
      let lastShipmentFullDate = null;
      if (shipmentData.lastTime && !isNaN(shipmentData.lastTime.getTime())) {
        const hours = shipmentData.lastTime.getHours();
        const minutes = shipmentData.lastTime.getMinutes();
        lastShipmentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        lastShipmentFullDate = `${shipmentData.lastTime.getDate().toString().padStart(2, '0')}.${(shipmentData.lastTime.getMonth() + 1).toString().padStart(2, '0')}.${shipmentData.lastTime.getFullYear()}`;
      }
      
      // Используем фактическую дату последней отгрузки для группировки
      const effectiveDeliveryDate = shipmentData.lastDate 
        ? `${shipmentData.lastDate.getDate().toString().padStart(2, '0')}.${(shipmentData.lastDate.getMonth() + 1).toString().padStart(2, '0')}.${shipmentData.lastDate.getFullYear()}`
        : req.delivery_date;
      
      return {
        requestNumber: req.number,
        requestDate: req.date,
        material: req.material,
        planQuantity: req.quantity,
        factQuantity: parseFloat(shipmentData.factQuantity.toFixed(1)),
        consignee: req.consignee || req.customer,
        division: req.division,
        closed: req.closed,
        delivery_date: effectiveDeliveryDate,  // ← дата для группировки (фактическая дата последней отгрузки)
        lastShipmentTime: lastShipmentTime,     // только время
        lastShipmentFullDate: lastShipmentFullDate, // полная дата
        truckCount: shipmentData.truckCount,
        vehicles: shipmentData.vehicles,
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