self.addEventListener("push", (event) => {
  const data = event.data ? event.data.text() : "Notificación de 1721";
  event.waitUntil(
    self.registration.showNotification("1721", {
      body: data,
      icon: "/logo.png"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/")
  );
});


