// capacitor.config.ts
//
// Спайк: оборачиваем уже работающий сайт (server.url), а не пытаемся
// собрать Next.js в статический экспорт — у приложения есть API-роуты,
// крон и сервер-сайд рендеринг, которые статикой не заменить. WebView
// внутри нативной оболочки просто открывает боевой сайт — как PWA на
// главном экране, но уже в реальном App Store/Play Store приложении, с
// доступом к нативным API (push, биометрия и т.д.) через плагины.
//
// bundleId ("appId" ниже) — легко поменять в любой момент, не привязан
// ни к чему до момента реальной публикации в App Store Connect.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.abziceberg.abzcontrol',
  appName: 'АБЗ Контроль',
  webDir: 'public', // Capacitor требует webDir, но в server.url-режиме он не используется как основной источник
  server: {
    url: 'https://abziceberg.ru',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
