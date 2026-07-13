// app/api/trucks/route.ts
import { NextResponse } from 'next/server';
import { getTrucks } from '@/lib/trucks';
import { db } from '@/lib/db';
import { shipments, type Shipment } from '@/lib/db/schema';

const AUTH_TOKEN = 'XBNlAqRnZxU3Q%2BSLHe3qKZSIIYiSGWym3mN8%2BbXmbSZE74YqB3bYf4TLIWAzLPyg%2BR9qd2Mf9AxDn2K3f4j5lA%3D%3D';

// ============================================
// ТИПЫ
// ============================================

interface TruckPosition {
  lat: number;
  lng: number;
  vel: number;
  time: number;
}

interface TruckData {
  uid: string;
  name: string;
  position: TruckPosition | null;
  lastUpdate: string | null;
  destination: string | null;
  factory: string;
  // Тоннаж/водитель/прибытие — берём из самой свежей (по дате) отгрузки
  // этого госномера, см. plateToLatestShipment ниже. Раньше эти поля были
  // только в демо (DemoTruckColonna.tsx), в боевой карточке машины при
  // клике оставались пустыми, хотя UI их уже умел показывать.
  quantity: number | null;
  driver: string | null;
  arrived: boolean;
}

interface RouteData {
  destination: string;
  factory: string;
  count: number;
  requestNumber: string;
  totalQuantity: number;
  licensePlates: string[];
  destCoords: { lat: number; lng: number } | null;
  factoryCoords: { lat: number; lng: number } | null;
  lastShipmentDate?: string | null;
  truckTimes?: Record<string, string>; // ✅ Добавляем
  // Тоннаж/водитель/прибытие — ТОЛЬКО из отгрузок ЭТОЙ заявки (в отличие от
  // TruckData.quantity/driver/arrived выше, которые берутся по "последней
  // отгрузке этого госномера ВООБЩЕ", независимо от заявки). Один и тот же
  // госномер может отработать несколько разных заявок за день, и статус
  // "прибыл"/тоннаж от ДРУГОЙ, более свежей заявки той же машины иначе
  // "протекает" сюда — из-за этого статус на GPS-карте расходился со
  // статусом в "Компактно" (там он всегда точный — по номеру рейса).
  truckStatus?: Record<string, { quantity: number | null; driver: string | null; arrived: boolean }>;
}

interface ApiResponse {
  success: boolean;
  count: number;
  total: number;
  trucks: TruckData[];
  routes: RouteData[];
  timestamp: string;
  error?: string;
}

// ============================================
// ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ GPS-ПОЗИЦИЙ
// ============================================

