// src/sw.js

// --- Imports ---
// Import Workbox core utilities
import { clientsClaim, skipWaiting } from 'workbox-core';
// Import Pre-caching functions
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
// Import Routing functions
import { registerRoute, NavigationRoute } from 'workbox-routing';
// Import Caching Strategies
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
// Import Cache Expiration and Cacheable Response plugins
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Log to confirm this full script is executing
console.log('[SW] Custom Service Worker script executing (Full Version).');

// --- Basic Lifecycle ---
// Force activation and take control immediately
skipWaiting();
clientsClaim();

// --- Pre-caching ---
// Clean up old caches from previous Workbox versions
cleanupOutdatedCaches();
// Pre-cache assets injected by vite-plugin-pwa (placeholder is self.__WB_MANIFEST)
precacheAndRoute(self.__WB_MANIFEST);

// --- Runtime Caching Rules ---



// Rule 2: Cache Google Fonts Stylesheets using StaleWhileRevalidate
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// Rule 3: Cache Google Fonts Webfonts using CacheFirst
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 30, // Cache up to 30 font files
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// Rule 4: Basic Navigation Route for SPAs (Optional but Recommended)
// Uncomment if needed
// registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// --- Activation Log ---
// Add a listener just to log activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event fired (Full Version)!');
});