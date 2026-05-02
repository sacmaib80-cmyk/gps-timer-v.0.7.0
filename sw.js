const CACHE_NAME = "sakuraq-v0-11-4";

const APP_SHELL = [
  "/index.html",
  "/manifest.webmanifest",
  "/logo-192.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if(event.data?.type === "SKIP_WAITING"){
    self.skipWaiting();
  }

  if(event.data?.type === "SCHEDULE_NOTIFICATION"){
    const { title, body, delayMs, tag } = event.data;

    setTimeout(async () => {
      const clientList = await self.clients.matchAll({ type: "window" });
      const isVisible = clientList.some(c => c.visibilityState === "visible");

      if(!isVisible){
        self.registration.showNotification(title, {
          body,
          icon: "./logo-192.png",
          tag: tag || "sakuraq-quest-done",
          requireInteraction: true,
          vibrate: [200, 100, 200]
        });
      }
    }, delayMs);
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

const url = new URL(req.url);

if (url.protocol !== "http:" && url.protocol !== "https:") return;
if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put("/index.html", clone).catch(() => {});
          });
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        if (!res || res.status !== 200) return res;

        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, clone).catch((err) => {
            console.error("[SW] cache.put failed:", err);
          });
        });

        return res;
      });
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow("/index.html");
      }

      return Promise.resolve();
    })
  );
});
