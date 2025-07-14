// Enhanced Flashcard.jsx - Step 1C: Show rich content when feedback is active

import React, { useState, useEffect } from "react";
import "./Flashcard.css";

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
  onShowDetails, // Prop to trigger showing the details modal
}) => {
  const [answer, setAnswer] = useState("");

  // Effect to clear the answer input when a new card is shown or feedback appears/disappears
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
  }`.trim();
  const markIcon = isMarkedHard ? "★" : "☆";
  const markTitle = isMarkedHard
    ? "Word is marked as hard"
    : "Mark this word as hard";

  return (
    <div className={cardClassName}>
      {pair ? (
        <div>
          {/* Action Buttons - Above the word */}
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
          </div>
        </form>
      )}

      {/* Hint Display - Outside of answer form for better mobile layout */}
      {hint && !showFeedback && (
        <div className="hint-display">
          {hint.type === "definition" && hint.definition && (
            <div>
              <strong>Definition:</strong> {hint.definition}
              {hint.suggestedWords && hint.suggestedWords.length > 0 && (
                <div>
                  <em>Suggestions: {hint.suggestedWords.join(", ")}</em>
                </div>
              )}
            </div>
          )}
          {hint.type === "error" && (
            <div style={{ color: "orange" }}>
              <strong>Error:</strong> {hint.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Flashcard;
