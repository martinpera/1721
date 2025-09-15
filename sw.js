self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>self.clients.claim());
self.addEventListener('push',e=>{
  const d=e.data?e.data.json():{title:'1721',body:'Novedades',url:'/'};
  e.waitUntil(self.registration.showNotification(d.title,{body:d.body,data:d.url}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const u=e.notification.data||'/';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    const w=ws.find(x=>x.url.startsWith(u));
    return w?w.focus():clients.openWindow(u);
  }));
});
