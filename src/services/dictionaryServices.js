import axios from "axios";

const MW_PROXY_PATH = "/api/mw-dictionary-proxy";

// Timeout configuration
const REQUEST_TIMEOUT_MS = 6000;
const SLOW_REQUEST_THRESHOLD_MS = 3000;

// Session management
let currentSessionToken = null;
let sessionExpiresAt = null;

// Session token management
function getStoredSession() {
  try {
    const stored = localStorage.getItem('mw_session');
    if (stored) {
      const session = JSON.parse(stored);
      if (Date.now() < session.expiresAt) {
        currentSessionToken = session.token;
        sessionExpiresAt = session.expiresAt;
        return session;
      } else {
        // Session expired, clear it
        localStorage.removeItem('mw_session');
        currentSessionToken = null;
        sessionExpiresAt = null;
      }
    }
  } catch (error) {
    console.warn('Error loading stored session:', error);
    localStorage.removeItem('mw_session');
  }
  return null;
}

function storeSession(token, expiresAt) {
  try {
    const session = { token, expiresAt };
    localStorage.setItem('mw_session', JSON.stringify(session));
    currentSessionToken = token;
    sessionExpiresAt = expiresAt;
    console.log(`Session stored, expires at ${new Date(expiresAt)}`);
  } catch (error) {
    console.warn('Error storing session:', error);
  }
}

function clearSession() {
  localStorage.removeItem('mw_session');
  currentSessionToken = null;
  sessionExpiresAt = null;
  console.log('Session cleared');
}

function hasValidSession() {
  if (!currentSessionToken || !sessionExpiresAt) {
    return false;
  }
  return Date.now() < sessionExpiresAt;
}

// Initialize session on module load
getStoredSession();

/**
 * Fetches definition and usage examples for a Spanish word/phrase
 * by calling your Cloudflare Pages Function proxy for the Merriam-Webster API.
 * @param {string} spanishWord - The word or phrase to look up.
 * @param {Function} onSlowRequest - callback called if request is taking longer than threshold
 * @param {string} turnstileToken - Turnstile token for API protection (fallback when no session)
 * @returns {Promise<object|null>} A promise that resolves to the API response data
 * or null if an error occurs.
 */
export const getMwHint = async (
  spanishWord,
  onSlowRequest = null,
  turnstileToken = null
) => {
  if (
    !spanishWord ||
    typeof spanishWord !== "string" ||
    spanishWord.trim() === ""
  ) {
    console.error("getMwHint: Spanish word is empty or invalid.");
    return null;
  }

  const wordToLookup = spanishWord.trim();
  const proxyUrl = `${MW_PROXY_PATH}?word=${encodeURIComponent(wordToLookup)}`;

  console.log(`Calling MW Proxy for hint: ${proxyUrl}`);

  // Determine authentication strategy
  const session = hasValidSession();
  const authHeaders = {};
  
  if (session) {
    console.log('Using existing session token for MW API call');
    authHeaders["CF-Session-Token"] = currentSessionToken;
  } else if (turnstileToken) {
    console.log('Using Turnstile token for MW API call');
    authHeaders["CF-Turnstile-Response"] = turnstileToken;
  } else {
    throw new Error('Either valid session or Turnstile token required for API access');
  }

  // Set up slow request timer
  let slowRequestTimer = null;
  if (onSlowRequest) {
    slowRequestTimer = setTimeout(() => {
      console.log(
        `MW request for "${wordToLookup}" is taking longer than ${SLOW_REQUEST_THRESHOLD_MS}ms`
      );
      onSlowRequest();
    }, SLOW_REQUEST_THRESHOLD_MS);
  }

  try {
    const response = await axios.get(proxyUrl, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    if (slowRequestTimer) {
      clearTimeout(slowRequestTimer);
    }

    console.log("Response from MW Proxy:", response.data);

    // Handle session info from response
    if (response.data && response.data._proxy && response.data._proxy.session) {
      const sessionInfo = response.data._proxy.session;
      
      if (sessionInfo.isNew) {
        console.log('New session created by server');
      }
      
      // Store/update session token
      storeSession(sessionInfo.token, sessionInfo.expiresAt);
    }

    // Handle API errors
    if (response.data && response.data.error) {
      // Check if it's a session-related error
      if (response.data.error === "Security Validation Failed" || 
          response.data.error === "Security Validation Required") {
        console.log('Session validation failed, clearing stored session');
        clearSession();
        
        // If we were using a session token, this indicates session expired
        // The calling code should retry with Turnstile token
        if (session && !turnstileToken) {
          return {
            error: true,
            type: "session_expired",
            message: "Session expired, please refresh",
            word: wordToLookup,
            needsTurnstile: true
          };
        }
      }
      
      console.error(
        `Error from MW Proxy Function: ${
          response.data.details || response.data.error
        }`
      );
      return {
        error: true,
        type: "api_error",
        message: response.data.details || response.data.error,
        word: wordToLookup
      };
    }

    return response.data;
  } catch (error) {
    if (slowRequestTimer) {
      clearTimeout(slowRequestTimer);
    }

    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      console.error(
        `MW API request timed out after ${REQUEST_TIMEOUT_MS}ms for "${wordToLookup}"`
      );

      return {
        error: true,
        type: "timeout",
        message: `Dictionary lookup timed out after ${
          REQUEST_TIMEOUT_MS / 1000
        } seconds`,
        word: wordToLookup,
      };
    }

    console.error(
      `Error fetching hint via proxy for "${wordToLookup}":`,
      error.message
    );

    if (error.response) {
      console.error("MW Proxy Error Response Data:", error.response.data);
      console.error("MW Proxy Error Response Status:", error.response.status);

      // Handle authentication errors
      if (error.response.status === 403) {
        console.log('Authentication failed, clearing session');
        clearSession();
        
        // Return specific error for session expiry
        if (session && !turnstileToken) {
          return {
            error: true,
            type: "session_expired",
            message: "Session expired, please refresh",
            word: wordToLookup,
            needsTurnstile: true
          };
        }
        
        return {
          error: true,
          type: "auth_error",
          message: "Authentication required",
          word: wordToLookup,
          needsTurnstile: true
        };
      }

      if (error.response.status >= 500) {
        return {
          error: true,
          type: "server_error",
          message: "Dictionary service temporarily unavailable",
          word: wordToLookup,
        };
      } else if (error.response.status === 404) {
        return {
          error: true,
          type: "not_found",
          message: "Word not found in dictionary",
          word: wordToLookup,
        };
      }
    } else if (error.request) {
      console.error(
        "MW Proxy: No response received for the request."
      );
      return {
        error: true,
        type: "network_error",
        message: "Network error occurred",
        word: wordToLookup,
      };
    } else {
      console.error("MW Proxy: Request setup error:", error.message);
      return {
        error: true,
        type: "request_error",
        message: "Failed to make request",
        word: wordToLookup,
      };
    }

    return null;
  }
};

// Export session management functions for use by other modules
export const sessionManager = {
  hasValidSession,
  clearSession,
  getSessionInfo: () => ({
    token: currentSessionToken,
    expiresAt: sessionExpiresAt,
    isValid: hasValidSession()
  })
};