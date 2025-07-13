import { db } from "../db";

export const createVocabularyExtractionHandlers = (
  setIsVocabExtractionModalOpen,
  setIsReviewExtractedModalOpen
) => {
  /**
   * Add words to incomplete words table for translation queue
   * @param {Array<string>} selectedWords - Array of Spanish words to add
   * @param {Object} extractionContext - Context about the extraction
   */
  const handleAddExtractedWords = async (selectedWords, extractionContext = {}) => {
    if (!selectedWords || selectedWords.length === 0) {
      console.warn("No words selected for addition");
      return { success: false, message: "No words selected" };
    }

    console.log(`Adding ${selectedWords.length} words to translation queue...`);
    
    const results = {
      added: [],
      failed: [],
      duplicates: []
    };

    try {
      // Check for existing words in both complete and incomplete tables
      const existingCompleteWords = await db.allWords.toArray();
      const existingIncompleteWords = await db.incompleteWords.toArray();
      
      const existingSpanishWords = new Set();
      
      // Add complete words
      existingCompleteWords.forEach(word => {
        existingSpanishWords.add(word.spanish.toLowerCase().trim());
      });
      
      // Add incomplete words
      existingIncompleteWords.forEach(word => {
        existingSpanishWords.add(word.spanish.toLowerCase().trim());
      });

      const now = Date.now();

      for (const spanishWord of selectedWords) {
        const cleanWord = spanishWord.trim();
        
        // Skip if already exists in either table
        if (existingSpanishWords.has(cleanWord.toLowerCase())) {
          results.duplicates.push(cleanWord);
          continue;
        }

        try {
          // Create new incomplete word object
          const newIncompleteWord = {
            spanish: cleanWord,
            extractionMetadata: {
              sourceText: extractionContext.sourceText || "",
              extractionDate: now,
              sourceCategory: extractionContext.sourceCategory || "",
              sourceLength: extractionContext.sourceLength || 0,
              comprehensionLevel: extractionContext.comprehensionLevel || 0,
              unknownWordCount: extractionContext.unknownWordCount || 0
            },
            status: 'needs_translation',
            extractedAt: now
          };

          // Add to incomplete words table
          const newId = await db.incompleteWords.add(newIncompleteWord);
          const wordWithId = await db.incompleteWords.get(newId);
          
          if (wordWithId) {
            results.added.push(wordWithId);
            console.log("Added to translation queue:", wordWithId.spanish);
          } else {
            results.failed.push(cleanWord);
          }

        } catch (error) {
          console.error(`Failed to add word "${cleanWord}" to queue:`, error);
          results.failed.push(cleanWord);
        }
      }

      // Log results
      console.log(`Vocabulary extraction results:`, {
        requested: selectedWords.length,
        added: results.added.length,
        duplicates: results.duplicates.length,
        failed: results.failed.length
      });

      return {
        success: true,
        results,
        message: `Added ${results.added.length} words to translation queue. ${results.duplicates.length} duplicates skipped. ${results.failed.length} failed.`
      };

    } catch (error) {
      console.error("Error in batch word addition to queue:", error);
      return {
        success: false,
        message: "Failed to add words to translation queue",
        error: error.message
      };
    }
  };

  /**
   * Handle the vocabulary extraction modal workflow
   */
  const handleVocabExtractionComplete = async (selectedWords, extractionContext = {}) => {
    const result = await handleAddExtractedWords(selectedWords, extractionContext);
    
    if (result.success && result.results.added.length > 0) {
      // Close the extraction modal
      setIsVocabExtractionModalOpen(false);
      
      // Open the review modal
      setIsReviewExtractedModalOpen(true);
      
      console.log("✅ Vocabulary extraction complete:", result.message);
      return result;
    } else {
      // Handle error case or no words added
      console.error("❌ Vocabulary extraction failed or no words added:", result.message);
      return result;
    }
  };

  /**
   * Get all incomplete words for review
   */
  const getIncompleteWords = async () => {
    try {
      const incompleteWords = await db.incompleteWords
        .where('status')
        .equals('needs_translation')
        .toArray();
      
      return incompleteWords.sort((a, b) => b.extractedAt - a.extractedAt); // Most recent first
    } catch (error) {
      console.error("Error fetching incomplete words:", error);
      return [];
    }
  };

  /**
   * Complete a word by moving it from incomplete to complete vocabulary
   */
  const handleCompleteWord = async (incompleteWordId, englishTranslation, additionalData = {}) => {
    try {
      const incompleteWord = await db.incompleteWords.get(incompleteWordId);
      if (!incompleteWord) {
        throw new Error("Incomplete word not found");
      }

      // Create complete word object
      const completeWord = {
        spanish: incompleteWord.spanish,
        english: englishTranslation.trim(),
        notes: additionalData.notes || `Extracted: ${new Date(incompleteWord.extractedAt).toLocaleDateString()}`,
        synonyms_spanish: additionalData.synonyms_spanish || [],
        synonyms_english: additionalData.synonyms_english || [],
        category: additionalData.category || incompleteWord.extractionMetadata.sourceCategory || "",
        exposureLevel: "new",
        timesStudied: 0,
        timesCorrect: 0,
        lastStudied: null,
        source: "extraction"
      };

      // Add to complete vocabulary and remove from incomplete
      await db.transaction('rw', [db.allWords, db.incompleteWords], async () => {
        await db.allWords.add(completeWord);
        await db.incompleteWords.delete(incompleteWordId);
      });

      console.log(`Completed word: "${incompleteWord.spanish}" → "${englishTranslation}"`);
      return { success: true, completedWord: completeWord };

    } catch (error) {
      console.error("Error completing word:", error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Delete an incomplete word
   */
  const handleDeleteIncompleteWord = async (incompleteWordId) => {
    try {
      await db.incompleteWords.delete(incompleteWordId);
      console.log(`Deleted incomplete word ID: ${incompleteWordId}`);
      return { success: true };
    } catch (error) {
      console.error("Error deleting incomplete word:", error);
      return { success: false, error: error.message };
    }
  };

  return {
    handleAddExtractedWords,
    handleVocabExtractionComplete,
    getIncompleteWords,
    handleCompleteWord,
    handleDeleteIncompleteWord
  };
};