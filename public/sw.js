const CACHE_NAME = "arcgenda-calendar-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/arcgenda-icon-192.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.startsWith("/_next/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put("/", responseToCache);
          });
          return response;
        })
        .catch(function () {
          return caches.match("/");
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then(function (response) {
          const responseToCache = response.clone();
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(function () {
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
          return Response.error();
        });
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/calendar";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        if ("focus" in client && clientUrl.pathname === targetUrl) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});

self.addEventListener("push", function (event) {
  let payload = {
    title: "Arcgenda",
    options: {
      body: "You have a calendar reminder.",
      icon: "/icons/arcgenda-icon-192.png",
      badge: "/icons/arcgenda-icon-192.png",
      data: { url: "/calendar" },
    },
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload.options.body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(payload.title, payload.options));
});
