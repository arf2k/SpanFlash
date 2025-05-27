// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa'; // Should be v0.21.0+

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // --- Core PWA Options ---
      registerType: 'autoUpdate',
      manifest: false, // Use manual manifest in /public

      // --- Strategy Configuration ---
      strategies: 'injectManifest', // Use custom SW
      srcDir: 'src',                // Location of sw.js
      filename: 'sw.js',            // Name of sw.js

      // --- injectManifest Options ---
      injectManifest: {
        // This tells Workbox to scan the output directory (dist)
        // and include files matching these patterns in the precache manifest
        // that gets injected into self.__WB_MANIFEST in src/sw.js
        globPatterns: [
            '**/*.{js,css,html,svg,png,ico,webmanifest,json}' // Include common types
        ],
        // Optional: If your public assets aren't being picked up, explicitly set globDirectory
        // globDirectory: 'dist', // Usually not needed if Vite output is standard 'dist'

        // Optional: Limit max size for precached files if needed
        // maximumFileSizeToCacheInBytes: 3000000,
      }
      // --- End injectManifest Options ---

      // --- REMOVED workbox & includeAssets ---
      // These are not used with injectManifest strategy

    }) // End VitePWA
  ], // End plugins

  // --- Add this server configuration block for the proxy ---
  server: {
    proxy: {
      // Proxy requests from /api (made by your PWA running on localhost)
      // to your deployed Cloudflare Pages Function URL
      '/api': {
        target: 'https://spanflash.pages.dev', // Your Cloudflare Pages domain
        changeOrigin: true, // Important for virtual hosted sites & proper proxying
        secure: false,      // Set to false if your target (spanflash.pages.dev) uses HTTPS and you sometimes have issues with local SSL certs.
                            // Cloudflare Pages uses valid HTTPS, so true or omitting secure (defaults to true for https targets) is usually fine.
                            // If you encounter proxy errors locally, toggling this can sometimes help.
        // rewrite: (path) => path.replace(/^\/api/, '/api') // Usually not needed if the path on the target is the same
                                                            // e.g., /api/tatoeba-proxy on localhost becomes 
                                                            // https://spanflash.pages.dev/api/tatoeba-proxy
      }
    }
  }
  // --- End server configuration block ---

}); // End defineConfig