import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions, users } from './db/schema';
import { eq } from 'drizzle-orm';

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

export async function sendPushNotification(
  userId: number,
  notification: PushNotification
) {
  if (!vapidConfigured) {
    return { sent: 0 };
  }
  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.user_id, userId));

    if (subscriptions.length === 0) {
      console.log(`No subscriptions found for user ${userId}`);
      return { sent: 0 };
    }

    let sent = 0;
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
        if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        }
      }
    }

    return { sent, total: subscriptions.length };
  } catch (error) {
    console.error('Send notification error:', error);
    return { sent: 0, total: 0 };
  }
}

export async function sendToAdmins(notification: PushNotification) {
  try {
    console.log('🔵 sendToAdmins called');
    
    const adminSubscriptions = await db
      .select()
      .from(pushSubscriptions)
      .innerJoin(users, eq(users.id, pushSubscriptions.user_id))
      .where(eq(users.group_id, 1));

    console.log(`🔵 Найдено ${adminSubscriptions.length} подписок админов`);

    let sent = 0;
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
        if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 410) {
          console.log(`🗑️ Удаляем невалидную подписку`);
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.push_subscriptions.endpoint));
        }
      }
    }

    return { sent };
  } catch (error) {
    console.error('Send to admins error:', error);
    return { sent: 0 };
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
