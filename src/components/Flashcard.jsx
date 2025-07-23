import React, { useState, useEffect } from "react";
import "./Flashcard.css";
import WordCelebration from "./WordCelebration";

const Flashcard = ({
  pair,
  direction,
  onAnswerSubmit,
  showFeedback,
  onGetHint,
  hint,
  isHintLoading,
  feedbackSignal,
  onMarkHard,
  isMarkedHard,
  onEdit,
  onShowDetails,
  onNewCard,
  onSwitchDirection,
  celebrationState,
  onCelebrationComplete,
}) => {
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    setAnswer("");
  }, [pair, showFeedback]);

  let wordToShow = "";
  let placeholderText = "Type your answer...";
  let correctAnswer = "";

  if (pair) {
    if (direction === "spa-eng") {
      wordToShow = pair.spanish;
      correctAnswer = pair.english;
      placeholderText = "Type English...";
    } else {
      wordToShow = pair.english;
      correctAnswer = pair.spanish;
      placeholderText = "Type Spanish...";
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!answer.trim() || showFeedback) return;
    onAnswerSubmit(answer);
  };

  const cardClassName = `flashcard ${
    feedbackSignal ? `flashcard--${feedbackSignal}` : ""
  } ${celebrationState?.flashcardClass || ""}`.trim();
  const markIcon = isMarkedHard ? "★" : "☆";
  const markTitle = isMarkedHard
    ? "Word is marked as hard"
    : "Mark this word as hard";

  return (
    <div className={cardClassName}>
      {pair ? (
        <div>
          <button
            onClick={onSwitchDirection}
            className="flashcard-switch-button"
            title={`Switch to ${
              direction === "spa-eng"
                ? "English → Spanish"
                : "Spanish → English"
            }`}
            disabled={!onSwitchDirection}
          >
            🔄
          </button>
          <div className="flashcard-action-buttons">
            <button
              onClick={() => onMarkHard(pair)}
              title={markTitle}
              className={`flashcard-action-button mark-hard ${
                isMarkedHard ? "marked" : ""
              }`}
            >
              {markIcon}
            </button>
            {onEdit && (
              <button
                onClick={onEdit}
                title="Edit this word"
                className="flashcard-action-button edit-word"
              >
                ✏️
              </button>
            )}
            {pair && onShowDetails && (
              <button
                onClick={onShowDetails}
                title="Show more details & examples"
                className="flashcard-action-button show-details"
              >
                📖
              </button>
            )}
          </div>

          {/* Main Word Display */}
          <p className="flashcard-word">{wordToShow}</p>

          {/* Enhanced Content - Show when feedback is active (flipped card state) */}
          {showFeedback && (
            <div className="flashcard-details-revealed">
              {/* Correct Translation */}
              <div className="detail-item">
                <strong>
                  {direction === "spa-eng" ? "English:" : "Spanish:"}
                </strong>
                <span className="detail-value">{correctAnswer}</span>
              </div>

              {/* Spanish Synonyms */}
              {pair.synonyms_spanish && pair.synonyms_spanish.length > 0 && (
                <div className="detail-item">
                  <strong>Spanish Synonyms:</strong>
                  <span className="detail-value">
                    {pair.synonyms_spanish.join(", ")}
                  </span>
                </div>
              )}

              {/* English Synonyms */}
              {pair.synonyms_english && pair.synonyms_english.length > 0 && (
                <div className="detail-item">
                  <strong>English Synonyms:</strong>
                  <span className="detail-value">
                    {pair.synonyms_english.join(", ")}
                  </span>
                </div>
              )}

              {/* Category */}
              {pair.category && (
                <div className="detail-item category-detail">
                  <strong>Category:</strong>
                  <span className="detail-value">{pair.category}</span>
                </div>
              )}

              {/* Notes */}
              {pair.notes && (
                <div className="detail-item notes-detail">
                  <strong>Notes:</strong>
                  <div className="notes-content">{pair.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p>No card data.</p>
      )}

      {/* Answer Form: Only shown if not showing feedback AND a pair exists */}
      {pair && !showFeedback && (
        <>
          <form onSubmit={handleSubmit} className="answer-form">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={placeholderText}
              className="answer-input"
              autoFocus
              required
            />
            <div className="answer-form-buttons">
              <button
                type="submit"
                className="submit-button"
                disabled={!answer.trim()}
              >
                Check Answer
              </button>
            </div>
          </form>
          <div className="secondary-buttons">
            <button
              type="button"
              onClick={onGetHint}
              className="hint-button"
              disabled={
                isHintLoading ||
                (hint && hint.type !== "error") ||
                (showFeedback && feedbackSignal === "incorrect")
              }
            >
              {isHintLoading ? "Getting Synonyms..." : "Synonyms"}
            </button>
            <button
              type="button"
              onClick={onNewCard}
              className="new-card-button"
            >
              New Card
            </button>
          </div>
        </>
      )}
      {/* Hint Display */}
      {console.log('=== HINT DEBUG ===') || null}
{console.log('isHintLoading:', isHintLoading) || null}
{console.log('hint exists:', !!hint) || null}
{console.log('hint object:', hint) || null}
{console.log('hint type:', hint?.type) || null}
{console.log('hint keys:', hint ? Object.keys(hint) : 'no hint') || null}
{console.log('==================') || null}

      {(isHintLoading || hint) && (
        <div className="hint-display">
      
          {isHintLoading && !hint && <span>Loading synonyms...</span>}
          {hint && (
            <>
              {hint.type === "slow_loading" && (
                <span style={{ color: "orange" }}>
                  {hint.message ||
                    "Dictionary lookup is taking longer than usual..."}
                </span>
              )}
              {hint.type === "suggestions" && hint.suggestions?.length > 0 && (
                <span>Did you mean: {hint.suggestions.join(", ")}?</span>
              )}
              {hint.type === "definitions" && hint.data ? (
                <>
                  <strong>Hint (MW): </strong>
                  {hint.data.fl && (
                    <em style={{ marginRight: "5px" }}>({hint.data.fl})</em>
                  )}
                  {hint.data.shortdef && hint.data.shortdef.length > 0 ? (
                    hint.data.shortdef.map((def, index) => (
                      <span key={index}>
                        {index > 0 && "; "} {def}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontStyle: "italic" }}>
                      (No short definition)
                    </span>
                  )}
                </>
              ) : null}
              {hint.type === "error" && (
                <span style={{ color: "orange" }}>
                  Hint Error: {hint.message || "Failed."}
                  {hint.canRetry && " Try again?"}
                </span>
              )}
              {hint.type === "unknown" && (
                <span style={{ color: "orange" }}>
                  Unrecognized hint format.
                </span>
              )}
            </>
          )}
        </div>
      )}
      {/* Level-up Celebration Overlay */}
      <WordCelebration
        isVisible={celebrationState?.isVisible || false}
        celebrationType={celebrationState?.type}
        onAnimationComplete={onCelebrationComplete}
      />
    </div>
  );
};

export default Flashcard;
