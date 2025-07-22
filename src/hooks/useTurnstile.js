import { useState, useCallback, useRef } from 'react';

const SITEKEY = 'OX4AAAAAAB19yX4ooY3T7i-e';
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
  }, []);

  const onTurnstileSuccess = useCallback((receivedToken) => {
    console.log('Turnstile validation successful');
    setToken(receivedToken);
    setTokenExpiry(Date.now() + TOKEN_DURATION);
    setIsWidgetVisible(false);
    setIsLoading(false);
    setError(null);

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