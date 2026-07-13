// instrumentation.ts
//
// Точка входа Next.js, которая выполняется один раз при старте серверного
// процесса (у нас это pm2 → npm start → next start). Используем её, чтобы
// поднять geofence-воркер (алерт "машина заехала на дорогу к весовой
// рамке") — он должен жить постоянно, независимо от того, открыта ли у
// кого-то вкладка в браузере.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startGeofenceWorker } = await import('./lib/geofence-worker');
    startGeofenceWorker();
  }
}
