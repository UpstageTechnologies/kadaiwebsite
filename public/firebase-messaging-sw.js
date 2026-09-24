/* Firebase Web Messaging background worker. Runtime config is supplied by the app registration URL. */
importScripts("https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js");

const config = Object.fromEntries(new URL(self.location.href).searchParams.entries());

firebase.initializeApp(config);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload?.data || {};
  const notification = payload?.notification || {};
  const title = data.title || notification.title || "Kadai order update";
  const body = data.body || notification.body || "Your order status has changed.";
  const orderId = String(data.orderId || "");

  self.registration.showNotification(title, {
    body,
    data: {
      orderId,
      status: String(data.status || ""),
      screen: String(data.screen || "TrackOrderScreen"),
    },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const orderId = event.notification.data?.orderId;
  const targetPath = orderId
    ? `/track-order/${encodeURIComponent(orderId)}`
    : "/orders";
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const existingClient = windowClients.find((client) => "focus" in client);
      if (existingClient) {
        existingClient.navigate(targetUrl);
        return existingClient.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});
