import React, { useState, useEffect, useRef } from "react";
import { spanishVerbLemmatizer } from "../utils/verbLemmatizer";
import "./VocabularyExtractionModal.css";

const VocabularyExtractionModal = ({
  isOpen,
  onClose,
  existingVocabulary = [],
  onAddWords = null,
}) => {
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [unknownWords, setUnknownWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState(new Set());
  const [analysisStats, setAnalysisStats] = useState(null);

  const textareaRef = useRef(null);
  const modalRef = useRef(null);

  // Initialize verb lemmatizer when modal opens
  useEffect(() => {
    if (isOpen && !spanishVerbLemmatizer.isInitialized) {
      initializeLemmatizer();
    }
  }, [isOpen]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  const initializeLemmatizer = async () => {
    try {
      const response = await fetch("/conjugations.json");
      const verbData = await response.json();
      await spanishVerbLemmatizer.initialize(verbData);
      console.log("Verb lemmatizer initialized for vocabulary extraction");
    } catch (error) {
      console.error("Failed to initialize verb lemmatizer:", error);
    }
  };

  const analyzeText = async () => {
    if (!inputText.trim()) return;

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

  const extractWordsFromText = (text) => {
    // Clean and split text into words
    return (
      text
        .toLowerCase()
        // Replace Spanish punctuation and split
        .replace(/[¿¡]/g, "")
        .replace(/[.,;:!?"'()—–\-\[\]{}]/g, " ")
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 0 && word.length <= 25) // Filter reasonable word lengths
        .filter((word) => !/^\d+$/.test(word))
    ); // Remove pure numbers
  };

  const analyzeWords = async (words, vocabularySet) => {
    const unknownWords = [];
    const wordCounts = new Map();
    let totalWords = 0;
    let knownWords = 0;
    let conjugatedVerbsResolved = 0;

    // Count word frequencies and analyze
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

  const isCommonWord = (word) => {
    // Common words that shouldn't be suggested for learning
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

  const clearText = () => {
    setInputText("");
    setUnknownWords([]);
    setSelectedWords(new Set());
    setAnalysisStats(null);
  };

  if (!isOpen) return null;

  return (
    <div className="vocab-extraction-overlay">
      <div className="vocab-extraction-modal" ref={modalRef}>
        <div className="vocab-extraction-header">
          <h2>📰 Extract Vocabulary</h2>
          <button
            onClick={onClose}
            className="vocab-extraction-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="vocab-extraction-content">
          {/* Text Input Section */}
          <div className="vocab-input-section">
            <label htmlFor="spanish-text">Paste Spanish text to analyze:</label>
            <textarea
              id="spanish-text"
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste Spanish article, news, or any text here..."
              className="vocab-text-input"
              rows={8}
            />

            <div className="vocab-input-actions">
              <button
                onClick={analyzeText}
                disabled={!inputText.trim() || isAnalyzing}
                className="vocab-analyze-btn"
              >
                {isAnalyzing ? "Analyzing..." : "Find Unknown Words"}
              </button>
              <button
                onClick={clearText}
                className="vocab-clear-btn"
                disabled={!inputText.trim() && unknownWords.length === 0}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Analysis Results Section */}
          {analysisStats && (
            <div className="vocab-stats-section">
              <h3>📊 Analysis Results</h3>
              <div className="vocab-stats-grid">
                <div className="vocab-stat">
                  <span className="vocab-stat-value">
                    {analysisStats.totalWords}
                  </span>
                  <span className="vocab-stat-label">Total Words</span>
                </div>
                <div className="vocab-stat">
                  <span className="vocab-stat-value">
                    {analysisStats.unknownWordsCount}
                  </span>
                  <span className="vocab-stat-label">Unknown Words</span>
                </div>
                <div className="vocab-stat">
                  <span className="vocab-stat-value">
                    {analysisStats.conjugatedVerbsResolved}
                  </span>
                  <span className="vocab-stat-label">Verbs Resolved</span>
                </div>
                <div className="vocab-stat">
                  <span className="vocab-stat-value">
                    {Math.round(
                      (analysisStats.knownWords / analysisStats.totalWords) *
                        100
                    )}
                    %
                  </span>
                  <span className="vocab-stat-label">Comprehension</span>
                </div>
              </div>
            </div>
          )}

          {/* Unknown Words Section */}
          {unknownWords.length > 0 && (
            <div className="vocab-results-section">
              <div className="vocab-results-header">
                <h3>🔍 Unknown Words ({unknownWords.length})</h3>
                <div className="vocab-selection-actions">
                  <button onClick={selectAllWords} className="vocab-select-all">
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="vocab-clear-selection"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              <div className="vocab-words-list">
                {unknownWords.map(({ word, count }) => (
                  <div
                    key={word}
                    className={`vocab-word-item ${
                      selectedWords.has(word) ? "selected" : ""
                    }`}
                    onClick={() => toggleWordSelection(word)}
                  >
                    <div className="vocab-word-main">
                      <span className="vocab-word-text">{word}</span>
                      {count > 1 && (
                        <span className="vocab-word-count">×{count}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedWords.size > 0 && (
                <div className="vocab-action-section">
                  <div className="vocab-selected-count">
                    {selectedWords.size} word
                    {selectedWords.size !== 1 ? "s" : ""} selected
                  </div>
                  <button
                    className="vocab-add-selected"
                    onClick={() => {
                      // This will be implemented when we add the word addition feature
                      console.log(
                        "Selected words for addition:",
                        Array.from(selectedWords)
                      );
                    }}
                  >
                    Add Selected Words →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {unknownWords.length === 0 && analysisStats && (
            <div className="vocab-empty-state">
              <div className="vocab-empty-icon">🎉</div>
              <h3>Excellent comprehension!</h3>
              <p>
                No unknown words found in this text. You already know all the
                vocabulary!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VocabularyExtractionModal;
