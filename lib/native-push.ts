// lib/native-push.ts
//
// Регистрация на push-уведомления в нативном iOS-приложении (Capacitor).
// Отдельно от app/components/PushNotifications.tsx (это Web Push/VAPID —
// работает в браузере, но НЕ работает внутри WKWebView-обёртки Capacitor).
// Тут используется нативный плагин, который говорит напрямую с APNs.
'use client';

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

let initialized = false;

async function sendTokenToServer(deviceToken: string) {
  try {
    await fetch('/api/push/register-native', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: deviceToken }),
    });
  } catch (err) {
    console.error('Не удалось отправить push-токен на сервер:', err);
  }
}

// Вызывать один раз после того, как известно, что пользователь
// авторизован (иначе /api/push/register-native ответит 401).
export async function initNativePush(): Promise<void> {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return; // в браузере/PWA не при чём — там свой Web Push
  initialized = true;

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('Разрешение на push-уведомления не получено');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      void sendTokenToServer(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
    });

    // Уведомление пришло, пока приложение открыто на переднем плане —
    // системный баннер показывается благодаря PushNotifications.presentationOptions
    // в capacitor.config.ts, тут просто логируем для отладки.
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push получен на переднем плане:', notification);
    });

    // Пользователь тапнул по уведомлению — переходим по ссылке из payload,
    // если она есть (см. lib/apns.ts, поле url).
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = (action.notification.data as { url?: string } | undefined)?.url;
      if (url) {
        window.location.href = url;
      }
    });
  } catch (err) {
    console.error('initNativePush error:', err);
  }
}
