import { getWordFrequencyRank } from '../data/spanishFrequency.js';

export class StudyListService {
  constructor(wordList = []) {
    this.wordList = wordList;
  }

  // Basic frequency gap analysis
  async generateFrequencyGaps(maxWords = 30) {
    try {
      // Dynamic import to avoid bundle bloat
      const { analyzeVocabularyFrequency } = await import('../data/spanishFrequency.js');
      const analysis = analyzeVocabularyFrequency(this.wordList);
      
      return {
        id: 'frequency_gaps',
        name: 'Missing Common Words',
        description: 'High-frequency Spanish words not in your vocabulary',
        words: analysis.suggestions.criticalGaps.slice(0, maxWords),
        algorithmUsed: 'frequency_analysis',
        metadata: {
          totalSuggestions: analysis.suggestions.criticalGaps.length,
          userCoverage: analysis.coverage
        }
      };
    } catch (error) {
      console.error('Failed to generate frequency gaps:', error);
      return this.createEmptyList('frequency_gaps', 'Missing Common Words');
    }
  }

  // Group verb conjugations 
  generateVerbFamilies() {
    const verbGroups = new Map();
    
    this.wordList.forEach(word => {
      if (this.isLikelyVerb(word.spanish)) {
        const infinitive = this.guessInfinitive(word.spanish);
        
        if (!verbGroups.has(infinitive)) {
          verbGroups.set(infinitive, {
            infinitive,
            forms: [],
            englishMeaning: word.english,
            frequencyRank: getWordFrequencyRank(infinitive) || 99999
          });
        }
        
        verbGroups.get(infinitive).forms.push(word);
      }
    });

    // Convert to list format
    return {
      id: 'verb_families',
      name: 'Verb Families',
      description: 'Grouped conjugated forms of verbs in your vocabulary',
      groups: Array.from(verbGroups.values()).filter(group => group.forms.length > 1),
      algorithmUsed: 'conjugation_grouping'
    };
  }

  // Random sampling for maintenance
  generateMaintenanceSample(sampleSize = 20) {
    const shuffled = [...this.wordList].sort(() => 0.5 - Math.random());
    
    return {
      id: 'maintenance_sample',
      name: 'Vocabulary Maintenance',
      description: 'Random sample for general vocabulary review',
      words: shuffled.slice(0, sampleSize).map(word => ({
        ...word,
        reason: 'maintenance_review'
      })),
      algorithmUsed: 'random_sampling'
    };
  }

  // Helper methods
  isLikelyVerb(spanish) {
    return /^[a-záéíóúüñ]+(ar|er|ir)$/i.test(spanish.trim()) ||
           /^[a-záéíóúüñ]+(é|ó|ió|aste|amos|aron)$/i.test(spanish.trim());
  }

  guessInfinitive(spanish) {
    const word = spanish.toLowerCase().trim();
    
    // Simple heuristic - just return the word if it looks like infinitive
    if (word.endsWith('ar') || word.endsWith('er') || word.endsWith('ir')) {
      return word;
    }
    
    // For conjugated forms, try to guess infinitive (very basic)
    if (word.endsWith('é') || word.endsWith('ó')) {
      return word.slice(0, -1) + 'ar'; // habló -> hablar
    }
    
    // Return as-is if can't determine
    return word;
  }

  createEmptyList(id, name) {
    return {
      id,
      name,
      description: 'Unable to generate list',
      words: [],
      algorithmUsed: 'none',
      error: true
    };
  }
}