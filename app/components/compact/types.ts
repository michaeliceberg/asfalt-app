// app/components/compact/types.ts
import { IncomingItem, ShipmentItem } from '@/app/page';

export interface CombinedRequest {
  requestNumber: string;
  requestDate: string;
  material: string;
  planQuantity: number;
  factQuantity: number;
  consignee: string;
  division: string;
  closed: boolean | null;
  delivery_date: string | null;
  lastShipmentTime: string | null;
  lastShipmentFullDate?: string | null;
  truckCount: number;
  unit?: string;
  vehicles: VehicleItem[];
}

export interface VehicleItem {
  licensePlate: string;
  factory: string;
  quantity: number;
  time: string;
  fullDateTime?: string;
  driver?: string;
  material?: string;
  supplier?: string;
}

export interface GroupedItem {
  time: string;
  lastFullDateTime?: string;
  factQuantity: number;
  planQuantity: number;
  consignee: string;
  factories: string[];
  truckCount: number;
  material: string;
  requestNumber: string;
  requestDate: string;
  closed: boolean | null;
  supplier?: string;
  unit?: string;
  vehicles: VehicleItem[];
  vehiclesMap?: Map<string, VehicleItem>;
}

export type UnifiedDataItem = IncomingItem | ShipmentItem;