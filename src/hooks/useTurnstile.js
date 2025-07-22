import { useState, useCallback, useRef } from 'react';

const SITEKEY = 'OX4AAAAAAB19yX4ooY3T7i-e';
const TOKEN_DURATION = 4.5 * 60 * 1000; 

export const useTurnstile = () => {
  const [token, setToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  
  const hasValidToken = useCallback(() => {
    return token && tokenExpiry && Date.now() < tokenExpiry;
  }, [token, tokenExpiry]);

  const clearToken = useCallback(() => {
    setToken(null);
    setTokenExpiry(null);
  }, []);

  const onTurnstileSuccess = useCallback((receivedToken) => {
    console.log('Turnstile validation successful');
    setToken(receivedToken);
    setTokenExpiry(Date.now() + TOKEN_DURATION);
  }, []);

  const onTurnstileError = useCallback((errorCode) => {
    console.error('Turnstile validation failed:', errorCode);
    clearToken();
  }, [clearToken]);

  const getToken = useCallback(() => {
    return hasValidToken() ? token : null;
  }, [hasValidToken, token]);

  const ensureValidToken = useCallback(async (apiCall) => {
    if (hasValidToken()) {
      return apiCall(token);
    }

    console.log('Need Turnstile token for API call');
    throw new Error('Turnstile validation required');
  }, [hasValidToken, token]);

  return {
    // State
    hasValidToken: hasValidToken(),
    
    // Actions  
    ensureValidToken,
    getToken,
    clearToken,
    
    // Turnstile callbacks
    onTurnstileSuccess,
    onTurnstileError,
    
    // Config
    sitekey: SITEKEY
  };
};