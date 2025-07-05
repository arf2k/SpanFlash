const fs = require('fs');
const path = require('path');
const readline = require('readline');

class PracticalConsolidationAnalyzer {
  constructor() {
    this.masterListPath = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');
    this.outputPath = path.join(__dirname, '..', 'consolidation_candidates.json');
    this.manualReviewPath = path.join(__dirname, '..', 'manual_review_candidates.json');
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
    
    let normalized = spanish.toLowerCase().trim();
    
    // Remove articles for grouping (but we'll prefer the version WITH articles)
    normalized = normalized.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '');
    
    // Remove accents for grouping
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Remove basic punctuation
    normalized = normalized.replace(/[.,;:!?¡¿"'()]/g, '');
    
    return normalized.trim();
  }

  isActualVerb(englishMeaning) {
    // Much more conservative verb detection
    const meaning = englishMeaning.toLowerCase().trim();
    
    // Clear verb indicators
    if (meaning.startsWith('to ')) return true;
    
    // Check against common verb patterns (but be conservative)
    const verbPatterns = [
      /^(am|is|are|was|were|being|been)\s/,
      /^(have|has|had|having)\s/,
      /^(do|does|did|doing|done)\s/,
      /^(will|would|shall|should|may|might|can|could|must)\s/,
      // Gerund forms that are clearly verbs
      /^(running|walking|eating|drinking|playing|working|studying|learning|teaching|speaking|writing|reading|cooking|dancing|singing|swimming|driving|traveling|helping|loving|living|dying|buying|selling|building|cleaning|cutting|burning|growing|jumping|climbing|throwing|carrying|moving|opening|closing|starting|stopping|trying|calling|listening|looking|watching|waiting|fighting|choosing|changing|creating|breaking|fixing|pushing|pulling)$/
    ];
    
    return verbPatterns.some(pattern => pattern.test(meaning));
  }

  calculateMeaningSimilarity(meanings) {
    // Calculate how similar the English meanings are
    // Return a score from 0 (completely different) to 1 (very similar)
    
    if (meanings.length <= 1) return 1;
    
    // Normalize all meanings for comparison
    const normalizedMeanings = meanings.map(m => 
      m.toLowerCase()
        .replace(/^(the|a|an|to)\s+/i, '')
        .replace(/[.,;:!?"'()]/g, '')
        .trim()
    );
    
    // Check for exact matches after normalization
    const uniqueNormalized = [...new Set(normalizedMeanings)];
    if (uniqueNormalized.length === 1) return 1; // All the same after normalization
    
    // Check for word overlap
    let totalSimilarity = 0;
    let pairs = 0;
    
    for (let i = 0; i < meanings.length; i++) {
      for (let j = i + 1; j < meanings.length; j++) {
        const words1 = normalizedMeanings[i].split(' ').filter(w => w.length > 2);
        const words2 = normalizedMeanings[j].split(' ').filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) continue;
        
        const commonWords = words1.filter(w => words2.includes(w));
        const allWords = [...new Set([...words1, ...words2])];
        
        const similarity = allWords.length > 0 ? commonWords.length / allWords.length : 0;
        totalSimilarity += similarity;
        pairs++;
      }
    }
    
    return pairs > 0 ? totalSimilarity / pairs : 0;
  }

  scoreWordForPrimary(word, allWords) {
    let score = 0;
    
    // REMOVED: Learning progress bias (as requested)
    
    // Strongly prefer proper formatting
    if (word.english.toLowerCase().startsWith('to ')) score += 15; // Prefer "to" verbs
    if (/^(el|la|los|las|un|una|unos|unas)\s+/i.test(word.spanish)) score += 20; // Strongly prefer Spanish articles
    
    // Prefer shorter, simpler definitions (often more basic/common)
    const englishLength = word.english.length;
    score += Math.max(0, 60 - englishLength); // Shorter gets significantly more points
    
    // Prefer single-word or two-word definitions
    const wordCount = word.english.trim().split(' ').length;
    if (wordCount === 1) score += 25; // Single word is best
    else if (wordCount === 2) score += 15; // Two words is good
    else if (wordCount >= 5) score -= 20; // Penalize long definitions heavily
    
    // Strong frequency ranking bonus (this should be primary factor)
    if (word.frequencyRank && word.frequencyRank < 99999) {
      const frequencyScore = Math.max(0, 100 - (word.frequencyRank / 100));
      score += frequencyScore;
    }
    
    // Avoid complex punctuation or unusual formatting
    if (word.english.includes(',') || word.english.includes(';')) score -= 15;
    if (word.english.includes('!') || word.english.includes('?')) score -= 10;
    if (/^[A-Z]/.test(word.english) && word.english.length > 3) score -= 5; // Slight penalty for capitalized (unless short)
    
    // Prefer common, basic meanings (avoid specialized terms)
    const specializedTerms = ['apparatus', 'opus', 'hull', 'wedge', 'stamina', 'vintage', 'fairway', 'ensemble'];
    if (specializedTerms.some(term => word.english.toLowerCase().includes(term))) {
      score -= 30;
    }
    
    // Prefer common, everyday words
    const commonWords = ['good', 'bad', 'big', 'small', 'hot', 'cold', 'new', 'old', 'right', 'wrong', 'easy', 'hard', 'fast', 'slow', 'high', 'low', 'near', 'far', 'early', 'late', 'strong', 'weak', 'clean', 'dirty', 'safe', 'dangerous', 'happy', 'sad', 'angry', 'calm', 'quiet', 'loud', 'light', 'dark', 'heavy', 'empty', 'full', 'open', 'closed', 'free', 'busy'];
    if (commonWords.some(word_check => word.english.toLowerCase().includes(word_check))) {
      score += 20;
    }
    
    // Small completeness bonus (but not major factor)
    if (word.notes && word.notes.trim()) score += 2;
    if (word.synonyms_english && word.synonyms_english.length > 0) score += 1;
    
    return score;
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

    // Filter to only groups with multiple words
    const multiWordGroups = new Map();
    spanishGroups.forEach((group, key) => {
      if (group.words.length > 1) {
        multiWordGroups.set(key, group);
      }
    });

    return multiWordGroups;
  }

  analyzeConsolidationCandidates(spanishGroups, options = {}) {
    const { focusOnVerbs = false, minGroupSize = 2, maxGroups = 50 } = options;
    
    const candidates = [];
    const manualReviewCases = [];
    
    spanishGroups.forEach((group, normalizedSpanish) => {
      if (group.words.length < minGroupSize) return;
      
      // Get all unique English meanings
      const allEnglishMeanings = group.words.map(w => w.english.trim());
      const uniqueMeanings = [...new Set(allEnglishMeanings)];
      
      // Check if this is a verb group (much more conservative)
      const verbCount = group.words.filter(word => this.isActualVerb(word.english)).length;
      const isVerbGroup = verbCount > 0 && verbCount >= group.words.length * 0.6; // At least 60% must be clear verbs
      
      // Skip if we're focusing on verbs and this isn't a verb group
      if (focusOnVerbs && !isVerbGroup) return;
      
      // Check meaning similarity
      const similarityScore = this.calculateMeaningSimilarity(uniqueMeanings);
      
      // If meanings are too different, send to manual review
      if (similarityScore < 0.1 && uniqueMeanings.length > 4) {
        manualReviewCases.push({
          spanishWord: normalizedSpanish,
          originalVariants: Array.from(group.originalSpanishVariants),
          wordCount: group.words.length,
          uniqueMeanings: uniqueMeanings.length,
          allMeanings: uniqueMeanings,
          similarityScore: similarityScore.toFixed(2),
          reason: 'Meanings too dissimilar for automatic consolidation',
          isVerb: isVerbGroup,
          needsManualReview: true
        });
        return;
      }
      
      // Score and sort words to find best primary
      const scoredWords = group.words.map(word => ({
        ...word,
        primaryScore: this.scoreWordForPrimary(word, group.words)
      })).sort((a, b) => b.primaryScore - a.primaryScore);
      
      const primaryWord = scoredWords[0];
      const secondaryWords = scoredWords.slice(1);
      
      // Collect potential synonyms (excluding primary)
      const otherMeanings = secondaryWords.map(w => w.english.trim());
      const existingSynonyms = primaryWord.synonyms_english || [];
      const newSynonyms = otherMeanings.filter(meaning => 
        meaning !== primaryWord.english.trim() && 
        !existingSynonyms.includes(meaning)
      );
      
      // Calculate impact
      const totalLearningProgress = group.words.reduce((sum, w) => sum + (w.timesStudied || 0), 0);
      const lostLearningProgress = secondaryWords.reduce((sum, w) => sum + (w.timesStudied || 0), 0);
      
      candidates.push({
        spanishWord: normalizedSpanish,
        originalVariants: Array.from(group.originalSpanishVariants),
        wordCount: group.words.length,
        uniqueMeanings: uniqueMeanings.length,
        isVerb: isVerbGroup,
        allMeanings: uniqueMeanings,
        similarityScore: similarityScore.toFixed(2),
        consolidationPlan: {
          primaryWord: {
            spanish: primaryWord.spanish,
            english: primaryWord.english,
            currentSynonyms: existingSynonyms,
            suggestedNewSynonyms: newSynonyms,
            learningProgress: {
              attempts: primaryWord.timesStudied || 0,
              accuracy: primaryWord.timesStudied > 0 ? 
                Math.round((primaryWord.timesCorrect / primaryWord.timesStudied) * 100) : 0
            },
            primaryScore: primaryWord.primaryScore.toFixed(1),
            originalIndex: primaryWord.originalIndex,
            frequencyRank: primaryWord.frequencyRank || 99999
          },
          secondaryWords: secondaryWords.map(word => ({
            spanish: word.spanish,
            english: word.english,
            learningProgress: {
              attempts: word.timesStudied || 0,
              accuracy: word.timesStudied > 0 ? 
                Math.round((word.timesCorrect / word.timesStudied) * 100) : 0
            },
            originalIndex: word.originalIndex,
            frequencyRank: word.frequencyRank || 99999
          })),
          impact: {
            wordsReduced: secondaryWords.length,
            synonymsAdded: newSynonyms.length,
            totalLearningProgress,
            lostLearningProgress
          }
        },
        userDecision: {
          approved: null,
          selectedPrimary: null, // Allow user to override primary selection
          notes: ''
        }
      });
    });

    // Sort candidates: verbs first (if focusing on verbs), then by word count, then by similarity
    const sortedCandidates = candidates.sort((a, b) => {
      if (focusOnVerbs) {
        if (a.isVerb !== b.isVerb) return b.isVerb ? 1 : -1;
      }
      if (a.wordCount !== b.wordCount) return b.wordCount - a.wordCount;
      return parseFloat(b.similarityScore) - parseFloat(a.similarityScore);
    }).slice(0, maxGroups);

    return { candidates: sortedCandidates, manualReviewCases };
  }

  displayCandidates(candidates, manualReviewCases, options = {}) {
    const { verbose = false, showProgress = true } = options;
    
    console.log(`\n📊 CONSOLIDATION CANDIDATES ANALYSIS`);
    console.log(`=`.repeat(70));
    console.log(`Consolidation candidates: ${candidates.length}`);
    console.log(`Manual review cases: ${manualReviewCases.length}`);
    
    const verbGroups = candidates.filter(c => c.isVerb).length;
    const totalWordsToConsolidate = candidates.reduce((sum, c) => sum + c.wordCount, 0);
    const potentialReduction = candidates.reduce((sum, c) => sum + c.consolidationPlan.impact.wordsReduced, 0);
    
    console.log(`Verb groups: ${verbGroups}`);
    console.log(`Total words involved: ${totalWordsToConsolidate}`);
    console.log(`Potential reduction: ${potentialReduction} words`);
    
    if (verbose && candidates.length > 0) {
      console.log(`\n🔍 DETAILED CANDIDATE LIST:`);
      
      candidates.forEach((candidate, index) => {
        const primary = candidate.consolidationPlan.primaryWord;
        const impact = candidate.consolidationPlan.impact;
        
        console.log(`\n${index + 1}. "${candidate.spanishWord}" ${candidate.isVerb ? '(VERB)' : ''}`);
        console.log(`   Variants: ${candidate.originalVariants.join(', ')}`);
        console.log(`   Total words: ${candidate.wordCount} → Unique meanings: ${candidate.uniqueMeanings}`);
        console.log(`   Similarity score: ${candidate.similarityScore}`);
        console.log(`   All meanings: ${candidate.allMeanings.join(' | ')}`);
        console.log(`   Suggested primary: "${primary.spanish}" → "${primary.english}"`);
        console.log(`   Primary score: ${primary.primaryScore} (freq rank: ${primary.frequencyRank})`);
        
        if (showProgress && (primary.learningProgress.attempts > 0 || impact.lostLearningProgress > 0)) {
          console.log(`   Learning: Primary has ${primary.learningProgress.attempts} attempts (${primary.learningProgress.accuracy}% accuracy)`);
          if (impact.lostLearningProgress > 0) {
            console.log(`   Warning: ${impact.lostLearningProgress} attempts would be lost from secondary words`);
          }
        }
        
        if (primary.suggestedNewSynonyms.length > 0) {
          console.log(`   New synonyms: ${primary.suggestedNewSynonyms.join(', ')}`);
        }
        
        console.log(`   Impact: -${impact.wordsReduced} words, +${impact.synonymsAdded} synonyms`);
      });
    } else if (candidates.length > 0) {
      console.log(`\n🔍 TOP 10 CANDIDATES (use --verbose for full list):`);
      
      candidates.slice(0, 10).forEach((candidate, index) => {
        const primary = candidate.consolidationPlan.primaryWord;
        
        console.log(`${index + 1}. "${candidate.spanishWord}" (${candidate.wordCount} words${candidate.isVerb ? ', VERB' : ''})`);
        console.log(`   → "${primary.english}" + ${primary.suggestedNewSynonyms.length} synonyms (sim: ${candidate.similarityScore})`);
      });
    }
    
    if (manualReviewCases.length > 0) {
      console.log(`\n⚠️  MANUAL REVIEW CASES (${manualReviewCases.length} groups):`);
      manualReviewCases.slice(0, 5).forEach((case_, index) => {
        console.log(`${index + 1}. "${case_.spanishWord}" (${case_.wordCount} words${case_.isVerb ? ', VERB' : ''})`);
        console.log(`   Meanings too different: ${case_.allMeanings.join(' | ')}`);
      });
      if (manualReviewCases.length > 5) {
        console.log(`   ... and ${manualReviewCases.length - 5} more (see manual_review_candidates.json)`);
      }
    }
  }

  generateReviewFiles(candidates, manualReviewCases) {
    // Main candidates file
    const reviewData = {
      generatedDate: new Date().toISOString(),
      summary: {
        totalCandidates: candidates.length,
        verbGroups: candidates.filter(c => c.isVerb).length,
        potentialReduction: candidates.reduce((sum, c) => sum + c.consolidationPlan.impact.wordsReduced, 0),
        totalWordsInvolved: candidates.reduce((sum, c) => sum + c.wordCount, 0),
        manualReviewCases: manualReviewCases.length
      },
      instructions: {
        focus: "Review each candidate and set 'approved: true' for consolidations you want to apply",
        workflow: [
          "1. Review the suggested primary word and synonyms",
          "2. Override 'selectedPrimary' if you prefer a different word as primary",
          "3. Set 'approved: true' for consolidations you approve",
          "4. Add notes if needed",
          "5. Run the consolidation import script to apply approved changes"
        ],
        scoring: "Primary words selected based on: frequency rank, simplicity, proper formatting (articles), common usage",
        batchProcessing: "Process largest groups first, then work down by size"
      },
      candidates: candidates
    };

    fs.writeFileSync(this.outputPath, JSON.stringify(reviewData, null, 2));
    console.log(`\n📄 Review file created: ${this.outputPath}`);
    
    // Manual review cases file
    if (manualReviewCases.length > 0) {
      const manualReviewData = {
        generatedDate: new Date().toISOString(),
        summary: {
          totalCases: manualReviewCases.length,
          reason: "These groups have meanings that are too dissimilar for automatic consolidation"
        },
        instructions: {
          focus: "These require manual review to determine if consolidation is appropriate",
          approach: "Consider whether the different meanings are actually related or should remain separate words"
        },
        cases: manualReviewCases
      };
      
      fs.writeFileSync(this.manualReviewPath, JSON.stringify(manualReviewData, null, 2));
      console.log(`📄 Manual review file created: ${this.manualReviewPath}`);
    }
    
    return reviewData;
  }

  async run() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const verbose = args.includes('--verbose');
    const verbsOnly = args.includes('--verbs-only');
    const minSize = args.includes('--min-size') ? 
      parseInt(args[args.indexOf('--min-size') + 1]) || 2 : 2;
    const maxGroups = args.includes('--max-groups') ? 
      parseInt(args[args.indexOf('--max-groups') + 1]) || 50 : 50;

    console.log(`🎯 PRACTICAL CONSOLIDATION ANALYSIS (REFINED)`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'ANALYSIS'} | Verbose: ${verbose} | Verbs only: ${verbsOnly}`);
    console.log(`Min group size: ${minSize} | Max groups: ${maxGroups}\n`);
    
    if (!this.loadMasterList()) {
      return;
    }

    const spanishGroups = this.groupWordsBySpanish();
    console.log(`Found ${spanishGroups.size} Spanish words with multiple definitions`);

    const { candidates, manualReviewCases } = this.analyzeConsolidationCandidates(spanishGroups, {
      focusOnVerbs: verbsOnly,
      minGroupSize: minSize,
      maxGroups
    });

    if (candidates.length === 0 && manualReviewCases.length === 0) {
      console.log('No consolidation candidates found with current criteria.');
      return;
    }

    this.displayCandidates(candidates, manualReviewCases, { verbose, showProgress: true });

    if (!dryRun) {
      this.generateReviewFiles(candidates, manualReviewCases);
      
      console.log(`\n💡 NEXT STEPS:`);
      console.log(`1. Review the candidates in: ${this.outputPath}`);
      console.log(`2. Set 'approved: true' for consolidations you want`);
      console.log(`3. Run the consolidation import script (to be created)`);
      if (manualReviewCases.length > 0) {
        console.log(`4. Review manual cases in: ${this.manualReviewPath}`);
      }
      console.log(`5. Optional: Run with --verbs-only to focus on verbs first`);
    } else {
      console.log(`\n--- DRY RUN COMPLETE ---`);
      console.log(`This was a dry run - no files were created.`);
      console.log(`Found ${candidates.length} consolidation candidates.`);
      console.log(`Found ${manualReviewCases.length} manual review cases.`);
      console.log(`Remove --dry-run to generate the review files.`);
    }
    
    console.log(`\n✅ Analysis complete!`);
  }

  showUsage() {
    console.log('Practical Consolidation Analyzer (Refined)');
    console.log('Usage: node scripts/practicalConsolidationAnalyzer.cjs [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run         Show analysis without creating files');
    console.log('  --verbose         Show detailed candidate information');
    console.log('  --verbs-only      Focus only on verb groups');
    console.log('  --min-size N      Minimum group size (default: 2)');
    console.log('  --max-groups N    Maximum groups to analyze (default: 50)');
    console.log('  --help            Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/practicalConsolidationAnalyzer.cjs --dry-run --verbose');
    console.log('  node scripts/practicalConsolidationAnalyzer.cjs --verbs-only');
    console.log('  node scripts/practicalConsolidationAnalyzer.cjs --min-size 4 --max-groups 20');
  }
}

// Main execution
if (require.main === module) {
  const analyzer = new PracticalConsolidationAnalyzer();
  
  if (process.argv.includes('--help')) {
    analyzer.showUsage();
  } else {
    analyzer.run();
  }
}

module.exports = { PracticalConsolidationAnalyzer };