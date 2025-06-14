import React, { useEffect, useCallback, useRef } from 'react';
import './SearchModal.css'; // Reuse modal styles

const StatsModal = ({ 
  isOpen, 
  onClose, 
  sessionStats, 
  getSessionAccuracy, 
  getSessionDuration,
  onNewSession 
}) => {
  const modalDialogRef = useRef(null);

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

  if (!isOpen) {
    return null;
  }

  const totalAnswers = sessionStats.correctAnswers + sessionStats.incorrectAnswers;

  return (
    <div className="search-modal-overlay" onClick={handleClickOutside}>
      <div className="search-modal-content" ref={modalDialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <h2>📊 Session Stats</h2>
          <button onClick={onClose} className="search-modal-close-btn">&times;</button>
        </div>
        
        <div style={{ padding: '20px', lineHeight: '1.6' }}>
          {/* Session Overview */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: 'var(--color-primary)' }}>Current Session</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <strong>Duration:</strong> {getSessionDuration()}
              </div>
              <div>
                <strong>Cards Reviewed:</strong> {sessionStats.cardsReviewed}
              </div>
              <div>
                <strong>Accuracy:</strong> {getSessionAccuracy()}%
              </div>
              <div>
                <strong>Total Answers:</strong> {totalAnswers}
              </div>
            </div>
          </div>

          {/* Answer Breakdown */}
          {totalAnswers > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: 'var(--color-primary)' }}>Answer Breakdown</h3>
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', color: 'var(--color-success)' }}>✅</div>
                  <div><strong>{sessionStats.correctAnswers}</strong></div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Correct</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', color: 'var(--color-danger)' }}>❌</div>
                  <div><strong>{sessionStats.incorrectAnswers}</strong></div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Incorrect</div>
                </div>
              </div>
            </div>
          )}

          {/* Game Type Stats */}
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: 'var(--color-primary)' }}>By Game Type</h3>
            {Object.entries(sessionStats.gameTypeStats).map(([gameType, stats]) => {
              const gameTotal = stats.correct + stats.incorrect;
              if (gameTotal === 0) return null;
              
              const gameAccuracy = Math.round((stats.correct / gameTotal) * 100);
              const gameNames = {
                flashcards: '🎴 Flashcards',
                matching: '🎮 Matching',
                fillInBlank: '📝 Fill-in-Blank',
                conjugation: '🔗 Conjugation'
              };

              return (
                <div key={gameType} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '8px',
                  padding: '8px',
                  backgroundColor: 'var(--bg-hint)',
                  borderRadius: '4px'
                }}>
                  <span>{gameNames[gameType]}</span>
                  <span>
                    <strong>{stats.correct}/{gameTotal}</strong> ({gameAccuracy}%)
                  </span>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div style={{ textAlign: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
            <button 
              onClick={() => {
                onNewSession();
                onClose();
              }}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--text-button)',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Start New Session
            </button>
            <button 
              onClick={onClose}
              style={{
                backgroundColor: 'var(--color-secondary)',
                color: 'var(--text-button)',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsModal;