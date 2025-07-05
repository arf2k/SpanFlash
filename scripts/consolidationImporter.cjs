const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ConsolidationImporter {
  constructor() {
    this.candidatesPath = path.join(__dirname, '..', 'consolidation_candidates.json');
    this.masterListPath = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');
    this.backupPath = this.masterListPath + '.pre-consolidation-backup';
  }

  async askConfirmation(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
      rl.question(question, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
  }

  loadFiles() {
    try {
      // Load consolidation candidates
      const candidatesData = fs.readFileSync(this.candidatesPath, 'utf-8');
      this.candidates = JSON.parse(candidatesData);
      console.log(`📋 Loaded consolidation candidates from: ${this.candidatesPath}`);

      // Load master word list
      const masterData = fs.readFileSync(this.masterListPath, 'utf-8');
      this.masterList = JSON.parse(masterData);
      console.log(`📚 Loaded master word list: ${this.masterList.words.length} words`);

      return true;
    } catch (error) {
      console.error('❌ Failed to load files:', error.message);
      return false;
    }
  }

  filterApprovedCandidates() {
    const approved = this.candidates.candidates.filter(candidate => 
      candidate.userDecision.approved === true
    );
    
    console.log(`\n✅ Found ${approved.length} approved consolidations out of ${this.candidates.candidates.length} total candidates`);
    
    if (approved.length === 0) {
      console.log('No approved consolidations found. Nothing to process.');
      return [];
    }

    return approved;
  }

  cleanSynonyms(synonyms, primaryEnglish) {
    if (!Array.isArray(synonyms)) return [];
    
    return synonyms
      .filter(syn => typeof syn === 'string' && syn.trim().length > 0)
      .map(syn => syn.trim())
      .filter(syn => {
        // Remove synonyms that contain commas (like "plate, dish")
        if (syn.includes(',')) return false;
        
        // Remove duplicates of the primary meaning
        if (syn.toLowerCase() === primaryEnglish.toLowerCase()) return false;
        
        // Remove obvious duplicates
        return true;
      })
      .filter((syn, index, arr) => {
        // Remove case-insensitive duplicates
        return arr.findIndex(s => s.toLowerCase() === syn.toLowerCase()) === index;
      });
  }

  buildConsolidatedWord(candidate, primaryWordData, allSecondaryWords) {
    // Determine the actual primary word
    let actualPrimary;
    let actualPrimaryEnglish;
    
    if (candidate.userDecision.selectedPrimary) {
      // User overrode the primary selection
      actualPrimaryEnglish = candidate.userDecision.selectedPrimary;
      
      // Find the word object that matches this English meaning
      const allWords = [primaryWordData, ...allSecondaryWords];
      actualPrimary = allWords.find(w => w.english.trim() === actualPrimaryEnglish) || primaryWordData;
      
      console.log(`   Override: Using "${actualPrimaryEnglish}" as primary instead of "${primaryWordData.english}"`);
    } else {
      // Use the suggested primary
      actualPrimary = primaryWordData;
      actualPrimaryEnglish = primaryWordData.english;
    }

    // Collect all other meanings as synonyms
    const allOtherMeanings = [primaryWordData, ...allSecondaryWords]
      .filter(w => w.english.trim() !== actualPrimaryEnglish)
      .map(w => w.english.trim());

    // Get existing synonyms and combine with new ones
    const existingSynonyms = actualPrimary.synonyms_english || [];
    const allSynonyms = [...existingSynonyms, ...allOtherMeanings];
    
    // Clean and deduplicate synonyms
    const cleanedSynonyms = this.cleanSynonyms(allSynonyms, actualPrimaryEnglish);

    // Create the consolidated word object
    const consolidatedWord = {
      ...actualPrimary,
      spanish: actualPrimary.spanish, // Keep the primary's Spanish (with articles)
      english: actualPrimaryEnglish,
      synonyms_english: cleanedSynonyms,
      // Keep all other properties from the primary word
      // Note: Learning progress stays with the primary word only
    };

    return consolidatedWord;
  }

  processConsolidations(approvedCandidates, dryRun = false) {
    const updatedWords = [...this.masterList.words];
    const indicesToRemove = new Set();
    const consolidationResults = [];

    approvedCandidates.forEach((candidate, index) => {
      console.log(`\n${index + 1}. Processing: "${candidate.spanishWord}"`);
      
      const primaryWordData = candidate.consolidationPlan.primaryWord;
      const secondaryWordsData = candidate.consolidationPlan.secondaryWords;
      
      // Get the actual word objects from master list
      const primaryWordIndex = primaryWordData.originalIndex;
      const secondaryIndices = secondaryWordsData.map(w => w.originalIndex);
      
      // Build the consolidated word
      const consolidatedWord = this.buildConsolidatedWord(
        candidate, 
        this.masterList.words[primaryWordIndex],
        secondaryWordsData.map(w => this.masterList.words[w.originalIndex])
      );

      // Update the primary word in place
      updatedWords[primaryWordIndex] = consolidatedWord;
      
      // Mark secondary words for removal
      secondaryIndices.forEach(idx => indicesToRemove.add(idx));

      // Track results
      const result = {
        spanishWord: candidate.spanishWord,
        primaryIndex: primaryWordIndex,
        removedIndices: secondaryIndices,
        consolidatedWord: {
          spanish: consolidatedWord.spanish,
          english: consolidatedWord.english,
          synonymsCount: consolidatedWord.synonyms_english.length,
          synonyms: consolidatedWord.synonyms_english
        },
        impact: candidate.consolidationPlan.impact
      };
      
      consolidationResults.push(result);

      console.log(`   Primary: "${consolidatedWord.spanish}" → "${consolidatedWord.english}"`);
      console.log(`   Synonyms (${consolidatedWord.synonyms_english.length}): ${consolidatedWord.synonyms_english.join(', ')}`);
      console.log(`   Removing ${secondaryIndices.length} duplicate entries`);
    });

    // Remove secondary words (in reverse order to maintain indices)
    const sortedIndicesToRemove = Array.from(indicesToRemove).sort((a, b) => b - a);
    sortedIndicesToRemove.forEach(index => {
      if (!dryRun) {
        updatedWords.splice(index, 1);
      }
    });

    return {
      updatedWords: dryRun ? this.masterList.words : updatedWords,
      consolidationResults,
      wordsRemoved: indicesToRemove.size,
      originalCount: this.masterList.words.length,
      finalCount: this.masterList.words.length - indicesToRemove.size
    };
  }

  displayResults(results, dryRun = false) {
    console.log(`\n📊 CONSOLIDATION ${dryRun ? 'PREVIEW' : 'RESULTS'}`);
    console.log(`=`.repeat(60));
    console.log(`Consolidations processed: ${results.consolidationResults.length}`);
    console.log(`Words removed: ${results.wordsRemoved}`);
    console.log(`Original word count: ${results.originalCount}`);
    console.log(`Final word count: ${results.finalCount}`);
    console.log(`Reduction: ${Math.round((results.wordsRemoved / results.originalCount) * 100)}%`);

    if (results.consolidationResults.length > 0) {
      console.log(`\n📋 CONSOLIDATION SUMMARY:`);
      results.consolidationResults.forEach((result, index) => {
        console.log(`${index + 1}. "${result.spanishWord}"`);
        console.log(`   → "${result.consolidatedWord.spanish}" = "${result.consolidatedWord.english}"`);
        console.log(`   + ${result.consolidatedWord.synonymsCount} synonyms: ${result.consolidatedWord.synonyms.slice(0, 3).join(', ')}${result.consolidatedWord.synonymsCount > 3 ? '...' : ''}`);
      });
    }
  }

  async saveResults(results) {
    try {
      // Create backup
      console.log(`\n💾 Creating backup: ${this.backupPath}`);
      fs.copyFileSync(this.masterListPath, this.backupPath);

      // Save updated master list
      const updatedMasterList = {
        ...this.masterList,
        words: results.updatedWords
      };

      fs.writeFileSync(this.masterListPath, JSON.stringify(updatedMasterList, null, 2), 'utf-8');
      console.log(`✅ Updated master list saved: ${this.masterListPath}`);

      return true;
    } catch (error) {
      console.error('❌ Failed to save results:', error.message);
      return false;
    }
  }

  async run() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const forceApply = args.includes('--apply');

    console.log(`🎯 CONSOLIDATION IMPORTER`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : (forceApply ? 'APPLY' : 'PREVIEW')}\n`);

    // Load files
    if (!this.loadFiles()) {
      return;
    }

    // Filter approved candidates
    const approvedCandidates = this.filterApprovedCandidates();
    if (approvedCandidates.length === 0) {
      return;
    }

    // Process consolidations
    console.log(`\n🔄 Processing ${approvedCandidates.length} approved consolidations...`);
    const results = this.processConsolidations(approvedCandidates, dryRun);

    // Display results
    this.displayResults(results, dryRun);

    if (dryRun) {
      console.log(`\n--- DRY RUN COMPLETE ---`);
      console.log(`This was a preview - no files were changed.`);
      console.log(`Use --apply to actually apply the consolidations.`);
      return;
    }

    if (!forceApply) {
      console.log(`\n--- PREVIEW COMPLETE ---`);
      console.log(`Use --apply to actually apply these consolidations.`);
      console.log(`Use --dry-run to see more detailed processing.`);
      return;
    }

    // Confirm before applying
    const confirmApply = await this.askConfirmation(
      `\n⚠️  This will permanently modify your master word list. Continue? (y/n): `
    );

    if (!confirmApply) {
      console.log('❌ Operation cancelled');
      return;
    }

    // Save results
    if (this.saveResults(results)) {
      console.log(`\n✅ Consolidation complete!`);
      console.log(`\n📝 Next steps:`);
      console.log(`1. Test your app to ensure consolidations work correctly`);
      console.log(`2. If issues: restore from backup: ${this.backupPath}`);
      console.log(`3. Consider running cleanMasterList.cjs to clean up any remaining issues`);
    }
  }

  showUsage() {
    console.log('Consolidation Importer');
    console.log('Usage: node scripts/consolidationImporter.cjs [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run     Show detailed processing without making changes');
    console.log('  --apply       Actually apply the consolidations (requires confirmation)');
    console.log('  --help        Show this help message');
    console.log('');
    console.log('Default: Shows preview summary without making changes');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/consolidationImporter.cjs                # Preview');
    console.log('  node scripts/consolidationImporter.cjs --dry-run      # Detailed preview');
    console.log('  node scripts/consolidationImporter.cjs --apply        # Apply changes');
  }
}

// Main execution
if (require.main === module) {
  const importer = new ConsolidationImporter();
  
  if (process.argv.includes('--help')) {
    importer.showUsage();
  } else {
    importer.run();
  }
}

module.exports = { ConsolidationImporter };