import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // keep runtime registration behavior
      registerType: 'autoUpdate',
      // you’re managing the manifest yourself / don’t need plugin to emit one
      manifest: false,

      // use Workbox injectManifest so your custom SW stays in control
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      // Workbox options for injectManifest
      injectManifest: {
        // Broaden to include potential .mjs outputs (harmless if none),
        // and keep existing types:
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,webmanifest,json}'],

        // Keep ignores minimal—no duplicates:
        globIgnores: ['**/node_modules/**/*', 'sw.js'],

        // Your prior value, unchanged:
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      }
    })
  ],

  // dev proxy unchanged
  server: {
    proxy: {
      '/api': {
        target: 'https://spanflash.pages.dev',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
