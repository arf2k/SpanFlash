import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';

// --- 2. Call registerSW ---
// immediate: true asks it to check for updates immediately.
// onNeedRefresh/onOfflineReady are callbacks primarily for logging in autoUpdate mode.
const updateSW = registerSW({
 
  onNeedRefresh() {
    console.log('PWA: New content available, update is needed.');
    // In 'autoUpdate' mode, the SW will update automatically in the background.
    // You could optionally add a UI prompt here if you switch registerType later.
  },
  onOfflineReady() {
    console.log('PWA: App is ready to work offline.');
    // Called when the SW has successfully cached resources for offline use.
  },
  onRegisterError(error) {
    console.error('PWA: Service Worker registration error', error);
  }
});


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);