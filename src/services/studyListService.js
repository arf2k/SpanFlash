import { getWordFrequencyRank } from '../data/spanishFrequency.js';
import { db } from '../db.js';

export class StudyListService {
  constructor(wordList = []) {
    this.wordList = wordList;
  }

  // NEW: Enhanced word data structure (replaces Leitner)
  static enhanceWord(word) {
    return {
      // Existing core data
      ...word,
      
      // NEW: Exposure tracking (replaces Leitner boxes)
      exposureLevel: word.exposureLevel || 'new', // 'new', 'learning', 'familiar', 'mastered', 'known'
      timesStudied: word.timesStudied || 0,
      timesCorrect: word.timesCorrect || 0,
      lastStudied: word.lastStudied || null,
      
      // NEW: Algorithmic metadata
      frequencyRank: word.frequencyRank || getWordFrequencyRank(word.spanish) || 99999,
      source: word.source || 'scraped', // 'scraped', 'frequency', 'user_added'
      userPriority: word.userPriority || 'normal', // 'high', 'normal', 'low'
      
      // NEW: Game performance tracking
      gamePerformance: word.gamePerformance || {
        flashcards: { correct: 0, total: 0 },
        matching: { correct: 0, total: 0 },
        fillInBlank: { correct: 0, total: 0 },
        conjugation: { correct: 0, total: 0 }
      }
    };
  }

  // ENHANCED: Generate lists for harder games (matching, fill-in-blank) 
  generateNewWordsList(maxWords = 20) {
    try {
      // Work with current Leitner data until migration
      const newWords = this.wordList.filter(word => {
        const leitnerBox = word.leitnerBox || 0;
        const exposureLevel = word.exposureLevel;
        
        // If has exposureLevel, use it; otherwise use Leitner conversion
        if (exposureLevel) {
          return !['mastered', 'known'].includes(exposureLevel);
        } else {
          // Leitner boxes 0-2 are good for new word games (need context clues)
          return leitnerBox <= 2;
        }
      });
      
      // Prefer high-frequency words for learning
      const rankedWords = newWords
        .map(word => ({
          ...word,
          frequencyRank: getWordFrequencyRank(word.spanish) || 99999
        }))
        .sort((a, b) => a.frequencyRank - b.frequencyRank);

      return {
        id: 'new_words',
        name: 'New & Learning Words',
        description: 'Newer words perfect for matching and fill-in-blank games (they have context clues)',
        words: rankedWords.slice(0, maxWords),
        algorithmUsed: 'leitner_compatible_new_words',
        gameRecommendation: ['matching', 'fillInBlank'],
        targetExposureLevel: ['new', 'learning']
      };
    } catch (error) {
      console.error('Failed to generate new words list:', error);
      return this.createEmptyList('new_words', 'New & Learning Words');
    }
  }

  // ENHANCED: Generate list for flashcards (familiar words, no context clues)
  generateFlashcardsList(maxWords = 20) {
    try {
      // Work with current Leitner data until migration
      const eligibleWords = this.wordList.filter(word => {
        // Convert Leitner boxes to exposure logic
        const leitnerBox = word.leitnerBox || 0;
        const exposureLevel = word.exposureLevel;
        
        // If has exposureLevel, use it; otherwise use Leitner conversion
        if (exposureLevel) {
          return ['learning', 'familiar'].includes(exposureLevel);
        } else {
          // Leitner boxes 1-4 are good for flashcards (some exposure, not mastered)
          return leitnerBox >= 1 && leitnerBox <= 4;
        }
      });
      
      // If not enough eligible words, include some new words (box 0)
      if (eligibleWords.length < maxWords) {
        const newWords = this.wordList.filter(word => (word.leitnerBox || 0) === 0);
        eligibleWords.push(...newWords.slice(0, maxWords - eligibleWords.length));
      }

      const finalWords = eligibleWords.slice(0, maxWords);

      return {
        id: 'flashcard_words',
        name: 'Flashcard Practice',
        description: 'Words for recall practice (current data structure)',
        words: finalWords,
        algorithmUsed: 'leitner_compatible',
        sourceBreakdown: this.getSourceBreakdown(finalWords),
        gameRecommendation: ['flashcards'],
        targetExposureLevel: ['learning', 'familiar']
      };
    } catch (error) {
      console.error('Failed to generate flashcard list:', error);
      return this.createEmptyList('flashcard_words', 'Flashcard Practice');
    }
  }

