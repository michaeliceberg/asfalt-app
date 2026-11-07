// scripts/calc-distances.ts
//
// Раньше крон раз в 5 минут считал расстояния по текущей позиции машины.
// Теперь это делает lib/gps-recorder.ts внутри сервера каждую минуту по
// истории GPS (lib/nav.ts). Скрипт оставлен для ручного прогона разбора:
//   npx tsx scripts/calc-distances.ts
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.production' });
loadEnv({ path: '.env' });

async function main() {
  const { processNavigation } = await import('../lib/nav');
  const r = await processNavigation();
  console.log(`✅ Найдено доставок: ${r.deliveries}, рейсов с карьера: ${r.quarry}`);
}

main().catch(console.error);
