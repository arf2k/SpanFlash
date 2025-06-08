// utils/conjugationService.js
export class ConjugationService {
  constructor() {
    // Use hosted version by default, change to localhost:8000 if self-hosting
    this.apiBase = 'http://verbe.cc/vcfr';
    this.cache = new Map();
    this.verbCache = new Set(); // Cache known verbs
  }

  // Check if a word is likely a Spanish verb
  isVerb(spanishWord) {
    if (!spanishWord) return false;
    
    // Basic Spanish verb patterns
    const verbEndings = ['ar', 'er', 'ir'];
    const word = spanishWord.toLowerCase().trim();
    
    // Check if it ends with verb suffixes
    return verbEndings.some(ending => word.endsWith(ending)) ||
           this.verbCache.has(word); // Or we know it's a verb from API
  }

  // Get all conjugations for a verb
  async getConjugations(verb) {
    const cacheKey = `full-${verb}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${this.apiBase}/conjugate/es/${verb}`);
      if (!response.ok) throw new Error('API request failed');
      
      const data = await response.json();
      
      if (data.value && data.value.moods) {
        this.verbCache.add(verb); // Cache as known verb
        this.cache.set(cacheKey, data.value);
        return data.value;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to conjugate ${verb}:`, error);
      return null;
    }
  }

  // Get specific conjugation (e.g., present tense)
  async getSpecificConjugation(verb, mood = 'indicativo', tense = 'presente') {
    const cacheKey = `${verb}-${mood}-${tense}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const url = `${this.apiBase}/conjugate/es/${verb}?mood=${mood}&tense=${tense}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('API request failed');
      
      const data = await response.json();
      
      if (data.value && Array.isArray(data.value)) {
        this.verbCache.add(verb);
        this.cache.set(cacheKey, data.value);
        return data.value;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to get ${mood} ${tense} for ${verb}:`, error);
      return null;
    }
  }

  // Generate a conjugation question for your Leitner system
  async generateConjugationQuestion(word) {
    if (!this.isVerb(word.spanish)) {
      return null;
    }

    const moods = ['indicativo'];
    const tenses = ['presente', 'pretérito', 'imperfecto', 'futuro'];
    const persons = [
      { label: 'yo', index: 0 },
      { label: 'tú', index: 1 },
      { label: 'él/ella', index: 2 },
      { label: 'nosotros', index: 3 },
      { label: 'vosotros', index: 4 },
      { label: 'ellos/ellas', index: 5 }
    ];

    // Pick random mood and tense
    const mood = moods[Math.floor(Math.random() * moods.length)];
    const tense = tenses[Math.floor(Math.random() * tenses.length)];
    const person = persons[Math.floor(Math.random() * persons.length)];

    try {
      const conjugations = await this.getSpecificConjugation(word.spanish, mood, tense);
      
      if (!conjugations || !conjugations[person.index]) {
        return null;
      }

      // Clean up the conjugation (remove pronouns)
      let answer = conjugations[person.index];
      answer = answer.replace(/^(yo|tú|él|ella|nosotros|vosotros|ellos|ellas)\s+/, '');

      return {
        type: 'conjugation',
        word: word,
        question: `Conjugate "${word.spanish}" for "${person.label}" in ${tense}`,
        answer: answer.trim(),
        fullAnswer: conjugations[person.index],
        mood: mood,
        tense: tense,
        person: person.label,
        englishMeaning: word.english
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
            isConfirmedVerb: true
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