// Minimal service worker: caches the offline fallback page and app icons,
// and serves the fallback when a navigation request fails (e.g. no
// connectivity). Does not attempt to cache app data or API responses —
// GoHighLevel and Supabase data must always be fetched fresh.
const CACHE_NAME = "jessica-os-shell-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error())),
  );
});

// Web Push: displays a notification and, on click, deep-links into the app.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Jessica OS", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Jessica OS", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { deepLink: payload.deepLink ?? "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deepLink = event.notification.data?.deepLink ?? "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(deepLink) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(deepLink);
    }),
  );
});
