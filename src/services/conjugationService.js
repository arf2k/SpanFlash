import { sessionManager } from "./dictionaryServices.js";
import { spanishVerbLemmatizer } from "../utils/verbLemmatizer.js";

export class ConjugationService {
  constructor() {
    //this.apiBase = "http://localhost:8000";
    this.apiBase = "/api/conjugation-proxy";

    this.cache = new Map();
    this.verbCache = new Set();
    this.isOnline = navigator.onLine;

    window.addEventListener("online", () => (this.isOnline = true));
    window.addEventListener("offline", () => (this.isOnline = false));
  }
  isVerb(spanishWord) {
    if (!spanishWord) return false;
    const word = spanishWord.toLowerCase().trim();

    // Exclude multi-word phrases
    if (word.includes(" ")) {
      return false;
    }

    // Use existing lemmatizer to check if it's a valid verb
    const infinitive = spanishVerbLemmatizer.getInfinitive(word);

    if (infinitive) {
      // Add to cache for future lookups
      this.verbCache.add(word);
      this.verbCache.add(infinitive);
      return true;
    }

    // Check cache (for previously confirmed verbs)
    if (this.verbCache.has(word)) {
      return true;
    }

    // Fallback: basic ending check for infinitives only
    const verbEndings = ["ar", "er", "ir"];
    const isInfinitive = verbEndings.some((ending) => word.endsWith(ending));

    if (isInfinitive) {
      // Additional check: exclude obvious adjectives ending in -ar
      const adjectivePatterns = [
        /acular$/, // espectacular, particular
        /ular$/, // circular, popular
        /ilar$/, // similar
        /elar$/, // ... other patterns
      ];

      const isLikelyAdjective = adjectivePatterns.some((pattern) =>
        pattern.test(word)
      );

      if (!isLikelyAdjective) {
        this.verbCache.add(word);
        return true;
      }
    }

    return false;
  }

