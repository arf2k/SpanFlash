import { getWordFrequencyRank } from '../data/spanishFrequency.js';
import { db } from '../db.js';
import { shuffleArray } from '../utils/gameUtils.js';

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

  // UPDATED WITH SMART SELECTION - THIS IS THE KEY CHANGE
  generateFlashcardsList(maxWords = 200) {
    try {
      console.log(`Generating flashcard list using learning data...`);

      // Check how much data we have
      const studiedWords = this.wordList.filter(word => word.timesStudied > 0);
      const unstudiedWords = this.wordList.filter(word => !word.timesStudied);

      console.log(`Progress: ${studiedWords.length} studied, ${unstudiedWords.length} new`);

      let finalSelection = [];

      // SMART SELECTION based on learning data
      if (studiedWords.length > 0) {
        // We have learning data! Use it!

        // 1. Get struggling words (high priority)
        const strugglingWords = studiedWords.filter(word => {
          const accuracy = word.timesCorrect / word.timesStudied;
          return accuracy < 0.7; // Less than 70% accuracy
        }).sort((a, b) => {
          // Worst accuracy first
          const aAcc = a.timesCorrect / a.timesStudied;
          const bAcc = b.timesCorrect / b.timesStudied;
          return aAcc - bAcc;
        });

        // 2. Get words due for review
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const dueForReview = studiedWords.filter(word => {
          const daysSinceReview = (now - word.lastStudied) / ONE_DAY;
          const accuracy = word.timesCorrect / word.timesStudied;

          // Review intervals based on performance
          if (accuracy < 0.5) return daysSinceReview > 0.5;  // Review after 12 hours
          if (accuracy < 0.8) return daysSinceReview > 1;    // Review after 1 day
          return daysSinceReview > 3;                         // Review after 3 days
        });

        // 3. Get some random studied words for variety
        const otherStudied = shuffleArray(
          studiedWords.filter(w =>
            !strugglingWords.includes(w) && !dueForReview.includes(w)
          )
        );

        // 4. Get high-frequency new words
        const rankedNew = unstudiedWords
          .map(word => ({
            ...word,
            frequencyRank: getWordFrequencyRank(word.spanish) || 99999
          }))
          .sort((a, b) => a.frequencyRank - b.frequencyRank);

        // Build final list with smart distribution
        const distribution = {
          struggling: Math.min(strugglingWords.length, Math.floor(maxWords * 0.3)),
          dueReview: Math.min(dueForReview.length, Math.floor(maxWords * 0.2)),
          practiced: Math.min(otherStudied.length, Math.floor(maxWords * 0.1)),
          new: Math.min(rankedNew.length, Math.floor(maxWords * 0.4))
        };

        console.log('Smart distribution:', distribution);

        finalSelection = [
          ...strugglingWords.slice(0, distribution.struggling),
          ...dueForReview.slice(0, distribution.dueReview),
          ...otherStudied.slice(0, distribution.practiced),
          ...rankedNew.slice(0, distribution.new)
        ];

        // Fill remaining slots with more new words
        const remaining = maxWords - finalSelection.length;
        if (remaining > 0) {
          const moreNew = rankedNew
            .slice(distribution.new, distribution.new + remaining);
          finalSelection.push(...moreNew);
        }

      } else {
        // No learning data yet - use frequency-based selection
        console.log('No studied words yet, using frequency-based selection');

        const rankedWords = unstudiedWords
          .map(word => ({
            ...word,
            frequencyRank: getWordFrequencyRank(word.spanish) || 99999
          }))
          .sort((a, b) => a.frequencyRank - b.frequencyRank);

        // Mix high-frequency with random for variety
        const highFreq = rankedWords.slice(0, maxWords * 0.6);
        const randomWords = shuffleArray(rankedWords.slice(maxWords * 0.6));

        finalSelection = [
          ...highFreq,
          ...randomWords.slice(0, maxWords * 0.4)
        ];
      }

      // Final shuffle for variety
      const shuffledFinal = shuffleArray(finalSelection.slice(0, maxWords));

      console.log(`Returning ${shuffledFinal.length} words (${studiedWords.length > 0 ? 'smart' : 'frequency'} mode)`);

      return {
        id: 'flashcard_words',
        name: studiedWords.length > 0 ? 'Smart Practice' : 'Learning Mode',
        description: studiedWords.length > 0
          ? `Focusing on struggling words and reviews (${studiedWords.length} words tracked)`
          : 'Starting with high-frequency Spanish words',
        words: shuffledFinal,
        algorithmUsed: studiedWords.length > 0 ? 'smart_spaced_repetition' : 'frequency_based',
        stats: {
          totalStudied: studiedWords.length,
          struggling: finalSelection.filter(w =>
            w.timesStudied > 0 && (w.timesCorrect / w.timesStudied) < 0.7
          ).length,
          newWords: finalSelection.filter(w => !w.timesStudied).length
        }
      };

    } catch (error) {
      console.error('Failed to generate flashcard list:', error);
      return this.createEmptyList('flashcard_words', 'Flashcard Practice');
    }
  }

  // NEW: Generate flashcards with session exclusions to prevent repeats
  generateFlashcardsListWithExclusions(maxWords = 20, excludeIds = new Set()) {
    try {
      console.log(`Generating ${maxWords} words, excluding ${excludeIds.size} already shown`);

      // Filter out already shown words
      const availableWords = this.wordList.filter(word =>
        !excludeIds.has(word.id) &&
        word.exposureLevel !== 'known'
      );

      if (availableWords.length === 0) {
        console.log('No more words available in this session');
        return this.createEmptyList('flashcard_words', 'All words seen this session');
      }

      // Shuffle and select
      const shuffled = shuffleArray(availableWords);
      const selected = shuffled.slice(0, maxWords);

      console.log(`Selected ${selected.length} from ${availableWords.length} available words`);

      return {
        id: 'flashcard_words',
        name: 'Flashcard Practice',
        description: 'Random selection (no repeats this session)',
        words: selected,
        algorithmUsed: 'random_selection_no_repeats',
        remainingInSession: availableWords.length - selected.length
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

  // NEW: Mark word as “known” (user already knows it, skip learning)
  async markWordAsKnown(wordId) {
    try {
      const word = await db.allWords.get(wordId);
      if (word) {
        word.exposureLevel = 'known';
        word.timesStudied = word.timesStudied || 1;
        word.timesCorrect = word.timesCorrect || 1;
        word.lastStudied = Date.now();
        await db.allWords.put(word);
        console.log(`Marked "${word.spanish}" as known`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to mark word as known:', error);
      return false;
    }
  }

  // NEW: Get words by exposure level
  getWordsByExposure(level, count) {
    return this.wordList
      .filter(word => (word.exposureLevel || 'new') === level)
      .sort(() => 0.5 - Math.random())
      .slice(0, count);
  }

  // NEW: Get struggling words (poor accuracy)
  getStrugglingWords(count) {
    return this.wordList.filter(word => {
      const accuracy = word.timesStudied > 0 ?
        (word.timesCorrect / word.timesStudied) : 1;
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
