if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    const isLocalDev =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]";

    if (isLocalDev) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (registration) {
          registration.unregister();
        });
      });

      if ("caches" in window) {
        caches.keys().then(function (keys) {
          keys.forEach(function (key) {
            caches.delete(key);
          });
        });
      }

      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(function (error) {
      console.warn("Service worker registration failed:", error);
    });
  });
}
