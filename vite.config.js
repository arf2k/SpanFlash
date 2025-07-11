import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa'; 

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, 
      strategies: 'injectManifest', 
      srcDir: 'src',                
      filename: 'sw.js',            
      injectManifest: {
        globPatterns: [
            '**/*.{js,css,html,svg,png,ico,webmanifest,json}'
        ],
        // globDirectory: 'dist', // Usually not needed
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit (adjust as needed)
      }
    }) 
  ], 
  server: { 
    proxy: {
      '/api': {
        target: 'https://spanflash.pages.dev', 
        changeOrigin: true, 
        secure: false, 
      }
    }
  }
});