  // NEW: Daily smart list that mixes different types
  generateDailyMix(maxWords = 25) {
    try {
      const newWords = this.getWordsByExposure('new', 8);
      const strugglingWords = this.getStrugglingWords(6);
      const maintenanceWords = this.getMaintenanceWords(6);
      const frequencyGaps = this.getHighFrequencyUnlearned(5);
      
      return {
        id: 'daily_mix',
        name: 'Daily Focus',
        description: 'Smart mix of new words, review, and maintenance',
        words: [...newWords, ...strugglingWords, ...maintenanceWords, ...frequencyGaps]
          .slice(0, maxWords),
        algorithmUsed: 'daily_smart_mix',
        gameRecommendation: ['all'],
        composition: {
          newWords: newWords.length,
          struggling: strugglingWords.length,
          maintenance: maintenanceWords.length,
          frequencyGaps: frequencyGaps.length
        }
      };
    } catch (error) {
      console.error('Failed to generate daily mix:', error);
      return this.createEmptyList('daily_mix', 'Daily Focus');
    }
  }

  // NEW: Mark word as "known" (user already knows it, skip learning)
  async markWordAsKnown(wordId) {
    try {
      const word = await db.allWords.get(wordId);
      if (!word) {
        console.error('Word not found:', wordId);
        return null;
      }

      const updatedWord = {
        ...word,
        exposureLevel: 'known',
        lastStudied: Date.now(),
        userPriority: 'low' // Known words get low priority
      };

      await db.allWords.put(updatedWord);
      console.log(`Word "${word.spanish}" marked as known`);
      return updatedWord;
    } catch (error) {
      console.error('Failed to mark word as known:', error);
      return null;
    }
  }

  // NEW: Update word exposure after game/study session
  async updateWordExposure(wordId, isCorrect, gameType = 'flashcards') {
    try {
      const word = await db.allWords.get(wordId);
      if (!word) return null;

      const updatedWord = StudyListService.enhanceWord(word);
      
      // Update study tracking
      updatedWord.timesStudied++;
      updatedWord.lastStudied = Date.now();
      if (isCorrect) updatedWord.timesCorrect++;
      
      // Update game-specific performance
      if (updatedWord.gamePerformance[gameType]) {
        updatedWord.gamePerformance[gameType].total++;
        if (isCorrect) updatedWord.gamePerformance[gameType].correct++;
      }
      
      // Calculate new exposure level
      updatedWord.exposureLevel = this.calculateExposureLevel(updatedWord);
      
      await db.allWords.put(updatedWord);
      console.log(`Updated word "${word.spanish}" exposure to ${updatedWord.exposureLevel}`);
      return updatedWord;
    } catch (error) {
      console.error('Failed to update word exposure:', error);
      return null;
    }
  }

  // Helper: Calculate exposure level based on performance
  calculateExposureLevel(word) {
    if (word.exposureLevel === 'known') return 'known'; // Don't change known words
    
    const accuracy = word.timesStudied > 0 ? (word.timesCorrect / word.timesStudied) : 0;
    const timesStudied = word.timesStudied || 0;
    
    if (timesStudied === 0) return 'new';
    if (timesStudied < 3 || accuracy < 0.5) return 'learning';
    if (timesStudied < 8 || accuracy < 0.8) return 'familiar';
    return 'mastered';
  }

  // Helper methods for list generation
  getWordsByExposure(exposureLevel, count) {
    return this.wordList
      .filter(word => (word.exposureLevel || 'new') === exposureLevel)
      .sort((a, b) => (getWordFrequencyRank(a.spanish) || 99999) - (getWordFrequencyRank(b.spanish) || 99999))
      .slice(0, count);
  }

  getStrugglingWords(count) {
    return this.wordList
      .filter(word => {
        const accuracy = word.timesStudied > 0 ? (word.timesCorrect / word.timesStudied) : 1;
        return word.timesStudied > 2 && accuracy < 0.6;
      })
      .sort((a, b) => {
        const aAccuracy = a.timesCorrect / a.timesStudied;
        const bAccuracy = b.timesCorrect / b.timesStudied;
        return aAccuracy - bAccuracy; // Worst performers first
      })
      .slice(0, count);
  }

