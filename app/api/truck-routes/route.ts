// app/api/truck-routes/route.ts
//
// Маршруты «завод → объект» по заявкам. Точка объекта: координаты из 1С
// (ПунктНазначения), иначе место, которое lib/nav.ts выучил по прошлым рейсам
// к этому получателю (у Айсберга координат в выгрузке нет), иначе старый
// справочник DESTINATIONS_FALLBACK. Для свежих заявок прикладываем roadTrack —
// реальную дорогу из последнего рейса к этому месту, карта рисует её вместо
// условной кривой.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shipments } from '@/lib/db/schema';
import { getFactoryCoords, getDestinationCoords } from '@/lib/constants';
import { loadPlaces, shipmentTarget, lastTrackToPlace } from '@/lib/nav';
import { parseRussianDate } from '@/lib/utils';

const TRACK_FOR_LAST_DAYS = 3;

export async function GET() {
  try {
    const allShipments = await db.select().from(shipments);

    const truckDestinations: Record<string, string> = {};
    const requestGroups: Record<string, {
      consignee: string;
      division: string;
      quantity: number;
      licensePlates: string[];
      destinationPoint: string | null;
      lastDate: number;
    }> = {};

    for (const shipment of allShipments) {
      const requestNumber = shipment.clientRequestNumber;
      if (!requestNumber) continue;

      if (!requestGroups[requestNumber]) {
        requestGroups[requestNumber] = {
          consignee: shipment.consignee || shipment.customer || 'Неизвестно',
          division: shipment.division,
          quantity: 0,
          licensePlates: [],
          destinationPoint: shipment.destinationPoint || null,
          lastDate: 0,
        };
      }
      const g = requestGroups[requestNumber];
      g.quantity += shipment.quantity;
      g.lastDate = Math.max(g.lastDate, parseRussianDate(shipment.date).getTime());
      if (shipment.licensePlate) g.licensePlates.push(shipment.licensePlate);
    }

    const allPlaces = await loadPlaces();
    const recentCutoff = Date.now() - TRACK_FOR_LAST_DAYS * 24 * 3600 * 1000;
    const trackCache = new Map<number, [number, number][] | null>();

    const routes = [];
    for (const [requestNumber, group] of Object.entries(requestGroups)) {
      if (group.licensePlates.length === 0) continue;

      let destCoords: { lat: number; lng: number; name: string } | null = null;
      let roadTrack: [number, number][] | null = null;

      const target = shipmentTarget(
        { destinationPoint: group.destinationPoint, consignee: group.consignee, customer: group.consignee },
        allPlaces
      );
      if (target) {
        destCoords = { lat: target.point.lat, lng: target.point.lng, name: target.name };
        if (target.place && group.lastDate >= recentCutoff) {
          if (!trackCache.has(target.place.id)) trackCache.set(target.place.id, await lastTrackToPlace(target.place.id));
          roadTrack = trackCache.get(target.place.id) ?? null;
        }
      }
      if (!destCoords) destCoords = getDestinationCoords(group.consignee);

      routes.push({
        destination: group.consignee,
        factory: group.division,
        count: [...new Set(group.licensePlates)].length,
        requestNumber,
        totalQuantity: group.quantity,
        destCoords,
        factoryCoords: getFactoryCoords(group.division),
        licensePlates: [...new Set(group.licensePlates)],
        destinationPoint: group.destinationPoint, // для отладки
        roadTrack,
      });
    }

    return NextResponse.json({
      success: true,
      routes,
      truckDestinations,
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