async function fetchTruckPositions(allTrucks: { uid: string }[]): Promise<Record<string, TruckPosition>> {
  const url = "https://xptr.geoinformer.com/service/monitoring";

  const uidList = allTrucks.map(t => t.uid);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        idList: uidList.map(String),
        ud: AUTH_TOKEN
      }),
    });

    if (!response.ok) {
      console.error(`❌ HTTP error! status: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.positions || {};
    
  } catch (error) {
    console.error('❌ Error in fetchTruckPositions:', error);
    return {};
  }
}

// ============================================
// ФУНКЦИЯ ДЛЯ ОПРЕДЕЛЕНИЯ ЗАВОДА
// ============================================

function detectFactory(truckName: string): string {
  if (truckName.includes('ЛХ')) return 'ЛХ';
  if (truckName.includes('ЛЮ')) return 'ЛЮ';
  if (truckName.includes('СП')) return 'СП';
  return 'Щ';
}

// ============================================
// ФУНКЦИЯ ДЛЯ ПОИСКА ПОСЛЕДНЕЙ ОТГРУЗКИ
// ============================================

function findLastShipment(shipmentsList: Shipment[]): Shipment | null {
  if (shipmentsList.length === 0) return null;
  
  return shipmentsList.reduce((latest: Shipment, current: Shipment) => {
    const currentDate = new Date(current.date);
    const latestDate = new Date(latest.date);
    return currentDate > latestDate ? current : latest;
  });
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ GET
// ============================================

export async function GET() {
  try {
    console.log('🔵 Fetching truck positions...');

    // Машины теперь в БД (таблица trucks, редактируется на /admin/trucks)
    const allTrucks = await getTrucks();

    // 1. Получаем GPS-позиции
    const positions = await fetchTruckPositions(allTrucks);
    // console.log('🔵 Got positions for', Object.keys(positions).length, 'trucks');
    
    // 2. Получаем маршруты из БД
    let truckDestinations: Record<string, string> = {};
    let routes: RouteData[] = [];
    let allShipments: Shipment[] = [];
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      // Получаем маршруты
      const routesResponse = await fetch(`${baseUrl}/api/truck-routes`);
      
      if (routesResponse.ok) {
        const routesData = await routesResponse.json();
        truckDestinations = routesData.truckDestinations || {};
        routes = routesData.routes || [];
        // console.log('🔵 Got', routes.length, 'routes from API');
      } else {
        console.warn('⚠️ Failed to fetch routes, continuing without them');
      }
      
      // Получаем все отгрузки из БД
      allShipments = await db.select().from(shipments);
      
    } catch (err) {
      console.warn('⚠️ Error fetching routes:', err);
    }
    










    // // 3. Добавляем lastShipmentDate к маршрутам
    // const routesWithDates: RouteData[] = routes.map((route) => {
    //   // Находим все отгрузки для этой заявки
    //   const shipmentsForRoute = allShipments.filter(
    //     (s: Shipment) => s.clientRequestNumber === route.requestNumber
    //   );
      
    //   let lastShipmentDate: string | null = null;
      
    //   if (shipmentsForRoute.length > 0) {
    //     const lastShipment = findLastShipment(shipmentsForRoute);
    //     lastShipmentDate = lastShipment?.date || null;
    //   }
      
    //   return {
    //     ...route,
    //     lastShipmentDate: lastShipmentDate,
    //   };
    // });
    

    



    // В формировании routesWithDates добавьте информацию о машинах с временем отгрузки
const routesWithDates: RouteData[] = routes.map((route) => {
  // Находим все отгрузки для этой заявки
  const shipmentsForRoute = allShipments.filter(
    (s: Shipment) => s.clientRequestNumber === route.requestNumber
  );
  
  // Создаём маппинг номеров машин -> время отгрузки
  const truckTimes: Record<string, string> = {};
  shipmentsForRoute.forEach((s: Shipment) => {
    if (s.licensePlate) {
      const normalizedPlate = s.licensePlate
        .toUpperCase()
        .replace(/\s/g, '')
        .replace(/[^A-Z0-9]/g, '');
      // Сохраняем время отгрузки (дата из 1С)
      truckTimes[normalizedPlate] = s.date;
    }
  });
  
  let lastShipmentDate: string | null = null;
  if (shipmentsForRoute.length > 0) {
    // ✅ Исправляем: используем правильную типизацию без any
    let latest = shipmentsForRoute[0];
    for (let i = 1; i < shipmentsForRoute.length; i++) {
      const current = shipmentsForRoute[i];
      const currentDate = new Date(current.date);
      const latestDate = new Date(latest.date);
      if (currentDate > latestDate) {
        latest = current;
      }
    }
    lastShipmentDate = latest?.date || null;
  }

  // Статус машины В РАМКАХ ЭТОЙ ЗАЯВКИ — если у одного госномера несколько
  // отгрузок внутри одной и той же заявки (редко, но бывает), берём самую
  // свежую ИЗ НИХ, а не вообще самую свежую отгрузку этого номера по всей
  // базе (см. комментарий у truckStatus в RouteData выше).
  const latestPerPlateInRoute: Record<string, Shipment> = {};
  shipmentsForRoute.forEach((s: Shipment) => {
    if (!s.licensePlate) return;
    const normalizedPlate = s.licensePlate.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
    const existing = latestPerPlateInRoute[normalizedPlate];
    if (!existing || new Date(s.date) > new Date(existing.date)) {
      latestPerPlateInRoute[normalizedPlate] = s;
    }
  });
  const truckStatus: Record<string, { quantity: number | null; driver: string | null; arrived: boolean }> = {};
  Object.entries(latestPerPlateInRoute).forEach(([plate, s]) => {
    truckStatus[plate] = {
      quantity: s.quantity ?? null,
      driver: s.driver ?? null,
      arrived: s.arrived ?? false,
    };
  });

  return {
    ...route,
    lastShipmentDate: lastShipmentDate,
    truckTimes: truckTimes, // ✅ Добавляем время отгрузки для каждой машины
    truckStatus: truckStatus,
  };
});










    // console.log('🔵 Routes with dates:', routesWithDates.length);

    // Самая свежая (по дате) отгрузка на каждый госномер — источник
    // тоннажа/водителя/статуса "прибыл" для карточки машины на карте.
    // Один и тот же госномер может встречаться в нескольких отгрузках за
    // день (разные заявки), поэтому берём именно последнюю по дате — это
    // и есть текущий/последний известный рейс этой машины.
    const plateToLatestShipment: Record<string, Shipment> = {};
    for (const s of allShipments) {
      if (!s.licensePlate) continue;
      const normalizedPlate = s.licensePlate.toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9]/g, '');
      const existing = plateToLatestShipment[normalizedPlate];
      if (!existing || new Date(s.date) > new Date(existing.date)) {
        plateToLatestShipment[normalizedPlate] = s;
      }
    }

    // 4. Формируем результат
    const result: TruckData[] = allTrucks.map(truck => {
      const pos = positions[truck.uid];

      // Нормализуем номер для поиска в truckDestinations
      const normalizedName = truck.name
        .toUpperCase()
        .replace(/\s/g, '')
        .replace(/[^A-Z0-9]/g, '');

      const destination = truckDestinations[normalizedName] || null;
      const factory = detectFactory(truck.name);
      const latestShipment = plateToLatestShipment[normalizedName];

      return {
        uid: truck.uid,
        name: truck.name,
        position: pos || null,
        lastUpdate: pos ? new Date(pos.time * 1000).toISOString() : null,
        destination: destination,
        quantity: latestShipment?.quantity ?? null,
        driver: latestShipment?.driver ?? null,
        arrived: latestShipment?.arrived ?? false,
        factory: factory,
      };
    });

    const activeCount = result.filter(t => t.position !== null).length;
    // console.log(`🔵 ${activeCount} trucks active out of ${result.length}`);

    const response: ApiResponse = {
      success: true,
      count: activeCount,
      total: result.length,
      trucks: result,
      routes: routesWithDates,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error fetching truck positions:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to fetch truck positions',
      trucks: [],
      routes: [],
      count: 0,
      total: 0,
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}








// // app/api/trucks/route.ts
// import { NextResponse } from 'next/server';
// import { TRUCKS } from '@/lib/trucks';

// const AUTH_TOKEN = 'XBNlAqRnZxU3Q%2BSLHe3qKZSIIYiSGWym3mN8%2BbXmbSZE74YqB3bYf4TLIWAzLPyg%2BR9qd2Mf9AxDn2K3f4j5lA%3D%3D';

// // ============================================
// // ТИПЫ
// // ============================================

// interface TruckPosition {
//   lat: number;
//   lng: number;
//   vel: number;
//   time: number;
// }

// interface TruckData {
//   uid: string;
//   name: string;
//   position: TruckPosition | null;
//   lastUpdate: string | null;
//   destination: string | null;
//   factory: string;
// }

// interface RouteData {
//   destination: string;
//   factory: string;
//   count: number;
//   requestNumber: string;
//   totalQuantity: number;
//   licensePlates: string[];
//   destCoords: { lat: number; lng: number } | null;
//   factoryCoords: { lat: number; lng: number } | null;
// }

// interface ApiResponse {
//   success: boolean;
//   count: number;
//   total: number;
//   trucks: TruckData[];
//   routes: RouteData[];
//   timestamp: string;
//   error?: string;
// }

// // ============================================
// // ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ GPS-ПОЗИЦИЙ
// // ============================================

// async function fetchTruckPositions(): Promise<Record<string, TruckPosition>> {
//   const url = "https://xptr.geoinformer.com/service/monitoring";
  
//   const uidList = TRUCKS.map(t => t.uid);
  
//   try {
//     const response = await fetch(url, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Accept': 'application/json',
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
//       },
//       body: JSON.stringify({
//         idList: uidList.map(String),
//         ud: AUTH_TOKEN
//       }),
//     });

//     if (!response.ok) {
//       console.error(`❌ HTTP error! status: ${response.status}`);
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const data = await response.json();
//     return data.positions || {};
    
//   } catch (error) {
//     console.error('❌ Error in fetchTruckPositions:', error);
//     return {};
//   }
// }

// // ============================================
// // ФУНКЦИЯ ДЛЯ ОПРЕДЕЛЕНИЯ ЗАВОДА
// // ============================================

// function detectFactory(truckName: string): string {
//   if (truckName.includes('ЛХ')) return 'ЛХ';
//   if (truckName.includes('ЛЮ')) return 'ЛЮ';
//   if (truckName.includes('СП')) return 'СП';
//   return 'Щ';
// }

// // ============================================
// // ОСНОВНАЯ ФУНКЦИЯ GET
// // ============================================

// export async function GET() {
//   try {
//     console.log('🔵 Fetching truck positions...');
    
//     // 1. Получаем GPS-позиции
//     const positions = await fetchTruckPositions();
//     console.log('🔵 Got positions for', Object.keys(positions).length, 'trucks');
    
//     // 2. Получаем маршруты из БД
//     let truckDestinations: Record<string, string> = {};
//     let routes: RouteData[] = []; // ← Типизированный массив
    
//     try {
//       const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
//       const routesResponse = await fetch(`${baseUrl}/api/truck-routes`);
      
//       if (routesResponse.ok) {
//         const routesData = await routesResponse.json();
//         truckDestinations = routesData.truckDestinations || {};
//         routes = routesData.routes || [];
//       } else {
//         console.warn('⚠️ Failed to fetch routes, continuing without them');
//       }
//     } catch (err) {
//       console.warn('⚠️ Error fetching routes:', err);
//     }
    
//     // 3. Формируем результат
//     const result: TruckData[] = TRUCKS.map(truck => {
//       const pos = positions[truck.uid];
      
//       // Нормализуем номер для поиска в truckDestinations
//       const normalizedName = truck.name
//         .toUpperCase()
//         .replace(/\s/g, '')
//         .replace(/[^A-Z0-9]/g, '');
      
//       const destination = truckDestinations[normalizedName] || null;
//       const factory = detectFactory(truck.name);
      
//       return {
//         uid: truck.uid,
//         name: truck.name,
//         position: pos || null,
//         lastUpdate: pos ? new Date(pos.time * 1000).toISOString() : null,
//         destination: destination,
//         factory: factory,
//       };
//     });

//     const activeCount = result.filter(t => t.position !== null).length;
//     console.log(`🔵 ${activeCount} trucks active out of ${result.length}`);

//     const response: ApiResponse = {
//       success: true,
//       count: activeCount,
//       total: result.length,
//       trucks: result,
//       routes: routes,
//       timestamp: new Date().toISOString(),
//     };

//     return NextResponse.json(response);

//   } catch (error) {
//     console.error('❌ Error fetching truck positions:', error);
    
//     const errorResponse: ApiResponse = {
//       success: false,
//       error: 'Failed to fetch truck positions',
//       trucks: [],
//       routes: [],
//       count: 0,
//       total: 0,
//       timestamp: new Date().toISOString(),
//     };
    
//     return NextResponse.json(errorResponse, { status: 500 });
//   }
// }






// // export async function GET() {
// //   try {
// //     const positions = await fetchTruckPositions();
    
// //     const result = TRUCKS.map(truck => {
// //       const pos = positions[truck.uid];
// //       return {
// //         uid: truck.uid,
// //         name: truck.name,
// //         position: pos || null,
// //         lastUpdate: pos ? new Date(pos.time * 1000).toISOString() : null,
// //       };
// //     });

// //     return NextResponse.json({
// //       success: true,
// //       count: result.filter(t => t.position !== null).length,
// //       total: result.length,
// //       trucks: result,
// //       timestamp: new Date().toISOString(),
// //     });

// //   } catch (error) {
// //     console.error('❌ Error fetching truck positions:', error);
// //     return NextResponse.json(
// //       { success: false, error: 'Failed to fetch truck positions' },
// //       { status: 500 }
// //     );
// //   }
// // }

// // async function fetchTruckPositions() {
// //   const url = "https://xptr.geoinformer.com/service/monitoring";
  
// //   const uidList = TRUCKS.map(t => t.uid);
  
// //   const response = await fetch(url, {
// //     method: 'POST',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       'Accept': 'application/json',
// //       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
// //     },
// //     body: JSON.stringify({
// //       idList: uidList.map(String),
// //       ud: AUTH_TOKEN
// //     }),
// //   });

// //   if (!response.ok) {
// //     throw new Error(`HTTP error! status: ${response.status}`);
// //   }

// //   const data = await response.json();
// //   return data.positions || {};
// // }





// // // app/api/trucks/route.ts
// // import { NextResponse } from 'next/server';

// // // Типы
// // interface TruckPosition {
// //   lat: number;
// //   lng: number;
// //   vel: number;
// //   time: number;
// // }

// // interface TruckInfo {
// //   uid: string;
// //   name: string;
// //   position: TruckPosition | null;
// //   lastUpdate: string | null;
// // }

// // // Токен авторизации (из вашего кода)
// // const AUTH_TOKEN = 'XBNlAqRnZxU3Q%2BSLHe3qKZSIIYiSGWym3mN8%2BbXmbSZE74YqB3bYf4TLIWAzLPyg%2BR9qd2Mf9AxDn2K3f4j5lA%3D%3D';

// // // Список машин (из вашего кода)
// // const TRUCKS = [
// //   { uid: "25611", name: "А546МК" },
// //   { uid: "23587", name: "О009УХ" },
// //   { uid: "23543", name: "А534НН" },
// //   { uid: "24049", name: "Е602СТ" },
// //   { uid: "25733", name: "С285ВН790" },
// //   { uid: "25620", name: "М473АУ790" },
// //   { uid: "25622", name: "М549АУ790" },
// //   { uid: "25736", name: "Е654РС790" },
// //   { uid: "25623", name: "М609АУ790" },
// //   { uid: "25737", name: "У003ВК790" },
// //   // ... добавляем остальные машины из listUidName
// // ];

// // export async function GET() {
// //   try {
// //     const positions = await fetchTruckPositions();
    
// //     // Формируем ответ
// //     const result: TruckInfo[] = TRUCKS.map(truck => {
// //       const pos = positions[truck.uid];
// //       return {
// //         uid: truck.uid,
// //         name: truck.name,
// //         position: pos || null,
// //         lastUpdate: pos ? new Date(pos.time * 1000).toISOString() : null,
// //       };
// //     });

// //     return NextResponse.json({
// //       success: true,
// //       count: result.filter(t => t.position !== null).length,
// //       total: result.length,
// //       trucks: result,
// //       timestamp: new Date().toISOString(),
// //     });

// //   } catch (error) {
// //     console.error('❌ Error fetching truck positions:', error);
// //     return NextResponse.json(
// //       { success: false, error: 'Failed to fetch truck positions' },
// //       { status: 500 }
// //     );
// //   }
// // }

// // // Функция запроса к API геолокации
// // async function fetchTruckPositions(): Promise<Record<string, TruckPosition>> {
// //   const url = "https://xptr.geoinformer.com/service/monitoring";
  
// //   const uidList = TRUCKS.map(t => t.uid);
  
// //   const payload = JSON.stringify({
// //     idList: uidList,
// //     ud: AUTH_TOKEN
// //   });

// //   const response = await fetch(url, {
// //     method: 'POST',
// //     headers: {
// //       'Content-Type': 'application/json',
// //       'Accept': 'application/json',
// //       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
// //     },
// //     body: payload,
// //   });

// //   if (!response.ok) {
// //     throw new Error(`HTTP error! status: ${response.status}`);
// //   }

// //   const data = await response.json();
// //   return data.positions || {};
// // }