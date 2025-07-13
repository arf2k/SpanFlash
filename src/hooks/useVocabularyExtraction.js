import { useState, useEffect } from "react";
import { spanishVerbLemmatizer } from "../utils/verbLemmatizer";

export function useVocabularyExtraction(existingVocabulary = []) {
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [unknownWords, setUnknownWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState(new Set());
  const [analysisStats, setAnalysisStats] = useState(null);
  const [isLemmatizerReady, setIsLemmatizerReady] = useState(false);

  // Initialize verb lemmatizer
  useEffect(() => {
    initializeLemmatizer();
  }, []);

  const initializeLemmatizer = async () => {
    if (spanishVerbLemmatizer.isInitialized) {
      setIsLemmatizerReady(true);
      return;
    }

    try {
      const response = await fetch("/conjugations.json");
      const verbData = await response.json();
      await spanishVerbLemmatizer.initialize(verbData);
      setIsLemmatizerReady(true);
      console.log("Verb lemmatizer initialized for vocabulary extraction");
    } catch (error) {
      console.error("Failed to initialize verb lemmatizer:", error);
      setIsLemmatizerReady(false);
    }
  };

  const extractWordsFromText = (text) => {
    return text
      .toLowerCase()
      .replace(/[¿¡]/g, "")
      .replace(/[.,;:!?"'()—–\-\[\]{}]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0 && word.length <= 25)
      .filter((word) => !/^\d+$/.test(word));
  };

  const isCommonWord = (word) => {
    const commonWords = new Set([
      "que",
      "de",
      "a",
      "en",
      "y",
      "por",
      "con",
      "para",
      "como",
      "del",
      "al",
      "se",
      "le",
      "su",
      "sus",
      "me",
      "te",
      "nos",
      "os",
      "lo",
      "la",
      "los",
      "las",
      "un",
      "una",
      "unos",
      "unas",
      "el",
      "este",
      "esta",
      "estos",
      "estas",
      "ese",
      "esa",
      "esos",
      "esas",
      "aquel",
      "aquella",
      "aquellos",
      "aquellas",
      "mi",
      "tu",
      "si",
      "no",
      "muy",
      "más",
      "pero",
      "también",
      "solo",
      "ya",
      "vez",
      "bien",
      "así",
      "donde",
      "cuando",
      "porque",
      "aunque",
      "hasta",
      "desde",
      "hacia",
      "según",
      "durante",
      "contra",
      "entre",
      "sobre",
      "bajo",
      "sin",
      "tras",
      "ante",
      "mediante",
    ]);
    return commonWords.has(word);
  };

  const analyzeWords = async (words, vocabularySet) => {
    const unknownWords = [];
    const wordCounts = new Map();
    let totalWords = 0;
    let knownWords = 0;
    let conjugatedVerbsResolved = 0;

    // Count word frequencies
    words.forEach((word) => {
      totalWords++;
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    // Analyze unique words
    for (const [word, count] of wordCounts.entries()) {
      let isKnown = false;
      let resolvedForm = word;

      // Check if word is in vocabulary as-is
      if (vocabularySet.has(word)) {
        isKnown = true;
        knownWords += count;
      } else {
        // Check if it's a conjugated verb
        const infinitive = spanishVerbLemmatizer.getInfinitive(word);
        if (infinitive && vocabularySet.has(infinitive)) {
          isKnown = true;
          knownWords += count;
          conjugatedVerbsResolved += count;
          resolvedForm = infinitive;
        }
      }

      // If still unknown, add to unknown list
      if (!isKnown && !isCommonWord(word)) {
        unknownWords.push({
          word: word,
          count: count,
          resolvedForm: resolvedForm,
        });
      } else if (isKnown) {
        knownWords += count;
      }
    }

    // Sort unknown words by frequency (most common first)
    unknownWords.sort((a, b) => b.count - a.count);

    return {
      unknownWords,
      stats: {
        totalWords,
        uniqueWords: wordCounts.size,
        knownWords,
        unknownWordsCount: unknownWords.length,
        conjugatedVerbsResolved,
      },
    };
  };

  const analyzeText = async () => {
    if (!inputText.trim() || !isLemmatizerReady) return;

    setIsAnalyzing(true);
    setUnknownWords([]);
    setSelectedWords(new Set());

    try {
      // Create vocabulary lookup for fast comparison
      const vocabularySet = new Set();
      existingVocabulary.forEach((word) => {
        vocabularySet.add(word.spanish.toLowerCase().trim());
        // Also add without articles for comparison
        const withoutArticle = word.spanish
          .replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, "")
          .toLowerCase()
          .trim();
        if (withoutArticle !== word.spanish.toLowerCase().trim()) {
          vocabularySet.add(withoutArticle);
        }
      });

      // Process the text
      const words = extractWordsFromText(inputText);
      const analysis = await analyzeWords(words, vocabularySet);

      setUnknownWords(analysis.unknownWords);
      setAnalysisStats(analysis.stats);
    } catch (error) {
      console.error("Error analyzing text:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleWordSelection = (word) => {
    const newSelected = new Set(selectedWords);
    if (newSelected.has(word)) {
      newSelected.delete(word);
    } else {
      newSelected.add(word);
    }
    setSelectedWords(newSelected);
  };

  const selectAllWords = () => {
    setSelectedWords(new Set(unknownWords.map((w) => w.word)));
  };

  const clearSelection = () => {
    setSelectedWords(new Set());
  };

  const clearAll = () => {
    setInputText("");
    setUnknownWords([]);
    setSelectedWords(new Set());
    setAnalysisStats(null);
  };

  return {
    // State
    inputText,
    isAnalyzing,
    unknownWords,
    selectedWords,
    analysisStats,
    isLemmatizerReady,

    // Actions
    setInputText,
    analyzeText,
    toggleWordSelection,
    selectAllWords,
    clearSelection,
    clearAll,
  };
}
