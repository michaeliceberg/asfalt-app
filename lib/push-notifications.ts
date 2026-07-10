import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions, apnsTokens, users } from './db/schema';
import { eq } from 'drizzle-orm';
import { sendApnsNotification, isDeadApnsToken, apnsConfigured } from './apns';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const vapidConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:your-email@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn('⚠️ VAPID-ключи не заданы — push-уведомления отключены');
}

// Подписка мертва навсегда и её нужно удалить, если push-сервис отвечает:
// 410 Gone — пользователь сам отписался/сбросил разрешение в браузере
// 401/403 — ключ не подходит к этой подписке (например, VapidPkHashMismatch
// после смены VAPID-ключей на сервере) — тоже никогда не заработает повторно
function isDeadSubscriptionError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return false;
  const statusCode = (error as { statusCode: number }).statusCode;
  return statusCode === 410 || statusCode === 401 || statusCode === 403;
}

interface PushNotification {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

// Отправка в нативное iOS-приложение (APNs) для одного пользователя.
// Вынесено отдельно, чтобы использовать и в sendPushNotification, и в
// sendToAdmins — без дублирования цикла с удалением мёртвых токенов.
async function sendApnsToUser(
  userId: number,
  notification: PushNotification
): Promise<number> {
  if (!apnsConfigured) return 0;

  const tokens = await db
    .select()
    .from(apnsTokens)
    .where(eq(apnsTokens.user_id, userId));

  let sent = 0;
  for (const t of tokens) {
    const result = await sendApnsNotification(t.device_token, {
      title: notification.title,
      body: notification.body,
      url: notification.url,
    });
    if (result.ok) {
      sent++;
    } else {
      console.error(`Failed to send APNs to ${t.device_token.slice(0, 12)}...:`, result.reason);
      if (isDeadApnsToken(result)) {
        console.log(`🗑️ Удаляем невалидный APNs-токен (${t.device_token.slice(0, 12)}...)`);
        await db.delete(apnsTokens).where(eq(apnsTokens.device_token, t.device_token));
      }
    }
  }
  return sent;
}

export async function sendPushNotification(
  userId: number,
  notification: PushNotification
) {
  let sent = 0;
  let total = 0;

  if (vapidConfigured) {
    try {
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.user_id, userId));

      total += subscriptions.length;

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        url: notification.url || '/',
        tag: notification.tag || 'default',
        icon: notification.icon || '/icon-192x192.png',
        badge: notification.badge || '/icon-192x192.png',
        actions: notification.actions || [
          {
            action: 'view',
            title: '👀 Посмотреть',
          },
        ],
      });

      for (const sub of subscriptions) {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(pushSubscription, payload);
          sent++;
        } catch (error: unknown) {
          console.error(`Failed to send to ${sub.endpoint}:`, error);
          if (isDeadSubscriptionError(error)) {
            console.log(`🗑️ Удаляем невалидную подписку (${sub.endpoint.slice(0, 50)}...)`);
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.endpoint, sub.endpoint));
          }
        }
      }
    } catch (error) {
      console.error('Send notification error:', error);
    }
  }

  try {
    sent += await sendApnsToUser(userId, notification);
  } catch (error) {
    console.error('Send APNs notification error:', error);
  }

  return { sent, total };
}

export async function sendToAdmins(notification: PushNotification) {
  let sent = 0;

  try {
    console.log('🔵 sendToAdmins called');

    if (vapidConfigured) {
      const adminSubscriptions = await db
        .select()
        .from(pushSubscriptions)
        .innerJoin(users, eq(users.id, pushSubscriptions.user_id))
        .where(eq(users.group_id, 1));

      console.log(`🔵 Найдено ${adminSubscriptions.length} web push-подписок админов`);

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        url: notification.url || '/',
        tag: notification.tag || 'alert',
        icon: notification.icon || '/icon-192x192.png',
        badge: notification.badge || '/icon-192x192.png',
        actions: notification.actions || [
          {
            action: 'view',
            title: '👀 Посмотреть',
          },
        ],
      });

      for (const sub of adminSubscriptions) {
        try {
          const pushSubscription = {
            endpoint: sub.push_subscriptions.endpoint,
            keys: {
              p256dh: sub.push_subscriptions.p256dh,
              auth: sub.push_subscriptions.auth,
            },
          };

          console.log(`🔵 Отправка на ${sub.push_subscriptions.endpoint.slice(0, 50)}...`);

          await webpush.sendNotification(pushSubscription, payload);
          sent++;
          console.log(`✅ Успешно отправлено!`);
        } catch (error: unknown) {
          console.error(`❌ Ошибка отправки:`, error);
          if (isDeadSubscriptionError(error)) {
            console.log(`🗑️ Удаляем невалидную подписку`);
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.endpoint, sub.push_subscriptions.endpoint));
          }
        }
      }
    }

    if (apnsConfigured) {
      const adminApnsTokens = await db
        .select()
        .from(apnsTokens)
        .innerJoin(users, eq(users.id, apnsTokens.user_id))
        .where(eq(users.group_id, 1));

      console.log(`🔵 Найдено ${adminApnsTokens.length} APNs-токенов админов`);

      for (const row of adminApnsTokens) {
        const result = await sendApnsNotification(row.apns_tokens.device_token, {
          title: notification.title,
          body: notification.body,
          url: notification.url,
        });
        if (result.ok) {
          sent++;
        } else {
          console.error(`❌ Ошибка отправки APNs:`, result.reason);
          if (isDeadApnsToken(result)) {
            await db
              .delete(apnsTokens)
              .where(eq(apnsTokens.device_token, row.apns_tokens.device_token));
          }
        }
      }
    }

    return { sent };
  } catch (error) {
    console.error('Send to admins error:', error);
    return { sent };
  }
}




