const fs = require('fs');
const path = require('path');

class ConsolidationAnalyzer {
  constructor() {
    this.masterListPath = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');
    this.outputPath = path.join(__dirname, '..', 'consolidation_review.json');
  }

  loadMasterList() {
    try {
      const rawData = fs.readFileSync(this.masterListPath, 'utf-8');
      this.masterData = JSON.parse(rawData);
      console.log(`📚 Loaded ${this.masterData.words.length} words from master vocabulary`);
      return true;
    } catch (error) {
      console.error('❌ Failed to load master vocabulary:', error.message);
      return false;
    }
  }

  normalizeSpanish(spanish) {
    if (typeof spanish !== 'string') return '';
    
    // Remove common articles
    let normalized = spanish.toLowerCase().trim();
    normalized = normalized.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '');
    
    // Remove accents for grouping
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Remove punctuation 
    normalized = normalized.replace(/[.,;:!?¡¿"'()]/g, '');
    
    return normalized.trim();
  }

  normalizeEnglish(english) {
    if (typeof english !== 'string') return '';
    
    let normalized = english.toLowerCase().trim();
    
    // Remove common articles  
    normalized = normalized.replace(/^(the|a|an)\s+/i, '');
    
    // Remove punctuation
    normalized = normalized.replace(/[.,;:!?"'()]/g, '');
    
    return normalized.trim();
  }

  groupBySpanishWord() {
    const spanishGroups = new Map();
    
    this.masterData.words.forEach((word, index) => {
      if (!word.spanish || !word.english) return;
      
      const normalizedSpanish = this.normalizeSpanish(word.spanish);
      const originalSpanish = word.spanish.trim();
      
      if (!spanishGroups.has(normalizedSpanish)) {
        spanishGroups.set(normalizedSpanish, {
          normalizedSpanish,
          originalSpanishVariants: new Set(),
          words: []
        });
      }
      
      const group = spanishGroups.get(normalizedSpanish);
      group.originalSpanishVariants.add(originalSpanish);
      group.words.push({ ...word, originalIndex: index });
    });

    return spanishGroups;
  }

  analyzeDuplicates(spanishGroups) {
    const duplicateGroups = [];
    const verbToIssues = [];
    
    spanishGroups.forEach((group, normalizedSpanish) => {
      if (group.words.length <= 1) return; // Skip single entries
      
      // Get unique English translations
      const englishVariants = [...new Set(group.words.map(w => w.english.trim()))];
      
      if (englishVariants.length > 1) {
        // Multiple English translations for same Spanish word
        const analysis = this.analyzeEnglishVariants(group.words, englishVariants);
        
        duplicateGroups.push({
          spanishWord: normalizedSpanish,
          originalSpanishVariants: [...group.originalSpanishVariants],
          wordCount: group.words.length,
          englishVariants: englishVariants,
          words: group.words,
          analysis: analysis,
          consolidationSuggestion: this.suggestConsolidation(analysis)
        });
        
        // Check for verb "to" issues
        const verbToIssue = this.detectVerbToIssues(englishVariants, group.words);
        if (verbToIssue) {
          verbToIssues.push({
            spanishWord: normalizedSpanish,
            issue: verbToIssue,
            words: group.words.filter(w => 
              verbToIssue.withTo.includes(w.english.trim()) || 
              verbToIssue.withoutTo.includes(w.english.trim())
            )
          });
        }
      }
    });

    return { duplicateGroups, verbToIssues };
  }

  analyzeEnglishVariants(words, englishVariants) {
    const analysis = {
      totalWords: words.length,
      uniqueEnglish: englishVariants.length,
      hasLearningProgress: words.filter(w => w.timesStudied > 0).length,
      bestCompleteness: null,
      possibleMerges: []
    };

    // Score each word by completeness
    const scoredWords = words.map(word => ({
      ...word,
      completenessScore: this.getCompletenessScore(word)
    })).sort((a, b) => b.completenessScore - a.completenessScore);

    analysis.bestCompleteness = scoredWords[0];

    // Look for possible merges (similar English meanings)
    for (let i = 0; i < englishVariants.length; i++) {
      for (let j = i + 1; j < englishVariants.length; j++) {
        const similarity = this.calculateSimilarity(englishVariants[i], englishVariants[j]);
        if (similarity > 0.6) { // 60% similarity threshold
          analysis.possibleMerges.push({
            english1: englishVariants[i],
            english2: englishVariants[j], 
            similarity: Math.round(similarity * 100)
          });
        }
      }
    }

    return analysis;
  }

  detectVerbToIssues(englishVariants) {
    const withTo = [];
    const withoutTo = [];
    
    englishVariants.forEach(english => {
      const normalized = english.toLowerCase().trim();
      
      if (normalized.startsWith('to ')) {
        withTo.push(english);
        // Check if version without "to" exists
        const withoutToVersion = normalized.substring(3); // Remove "to "
        const matchingWithoutTo = englishVariants.find(e => 
          this.normalizeEnglish(e) === withoutToVersion
        );
        if (matchingWithoutTo) {
          withoutTo.push(matchingWithoutTo);
        }
      }
    });

    if (withTo.length > 0 && withoutTo.length > 0) {
      return {
        type: 'verb_to_inconsistency',
        withTo: withTo,
        withoutTo: withoutTo,
        suggestion: 'Keep "to" versions for verbs, remove versions without "to"'
      };
    }

    return null;
  }

  getCompletenessScore(word) {
    let score = 0;
    if (word.notes && word.notes.trim()) score += 2;
    if (word.synonyms_spanish && word.synonyms_spanish.length > 0) score += 1;
    if (word.synonyms_english && word.synonyms_english.length > 0) score += 1;
    if (word.category && word.category.trim()) score += 1;
    if (word.timesStudied > 0) score += 3; // Learning progress is valuable
    if (word.frequencyRank && word.frequencyRank < 99999) score += 1;
    return score;
  }

  calculateSimilarity(str1, str2) {
    const norm1 = this.normalizeEnglish(str1);
    const norm2 = this.normalizeEnglish(str2);
    
    if (norm1 === norm2) return 1.0;
    
    // Simple similarity based on common words
    const words1 = norm1.split(' ');
    const words2 = norm2.split(' ');
    const allWords = new Set([...words1, ...words2]);
    const commonWords = words1.filter(w => words2.includes(w));
    
    return commonWords.length / allWords.size;
  }

  suggestConsolidation(analysis) {
    const suggestions = [];
    
    // Suggest keeping the most complete version
    if (analysis.bestCompleteness) {
      suggestions.push({
        action: 'keep_best',
        reason: `Keep most complete version: "${analysis.bestCompleteness.english}"`,
        targetWord: analysis.bestCompleteness
      });
    }
    
    // Suggest merging similar translations
    if (analysis.possibleMerges.length > 0) {
      analysis.possibleMerges.forEach(merge => {
        suggestions.push({
          action: 'consider_merge',
          reason: `Consider merging "${merge.english1}" and "${merge.english2}" (${merge.similarity}% similar)`,
          english1: merge.english1,
          english2: merge.english2
        });
      });
    }
    
    return suggestions;
  }

  generateReviewFile() {
    const spanishGroups = this.groupBySpanishWord();
    const { duplicateGroups, verbToIssues } = this.analyzeDuplicates(spanishGroups);
    
    const reviewData = {
      generatedDate: new Date().toISOString(),
      summary: {
        totalWords: this.masterData.words.length,
        spanishWordsWithDuplicates: duplicateGroups.length,
        verbToIssues: verbToIssues.length,
        totalDuplicateWords: duplicateGroups.reduce((sum, group) => sum + group.wordCount, 0)
      },
      duplicateGroups: duplicateGroups.map(group => ({
        spanishWord: group.spanishWord,
        originalSpanishVariants: group.originalSpanishVariants,
        englishVariants: group.englishVariants,
        wordCount: group.wordCount,
        analysis: group.analysis,
        consolidationSuggestion: group.consolidationSuggestion,
        words: group.words.map(word => ({
          ...word,
          action: 'review', // User will set to: 'keep', 'delete', 'merge'
          notes: '', // User can add consolidation notes
          suggestedEnglish: word.english // User can edit this
        }))
      })),
      verbToIssues: verbToIssues.map(issue => ({
        spanishWord: issue.spanishWord,
        issueType: issue.issue.type,
        withTo: issue.issue.withTo,
        withoutTo: issue.issue.withoutTo,
        suggestion: issue.issue.suggestion,
        words: issue.words.map(word => ({
          ...word,
          action: 'review', // User will decide
          shouldKeep: null // User will set true/false
        }))
      }))
    };

    fs.writeFileSync(this.outputPath, JSON.stringify(reviewData, null, 2));
    console.log(`\n📄 Consolidation review file created: ${this.outputPath}`);
    
    return reviewData;
  }

  displaySummary(reviewData) {
    console.log(`\n📊 CONSOLIDATION ANALYSIS SUMMARY`);
    console.log(`=`.repeat(60));
    console.log(`Total vocabulary words: ${reviewData.summary.totalWords.toLocaleString()}`);
    console.log(`Spanish words with duplicates: ${reviewData.summary.spanishWordsWithDuplicates}`);
    console.log(`Total duplicate word entries: ${reviewData.summary.totalDuplicateWords}`);
    console.log(`Verb "to" inconsistencies: ${reviewData.summary.verbToIssues}`);

    if (reviewData.duplicateGroups.length > 0) {
      console.log(`\n🔍 TOP DUPLICATE EXAMPLES:`);
      reviewData.duplicateGroups.slice(0, 5).forEach(group => {
        console.log(`\n"${group.spanishWord}" has ${group.wordCount} entries:`);
        group.englishVariants.forEach(english => {
          console.log(`  → "${english}"`);
        });
        if (group.consolidationSuggestion.length > 0) {
          console.log(`  💡 ${group.consolidationSuggestion[0].reason}`);
        }
      });
    }

    if (reviewData.verbToIssues.length > 0) {
      console.log(`\n🔗 VERB "TO" ISSUES:`);
      reviewData.verbToIssues.slice(0, 3).forEach(issue => {
        console.log(`\n"${issue.spanishWord}":`);
        console.log(`  With "to": ${issue.withTo.join(', ')}`);
        console.log(`  Without "to": ${issue.withoutTo.join(', ')}`);
        console.log(`  💡 ${issue.suggestion}`);
      });
    }

    console.log(`\n💡 NEXT STEPS:`);
    console.log(`1. Review ${this.outputPath}`);
    console.log(`2. For each duplicate group, set 'action' on words: 'keep', 'delete', or 'merge'`);
    console.log(`3. For verb issues, set 'shouldKeep' to true/false for each word`);
    console.log(`4. Edit 'suggestedEnglish' fields as needed`);
    console.log(`5. Run the consolidation import script (coming next) to apply changes`);
  }

  run() {
    console.log(`🔍 ANALYZING VOCABULARY FOR CONSOLIDATION OPPORTUNITIES\n`);
    
    if (!this.loadMasterList()) {
      return;
    }

    const reviewData = this.generateReviewFile();
    this.displaySummary(reviewData);
    
    console.log(`\n✅ Consolidation analysis complete!`);
  }
}

// Run the analyzer
if (require.main === module) {
  const analyzer = new ConsolidationAnalyzer();
  analyzer.run();
}

module.exports = { ConsolidationAnalyzer };