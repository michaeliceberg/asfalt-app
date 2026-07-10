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
  plugins: {
    // В server.url-режиме экран приложения грузит удалённый сайт по сети —
    // без сплэша при холодном старте (особенно на плохом интернете) был бы
    // белый экран на секунду-две. ВАЖНО: launchAutoHide не умеет ждать
    // окончания загрузки WebView сам по себе — он просто прячет сплэш через
    // launchShowDuration миллисекунд после старта. Раньше здесь стояло 0 —
    // это по факту выключало сплэш (прятался мгновенно). Ставим фиксированную
    // паузу, которая с запасом перекрывает типичное время загрузки страницы.
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#fafaf8',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    // Без этого push-уведомление, пришедшее пока приложение открыто
    // на переднем плане, никак не показывалось бы пользователю — просто
    // тихо долетало бы до JS-слушателя. С presentationOptions iOS покажет
    // системный баннер/значок/звук так же, как если бы приложение было
    // свёрнуто.
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
