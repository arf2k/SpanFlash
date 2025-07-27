import axios from "axios";
// Import session management from dictionary services
import { sessionManager } from "./dictionaryServices.js";

const TATOEBA_PROXY_PATH = "/api/tatoeba-proxy";

const REQUEST_TIMEOUT_MS = 8000;
const SLOW_REQUEST_THRESHOLD_MS = 4000;

/**
 * @param {string} spanishQuery
 * @param {Function} onSlowRequest - Optional callback called if request is taking longer than threshold
 * @param {string} turnstileToken - Turnstile token for API protection (fallback when no session)
 * @returns {Promise<Array<{id_spa: number, text_spa: string, id_eng: number, text_eng: string}>>}
 * A promise that resolves to an array of example sentence pairs, or an empty array if none found/error.
 */
export const getTatoebaExamples = async (
  spanishQuery,
  onSlowRequest = null,
  turnstileToken = null
) => {
  if (
    !spanishQuery ||
    typeof spanishQuery !== "string" ||
    spanishQuery.trim() === ""
  ) {
    console.warn("getTatoebaExamples: spanishQuery is empty or invalid.");
    return [];
  }

  const params = new URLSearchParams({
    query: spanishQuery.trim(),
    from: "spa",
    to: "eng",
    orphans: "no",
    sort: "relevance",
    limit: "5",
  });

  const apiUrl = `${TATOEBA_PROXY_PATH}?${params.toString()}`;

  console.log(`Calling Tatoeba Proxy: ${apiUrl}`);

  // Determine authentication strategy (same as MW Dictionary)
  const sessionInfo = sessionManager.getSessionInfo();
  const hasValidSession = sessionInfo.isValid;
  const authHeaders = {};

  if (hasValidSession) {
    console.log("Using existing session token for Tatoeba API call");
    authHeaders["CF-Session-Token"] = sessionInfo.token;
  } else if (turnstileToken) {
    console.log("Using Turnstile token for Tatoeba API call");
    authHeaders["CF-Turnstile-Response"] = turnstileToken;
  } else {
    throw new Error(
      "Either valid session or Turnstile token required for Tatoeba API access"
    );
  }

  // Set up slow request timer
  let slowRequestTimer = null;
  if (onSlowRequest) {
    slowRequestTimer = setTimeout(() => {
      console.log(
        `Tatoeba request for "${spanishQuery}" is taking longer than ${SLOW_REQUEST_THRESHOLD_MS}ms`
      );
      onSlowRequest();
    }, SLOW_REQUEST_THRESHOLD_MS);
  }

  try {
    console.log("=== TATOEBA API CALL DEBUG ===");
    console.log("Session valid:", hasValidSession);
    console.log("Current session token:", sessionInfo.token);
    console.log("Headers being sent:", authHeaders);
    console.log("===============================");

    const response = await axios.get(apiUrl, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    // Clear slow request timer on success
    if (slowRequestTimer) {
      clearTimeout(slowRequestTimer);
    }

    console.log("Response from Tatoeba Proxy:", response.data);

    // Handle session info from response (same pattern as MW Dictionary)
    if (response.data && response.data._proxy && response.data._proxy.session) {
      const sessionInfo = response.data._proxy.session;

      if (sessionInfo.isNew) {
        console.log("New session created by Tatoeba server");
      }

      // Note: Session storage is handled by dictionaryServices.js
      // Both APIs share the same session tokens
    }

    // Handle API errors
    if (response.data && response.data.error) {
      // Check if it's a session-related error
      if (
        response.data.error === "Security Validation Failed" ||
        response.data.error === "Security Validation Required"
      ) {
        console.log(
          "Tatoeba session validation failed, clearing stored session"
        );
        sessionManager.clearSession();

        // If we were using a session token, this indicates session expired
        if (hasValidSession && !turnstileToken) {
          return {
            error: true,
            type: "session_expired",
            message: "Session expired, please refresh",
            query: spanishQuery,
            needsTurnstile: true,
          };
        }
      }

      console.error(
        "Error from Tatoeba proxy function:",
        response.data.details || response.data.error
      );
      // Return structured error instead of empty array
      return {
        error: true,
        type: "proxy_error",
        message: response.data.details || response.data.error,
        query: spanishQuery,
      };
    }

    // Remove _proxy metadata before processing
    if (response.data && response.data._proxy) {
      console.log("Removing _proxy metadata from Tatoeba response");
      delete response.data._proxy;
    }

    // Process successful response
    if (response.data && Array.isArray(response.data.results)) {
      const sentencePairs = response.data.results
        .map((result) => {
          if (
            result.text &&
            result.translations &&
            result.translations[0] &&
            result.translations[0][0]
          ) {
            const sourceSentenceText = result.text;
            const sourceSentenceId = result.id;
            const englishTranslation = result.translations[0].find(
              (trans) => trans.lang === "eng"
            );

            if (englishTranslation && englishTranslation.text) {
              return {
                id_spa: sourceSentenceId,
                text_spa: sourceSentenceText,
                id_eng: englishTranslation.id,
                text_eng: englishTranslation.text,
              };
            }
          }
          return null;
        })
        .filter((pair) => pair !== null);

      console.log("Processed Tatoeba Sentence Pairs via Proxy:", sentencePairs);
      return sentencePairs;
    } else {
      console.warn(
        "Tatoeba proxy response did not contain expected results array:",
        response.data
      );
      return [];
    }
  } catch (error) {
    // Clear slow request timer on error
    if (slowRequestTimer) {
      clearTimeout(slowRequestTimer);
    }

    // Error handling with timeout detection
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      console.error(
        `Tatoeba API request timed out after ${REQUEST_TIMEOUT_MS}ms for "${spanishQuery}"`
      );
      return {
        error: true,
        type: "timeout",
        message: `Example lookup timed out after ${
          REQUEST_TIMEOUT_MS / 1000
        } seconds`,
        query: spanishQuery,
      };
    }

    // Network or other errors
    console.error(
      `Error fetching examples via Tatoeba Proxy for "${spanishQuery}":`,
      error.message
    );

    if (error.response) {
      console.error("Tatoeba Proxy Error Response Data:", error.response.data);
      console.error(
        "Tatoeba Proxy Error Response Status:",
        error.response.status
      );

      // Handle authentication errors (same as MW Dictionary)
      if (error.response.status === 403) {
        console.log("Tatoeba authentication failed, clearing session");
        sessionManager.clearSession();

        // Return specific error for session expiry
        if (hasValidSession && !turnstileToken) {
          return {
            error: true,
            type: "session_expired",
            message: "Session expired, please refresh",
            query: spanishQuery,
            needsTurnstile: true,
          };
        }

        return {
          error: true,
          type: "auth_error",
          message: "Authentication required",
          query: spanishQuery,
          needsTurnstile: true,
        };
      }

      if (error.response.status >= 500) {
        return {
          error: true,
          type: "server_error",
          message: "Example service temporarily unavailable",
          query: spanishQuery,
        };
      } else if (error.response.status === 404) {
        return {
          error: true,
          type: "not_found",
          message: "No examples found",
          query: spanishQuery,
        };
      }
    } else if (error.request) {
      console.error("Tatoeba Proxy: No response received for the request.");
      return {
        error: true,
        type: "network_error",
        message: "Unable to connect to example service",
        query: spanishQuery,
      };
    }

    console.error("Tatoeba: Generic error fallback for:", spanishQuery);
    return [];
  }
};
