import axios from "axios";

const MW_PROXY_PATH = "/api/mw-dictionary-proxy";

// Timeout configuration
const REQUEST_TIMEOUT_MS = 6000;
const SLOW_REQUEST_THRESHOLD_MS = 3000;

/**
 * Fetches definition and usage examples for a Spanish word/phrase
 * by calling your Cloudflare Pages Function proxy for the Merriam-Webster API.
 * @param {string} spanishWord - The word or phrase to look up.
 * @param {Function} onSlowRequest - callback called if request is taking longer than threshold
 *  * @param {string} turnstileToken -  Turnstile token for API protection
 * @returns {Promise<object|null>} A promise that resolves to the API response data
 * or null if an error occurs.
 */
export const getMwHint = async (
  spanishWord,
  onSlowRequest = null,
  turnstileToken
) => {
  if (!turnstileToken) {
    throw new Error('Turnstile token required for API access');
  }
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
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(turnstileToken && { "CF-Turnstile-Response": turnstileToken }),
      },
    });
    if (slowRequestTimer) {
      clearTimeout(slowRequestTimer);
    }

    console.log("Response from MW Proxy:", response.data);

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

    return {
      error: true,
      type: "unknown_error",
      message: "Dictionary lookup failed",
      word: wordToLookup,
    };
  }
};
