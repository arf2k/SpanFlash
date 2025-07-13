class SpanishVerbLemmatizer {
  constructor() {
    this.conjugationToInfinitive = new Map();
    this.infinitives = new Set();
    this.isInitialized = false;
  }

  /**
   * Initialize the lemmatizer with verb conjugation data
   * @param {Object} verbData - The conjugation database from ellaverbs
   */
  async initialize(verbData) {
    if (this.isInitialized) return;

    console.log("Building Spanish verb reverse lookup table...");
    let totalConjugations = 0;
    let duplicateCount = 0;

    // Process each verb in the database
    Object.entries(verbData.verbs).forEach(([verbKey, verbInfo]) => {
      const infinitive = verbInfo.verb;
      this.infinitives.add(infinitive);

      // Process all tenses for this verb
      Object.entries(verbInfo.tenses).forEach(
        ([tenseName, tenseConjugations]) => {
          // Skip complex tenses that contain multiple words (e.g., "he sido", "estoy siendo")
          if (this.isCompoundTense(tenseName)) {
            return;
          }

          // Process each person's conjugation
          Object.entries(tenseConjugations).forEach(([person, conjugation]) => {
            if (this.isValidConjugation(conjugation)) {
              const cleanConjugation = this.cleanConjugation(conjugation);

              if (cleanConjugation && cleanConjugation !== infinitive) {
                // Check for duplicates (some forms appear in multiple verbs)
                if (this.conjugationToInfinitive.has(cleanConjugation)) {
                  const existingInfinitive =
                    this.conjugationToInfinitive.get(cleanConjugation);
                  if (existingInfinitive !== infinitive) {
                    // Handle ambiguous forms (e.g., "era" could be "ser" or "estar")
                    this.handleAmbiguousForm(
                      cleanConjugation,
                      existingInfinitive,
                      infinitive
                    );
                    duplicateCount++;
                  }
                } else {
                  this.conjugationToInfinitive.set(
                    cleanConjugation,
                    infinitive
                  );
                  totalConjugations++;
                }
              }
            }
          });
        }
      );
    });

    console.log(`✅ Verb lemmatizer initialized:`);
    console.log(`   - ${this.infinitives.size} base verbs processed`);
    console.log(`   - ${totalConjugations} unique conjugations mapped`);
    console.log(`   - ${duplicateCount} ambiguous forms handled`);

    this.isInitialized = true;
  }

  /**
   * Check if a tense contains compound forms (multiple words)
   */
  isCompoundTense(tenseName) {
    const compoundTenses = [
      "present_continuous",
      "informal_future",
      "present_perfect",
      "past_perfect",
      "future_perfect",
      "conditional_perfect",
      "subjunctive_present_perfect",
      "subjunctive_past_perfect",
      "subjunctive_future_perfect",
    ];
    return compoundTenses.includes(tenseName);
  }

  /**
   * Check if a conjugation is valid for processing
   */
  isValidConjugation(conjugation) {
    if (!conjugation || typeof conjugation !== "string") return false;

    // Skip empty, dash, or multi-word forms
    return (
      conjugation.trim() !== "" &&
      conjugation !== "-" &&
      !conjugation.includes(" ") &&
      !conjugation.includes("no ")
    ); // Skip negative imperatives
  }

  /**
   * Clean conjugation form for lookup
   */
  cleanConjugation(conjugation) {
    return conjugation
      .toLowerCase()
      .trim()
      .replace(/[¿¡.,;:!?"'()]/g, ""); // Remove punctuation but keep accents
  }

  /**
   * Handle forms that could belong to multiple verbs
   */
  handleAmbiguousForm(conjugation, existing, newInfinitive) {
    // Prefer more common verbs for ambiguous forms
    const commonVerbs = [
      "ser",
      "estar",
      "tener",
      "hacer",
      "poder",
      "decir",
      "ir",
      "ver",
      "dar",
      "saber",
    ];

    if (
      commonVerbs.includes(existing) &&
      !commonVerbs.includes(newInfinitive)
    ) {
      // Keep the existing common verb
      return;
    } else if (
      !commonVerbs.includes(existing) &&
      commonVerbs.includes(newInfinitive)
    ) {
      // Replace with the more common verb
      this.conjugationToInfinitive.set(conjugation, newInfinitive);
    } else {
      // For equally common/uncommon verbs, keep the first one found
      // Could be enhanced with frequency data later
    }
  }

  /**
   * Get the infinitive form of a conjugated verb
   * @param {string} word - The potentially conjugated verb
   * @returns {string|null} - The infinitive form, or null if not found
   */
  getInfinitive(word) {
    if (!this.isInitialized) {
      console.warn("Verb lemmatizer not initialized");
      return null;
    }

    const cleanWord = this.cleanConjugation(word);

    // Check if it's already an infinitive
    if (this.infinitives.has(cleanWord)) {
      return cleanWord;
    }

    // Look up conjugated form
    return this.conjugationToInfinitive.get(cleanWord) || null;
  }

  /**
   * Check if a word is a known verb (infinitive or conjugated)
   * @param {string} word - The word to check
   * @returns {boolean} - True if it's a known verb form
   */
  isKnownVerb(word) {
    return this.getInfinitive(word) !== null;
  }

  /**
   * Get statistics about the lemmatizer
   */
  getStats() {
    return {
      totalInfinitives: this.infinitives.size,
      totalConjugations: this.conjugationToInfinitive.size,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Export the lookup table for debugging or caching
   */
  exportLookupTable() {
    if (!this.isInitialized) return null;

    return {
      conjugationToInfinitive: Object.fromEntries(this.conjugationToInfinitive),
      infinitives: Array.from(this.infinitives),
      stats: this.getStats(),
    };
  }
}

// Create singleton instance
export const spanishVerbLemmatizer = new SpanishVerbLemmatizer();

// Utility function for easy usage
export const getVerbInfinitive = (word) => {
  return spanishVerbLemmatizer.getInfinitive(word);
};

export const isKnownVerb = (word) => {
  return spanishVerbLemmatizer.isKnownVerb(word);
};

// Export the class for direct instantiation if needed
export { SpanishVerbLemmatizer };
