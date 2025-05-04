import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; 
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    // --- Use the imported 'react' function (which is now plugin-react-swc) ---
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // Use manual manifest in /public
      includeAssets: ['favicon.ico', 'icons/*.png'],
      // workbox: { // Default workbox config is usually okay for app shell
      //   globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      // }
    })
  ],
  // Add any other Vite config you might have
  // server: {
  //   port: 3000
  // }
});