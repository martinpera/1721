self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: '1721', body: 'Novedades', url: 'https://1721.com.uy' };
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    data: data.url
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data || 'https://1721.com.uy';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const win = wins.find(w => w.url.startsWith(url));
      return win ? win.focus() : clients.openWindow(url);
    })
  );
});
