import { spanishConjugationRules } from './spanishConjugationRules';

/**
 * Hybrid Spanish Verb Lemmatizer
 * 1. First checks conjugations.json 
 * 2. Falls back to rule-based patterns (catches missing regular verbs)
 */
class SpanishVerbLemmatizer {
  constructor() {
    this.conjugationToInfinitive = new Map();
    this.infinitives = new Set();
    this.isInitialized = false;
  }

  /**
   * Initialize the lemmatizer with conjugation data + rule fallback
   * @param {Object} verbData - The conjugation database from ellaverbs
   */
  async initialize(verbData) {
    if (this.isInitialized) return;

    console.log("Building hybrid Spanish verb lemmatizer (JSON + Rules)...");
    let totalConjugations = 0;
    let duplicateCount = 0;

    // Process JSON database first (existing logic)
    Object.entries(verbData.verbs).forEach(([verbKey, verbInfo]) => {
      const infinitive = verbInfo.verb;
      this.infinitives.add(infinitive);

      // Process all tenses for this verb
      Object.entries(verbInfo.tenses).forEach(
        ([tenseName, tenseConjugations]) => {
          // Skip complex tenses that contain multiple words
          if (this.isCompoundTense(tenseName)) {
            return;
          }

          // Process each person's conjugation
          Object.entries(tenseConjugations).forEach(([person, conjugation]) => {
            if (this.isValidConjugation(conjugation)) {
              const cleanConjugation = this.cleanConjugation(conjugation);

              if (cleanConjugation && cleanConjugation !== infinitive) {
                // Check for duplicates
                if (this.conjugationToInfinitive.has(cleanConjugation)) {
                  const existingInfinitive =
                    this.conjugationToInfinitive.get(cleanConjugation);
                  if (existingInfinitive !== infinitive) {
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

    console.log(`✅ Hybrid verb lemmatizer initialized:`);
    console.log(`   - ${this.infinitives.size} base verbs from JSON`);
    console.log(`   - ${totalConjugations} unique conjugations mapped`);
    console.log(`   - Rule-based fallback ready for missing patterns`);
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

    return (
      conjugation.trim() !== "" &&
      conjugation !== "-" &&
      !conjugation.includes(" ") &&
      !conjugation.includes("no ")
    );
  }

  /**
   * Clean conjugation form for lookup
   */
  cleanConjugation(conjugation) {
    return conjugation
      .toLowerCase()
      .trim()
      .replace(/[¿¡.,;:!?'()]/g, ""); // Remove punctuation but keep accents
  }

  /**
   * Handle forms that could belong to multiple verbs
   */
  handleAmbiguousForm(conjugation, existing, newInfinitive) {
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
    }
  }

  /**
   * Get the infinitive form of a conjugated verb - HYBRID APPROACH
   * @param {string} word - The potentially conjugated verb
   * @returns {string|null} - The infinitive form, or null if not found
   */
  getInfinitive(word) {
    if (!this.isInitialized) {
      console.warn("Verb lemmatizer not initialized");
      return null;
    }

    const cleanWord = this.cleanConjugation(word);

    // 1. Check if it's already an infinitive
    if (this.infinitives.has(cleanWord)) {
      return cleanWord;
    }

    // 2. Check JSON database first 
    const jsonResult = this.conjugationToInfinitive.get(cleanWord);
    if (jsonResult) {
      return jsonResult;
    }

    // 3. Fallback to rule-based patterns for missing regular verbs
    const ruleResult = spanishConjugationRules.getInfinitive(cleanWord);
    if (ruleResult) {
      return ruleResult;
    }

    return null;
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
    const ruleStats = spanishConjugationRules.getStats();
    return {
      systemType: 'hybrid_json_plus_rules',
      totalInfinitives: this.infinitives.size,
      totalConjugations: this.conjugationToInfinitive.size,
      irregularRuleForms: ruleStats.irregularForms,
      isInitialized: this.isInitialized,
      coverage: 'comprehensive - JSON database + rule fallback'
    };
  }

  /**
   * Export the lookup table for debugging
   */
  exportLookupTable() {
    if (!this.isInitialized) return null;

    return {
      conjugationToInfinitive: Object.fromEntries(this.conjugationToInfinitive),
      infinitives: Array.from(this.infinitives),
      ruleStats: spanishConjugationRules.getStats(),
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