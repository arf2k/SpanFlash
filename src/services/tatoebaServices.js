import axios from "axios";

const TATOEBA_PROXY_PATH = "/api/tatoeba-proxy";

const REQUEST_TIMEOUT_MS = 8000;
const SLOW_REQUEST_THRESHOLD_MS = 4000;

/**
 * @param {string} spanishQuery
 * @param {Function} onSlowRequest - Optional callback called if request is taking longer than threshold
 * @returns {Promise<Array<{id_spa: number, text_spa: string, id_eng: number, text_eng: string}>>}
 * A promise that resolves to an array of example sentence pairs, or an empty array if none found/error.
 */
export const getTatoebaExamples = async (
  spanishQuery,
  onSlowRequest = null
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

  console.log(`Calling PWA's Tatoeba Proxy: ${apiUrl}`);

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
    const response = await axios.get(apiUrl, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // Clear slow request timer on success
    if (slowRequestTimer) {
      clearTimeout(slowRequestTimer);
    }

    console.log("Response from PWA's Tatoeba Proxy:", response.data);

    if (response.data && response.data.error) {
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
      `Error fetching examples via PWA's Tatoeba Proxy for "${spanishQuery}":`,
      error.message
    );

    if (error.response) {
      console.error("Proxy API Error Response Data:", error.response.data);
      console.error("Proxy API Error Response Status:", error.response.status);

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
      console.error(
        "Tatoeba Proxy: No response received for the request.",
        error.request
      );
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
