// app/components/compact/utils.ts
import { parseRussianDate } from '@/lib/utils';
import { VehicleItem } from './types';

export const compareDatesDesc = (dateA: string, dateB: string): number => {
  const a = parseRussianDate(dateA);
  const b = parseRussianDate(dateB);
  return b.getTime() - a.getTime();
};

export const getLatestDateTime = (group: { 
  time: string; 
  lastFullDateTime?: string; 
  vehicles: VehicleItem[] 
}): string => {
  if (group.lastFullDateTime) return group.lastFullDateTime;
  const latestVehicle = [...group.vehicles].sort((a, b) => 
    (b.fullDateTime || b.time).localeCompare(a.fullDateTime || a.time)
  );
  return latestVehicle[0]?.fullDateTime || latestVehicle[0]?.time || group.time;
};