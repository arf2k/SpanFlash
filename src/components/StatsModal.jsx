import React, { useEffect, useCallback, useRef, useState } from "react";
import "./SearchModal.css";
import "./StatsModal.css";
import { db } from "../db";

const StatsModal = ({
  isOpen,
  onClose,
  sessionStats,
  todaysStats,
  allTimeStats,
  isLoadingAllTimeStats,
  loadAllTimeStats,
  viewMode,
  toggleViewMode,
  getSessionAccuracy,
  getSessionDuration,
  onNewSession,
}) => {
  const modalDialogRef = useRef(null);

  const handleEscapeKey = useCallback(
    (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscapeKey);
    } else {
      document.removeEventListener("keydown", handleEscapeKey);
    }
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, handleEscapeKey]);

  useEffect(() => {
       console.log('StatsModal useEffect triggered:', { isOpen, viewMode, allTimeStats: !!allTimeStats });

    if (isOpen && viewMode === "alltime" && !allTimeStats) {
         console.log('Loading all-time stats...');

      loadAllTimeStats();
    }
  }, [isOpen, viewMode, allTimeStats, loadAllTimeStats]);

  const handleClickOutside = useCallback(
    (event) => {
      if (
        modalDialogRef.current &&
        !modalDialogRef.current.contains(event.target)
      ) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return null;
  }

  const totalAnswers =
    sessionStats.correctAnswers + sessionStats.incorrectAnswers;

  return (
    <div className="search-modal-overlay" onClick={handleClickOutside}>
      <div
        className="stats-modal-content"
        ref={modalDialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-modal-header">
          <h2>📊 Session Stats</h2>
          <button onClick={onClose} className="search-modal-close-btn">
            &times;
          </button>
        </div>
        <div className="stats-view-toggle">
          <button
            className={`stats-toggle-btn ${
              viewMode === "session" ? "active" : ""
            }`}
            onClick={() => toggleViewMode("session")}
          >
            Session Stats
          </button>
          <button
            className={`stats-toggle-btn ${
              viewMode === "alltime" ? "active" : ""
            }`}
            onClick={() => toggleViewMode("alltime")}
          >
            All-Time Stats
          </button>
        </div>
        <div className="stats-modal-scrollable-area">
          {viewMode === "session" && (
            <>
              {/* Enhanced Session Overview - Current Session + Today's Total */}

              <div className="stats-section">
                <h3 className="stats-section-title">
                  Session & Daily Progress
                </h3>

                {/* Current Session Row */}
                <div style={{ marginBottom: "15px" }}>
                  <h4
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: "1rem",
                      color: "var(--color-primary)",
                    }}
                  >
                    Current Session
                  </h4>
                  <div className="stats-overview-grid">
                    <div className="stats-metric">
                      <strong className="stats-metric-label">Duration:</strong>
                      <span className="stats-metric-value">
                        {getSessionDuration()}
                      </span>
                    </div>
                    <div className="stats-metric">
                      <strong className="stats-metric-label">Cards:</strong>
                      <span className="stats-metric-value">
                        {sessionStats.cardsReviewed}
                      </span>
                    </div>
                    <div className="stats-metric">
                      <strong className="stats-metric-label">Accuracy:</strong>
                      <span className="stats-metric-value">
                        {getSessionAccuracy()}%
                      </span>
                    </div>
                    <div className="stats-metric">
                      <strong className="stats-metric-label">Answers:</strong>
                      <span className="stats-metric-value">{totalAnswers}</span>
                    </div>
                  </div>
                </div>

                {/* Today's Total Row */}
                <div>
                  <h4
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: "1rem",
                      color: "var(--color-success)",
                    }}
                  >
                    Today's Total
                  </h4>
                  {todaysStats ? (
                    <div className="stats-overview-grid">
                      <div className="stats-metric">
                        <strong className="stats-metric-label">
                          Total Cards:
                        </strong>
                        <span className="stats-metric-value">
                          {todaysStats.cardsReviewed}
                        </span>
                      </div>
                      <div className="stats-metric">
                        <strong className="stats-metric-label">Correct:</strong>
                        <span className="stats-metric-value">
                          {todaysStats.correctAnswers}
                        </span>
                      </div>
                      <div className="stats-metric">
                        <strong className="stats-metric-label">
                          Daily Accuracy:
                        </strong>
                        <span className="stats-metric-value">
                          {todaysStats.cardsReviewed > 0
                            ? Math.round(
                                (todaysStats.correctAnswers /
                                  (todaysStats.correctAnswers +
                                    todaysStats.incorrectAnswers)) *
                                  100
                              )
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="stats-metric">
                        <strong className="stats-metric-label">
                          Incorrect:
                        </strong>
                        <span className="stats-metric-value">
                          {todaysStats.incorrectAnswers}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p
                      style={{
                        fontStyle: "italic",
                        color: "var(--text-muted)",
                      }}
                    >
                      No practice today yet
                    </p>
                  )}
                </div>
              </div>
              {/* Answer Breakdown */}
              {totalAnswers > 0 && (
                <div style={{ marginBottom: "25px" }}>
                  <h3
                    style={{
                      margin: "0 0 15px 0",
                      color: "var(--color-primary)",
                    }}
                  >
                    Answer Breakdown
                  </h3>
                  <div className="stats-answer-breakdown">
                    <div className="stats-answer-item correct">
                      <div className="stats-answer-icon">✅</div>
                      <div className="stats-answer-count">
                        {sessionStats.correctAnswers}
                      </div>
                      <div className="stats-answer-label">Correct</div>
                    </div>
                    <div className="stats-answer-item incorrect">
                      <div className="stats-answer-icon">❌</div>
                      <div className="stats-answer-count">
                        {sessionStats.incorrectAnswers}
                      </div>
                      <div className="stats-answer-label">Incorrect</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Game Type Stats */}
              <div style={{ marginBottom: "25px" }}>
                <h3
                  style={{
                    margin: "0 0 15px 0",
                    color: "var(--color-primary)",
                  }}
                >
                  By Game Type
                </h3>
                {Object.entries(sessionStats.gameTypeStats).map(
                  ([gameType, stats]) => {
                    const gameTotal = stats.correct + stats.incorrect;
                    if (gameTotal === 0) return null;

                    const gameAccuracy = Math.round(
                      (stats.correct / gameTotal) * 100
                    );
                    const gameNames = {
                      flashcards: "🎴 Flashcards",
                      matching: "🎮 Matching",
                      fillInBlank: "📝 Fill-in-Blank",
                      conjugation: "🔗 Conjugation",
                    };

                    return (
                      <div
                        key={gameType}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "8px",
                          padding: "8px",
                          backgroundColor: "var(--bg-hint)",
                          borderRadius: "4px",
                        }}
                      >
                        <span>{gameNames[gameType]}</span>
                        <span>
                          <strong>
                            {stats.correct}/{gameTotal}
                          </strong>{" "}
                          ({gameAccuracy}%)
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
              {/* Actions */}
              <div
                style={{
                  textAlign: "center",
                  borderTop: "1px solid var(--color-border)",
                  paddingTop: "20px",
                }}
              >
                <button
                  onClick={() => {
                    onNewSession();
                    onClose();
                  }}
                  style={{
                    backgroundColor: "var(--color-primary)",
                    color: "var(--text-button)",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "10px",
                  }}
                >
                  Start New Session
                </button>
                <button
                  onClick={onClose}
                  style={{
                    backgroundColor: "var(--color-secondary)",
                    color: "var(--text-button)",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </>
          )}
 {viewMode === 'alltime' && (
            <>
              {isLoadingAllTimeStats ? (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                    Loading all-time stats...
                  </p>
                </div>
              ) : allTimeStats ? (
                <div className="stats-section">
                  <h3 className="stats-section-title">📈 All-Time Progress</h3>
                  
                  <div className="stats-overview-grid">
                    <div className="stats-metric">
                      <strong className="stats-metric-label">Total Cards:</strong>
                      <span className="stats-metric-value">{allTimeStats.totalCards}</span>
                    </div>
                    <div className="stats-metric">
                      <strong className="stats-metric-label">Days Studied:</strong>
                      <span className="stats-metric-value">{allTimeStats.daysStudied}</span>
                    </div>
                    <div className="stats-metric">
                      <strong className="stats-metric-label">Overall Accuracy:</strong>
                      <span className="stats-metric-value">{allTimeStats.overallAccuracy}%</span>
                    </div>
                    <div className="stats-metric">
                      <strong className="stats-metric-label">Correct Answers:</strong>
                      <span className="stats-metric-value">{allTimeStats.totalCorrect}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                    No all-time data available yet
                  </p>
                </div>
              )}
            </>
          )}
   
        </div>
      </div>
    </div>
  );
};

export default StatsModal;
