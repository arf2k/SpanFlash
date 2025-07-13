import React, { useState, useEffect, useRef } from 'react';
import './SearchModal.css';
import './VocabularyExtractionModal.css'; 

const ReviewExtractedWordsModal = ({
  isOpen,
  onClose,
  incompleteWords = [],
  onCompleteWord,
  onDeleteWord,
  onRefreshIncompleteWords
}) => {
  const [editingWord, setEditingWord] = useState(null);
  const [englishInput, setEnglishInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [completedCount, setCompletedCount] = useState(0);

  const modalRef = useRef(null);

  // Refresh incomplete words when modal opens
  useEffect(() => {
    if (isOpen && onRefreshIncompleteWords) {
      onRefreshIncompleteWords();
    }
  }, [isOpen, onRefreshIncompleteWords]);

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

  const handleStartEdit = (word) => {
    setEditingWord(word);
    setEnglishInput('');
    setCategoryInput(word.extractionMetadata?.sourceCategory || '');
    setNotesInput('');
  };

  const handleCancelEdit = () => {
    setEditingWord(null);
    setEnglishInput('');
    setCategoryInput('');
    setNotesInput('');
  };

  const handleSaveWord = async () => {
    if (!editingWord || !englishInput.trim()) {
      return;
    }

    const additionalData = {
      category: categoryInput.trim(),
      notes: notesInput.trim() || `Extracted: ${new Date(editingWord.extractedAt).toLocaleDateString()}`,
      synonyms_spanish: [],
      synonyms_english: []
    };

    const result = await onCompleteWord(editingWord.id, englishInput.trim(), additionalData);
    
    if (result.success) {
      setCompletedCount(prev => prev + 1);
      handleCancelEdit();
      
      // Refresh the list
      if (onRefreshIncompleteWords) {
        onRefreshIncompleteWords();
      }
    } else {
      console.error('Failed to complete word:', result.error);
    }
  };

  const handleDeleteWord = async (wordId) => {
    if (window.confirm('Delete this word from the translation queue?')) {
      const result = await onDeleteWord(wordId);
      
      if (result.success && onRefreshIncompleteWords) {
        onRefreshIncompleteWords();
      }
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatSourceText = (sourceText) => {
    if (!sourceText) return 'No source text';
    return sourceText.length > 100 ? sourceText.substring(0, 100) + '...' : sourceText;
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay">
      <div className="vocab-extraction-modal" ref={modalRef}>
        <div className="vocab-extraction-header">
          <h2>📝 Review Extracted Words</h2>
          <button 
            onClick={onClose}
            className="vocab-extraction-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="vocab-extraction-content">
          {/* Summary Stats */}
          <div className="vocab-stats-section">
            <div className="vocab-stats-grid">
              <div className="vocab-stat">
                <span className="vocab-stat-value">{incompleteWords.length}</span>
                <span className="vocab-stat-label">Needs Translation</span>
              </div>
              <div className="vocab-stat">
                <span className="vocab-stat-value">{completedCount}</span>
                <span className="vocab-stat-label">Completed This Session</span>
              </div>
            </div>
          </div>

          {/* Words List */}
          {incompleteWords.length > 0 ? (
            <div className="vocab-results-section">
              <h3>Words Awaiting Translation</h3>
              
              <div className="incomplete-words-list">
                {incompleteWords.map((word) => (
                  <div key={word.id} className="incomplete-word-item">
                    <div className="incomplete-word-header">
                      <div className="incomplete-word-main">
                        <h4 className="incomplete-word-spanish">{word.spanish}</h4>
                        <div className="incomplete-word-meta">
                          <span className="extraction-date">
                            Extracted: {formatDate(word.extractedAt)}
                          </span>
                          {word.extractionMetadata?.sourceCategory && (
                            <span className="source-category">
                              Category: {word.extractionMetadata.sourceCategory}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="incomplete-word-actions">
                        <button
                          onClick={() => handleStartEdit(word)}
                          className="edit-word-btn"
                          disabled={editingWord?.id === word.id}
                        >
                          {editingWord?.id === word.id ? 'Editing...' : 'Translate'}
                        </button>
                        <button
                          onClick={() => handleDeleteWord(word.id)}
                          className="delete-word-btn"
                          title="Delete word"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Source Text Preview */}
                    {word.extractionMetadata?.sourceText && (
                      <div className="source-text-preview">
                        <em>{formatSourceText(word.extractionMetadata.sourceText)}</em>
                      </div>
                    )}

                    {/* Edit Form */}
                    {editingWord?.id === word.id && (
                      <div className="word-edit-form">
                        <div className="form-group">
                          <label htmlFor="english-translation">English Translation*:</label>
                          <input
                            id="english-translation"
                            type="text"
                            value={englishInput}
                            onChange={(e) => setEnglishInput(e.target.value)}
                            placeholder="Enter English translation..."
                            autoFocus
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="word-category">Category:</label>
                          <input
                            id="word-category"
                            type="text"
                            value={categoryInput}
                            onChange={(e) => setCategoryInput(e.target.value)}
                            placeholder="Optional category..."
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="word-notes">Notes:</label>
                          <textarea
                            id="word-notes"
                            value={notesInput}
                            onChange={(e) => setNotesInput(e.target.value)}
                            placeholder="Optional notes..."
                            rows="2"
                          />
                        </div>

                        <div className="form-actions">
                          <button
                            onClick={handleSaveWord}
                            className="save-word-btn"
                            disabled={!englishInput.trim()}
                          >
                            Add to Vocabulary
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="cancel-edit-btn"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="vocab-empty-state">
              <div className="vocab-empty-icon">🎉</div>
              <h3>All caught up!</h3>
              <p>No words waiting for translation. Use the vocabulary extractor to find new words from Spanish text.</p>
            </div>
          )}

          {/* Modal Actions */}
          <div className="vocab-action-section">
            <button 
              onClick={onClose}
              className="vocab-add-selected"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewExtractedWordsModal;