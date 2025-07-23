import { useState, useCallback, useRef, useEffect } from 'react';

const SITEKEY = '0x4AAAAAABl-voZH2oYZsi1W';
const TOKEN_DURATION = 4.5 * 60 * 1000; 

export const useTurnstile = () => {
     
 useEffect(() => {
    console.log('=== BROWSER ENVIRONMENT ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('Cookies enabled:', navigator.cookieEnabled);
    console.log('Turnstile script loaded:', !!window.turnstile);
    const session = localStorage.getItem('mw_session');
    console.log('Stored session:', session ? 'Yes' : 'None');
    console.log('============================');
  }, []);

  const [token, setToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [isWidgetVisible, setIsWidgetVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const pendingCallback = useRef(null);
  const widgetId = useRef(null);

  const hasValidToken = useCallback(() => {
    return token && tokenExpiry && Date.now() < tokenExpiry;
  }, [token, tokenExpiry]);

  const clearToken = useCallback(() => {
    setToken(null);
    setTokenExpiry(null);
    setError(null);
    delete window.turnstileToken;
  }, []);

  // Create stable callback functions that don't change
  const onTurnstileSuccess = useCallback((receivedToken) => {
    console.log('Turnstile validation successful, token received:', receivedToken);
    setToken(receivedToken);
    setTokenExpiry(Date.now() + TOKEN_DURATION);
    setIsWidgetVisible(false);
    setIsLoading(false);
    setError(null);

    // Store token globally for API calls
    window.turnstileToken = receivedToken;

    if (pendingCallback.current) {
      console.log('Executing pending callback');
      pendingCallback.current();
      pendingCallback.current = null;
    }
  }, []);

  const onTurnstileError = useCallback((errorCode) => {
    console.error('Turnstile validation failed:', errorCode);
    setError(`Verification failed: ${errorCode}`);
    setIsWidgetVisible(false);
    setIsLoading(false);
    clearToken();
  }, [clearToken]);

  const resetWidget = useCallback(() => {
    if (window.turnstile && widgetId.current) {
      window.turnstile.reset(widgetId.current);
    }
    setError(null);
    setIsLoading(true);
  }, []);

  const hideWidget = useCallback(() => {
    setIsWidgetVisible(false);
    setIsLoading(false);
    pendingCallback.current = null;
  }, []);

  const ensureValidToken = useCallback((callback) => {
    if (hasValidToken()) {
      callback();
      return;
    }

    console.log('Need Turnstile token for API call - showing widget');
    pendingCallback.current = callback;
    setIsWidgetVisible(true);
    setIsLoading(true);
    setError(null);
  }, [hasValidToken]);

  const getToken = useCallback(() => {
    return hasValidToken() ? token : null;
  }, [hasValidToken, token]);

  // Render widget when visible - using DIRECT function callbacks instead of strings
  useEffect(() => {
  if (isWidgetVisible && window.turnstile) {
    const container = document.querySelector('.cf-turnstile');
    if (container && !widgetId.current) {
      try {
        // Clear any existing content
        container.innerHTML = '';
        
        // Universal configuration that works across all browsers
        console.log('Rendering Turnstile widget - Universal config');
        
        widgetId.current = window.turnstile.render(container, {
          sitekey: SITEKEY,
          callback: onTurnstileSuccess,
          'error-callback': onTurnstileError,
          action: 'api-protection',
          theme: 'auto',
          size: 'normal',
          'retry': 'auto',
          'retry-interval': 8000,
          'refresh-expired': 'auto'
        });
        
        console.log('Turnstile widget rendered with ID:', widgetId.current);
        
        // Universal error handling - if widget fails, retry once
        setTimeout(() => {
          if (!widgetId.current) {
            console.log('Widget failed to initialize, retrying...');
            try {
              widgetId.current = window.turnstile.render(container, {
                sitekey: SITEKEY,
                callback: onTurnstileSuccess,
                'error-callback': onTurnstileError,
              });
            } catch (retryError) {
              console.error('Widget retry failed:', retryError);
              setError('Security verification failed to load');
            }
          }
        }, 2000);
        
      } catch (error) {
        console.error('Failed to render Turnstile widget:', error);
        setError('Failed to load verification widget');
        setIsLoading(false);
      }
    }
  }
}, [isWidgetVisible, onTurnstileSuccess, onTurnstileError]);
  // Clean up widget when hiding
  useEffect(() => {
    if (!isWidgetVisible && widgetId.current) {
      console.log('Cleaning up widget ID');
      widgetId.current = null;
    }
  }, [isWidgetVisible]);

  return {
    // State
    hasValidToken: hasValidToken(),
    isWidgetVisible,
    isLoading,
    error,
    sitekey: SITEKEY,
    
    // Actions
    ensureValidToken,
    getToken,
    clearToken,
    hideWidget,
    resetWidget,
    
    // Turnstile callbacks
    onTurnstileSuccess,
    onTurnstileError,
    
    // Widget management
    setWidgetId: (id) => { widgetId.current = id; }
  };
};