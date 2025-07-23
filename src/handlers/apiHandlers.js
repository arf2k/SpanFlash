import { getMwHint, sessionManager } from "../services/dictionaryServices.js";
import { getTatoebaExamples } from "../services/tatoebaServices.js";

export const createApiHandlers = (
  currentPair,
  isHintLoading,
  setIsHintLoading,
  hintData,
  setHintData,
  showFeedback,
  feedbackSignal,
  setApiSuggestions,
  setIsLoadingTatoebaExamples,
  setTatoebaError,
  setTatoebaExamples,
  ensureValidToken
) => {
  const handleGetHint = async (forceLookup = false) => {
    if (!currentPair || isHintLoading) return;
    if (
      !forceLookup &&
      ((hintData && hintData.type !== "error") ||
        (showFeedback && feedbackSignal === "incorrect"))
    )
      return;

    const wordToLookup = currentPair.spanish;
    if (!wordToLookup) {
      setHintData({
        type: "error",
        message: "Internal error: Word missing for hint.",
      });
      return;
    }

    const spanishArticleRegex = /^(el|la|los|las|un|una|unos|unas)\s+/i;
    let wordForApi = wordToLookup.replace(spanishArticleRegex, "").trim();
    if (!wordForApi) {
      setHintData({
        type: "error",
        message: "Cannot look up article alone as hint.",
      });
      return;
    }

    setIsHintLoading(true);
    setApiSuggestions(null);
    if (forceLookup || !hintData) setHintData(null);

    // Set up slow request callback
    let hasShownSlowMessage = false;
    const onSlowRequest = () => {
      if (!hasShownSlowMessage) {
        hasShownSlowMessage = true;
        setHintData({
          type: "slow_loading",
          message: "Dictionary lookup is taking longer than usual...",
          word: wordForApi,
        });
      }
    };

    try {
      // First attempt: Try with session token (if available) or Turnstile token
      let apiResponse;
      
      if (sessionManager.hasValidSession()) {
        console.log('Attempting MW API call with existing session');
        apiResponse = await getMwHint(wordForApi, onSlowRequest);
      } else {
        console.log('No valid session, requesting Turnstile token');
        // Request Turnstile token and make API call
        apiResponse = await new Promise((resolve, reject) => {
          ensureValidToken(async () => {
            try {
              const currentToken = window.turnstileToken;
              if (!currentToken) {
                reject(new Error("No token available after validation"));
                return;
              }
              const response = await getMwHint(
                wordForApi,
                onSlowRequest,
                currentToken
              );
              resolve(response);
            } catch (error) {
              reject(error);
            }
          });
        });
      }

      // Handle session expiry - retry with Turnstile
      if (apiResponse?.error && apiResponse.needsTurnstile) {
        console.log('Session expired or auth failed, retrying with Turnstile token');
        
        apiResponse = await new Promise((resolve, reject) => {
          ensureValidToken(async () => {
            try {
              const currentToken = window.turnstileToken;
              if (!currentToken) {
                reject(new Error("No token available after validation"));
                return;
              }
              const response = await getMwHint(
                wordForApi,
                onSlowRequest,
                currentToken
              );
              resolve(response);
            } catch (error) {
              reject(error);
            }
          });
        });
      }

      // Handle API response
      if (apiResponse && apiResponse.error) {
        switch (apiResponse.type) {
          case "timeout":
            setHintData({
              type: "error",
              message: `Dictionary lookup timed out. Try again?`,
              canRetry: true,
              word: wordForApi,
            });
            break;
          case "server_error":
            setHintData({
              type: "error",
              message: "Dictionary service temporarily unavailable.",
              canRetry: true,
              word: wordForApi,
            });
            break;
          case "not_found":
            setHintData({
              type: "not_found",
              message: `No dictionary entry found for "${wordForApi}".`,
              word: wordForApi,
            });
            break;
          case "auth_error":
          case "session_expired":
            setHintData({
              type: "error",
              message: "Authentication failed. Please try again.",
              canRetry: true,
              word: wordForApi,
            });
            break;
          default:
            setHintData({
              type: "error",
              message: apiResponse.message || "Dictionary lookup failed.",
              canRetry: true,
              word: wordForApi,
            });
        }
        setIsHintLoading(false);
        return;
      }

      // Success case
      if (apiResponse && Array.isArray(apiResponse) && apiResponse.length > 0) {
        const extractedDefinitions = extractDefinitionsFromMwResponse(apiResponse);
        
        if (extractedDefinitions.length > 0) {
          setHintData({
            type: "success",
            word: wordForApi,
            originalWord: wordToLookup,
            definitions: extractedDefinitions,
          });
        } else {
          setHintData({
            type: "not_found",
            message: `No clear definitions found for "${wordForApi}".`,
            word: wordForApi,
          });
        }
      } else {
        setHintData({
          type: "not_found",
          message: `No dictionary entry found for "${wordForApi}".`,
          word: wordForApi,
        });
      }
    } catch (error) {
      console.error("Error in handleGetHint:", error);
      
      if (error.message?.includes("No token available")) {
        setHintData({
          type: "error",
          message: "Authentication required. Please try again.",
          canRetry: true,
          word: wordForApi,
        });
      } else {
        setHintData({
          type: "error",
          message: "Dictionary lookup failed. Please try again.",
          canRetry: true,
          word: wordForApi,
        });
      }
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleGetTatoebaExamples = async () => {
    if (!currentPair || !currentPair.spanish) {
      console.warn("No current pair or Spanish word available for Tatoeba lookup");
      return;
    }

    const spanishPhrase = currentPair.spanish.trim();
    if (!spanishPhrase) {
      console.warn("Spanish phrase is empty");
      return;
    }

    console.log(`Getting Tatoeba examples for: "${spanishPhrase}"`);
    setIsLoadingTatoebaExamples(true);
    setTatoebaError(null);
    setTatoebaExamples([]);

    // Set up slow request callback
    let hasShownSlowMessage = false;
    const onSlowRequest = () => {
      if (!hasShownSlowMessage) {
        hasShownSlowMessage = true;
        setTatoebaError("Example lookup is taking longer than usual...");
      }
    };

    try {
      const examples = await getTatoebaExamples(spanishPhrase, onSlowRequest);

      if (examples && examples.error) {
        switch (examples.type) {
          case "timeout":
            setTatoebaError(`Example lookup timed out. Try again?`);
            break;
          case "server_error":
            setTatoebaError("Example service temporarily unavailable.");
            break;
          case "not_found":
            setTatoebaError(`No examples found for "${spanishPhrase}".`);
            break;
          default:
            setTatoebaError(examples.message || "Failed to load examples.");
        }
        setIsLoadingTatoebaExamples(false);
        return;
      }

      if (examples && Array.isArray(examples) && examples.length > 0) {
        setTatoebaExamples(examples);
        console.log(`Found ${examples.length} Tatoeba examples for "${spanishPhrase}"`);
      } else {
        setTatoebaError(`No examples found for "${spanishPhrase}".`);
      }
    } catch (error) {
      console.error("Error fetching Tatoeba examples:", error);
      setTatoebaError("Failed to load examples. Please try again.");
    } finally {
      setIsLoadingTatoebaExamples(false);
    }
  };

  return {
    handleGetHint,
    handleGetTatoebaExamples,
  };
};

// Helper function to extract definitions from MW API response
function extractDefinitionsFromMwResponse(mwResponse) {
  const definitions = [];

  if (!Array.isArray(mwResponse)) {
    return definitions;
  }

  mwResponse.forEach((entry, entryIndex) => {
    if (!entry || typeof entry !== "object") return;

    // Handle suggestion arrays (when word not found)
    if (typeof entry === "string") {
      return;
    }

    // Extract headword
    const headword = entry.meta?.id || entry.hwi?.hw || "Unknown";

    // Extract part of speech
    const partOfSpeech = entry.fl || "";

    // Extract definitions from shortdef (simple definitions)
    if (entry.shortdef && Array.isArray(entry.shortdef)) {
      entry.shortdef.forEach((def, defIndex) => {
        if (def && typeof def === "string" && def.trim()) {
          definitions.push({
            id: `${entryIndex}-shortdef-${defIndex}`,
            text: def.trim(),
            type: "shortdef",
            partOfSpeech,
            headword,
          });
        }
      });
    }

    // Extract definitions from detailed definitions if shortdef not available
    if (definitions.length === 0 && entry.def && Array.isArray(entry.def)) {
      entry.def.forEach((defSection, defSectionIndex) => {
        if (defSection.sseq && Array.isArray(defSection.sseq)) {
          defSection.sseq.forEach((sense, senseIndex) => {
            if (Array.isArray(sense) && sense.length > 0) {
              const senseData = sense[0];
              if (Array.isArray(senseData) && senseData.length > 1) {
                const defData = senseData[1];
                if (defData && defData.dt && Array.isArray(defData.dt)) {
                  defData.dt.forEach((defText, defTextIndex) => {
                    if (Array.isArray(defText) && defText[0] === "text" && defText[1]) {
                      const cleanDef = defText[1]
                        .replace(/\{[^}]*\}/g, "") // Remove markup
                        .replace(/\s+/g, " ") // Normalize whitespace
                        .trim();
                      
                      if (cleanDef) {
                        definitions.push({
                          id: `${entryIndex}-detailed-${defSectionIndex}-${senseIndex}-${defTextIndex}`,
                          text: cleanDef,
                          type: "detailed",
                          partOfSpeech,
                          headword,
                        });
                      }
                    }
                  });
                }
              }
            }
          });
        }
      });
    }
  });

  // Limit to top 3 definitions to avoid overwhelming users
  return definitions.slice(0, 3);
}