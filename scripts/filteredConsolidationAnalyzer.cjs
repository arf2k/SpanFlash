const fs = require('fs');
const path = require('path');

class FilteredConsolidationAnalyzer {
  constructor() {
    this.masterListPath = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');
    this.outputPath = path.join(__dirname, '..', 'filtered_consolidation_review.json');
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

  normalizeSpanishForGrouping(spanish) {
    if (typeof spanish !== 'string') return '';
    
    // More conservative normalization - only remove obvious formatting differences
    let normalized = spanish.toLowerCase().trim();
    
    // Remove articles for grouping
    normalized = normalized.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '');
    
    // Remove accents for grouping
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Remove basic punctuation
    normalized = normalized.replace(/[.,;:!?¡¿"'()]/g, '');
    
    return normalized.trim();
  }

  normalizeEnglishForComparison(english) {
    if (typeof english !== 'string') return '';
    
    let normalized = english.toLowerCase().trim();
    
    // Remove articles
    normalized = normalized.replace(/^(the|a|an)\s+/i, '');
    
    // Remove "to" for verb comparison
    normalized = normalized.replace(/^to\s+/i, '');
    
    // Remove basic punctuation  
    normalized = normalized.replace(/[.,;:!?"'()]/g, '');
    
    return normalized.trim();
  }

  calculateEnglishSimilarity(english1, english2) {
    const norm1 = this.normalizeEnglishForComparison(english1);
    const norm2 = this.normalizeEnglishForComparison(english2);
    
    // Exact match after normalization
    if (norm1 === norm2) return 1.0;
    
    // Calculate word-based similarity
    const words1 = norm1.split(' ').filter(w => w.length > 0);
    const words2 = norm2.split(' ').filter(w => w.length > 0);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const allWords = new Set([...words1, ...words2]);
    const commonWords = words1.filter(w => words2.includes(w));
    
    return commonWords.length / allWords.size;
  }

  isObviousConsolidationCandidate(group) {
    if (group.words.length <= 1) return false;
    
    // Get all English meanings
    const englishMeanings = group.words.map(w => w.english.trim());
    
    // Check if this is primarily a formatting issue
    let highSimilarityPairs = 0;
    let totalPairs = 0;
    
    for (let i = 0; i < englishMeanings.length; i++) {
      for (let j = i + 1; j < englishMeanings.length; j++) {
        totalPairs++;
        const similarity = this.calculateEnglishSimilarity(englishMeanings[i], englishMeanings[j]);
        
        if (similarity >= 0.8) { // 80% similarity threshold
          highSimilarityPairs++;
        }
      }
    }
    
    // Only consider obvious if most pairs are highly similar
    const similarityRatio = highSimilarityPairs / totalPairs;
    return similarityRatio >= 0.7; // 70% of pairs must be similar
  }

  categorizeConsolidationType(group) {
    const englishMeanings = group.words.map(w => w.english.trim());
    const spanishVariants = group.words.map(w => w.spanish.trim());
    
    // Check for formatting-only differences
    const normalizedEnglish = [...new Set(englishMeanings.map(e => this.normalizeEnglishForComparison(e)))];
    const normalizedSpanish = [...new Set(spanishVariants.map(s => this.normalizeSpanishForGrouping(s)))];
    
    let category = 'formatting';
    let issues = [];
    
    // Detect specific formatting issues
    if (normalizedEnglish.length === 1) {
      // Same meaning, different formatting
      
      // Check for "to" verb variants
      const withTo = englishMeanings.filter(e => e.toLowerCase().startsWith('to '));
      const withoutTo = englishMeanings.filter(e => !e.toLowerCase().startsWith('to '));
      if (withTo.length > 0 && withoutTo.length > 0) {
        issues.push('to_verb_variants');
      }
      
      // Check for article variants
      const withArticles = englishMeanings.filter(e => /^(the|a|an)\s+/i.test(e));
      const withoutArticles = englishMeanings.filter(e => !/^(the|a|an)\s+/i.test(e));
      if (withArticles.length > 0 && withoutArticles.length > 0) {
        issues.push('english_article_variants');
      }
      
      // Check for Spanish article variants
      const spanishWithArticles = spanishVariants.filter(s => /^(el|la|los|las|un|una|unos|unas)\s+/i.test(s));
      const spanishWithoutArticles = spanishVariants.filter(s => !/^(el|la|los|las|un|una|unos|unas)\s+/i.test(s));
      if (spanishWithArticles.length > 0 && spanishWithoutArticles.length > 0) {
        issues.push('spanish_article_variants');
      }
      
      // Check for capitalization variants
      const capitalizedFirst = englishMeanings.filter(e => /^[A-Z]/.test(e));
      const lowercaseFirst = englishMeanings.filter(e => /^[a-z]/.test(e));
      if (capitalizedFirst.length > 0 && lowercaseFirst.length > 0) {
        issues.push('capitalization_variants');
      }
      
    } else if (normalizedEnglish.length <= 3 && group.words.length <= 6) {
      category = 'similar_meanings';
      issues.push('minor_meaning_differences');
    } else {
      category = 'complex';
      issues.push('significant_meaning_differences');
    }
    
    return { category, issues };
  }

  groupWordsBySpanish() {
    const spanishGroups = new Map();
    
    this.masterData.words.forEach((word, index) => {
      if (!word.spanish || !word.english) return;
      
      const normalizedSpanish = this.normalizeSpanishForGrouping(word.spanish);
      
      if (!spanishGroups.has(normalizedSpanish)) {
        spanishGroups.set(normalizedSpanish, {
          normalizedSpanish,
          originalSpanishVariants: new Set(),
          words: []
        });
      }
      
      const group = spanishGroups.get(normalizedSpanish);
      group.originalSpanishVariants.add(word.spanish.trim());
      group.words.push({ ...word, originalIndex: index });
    });

    return spanishGroups;
  }

  calculatePrimaryCandidateScore(word) {
    let score = 0;
    
    // Learning progress (highest priority)
    if (word.timesStudied > 0) {
      score += (word.timesStudied * 10);
      const accuracy = word.timesCorrect / word.timesStudied;
      score += (accuracy * 20);
    }
    
    // Prefer proper formatting
    if (word.english.toLowerCase().startsWith('to ')) score += 15; // Prefer "to" verbs
    if (/^(el|la|los|las|un|una|unos|unas)\s+/i.test(word.spanish)) score += 10; // Prefer Spanish articles
    
    // Prefer simpler/more common meanings
    const englishLength = word.english.length;
    score += Math.max(0, 30 - englishLength); // Shorter = often more basic
    
    // Frequency ranking
    if (word.frequencyRank && word.frequencyRank < 99999) {
      score += Math.max(0, 50 - (word.frequencyRank / 100));
    }
    
    // Completeness bonus
    if (word.notes && word.notes.trim()) score += 5;
    if (word.synonyms_english && word.synonyms_english.length > 0) score += 3;
    
    return score;
  }

  analyzeFilteredCandidates(spanishGroups) {
    const consolidationCandidates = [];
    const skippedComplex = [];
    
    spanishGroups.forEach((group, normalizedSpanish) => {
      if (group.words.length <= 1) return;
      
      const categorization = this.categorizeConsolidationType(group);
      
      // Only include obvious cases
      if (categorization.category === 'formatting' || 
          (categorization.category === 'similar_meanings' && this.isObviousConsolidationCandidate(group))) {
        
        // Score and sort words to find best primary
        const scoredWords = group.words.map(word => ({
          ...word,
          primaryScore: this.calculatePrimaryCandidateScore(word)
        })).sort((a, b) => b.primaryScore - a.primaryScore);
        
        const primaryWord = scoredWords[0];
        const secondaryWords = scoredWords.slice(1);
        
        // Collect synonyms
        const allEnglishMeanings = group.words.map(w => w.english.trim());
        const otherMeanings = secondaryWords.map(w => w.english.trim());
        const existingSynonyms = primaryWord.synonyms_english || [];
        const mergedSynonyms = [...new Set([...existingSynonyms, ...otherMeanings])];
        
        consolidationCandidates.push({
          spanishWord: normalizedSpanish,
          category: categorization.category,
          issues: categorization.issues,
          wordCount: group.words.length,
          uniqueMeanings: [...new Set(allEnglishMeanings)].length,
          consolidationPlan: {
            primaryWord: {
              ...primaryWord,
              suggestedSynonyms: mergedSynonyms,
              action: 'keep_as_primary'
            },
            secondaryWords: secondaryWords.map(word => ({
              ...word,
              action: 'merge_to_synonyms',
              learningProgress: {
                attempts: word.timesStudied || 0,
                accuracy: word.timesStudied > 0 ? Math.round((word.timesCorrect / word.timesStudied) * 100) : 0
              }
            })),
            impact: {
              wordsReduced: secondaryWords.length,
              synonymsAdded: otherMeanings.length,
              totalLearningProgress: group.words.reduce((sum, w) => sum + (w.timesStudied || 0), 0),
              lostLearningProgress: secondaryWords.reduce((sum, w) => sum + (w.timesStudied || 0), 0)
            }
          },
          userDecision: {
            approved: null,
            notes: ''
          }
        });
      } else {
        skippedComplex.push({
          spanishWord: normalizedSpanish,
          category: categorization.category,
          wordCount: group.words.length,
          reason: 'Complex meanings - requires manual review'
        });
      }
    });

    return { 
      consolidationCandidates: consolidationCandidates.sort((a, b) => b.wordCount - a.wordCount),
      skippedComplex: skippedComplex.sort((a, b) => b.wordCount - a.wordCount)
    };
  }

  generateReviewFile() {
    const spanishGroups = this.groupWordsBySpanish();
    const { consolidationCandidates, skippedComplex } = this.analyzeFilteredCandidates(spanishGroups);
    
    const totalWordsToConsolidate = consolidationCandidates.reduce((sum, group) => sum + group.wordCount, 0);
    const potentialReduction = consolidationCandidates.reduce((sum, group) => sum + group.consolidationPlan.impact.wordsReduced, 0);
    
    const reviewData = {
      generatedDate: new Date().toISOString(),
      summary: {
        totalWords: this.masterData.words.length,
        obviousConsolidationCandidates: consolidationCandidates.length,
        totalWordsToConsolidate: totalWordsToConsolidate,
        potentialReduction: potentialReduction,
        skippedComplexGroups: skippedComplex.length,
        estimatedFinalSize: this.masterData.words.length - potentialReduction
      },
      instructions: {
        focus: "This filtered version only shows obvious consolidation candidates - primarily formatting issues",
        categories: {
          formatting: "Same meanings with different formatting (capitalization, articles, 'to' prefixes)",
          similar_meanings: "Very similar meanings that are likely the same concept"
        },
        actions: "Set 'approved: true' for consolidations you want to apply"
      },
      obviousConsolidations: consolidationCandidates,
      skippedForManualReview: skippedComplex.slice(0, 20) // Show top 20 skipped for reference
    };

    fs.writeFileSync(this.outputPath, JSON.stringify(reviewData, null, 2));
    console.log(`\n📄 Filtered consolidation review file created: ${this.outputPath}`);
    
    return reviewData;
  }

  displaySummary(reviewData) {
    console.log(`\n📊 FILTERED SMART CONSOLIDATION ANALYSIS`);
    console.log(`=`.repeat(70));
    console.log(`Total vocabulary words: ${reviewData.summary.totalWords.toLocaleString()}`);
    console.log(`Obvious consolidation candidates: ${reviewData.summary.obviousConsolidationCandidates}`);
    console.log(`Complex cases skipped: ${reviewData.summary.skippedComplexGroups}`);
    console.log(`Potential vocabulary reduction: ${reviewData.summary.potentialReduction} words`);
    console.log(`Estimated final vocabulary size: ${reviewData.summary.estimatedFinalSize.toLocaleString()}`);

    if (reviewData.obviousConsolidations.length > 0) {
      console.log(`\n🔍 TOP OBVIOUS CONSOLIDATION CANDIDATES:`);
      
      reviewData.obviousConsolidations.slice(0, 10).forEach((group, index) => {
        const primary = group.consolidationPlan.primaryWord;
        const impact = group.consolidationPlan.impact;
        
        console.log(`\n${index + 1}. "${group.spanishWord}" (${group.category})`);
        console.log(`   Primary: "${primary.spanish}" → "${primary.english}"`);
        console.log(`   Issues: ${group.issues.join(', ')}`);
        console.log(`   Impact: -${impact.wordsReduced} words, +${impact.synonymsAdded} synonyms`);
        
        if (impact.lostLearningProgress > 0) {
          console.log(`   Learning: ${impact.lostLearningProgress} attempts would be lost`);
        }
      });
    }

    console.log(`\n💡 NEXT STEPS:`);
    console.log(`1. Review ${this.outputPath} - much smaller and focused list`);
    console.log(`2. Set 'approved: true' for obvious formatting fixes`);
    console.log(`3. Run the consolidation import script to apply changes`);
    console.log(`4. Later: tackle complex cases from the skipped list`);
    
    console.log(`\n🎯 FOCUS AREAS:`);
    const formattingIssues = reviewData.obviousConsolidations.filter(g => g.category === 'formatting').length;
    const similarMeanings = reviewData.obviousConsolidations.filter(g => g.category === 'similar_meanings').length;
    
    console.log(`• ${formattingIssues} formatting issues (safe to consolidate)`);
    console.log(`• ${similarMeanings} similar meaning groups (review carefully)`);
    console.log(`• This filtered approach avoids the complex primary selection issues`);
  }

  run() {
    console.log(`🎯 ANALYZING VOCABULARY FOR OBVIOUS CONSOLIDATION OPPORTUNITIES\n`);
    
    if (!this.loadMasterList()) {
      return;
    }

    const reviewData = this.generateReviewFile();
    this.displaySummary(reviewData);
    
    console.log(`\n✅ Filtered consolidation analysis complete!`);
  }
}

// Run the analyzer
if (require.main === module) {
  const analyzer = new FilteredConsolidationAnalyzer();
  analyzer.run();
}

module.exports = { FilteredConsolidationAnalyzer };