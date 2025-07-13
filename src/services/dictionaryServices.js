import axios from "axios";

const MW_PROXY_PATH = "/api/mw-dictionary-proxy";

// Timeout configuration
const REQUEST_TIMEOUT_MS = 6000; // 6 seconds
const SLOW_REQUEST_THRESHOLD_MS = 3000; // 3 seconds to show "still loading"

/**
 * Fetches definition and usage examples for a Spanish word/phrase
 * by calling your Cloudflare Pages Function proxy for the Merriam-Webster API.
 * @param {string} spanishWord - The word or phrase to look up.
 * @param {Function} onSlowRequest - Optional callback called if request is taking longer than threshold
 * @returns {Promise<object|null>} A promise that resolves to the API response data
 * (as returned by Merriam-Webster, usually an array)
 * or null if an error occurs.
 */
export const getMwHint = async (spanishWord, onSlowRequest = null) => {
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
      // Add explicit headers for better debugging
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // Clear slow request timer on success
    if (slowRequestTimer) {
      clearTimeout(slowRequestTimer);
    }

    console.log("Response from MW Proxy:", response.data);

    // Check for proxy-level errors
    if (response.data && response.data.error) {
      console.error(
        `Error from MW Proxy Function: ${
          response.data.details || response.data.error
        }`
      );
      return null;
    }

    return response.data;
  } catch (error) {
    // Clear slow request timer on error
    if (slowRequestTimer) {
      clearTimeout(slowRequestTimer);
    }

    // Enhanced error handling with timeout detection
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

    // Network or other errors
    console.error(
      `Error fetching hint via proxy for "${wordToLookup}":`,
      error.message
    );

    if (error.response) {
      console.error("MW Proxy Error Response Data:", error.response.data);
      console.error("MW Proxy Error Response Status:", error.response.status);

      // Return specific error info for different HTTP status codes
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
        "MW Proxy: No response received for the request.",
        error.request
      );
      return {
        error: true,
        type: "network_error",
        message: "Unable to connect to dictionary service",
        word: wordToLookup,
      };
    }

    // Generic error fallback
    return {
      error: true,
      type: "unknown_error",
      message: "Dictionary lookup failed",
      word: wordToLookup,
    };
  }
};
