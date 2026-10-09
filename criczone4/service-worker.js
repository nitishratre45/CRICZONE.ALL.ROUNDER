self.addEventListener("install",event=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
// Keep streaming, media and API requests untouched.
