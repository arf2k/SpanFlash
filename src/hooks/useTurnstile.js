import { useState, useCallback, useRef, useEffect } from 'react';

const SITEKEY = '0x4AAAAAABl9yX4ooY3T7i-e';
const TOKEN_DURATION = 4.5 * 60 * 1000; 

export const useTurnstile = () => {
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

  const onTurnstileSuccess = useCallback((receivedToken) => {
    console.log('Turnstile validation successful');
    setToken(receivedToken);
    setTokenExpiry(Date.now() + TOKEN_DURATION);
    setIsWidgetVisible(false);
    setIsLoading(false);
    setError(null);

    // Store token globally for API calls
    window.turnstileToken = receivedToken;

    if (pendingCallback.current) {
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

  // Set up global callbacks ONCE and keep them stable
  useEffect(() => {
    window.onTurnstileSuccess = (token) => {
      console.log('Global callback triggered with token');
      // Find the current onTurnstileSuccess function and call it
      setToken(token);
      setTokenExpiry(Date.now() + TOKEN_DURATION);
      setIsWidgetVisible(false);
      setIsLoading(false);
      setError(null);
      window.turnstileToken = token;
      
      // Execute pending callback if exists
      if (pendingCallback.current) {
        pendingCallback.current();
        pendingCallback.current = null;
      }
    };
    
    window.onTurnstileError = (errorCode) => {
      console.log('Global error callback triggered:', errorCode);
      setError(`Verification failed: ${errorCode}`);
      setIsWidgetVisible(false);
      setIsLoading(false);
      setToken(null);
      setTokenExpiry(null);
      delete window.turnstileToken;
    };

    return () => {
      delete window.onTurnstileSuccess;
      delete window.onTurnstileError;
      delete window.turnstileToken;
    };
  }, []); // Empty dependency array - callbacks set up once and never change

  // Render widget when visible
  useEffect(() => {
    if (isWidgetVisible && window.turnstile) {
      const container = document.querySelector('.cf-turnstile');
      if (container && !widgetId.current) {
        try {
          // Clear any existing content
          container.innerHTML = '';
          
          // Make sure callbacks are available before rendering
          if (!window.onTurnstileSuccess || !window.onTurnstileError) {
            console.error('Turnstile callbacks not ready');
            return;
          }
          
          widgetId.current = window.turnstile.render(container, {
            sitekey: SITEKEY,
            callback: 'onTurnstileSuccess',
            'error-callback': 'onTurnstileError',
            action: 'api-protection',
            theme: 'auto',
            size: 'normal',
          });
          
          console.log('Turnstile widget rendered with ID:', widgetId.current);
        } catch (error) {
          console.error('Failed to render Turnstile widget:', error);
          setError('Failed to load verification widget');
          setIsLoading(false);
        }
      }
    }
  }, [isWidgetVisible]);

  // Clean up widget when hiding
  useEffect(() => {
    if (!isWidgetVisible && widgetId.current) {
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