// export async function sendToAdmins(notification: PushNotification) {
//   try {
//     const adminSubscriptions = await db
//       .select()
//       .from(pushSubscriptions)
//       .innerJoin(users, eq(users.id, pushSubscriptions.user_id))
//       .where(eq(users.group_id, 1));

//     let sent = 0;
//     const payload = JSON.stringify({
//       title: notification.title,
//       body: notification.body,
//       url: notification.url || '/',
//       tag: notification.tag || 'alert',
//       icon: notification.icon || '/icon-192x192.png',
//       badge: notification.badge || '/icon-192x192.png',
//       actions: notification.actions || [
//         {
//           action: 'view',
//           title: '👀 Посмотреть',
//         },
//       ],
//     });

//     for (const sub of adminSubscriptions) {
//       try {
//         const pushSubscription = {
//           endpoint: sub.push_subscriptions.endpoint,
//           keys: {
//             p256dh: sub.push_subscriptions.p256dh,
//             auth: sub.push_subscriptions.auth,
//           },
//         };

//         await webpush.sendNotification(pushSubscription, payload);
//         sent++;
//       } catch (error: any) {
//         console.error(`Failed to send to admin:`, error);
//         if (error.statusCode === 410) {
//           await db
//             .delete(pushSubscriptions)
//             .where(eq(pushSubscriptions.endpoint, sub.push_subscriptions.endpoint));
//         }
//       }
//     }

//     return { sent };
//   } catch (error) {
//     console.error('Send to admins error:', error);
//     return { sent: 0 };
//   }
// }
// export async function sendToAdmins(notification: PushNotification) {
//   try {
//     console.log('🔵 sendToAdmins called');
    
//     const adminSubscriptions = await db
//       .select()
//       .from(pushSubscriptions)
//       .innerJoin(users, eq(users.id, pushSubscriptions.user_id))
//       .where(eq(users.group_id, 1));

//     console.log(`🔵 Найдено ${adminSubscriptions.length} подписок админов`);

//     let sent = 0;
//     const payload = JSON.stringify({
//       title: notification.title,
//       body: notification.body,
//       url: notification.url || '/',
//       tag: notification.tag || 'alert',
//       icon: notification.icon || '/icon-192x192.png',
//       badge: notification.badge || '/icon-192x192.png',
//       actions: notification.actions || [
//         {
//           action: 'view',
//           title: '👀 Посмотреть',
//         },
//       ],
//     });

//     for (const sub of adminSubscriptions) {
//       try {
//         const pushSubscription = {
//           endpoint: sub.push_subscriptions.endpoint,
//           keys: {
//             p256dh: sub.push_subscriptions.p256dh,
//             auth: sub.push_subscriptions.auth,
//           },
//         };

//         console.log(`🔵 Отправка на ${sub.push_subscriptions.endpoint.slice(0, 50)}...`);
        
//         await webpush.sendNotification(pushSubscription, payload);
//         sent++;
//         console.log(`✅ Успешно отправлено!`);
//       } catch (error: any) {
//         console.error(`❌ Ошибка отправки:`, error);
//         console.error(`❌ Статус ошибки:`, error.statusCode);
//         console.error(`❌ Сообщение:`, error.message);
//         if (error.statusCode === 410) {
//           await db
//             .delete(pushSubscriptions)
//             .where(eq(pushSubscriptions.endpoint, sub.push_subscriptions.endpoint));
//         }
//       }
//     }

//     return { sent };
//   } catch (error) {
//     console.error('Send to admins error:', error);
//     return { sent: 0 };
//   }
// }
