export class ConjugationService {
  constructor() {
    // Fixed API endpoint (you found the correct one!)
    this.apiBase = "http://localhost:8000";

    this.cache = new Map();
    this.verbCache = new Set(); // Cache known verbs
    this.isOnline = navigator.onLine;

    // Listen for online/offline changes
    window.addEventListener("online", () => (this.isOnline = true));
    window.addEventListener("offline", () => (this.isOnline = false));
  }

  // Check if a word is likely a Spanish verb
  isVerb(spanishWord) {
    if (!spanishWord) return false;

    // Basic Spanish verb patterns
    const verbEndings = ["ar", "er", "ir"];
    const word = spanishWord.toLowerCase().trim();

    // Check if it ends with verb suffixes
    return (
      verbEndings.some((ending) => word.endsWith(ending)) ||
      this.verbCache.has(word)
    ); // Or we know it's a verb from API
  }

  // Enhanced conjugation fetching with better error handling
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
      const response = await fetch(`${this.apiBase}/conjugate/es/${verb}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.value && data.value.moods) {
        this.verbCache.add(verb); // Cache as known verb
        this.cache.set(cacheKey, data.value);
        return data.value;
      }

      return null;
    } catch (error) {
      console.warn(`Failed to conjugate ${verb}:`, error.message);

      // Try fallback with simpler conjugation if API fails
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

  // Generate a conjugation question with better tense mapping
  async generateConjugationQuestion(word) {
    if (!this.isVerb(word.spanish)) {
      return null;
    }

    const tenseMapping = {
      presente: "presente",
      pretérito: "pretérito-perfecto-simple",
      imperfecto: "pretérito-imperfecto",
      futuro: "futuro",
      condicional: "condicional-simple",
      "subjuntivo presente": "subjuntivo-presente",
      "subjuntivo imperfecto": "subjuntivo-imperfecto",
    };

    const displayTenses = Object.keys(tenseMapping);
    const persons = [
      { label: "yo", index: 0 },
      { label: "tú", index: 1 },
      { label: "él/ella", index: 2 },
      { label: "nosotros", index: 3 },
      { label: "ellos/ellas", index: 4 },
    ];

    // Pick random tense and person
    const displayTense =
      displayTenses[Math.floor(Math.random() * displayTenses.length)];
    const apiTense = tenseMapping[displayTense];
    const person = persons[Math.floor(Math.random() * persons.length)];

    try {
      const conjugations = await this.getConjugations(word.spanish);

      if (
        !conjugations ||
        !conjugations.moods ||
        !conjugations.moods.indicativo ||
        !conjugations.moods.indicativo[apiTense]
      ) {
        return null;
      }

      const tenseConjugations = conjugations.moods.indicativo[apiTense];

      if (!tenseConjugations || !tenseConjugations[person.index]) {
        return null;
      }

      // Clean up the conjugation (remove pronouns if present)
      let answer = tenseConjugations[person.index];
      answer = answer.replace(
        /^(yo|tú|él|ella|nosotros|ellos|ellas)\s+/,
        ""
      );

      return {
        type: "conjugation",
        word: word,
        question: `Conjugate "${word.spanish}" for "${person.label}" in ${displayTense}`,
        answer: answer.trim(),
        fullAnswer: tenseConjugations[person.index],
        mood: "indicativo",
        tense: displayTense,
        person: person.label,
        englishMeaning: word.english,
      };
    } catch (error) {
      console.warn(`Error generating question for ${word.spanish}:`, error);
      return null;
    }
  }

  // Get verbs from your word list
  async identifyVerbsInWordList(words) {
    const verbs = [];

    for (const word of words) {
      if (this.isVerb(word.spanish)) {
        // Test if we can actually conjugate it
        const conjugations = await this.getConjugations(word.spanish);
        if (conjugations) {
          verbs.push({
            ...word,
            isConfirmedVerb: true,
          });
        }
      }
    }

    return verbs;
  }

  // Clear cache (useful for development)
  clearCache() {
    this.cache.clear();
    this.verbCache.clear();
  }
}