  async getConjugations(verb) {
    const cacheKey = `full-${verb}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    if (!this.isOnline) {
      console.warn("Offline - using cached data only");
      return null;
    }

    try {
      // Determine authentication strategy (same as other APIs)
      const sessionInfo = sessionManager.getSessionInfo();
      const hasValidSession = sessionInfo.isValid;
      const authHeaders = {};

      if (hasValidSession) {
        console.log("Using existing session token for Conjugation API call");
        authHeaders["CF-Session-Token"] = sessionInfo.token;
      } else {
        // For conjugation, we'll try without auth first, then require Turnstile if needed
        console.log(
          "No valid session for Conjugation API call - attempting without auth"
        );
      }

      console.log("=== CONJUGATION API CALL DEBUG ===");
      console.log("Session valid:", hasValidSession);
      console.log("Current session token:", sessionInfo.token);
      console.log("Headers being sent:", authHeaders);
      console.log("==================================");

      const response = await fetch(`${this.apiBase}/es/${verb}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...authHeaders,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 403) {
          console.log("Conjugation authentication failed, clearing session");
          sessionManager.clearSession();

          // Return specific error for session expiry
          if (hasValidSession) {
            throw new Error(
              "Session expired - authentication required for conjugation service"
            );
          }

          throw new Error("Authentication required for conjugation service");
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle session info from response (same pattern as other APIs)
      if (data && data._proxy && data._proxy.session) {
        const sessionInfo = data._proxy.session;

        if (sessionInfo.isNew) {
          console.log("New session created by Conjugation server");
        }

        // Note: Session storage is handled by dictionaryServices.js
        // All APIs share the same session tokens
      }

      // Remove _proxy metadata before processing
      if (data && data._proxy) {
        console.log("Removing _proxy metadata from Conjugation response");
        delete data._proxy;
      }

      if (data.value && data.value.moods) {
        this.verbCache.add(verb); // Cache as known verb
        this.cache.set(cacheKey, data.value);
        return data.value;
      }

      return null;
    } catch (error) {
      console.warn(`Failed to conjugate ${verb}:`, error.message);

      // Handle authentication-specific errors
      if (
        error.message.includes("authentication required") ||
        error.message.includes("Session expired")
      ) {
        // Return null for auth errors - caller can handle gracefully
        return null;
      }

      if (!error.message.includes("timeout")) {
        return await this.tryFallbackConjugation(verb);
      }

      return null;
    }
  }

  // Fallback conjugation for basic verbs
  async tryFallbackConjugation(verb) {
    // Simple rule-based conjugation for common regular verbs
    if (verb.endsWith("ar")) {
      return this.generateRegularArConjugation(verb);
    } else if (verb.endsWith("er")) {
      return this.generateRegularErConjugation(verb);
    } else if (verb.endsWith("ir")) {
      return this.generateRegularIrConjugation(verb);
    }
    return null;
  }
  async generateConjugationQuestion(wordObject) {
    if (!wordObject || !wordObject.spanish) {
      console.warn("generateConjugationQuestion: Invalid word object");
      return null;
    }

    const verb = wordObject.spanish.toLowerCase().trim();

    try {
      const conjugations = await this.getConjugations(verb);

      if (!conjugations || !conjugations.moods) {
        console.warn(`No conjugations found for verb: ${verb}`);
        return null;
      }

      // Available moods and tenses
      const availableQuestions = [];

      // Extract all available conjugations
      Object.entries(conjugations.moods).forEach(([moodName, moodData]) => {
        if (moodData && typeof moodData === "object") {
          Object.entries(moodData).forEach(([tenseName, tenseData]) => {
            if (Array.isArray(tenseData) && tenseData.length > 0) {
              if (this.isValidTenseForQuestions(tenseName, tenseData)) {
                tenseData.forEach((conjugation, personIndex) => {
                  if (
                    conjugation &&
                    typeof conjugation === "string" &&
                    conjugation.trim() !== ""
                  ) {
                    availableQuestions.push({
                      mood: moodName,
                      tense: tenseName,
                      person: personIndex,
                      conjugation: conjugation.trim(),
                      infinitive: verb,
                    });
                  }
                });
              }
            }
          });
        }
      });

      if (availableQuestions.length === 0) {
        console.warn(`No valid conjugations found for verb: ${verb}`);
        return null;
      }

      // Select random question
      const randomQuestion =
        availableQuestions[
          Math.floor(Math.random() * availableQuestions.length)
        ];

      // Person pronouns mapping
      const personPronouns = ["yo", "tú", "él/ella", "nosotros", "ellos/ellas"];
      const pronoun =
        personPronouns[randomQuestion.person] ||
        `person ${randomQuestion.person + 1}`;

      // Format mood and tense names for display
      const formatName = (name) =>
        name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");

      return {
        verb: wordObject,
        infinitive: verb,
        mood: randomQuestion.mood,
        tense: randomQuestion.tense,
        person: randomQuestion.person,
        pronoun: pronoun,
        answer: randomQuestion.conjugation, // 🔄 renamed from correctAnswer
        question: `Conjugate "${verb}" for "${pronoun}" in ${formatName(
          randomQuestion.mood
        )} ${formatName(randomQuestion.tense)}`,
        displayMood: formatName(randomQuestion.mood),
        displayTense: formatName(randomQuestion.tense),
        englishMeaning: wordObject.english || "", // ✅ added for UI display
      };
    } catch (error) {
      console.warn(
        `Error generating conjugation question for ${verb}:`,
        error.message
      );

      // Handle authentication errors gracefully
      if (
        error.message.includes("authentication required") ||
        error.message.includes("Session expired")
      ) {
        return null;
      }

      return null;
    }
  }

  isValidTenseForQuestions(tenseName, tenseData) {
    // Exclude non-personal forms that don't use pronouns
    const excludedTenses = [
      "gerundio",
      "gerund",
      "gerundio_simple",
      "participio",
      "participle",
      "participio_pasado",
      "past_participle",
      "infinitivo",
      "infinitive",
      "infinitivo_simple",
      "imperativo_negativo", // negative imperatives are complex
    ];

    const lowerTenseName = tenseName.toLowerCase();

    // Check if tense name contains excluded patterns
    if (excludedTenses.some((excluded) => lowerTenseName.includes(excluded))) {
      return false;
    }

    // Must be an array with valid conjugations
    if (!Array.isArray(tenseData) || tenseData.length === 0) {
      return false;
    }

    // Check if it has at least one valid conjugation
    const hasValidConjugations = tenseData.some((conj) => {
      if (!conj || typeof conj !== "string") return false;
      const cleanConj = conj.trim();
      return cleanConj !== "" && cleanConj !== "-";
    });

    return hasValidConjugations;
  }

  generateRegularArConjugation(verb) {
    const stem = verb.slice(0, -2);
    return {
      moods: {
        indicativo: {
          presente: [
            `yo ${stem}o`,
            `tú ${stem}as`,
            `él ${stem}a`,
            `nosotros ${stem}amos`,
            `ellos ${stem}an`,
          ],
        },
      },
    };
  }

  generateRegularErConjugation(verb) {
    const stem = verb.slice(0, -2);
    return {
      moods: {
        indicativo: {
          presente: [
            `yo ${stem}o`,
            `tú ${stem}es`,
            `él ${stem}e`,
            `nosotros ${stem}emos`,
            `ellos ${stem}en`,
          ],
        },
      },
    };
  }

  generateRegularIrConjugation(verb) {
    const stem = verb.slice(0, -2);
    return {
      moods: {
        indicativo: {
          presente: [
            `yo ${stem}o`,
            `tú ${stem}es`,
            `él ${stem}e`,
            `nosotros ${stem}imos`,
            `ellos ${stem}en`,
          ],
        },
      },
    };
  }
}
