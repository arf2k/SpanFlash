import { getMwHint } from "../services/dictionaryServices.js";
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
      const apiResponse = await new Promise((resolve, reject) => {
        ensureValidToken(async () => {
          try {
            const response = await getMwHint(
              wordForApi,
              onSlowRequest,
              window.turnstileToken
            );
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

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
              type: "error",
              message: `"${wordForApi}" not found in dictionary.`,
              canRetry: false,
              word: wordForApi,
            });
            break;
          case "network_error":
            setHintData({
              type: "error",
              message: "Unable to connect to dictionary service.",
              canRetry: true,
              word: wordForApi,
            });
            break;
          default:
            setHintData({
              type: "error",
              message: "Dictionary lookup failed.",
              canRetry: true,
              word: wordForApi,
            });
        }
        return;
      }

      console.log("Raw Hint Data from MW:", apiResponse);

      // Parse English synonyms for suggestions (existing logic)
      let parsedEngSynonyms = [];
      if (apiResponse && Array.isArray(apiResponse) && apiResponse.length > 0) {
        const firstResult = apiResponse[0];
        if (
          firstResult &&
          typeof firstResult === "object" &&
          firstResult.shortdef &&
          Array.isArray(firstResult.shortdef) &&
          firstResult.shortdef.length > 0
        ) {
          const shortDefString = firstResult.shortdef[0];
          parsedEngSynonyms = shortDefString
            .split(/,| or /)
            .map((s) => {
              let cleaned = s.replace(/\([^)]*?\)/g, "").trim();
              if (cleaned.toLowerCase().startsWith("especially "))
                cleaned = cleaned.substring(11).trim();
              return cleaned;
            })
            .filter((s) => s && s.length > 1);
          if (
            parsedEngSynonyms.length > 0 &&
            currentPair &&
            currentPair.english
          ) {
            const primaryEnglishLower = currentPair.english
              .toLowerCase()
              .trim();
            parsedEngSynonyms = parsedEngSynonyms.filter(
              (s) => s.toLowerCase().trim() !== primaryEnglishLower
            );
          }
        }
      }

      if (parsedEngSynonyms.length > 0) {
        parsedEngSynonyms = [...new Set(parsedEngSynonyms)];
        setApiSuggestions({
          wordId: currentPair.id,
          type: "englishSynonyms",
          values: parsedEngSynonyms,
        });
        console.log(
          "API Suggested English Synonyms:",
          parsedEngSynonyms,
          "for ID:",
          currentPair.id
        );
      }

      // Process definition data (existing logic)
      let definitionData = null,
        suggestionsFromApi = null;
      if (Array.isArray(apiResponse) && apiResponse.length > 0) {
        if (typeof apiResponse[0] === "string")
          suggestionsFromApi = apiResponse;
        else if (typeof apiResponse[0] === "object" && apiResponse[0]?.meta?.id)
          definitionData = apiResponse[0];
        else setHintData({ type: "unknown", raw: apiResponse });
      } else if (
        typeof apiResponse === "object" &&
        !Array.isArray(apiResponse) &&
        apiResponse !== null &&
        apiResponse?.meta?.id
      )
        definitionData = apiResponse;
      else if (Array.isArray(apiResponse) && apiResponse.length === 0)
        setHintData({
          type: "error",
          message: `No definition or suggestions found for "${wordForApi}".`,
          canRetry: true,
          word: wordForApi,
        });
      else setHintData({ type: "unknown", raw: apiResponse });

      if (definitionData)
        setHintData({ type: "definitions", data: definitionData });
      else if (suggestionsFromApi)
        setHintData({ type: "suggestions", suggestions: suggestionsFromApi });
    } catch (err) {
      console.error("Error in handleGetHint fetching/processing MW data:", err);
      setHintData({
        type: "error",
        message: "Failed to fetch hint.",
        canRetry: true,
        word: wordForApi,
      });
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleFetchTatoebaExamples = async (wordToFetch) => {
    if (!wordToFetch) {
      setTatoebaError("No Spanish word provided to fetch examples for.");
      return;
    }
    setIsLoadingTatoebaExamples(true);
    setTatoebaError(null);
    setTatoebaExamples([]);
    console.log(`Fetching Tatoeba examples for "${wordToFetch}"`);
    try {
      const examples = await getTatoebaExamples(wordToFetch);
      if (examples.length === 0)
        setTatoebaError(
          `No example sentences found for "${wordToFetch}" on Tatoeba.`
        );
      setTatoebaExamples(examples);
    } catch (error) {
      console.error("Error in handleFetchTatoebaExamples:", error);
      setTatoebaError(`Failed to fetch examples: ${error.message}`);
      setTatoebaExamples([]);
    } finally {
      setIsLoadingTatoebaExamples(false);
    }
  };

  return {
    handleGetHint,
    handleFetchTatoebaExamples,
  };
};
