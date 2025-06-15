import React, { useState, useEffect, useCallback, useRef } from 'react';

import './SearchModal.css'; 
import './VocabularyAnalysisModal.css';

const VocabularyAnalysisModal = ({ 
  isOpen, 
  onClose, 
  wordList = []
}) => {
  const modalDialogRef = useRef(null);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisDate, setAnalysisDate] = useState(null);

  const handleEscapeKey = useCallback((event) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    } else {
      document.removeEventListener('keydown', handleEscapeKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, handleEscapeKey]);

  const handleClickOutside = useCallback((event) => {
    if (modalDialogRef.current && !modalDialogRef.current.contains(event.target)) {
      onClose();
    }
  }, [onClose]);

  // Run analysis when modal opens or wordList changes
  useEffect(() => {
    if (isOpen && wordList.length > 0) {
      runAnalysis();
    }
  }, [isOpen, wordList]);

  const runAnalysis = async () => {
  setIsAnalyzing(true);
  try {
    // Add small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Dynamic import - only load when needed
    const { analyzeVocabularyFrequency } = await import('../data/spanishFrequency.js');
    
    const result = analyzeVocabularyFrequency(wordList);
    setAnalysis(result);
    setAnalysisDate(new Date());
  } catch (error) {
    console.error('Failed to analyze vocabulary:', error);
    setAnalysis(null);
  } finally {
    setIsAnalyzing(false);
  }
};

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFluencyColor = (level) => {
    const colors = {
      'Advanced': 'var(--color-success)',
      'Intermediate': 'var(--color-primary)', 
      'Beginner+': 'var(--color-warning)',
      'Beginner': 'var(--color-secondary)'
    };
    return colors[level] || 'var(--text-body)';
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="search-modal-overlay" onClick={handleClickOutside}>
      <div className="search-modal-content vocab-analysis-modal-content" ref={modalDialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <h2>📊 Vocabulary Analysis</h2>
          <button onClick={onClose} className="search-modal-close-btn">&times;</button>
        </div>
        
        <div className="vocab-analysis-scrollable-area">
          {isAnalyzing ? (
            <div className="vocab-analysis-loading">
              <div className="vocab-analysis-spinner"></div>
              <p>Analyzing your vocabulary...</p>
            </div>
          ) : analysis ? (
            <>
              {/* Analysis Header */}
              <div className="vocab-analysis-header">
                <div className="vocab-analysis-title">
                  <h3>Your Vocabulary: {analysis.totalVocabularySize.toLocaleString()} words</h3>
                  <p className="vocab-analysis-date">Updated: {formatDate(analysisDate)}</p>
                </div>
                <div className="vocab-analysis-level">
                  <span 
                    className="fluency-level-badge"
                    style={{ color: getFluencyColor(analysis.estimatedFluencyLevel) }}
                  >
                    {analysis.estimatedFluencyLevel}
                  </span>
                </div>
              </div>

              {/* Coverage Statistics */}
              <div className="vocab-analysis-section">
                <h4>Frequency Coverage</h4>
                <div className="coverage-grid">
                  <div className="coverage-item">
                    <div className="coverage-label">Top 100</div>
                    <div className="coverage-bar">
                      <div 
                        className="coverage-fill"
                        style={{ width: `${analysis.coverage.percentageTop100}%` }}
                      ></div>
                    </div>
                    <div className="coverage-stats">
                      {analysis.coverage.knownInTop100}/100 ({analysis.coverage.percentageTop100}%)
                    </div>
                  </div>

                  <div className="coverage-item">
                    <div className="coverage-label">Top 500</div>
                    <div className="coverage-bar">
                      <div 
                        className="coverage-fill"
                        style={{ width: `${analysis.coverage.percentageTop500}%` }}
                      ></div>
                    </div>
                    <div className="coverage-stats">
                      {analysis.coverage.knownInTop500}/500 ({analysis.coverage.percentageTop500}%)
                    </div>
                  </div>

                  <div className="coverage-item">
                    <div className="coverage-label">Top 1,000</div>
                    <div className="coverage-bar">
                      <div 
                        className="coverage-fill"
                        style={{ width: `${analysis.coverage.percentageTop1000}%` }}
                      ></div>
                    </div>
                    <div className="coverage-stats">
                      {analysis.coverage.knownInTop1000}/1,000 ({analysis.coverage.percentageTop1000}%)
                    </div>
                  </div>

                  <div className="coverage-item">
                    <div className="coverage-label">Top 5,000</div>
                    <div className="coverage-bar">
                      <div 
                        className="coverage-fill"
                        style={{ width: `${analysis.coverage.percentageTop5000}%` }}
                      ></div>
                    </div>
                    <div className="coverage-stats">
                      {analysis.coverage.knownInTop5000}/5,000 ({analysis.coverage.percentageTop5000}%)
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Insights */}
              <div className="vocab-analysis-section">
                <h4>Quick Insights</h4>
                <div className="insights-list">
                  <div className="insight-item">
                    <span className="insight-icon">📰</span>
                    <span className="insight-text">
                      You know {analysis.coverage.percentageTop1000}% of words needed for news comprehension
                    </span>
                  </div>
                  
                  <div className="insight-item">
                    <span className="insight-icon">🎓</span>
                    <span className="insight-text">
                      Your vocabulary includes {analysis.totalVocabularySize - analysis.coverage.knownInTop5000} specialized words
                    </span>
                  </div>
                  
                  <div className="insight-item">
                    <span className="insight-icon">📈</span>
                    <span className="insight-text">
                      Estimated fluency level: {analysis.estimatedFluencyLevel}
                    </span>
                  </div>

                  {analysis.coverage.percentageTop500 < 90 && (
                    <div className="insight-item">
                      <span className="insight-icon">🎯</span>
                      <span className="insight-text">
                        Learning {500 - analysis.coverage.knownInTop500} more common words would boost your fluency
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Learning Suggestions Preview */}
              {analysis.suggestions.criticalGaps.length > 0 && (
                <div className="vocab-analysis-section">
                  <h4>High-Value Learning Opportunities</h4>
                  <p className="suggestions-intro">
                    Common words that would improve your vocabulary efficiency:
                  </p>
                  <div className="suggestions-preview">
                    {analysis.suggestions.criticalGaps.slice(0, 8).map((word, index) => (
                      <div key={word.word} className="suggestion-item">
                        <span className="suggestion-rank">#{word.rank}</span>
                        <span className="suggestion-word">{word.word}</span>
                      </div>
                    ))}
                    {analysis.suggestions.criticalGaps.length > 8 && (
                      <div className="suggestion-more">
                        +{analysis.suggestions.criticalGaps.length - 8} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="vocab-analysis-error">
              <p>Unable to analyze vocabulary. Please try again.</p>
              <button onClick={runAnalysis} className="retry-button">Retry Analysis</button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="vocab-analysis-actions">
          <button onClick={runAnalysis} disabled={isAnalyzing} className="refresh-button">
            {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
          <button onClick={onClose} className="close-button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VocabularyAnalysisModal;