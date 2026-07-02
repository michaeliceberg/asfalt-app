// public/sw.js

self.addEventListener('install', (event) => {
  console.log('🔵 Service Worker installed');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('🔵 Service Worker activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('🔵 Push event received', event);
  
  let data = {};
  
  try {
    // Пытаемся распарсить JSON
    data = event.data?.json() || {};
  } catch (e) {
    // Если не JSON — используем текст
    const text = event.data?.text() || '';
    data = {
      title: 'Уведомление',
      body: text || 'Новое уведомление',
    };
  }
  
  const options = {
    body: data.body || 'Новое уведомление',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-192x192.png',
    vibrate: [200, 100, 200, 100, 300],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [
      {
        action: 'view',
        title: '👀 Посмотреть',
      },
    ],
    requireInteraction: true,
    tag: data.tag || 'default',
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'АБЗ Контроль', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('🔵 Notification clicked', event);
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});






// // public/sw.js

// self.addEventListener('install', (event) => {
//   console.log('🔵 Service Worker installed');
//   event.waitUntil(self.skipWaiting());
// });

// self.addEventListener('activate', (event) => {
//   console.log('🔵 Service Worker activated');
//   event.waitUntil(self.clients.claim());
// });

// self.addEventListener('push', (event) => {
//   console.log('🔵 Push event received', event);
  
//   const data = event.data?.json() || {};
  
//   const options = {
//     body: data.body || 'Новое уведомление',
//     icon: '/icon-192x192.png',
//     badge: '/icon-192x192.png',
//     vibrate: [200, 100, 200, 100, 300],
//     data: {
//       url: data.url || '/',
//     },
//     actions: data.actions || [
//       {
//         action: 'view',
//         title: '👀 Посмотреть',
//       },
//     ],
//     requireInteraction: true,
//     tag: data.tag || 'default',
//   };

//   event.waitUntil(
//     self.registration.showNotification(data.title || 'АБЗ Контроль', options)
//   );
// });

// self.addEventListener('notificationclick', (event) => {
//   console.log('🔵 Notification clicked', event);
//   event.notification.close();
  
//   const url = event.notification.data?.url || '/';
  
//   event.waitUntil(
//     clients.matchAll({ type: 'window' }).then((windowClients) => {
//       for (const client of windowClients) {
//         if (client.url === url && 'focus' in client) {
//           return client.focus();
//         }
//       }
//       if (clients.openWindow) {
//         return clients.openWindow(url);
//       }
//     })
//   );
// });
