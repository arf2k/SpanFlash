import { sessionManager } from "./dictionaryServices.js";

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

    if (word.includes(" ")) {
      return false;
    }

    const verbEndings = ["ar", "er", "ir"];

    return (
      verbEndings.some((ending) => word.endsWith(ending)) ||
      this.verbCache.has(word)
    );
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
        console.log('Using existing session token for Conjugation API call');
        authHeaders["CF-Session-Token"] = sessionInfo.token;
      } else {
        // For conjugation, we'll try without auth first, then require Turnstile if needed
        console.log('No valid session for Conjugation API call - attempting without auth');
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
          console.log('Conjugation authentication failed, clearing session');
          sessionManager.clearSession();
          
          // Return specific error for session expiry
          if (hasValidSession) {
            throw new Error("Session expired - authentication required for conjugation service");
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
          console.log('New session created by Conjugation server');
        }
        
        // Note: Session storage is handled by dictionaryServices.js
        // All APIs share the same session tokens
      }

      // Remove _proxy metadata before processing
      if (data && data._proxy) {
        console.log('Removing _proxy metadata from Conjugation response');
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
      if (error.message.includes("authentication required") || 
          error.message.includes("Session expired")) {
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
        if (moodData && typeof moodData === 'object') {
          Object.entries(moodData).forEach(([tenseName, tenseData]) => {
            if (Array.isArray(tenseData) && tenseData.length > 0) {
              tenseData.forEach((conjugation, personIndex) => {
                if (conjugation && typeof conjugation === 'string' && conjugation.trim() !== '') {
                  availableQuestions.push({
                    mood: moodName,
                    tense: tenseName,
                    person: personIndex,
                    conjugation: conjugation.trim(),
                    infinitive: verb
                  });
                }
              });
            }
          });
        }
      });

      if (availableQuestions.length === 0) {
        console.warn(`No valid conjugations found for verb: ${verb}`);
        return null;
      }

      // Select random question
      const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
      
      // Person pronouns mapping
      const personPronouns = ['yo', 'tú', 'él/ella', 'nosotros', 'ellos/ellas'];
      const pronoun = personPronouns[randomQuestion.person] || `person ${randomQuestion.person + 1}`;

      // Format mood and tense names for display
      const formatName = (name) => name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
      
      return {
        verb: wordObject,
        infinitive: verb,
        mood: randomQuestion.mood,
        tense: randomQuestion.tense,
        person: randomQuestion.person,
        pronoun: pronoun,
        correctAnswer: randomQuestion.conjugation,
        question: `Conjugate "${verb}" for "${pronoun}" in ${formatName(randomQuestion.mood)} ${formatName(randomQuestion.tense)}`,
        displayMood: formatName(randomQuestion.mood),
        displayTense: formatName(randomQuestion.tense)
      };

    } catch (error) {
      console.warn(`Error generating conjugation question for ${verb}:`, error.message);
      
      // Handle authentication errors gracefully
      if (error.message.includes("authentication required") || 
          error.message.includes("Session expired")) {
        return null;
      }
      
      return null;
    }
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