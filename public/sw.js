/* Push-only service worker — no offline caching. */

self.addEventListener("push", (event) => {
  let payload = {
    title: "إشعار",
    body: "",
    url: "/notifications",
  };

  try {
    if (event.data) {
      const data = event.data.json();
      payload = {
        title: typeof data.title === "string" ? data.title : payload.title,
        body: typeof data.body === "string" ? data.body : payload.body,
        url: typeof data.url === "string" ? data.url : payload.url,
      };
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) {
        payload.body = text;
      }
    } catch {
      // keep defaults
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    "/notifications";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(targetUrl);
              return;
            } catch {
              // fall through to openWindow
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
