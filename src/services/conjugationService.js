
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

    const verbEndings = ["ar", "er", "ir"];
    const word = spanishWord.toLowerCase().trim();

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
      const response = await fetch(`${this.apiBase}/es/${verb}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000),
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
      { label: "él/ella/usted", index: 2 },
      { label: "nosotros/as", index: 3 },
      { label: "vosotros/as", index: 4 }, 
      { label: "ellos/ellas/ustedes", index: 5 } 
    ];

    const personsToPractice = persons.filter((p) => p.label !== "vosotros/as");
    // Pick random tense and person
    const displayTense =
      displayTenses[Math.floor(Math.random() * displayTenses.length)];
    const apiTense = tenseMapping[displayTense];
    const person =
      personsToPractice[Math.floor(Math.random() * personsToPractice.length)]; // Use the filtered list

    try {
      const conjugations = await this.getConjugations(word.spanish);

      if (
        !conjugations ||
        !conjugations.moods?.indicativo?.[apiTense] // Using optional chaining for safety
      ) {
        return null;
      }

      const tenseConjugations = conjugations.moods.indicativo[apiTense];

      if (!tenseConjugations || !tenseConjugations[person.index]) {
        return null;
      }

      let answer = tenseConjugations[person.index];
      answer = answer.replace(
        /^(yo|tú|él|ella|Ud\.|nosotros|vosotros|ellos|ellas|Uds\.)\s+/, // Added Ud. and Uds.
        ""
      );

      return {
        type: "conjugation",
        word: word,
        question: `Conjugate "${word.spanish}" for "${person.label}" in the ${displayTense} tense`,
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