  getMaintenanceWords(count) {
    const oldMasteredWords = this.wordList.filter(word => {
      const daysSinceStudied = word.lastStudied ? 
        (Date.now() - word.lastStudied) / (1000 * 60 * 60 * 24) : 999;
      return (word.exposureLevel === 'mastered' || word.exposureLevel === 'familiar') && 
             daysSinceStudied > 7;
    });
    
    // Random sample of old mastered words
    return oldMasteredWords
      .sort(() => 0.5 - Math.random())
      .slice(0, count);
  }

  getHighFrequencyUnlearned(count) {
    return this.wordList
      .filter(word => {
        const rank = getWordFrequencyRank(word.spanish) || 99999;
        const exposureLevel = word.exposureLevel || 'new';
        return rank <= 2000 && ['new', 'learning'].includes(exposureLevel);
      })
      .sort((a, b) => (getWordFrequencyRank(a.spanish) || 99999) - (getWordFrequencyRank(b.spanish) || 99999))
      .slice(0, count);
  }

  // Existing methods (enhanced)
  async generateFrequencyGaps(maxWords = 30) {
    try {
      const { analyzeVocabularyFrequency } = await import('../data/spanishFrequency.js');
      
      // Only analyze words that aren't marked as 'known'
      const learningWords = this.wordList.filter(word => 
        (word.exposureLevel || 'new') !== 'known'
      );
      
      const analysis = analyzeVocabularyFrequency(learningWords);
      
      return {
        id: 'frequency_gaps',
        name: 'Missing Common Words',
        description: 'High-frequency Spanish words not in your active vocabulary',
        words: analysis.suggestions.criticalGaps.slice(0, maxWords),
        algorithmUsed: 'frequency_analysis_excluding_known',
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

  generateVerbFamilies() {
    const verbGroups = new Map();
    
    // Only include verbs that aren't marked as 'known'
    const activeVerbs = this.wordList.filter(word => 
      (word.exposureLevel || 'new') !== 'known'
    );
    
    activeVerbs.forEach(word => {
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

    return {
      id: 'verb_families',
      name: 'Verb Families',
      description: 'Grouped conjugated forms of verbs in your active vocabulary',
      groups: Array.from(verbGroups.values()).filter(group => group.forms.length > 1),
      algorithmUsed: 'conjugation_grouping_excluding_known'
    };
  }

  generateMaintenanceSample(sampleSize = 20) {
    // Only sample from non-known words
    const activeWords = this.wordList.filter(word => 
      (word.exposureLevel || 'new') !== 'known'
    );
    
    const shuffled = [...activeWords].sort(() => 0.5 - Math.random());
    
    return {
      id: 'maintenance_sample',
      name: 'Vocabulary Maintenance',
      description: 'Random sample for general vocabulary review',
      words: shuffled.slice(0, sampleSize).map(word => ({
        ...word,
        reason: 'maintenance_review'
      })),
      algorithmUsed: 'random_sampling_excluding_known'
    };
  }

  // Helper methods (unchanged)
  isLikelyVerb(spanish) {
    return /^[a-záéíóúüñ]+(ar|er|ir)$/i.test(spanish.trim()) ||
           /^[a-záéíóúüñ]+(é|ó|ió|aste|amos|aron)$/i.test(spanish.trim());
  }

  guessInfinitive(spanish) {
    const word = spanish.toLowerCase().trim();
    
    if (word.endsWith('ar') || word.endsWith('er') || word.endsWith('ir')) {
      return word;
    }
    
    if (word.endsWith('é') || word.endsWith('ó')) {
      return word.slice(0, -1) + 'ar';
    }
    
    return word;
  }

  // NEW: Get words by source type
  getWordsBySource(sources = ['scraped']) {
    return this.wordList.filter(word => 
      sources.includes(word.source || 'scraped')
    );
  }

  // NEW: Show source breakdown for debugging/analysis
  getSourceBreakdown(words) {
    const breakdown = {};
    words.forEach(word => {
      const source = word.source || 'scraped';
      breakdown[source] = (breakdown[source] || 0) + 1;
    });
    return breakdown;
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