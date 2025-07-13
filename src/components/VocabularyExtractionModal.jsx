import React, { useEffect, useRef } from 'react';
import { useVocabularyExtraction } from '../hooks/useVocabularyExtraction';
import './VocabularyExtractionModal.css';

const VocabularyExtractionModal = ({ 
  isOpen, 
  onClose, 
  existingVocabulary = [],
  onAddWords = null 
}) => {
  const {
    inputText,
    isAnalyzing,
    unknownWords,
    selectedWords,
    analysisStats,
    isLemmatizerReady,
    setInputText,
    analyzeText,
    toggleWordSelection,
    selectAllWords,
    clearSelection,
    clearAll
  } = useVocabularyExtraction(existingVocabulary);
  
  const textareaRef = useRef(null);
  const modalRef = useRef(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

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
                disabled={!inputText.trim() || isAnalyzing || !isLemmatizerReady}
                className="vocab-analyze-btn"
              >
                {isAnalyzing ? 'Analyzing...' : !isLemmatizerReady ? 'Loading...' : 'Find Unknown Words'}
              </button>
              <button 
                onClick={clearAll}
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
                  <span className="vocab-stat-value">{analysisStats.totalWords}</span>
                  <span className="vocab-stat-label">Total Words</span>
                </div>
                <div className="vocab-stat">
                  <span className="vocab-stat-value">{analysisStats.unknownWordsCount}</span>
                  <span className="vocab-stat-label">Unknown Words</span>
                </div>
                <div className="vocab-stat">
                  <span className="vocab-stat-value">{analysisStats.conjugatedVerbsResolved}</span>
                  <span className="vocab-stat-label">Verbs Resolved</span>
                </div>
                <div className="vocab-stat">
                  <span className="vocab-stat-value">
                    {Math.round((analysisStats.knownWords / analysisStats.totalWords) * 100)}%
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
                  <button onClick={clearSelection} className="vocab-clear-selection">
                    Clear Selection
                  </button>
                </div>
              </div>

              <div className="vocab-words-list">
                {unknownWords.map(({ word, count }) => (
                  <div
                    key={word}
                    className={`vocab-word-item ${selectedWords.has(word) ? 'selected' : ''}`}
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
                    {selectedWords.size} word{selectedWords.size !== 1 ? 's' : ''} selected
                  </div>
                  <button 
                    className="vocab-add-selected"
                    onClick={() => {
                      // This will be implemented when we add the word addition feature
                      console.log('Selected words for addition:', Array.from(selectedWords));
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
              <p>No unknown words found in this text. You already know all the vocabulary!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VocabularyExtractionModal;