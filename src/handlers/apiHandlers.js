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

    try {
      const apiResponse = await new Promise((resolve, reject) => {
        ensureValidToken(async () => {
          try {
            const currentToken = window.turnstileToken;
            if (!currentToken) {
              reject(new Error("No token available after validation"));
              return;
            }
            const response = await getMwHint(
              wordForApi,
              null, // onSlowRequest
              currentToken
            );
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      console.log("MW API Response received:", apiResponse);

      // Handle errors
      if (apiResponse && apiResponse.error) {
        setHintData({
          type: "error",
          message: apiResponse.message || "Dictionary lookup failed.",
          canRetry: true,
          word: wordForApi,
        });
        setIsHintLoading(false);
        return;
      }

      // SIMPLE FIX: Strip _proxy and extract definitions
      let mwData = apiResponse;
      if (mwData && mwData._proxy) {
        console.log("Removing _proxy metadata");
        // Convert {0: obj, 1: obj, _proxy: ...} to [obj, obj]
        const keys = Object.keys(mwData).filter(
          (k) => k !== "_proxy" && !isNaN(k)
        );
        mwData = keys.map((k) => mwData[k]);
      }

      console.log("Processing MW data:", mwData);

      // Extract first definition
      if (Array.isArray(mwData) && mwData.length > 0) {
        const firstEntry = mwData[0];
        if (
          firstEntry &&
          firstEntry.shortdef &&
          firstEntry.shortdef.length > 0
        ) {
          setHintData({
            type: "definitions",
            data: {
              shortdef: firstEntry.shortdef,
              fl: firstEntry.fl || "",
            },
          });
          console.log("Hint set successfully");
        } else {
          setHintData({
            type: "not_found",
            message: `No definitions found for "${wordForApi}".`,
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
      setHintData({
        type: "error",
        message: "Dictionary lookup failed. Please try again.",
        canRetry: true,
        word: wordForApi,
      });
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleFetchTatoebaExamples = async (spanishPhrase) => {
    if (!currentPair || !currentPair.spanish) {
      console.warn(
        "No current pair or Spanish word available for Tatoeba lookup"
      );
      return;
    }

      const phrase = spanishPhrase || (currentPair && currentPair.spanish) || '';
    if (!phrase.trim()) {
      console.warn("Spanish phrase is empty");
      return;
    }
  

    console.log(`Getting Tatoeba examples for: "${phrase}"`);
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
      const examples = await new Promise((resolve, reject) => {
        // Check if we have a valid session first
        const sessionInfo = sessionManager.getSessionInfo();

        if (sessionInfo.isValid) {
          // We have a valid session, call directly
          console.log("Using existing session for Tatoeba examples");
          getTatoebaExamples(
            spanishPhrase,
            onSlowRequest,
            null // No turnstile token needed
          )
            .then(resolve)
            .catch(reject);
        } else {
          // No valid session, need Turnstile token
          console.log(
            "No valid session, requiring Turnstile for Tatoeba examples"
          );
          ensureValidToken(async () => {
            try {
              const currentToken = window.turnstileToken;
              if (!currentToken) {
                reject(new Error("No token available after validation"));
                return;
              }
              const response = await getTatoebaExamples(
                spanishPhrase,
                onSlowRequest,
                currentToken
              );
              resolve(response);
            } catch (error) {
              reject(error);
            }
          });
        }
      });

      if (examples && examples.error) {
        switch (examples.type) {
          case "session_expired":
            setTatoebaError("Session expired. Please refresh and try again.");
            break;
          case "auth_error":
            setTatoebaError("Authentication failed. Please try again.");
            break;
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
        console.log(
          `Found ${examples.length} Tatoeba examples for "${spanishPhrase}"`
        );
      } else {
        setTatoebaError(`No examples found for "${spanishPhrase}".`);
      }
    } catch (error) {
      console.error("Error fetching Tatoeba examples:", error);

      // Handle specific error cases
      if (
        error.message ===
        "Either valid session or Turnstile token required for Tatoeba API access"
      ) {
        setTatoebaError("Authentication required. Please refresh the page.");
      } else {
        setTatoebaError("Failed to load examples. Please try again.");
      }
    } finally {
      setIsLoadingTatoebaExamples(false);
    }
  };

  return {
    handleGetHint,
    handleFetchTatoebaExamples,
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
                    if (
                      Array.isArray(defText) &&
                      defText[0] === "text" &&
                      defText[1]
                    ) {
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
