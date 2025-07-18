import React, { useState } from "react";
import "./FloatingGamesButton.css";

const FloatingGamesButton = ({
  // Game mode handlers
  onFillInBlankToggle,
  onMatchingGameToggle,
  onVerbConjugationToggle,
  onHardModeToggle,
  onSearchClick,
  onNewCard,

  // State
  isAnyGameActive,
  isMatchingGameModeActive,
  isFillInTheBlankModeActive,
  isInHardWordsMode,
  languageDirection,
  isLoadingData,
  listForFlashcardGame,
  showHardWordsView,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleGameAction = (action) => {
    action();
    setIsMenuOpen(false); // Close menu after action
  };

  // Don't show if any game is active (games have their own exit buttons)
  if (isAnyGameActive) {
    return null;
  }

  return (
    <div className="floating-games-container">
      {/* Expandable Menu */}
      {isMenuOpen && (
        <div className="games-menu">
          <button
            onClick={() => handleGameAction(onFillInBlankToggle)}
            className="game-menu-item"
            title="Fill-in-the-Blank Game"
          >
            <span className="game-icon">📝</span>
            <span className="game-label">Fill-in-Blank</span>
          </button>

          <button
            onClick={() => handleGameAction(onMatchingGameToggle)}
            className="game-menu-item"
            title="Matching Game"
          >
            <span className="game-icon">🎯</span>
            <span className="game-label">Matching Game</span>
          </button>

          <button
            onClick={() => handleGameAction(onVerbConjugationToggle)}
            className="game-menu-item"
            title="Verb Conjugation Game"
          >
            <span className="game-icon">🔗</span>
            <span className="game-label">Conjugation</span>
          </button>

          <button
            onClick={() => handleGameAction(onHardModeToggle)}
            className="game-menu-item"
            title={
              isInHardWordsMode ? "Practice All Words" : "Practice Hard Words"
            }
          >
            <span className="game-icon">{isInHardWordsMode ? "📋" : "🧠"}</span>
            <span className="game-label">
              {isInHardWordsMode ? "All Words" : "Hard Mode"}
            </span>
          </button>

          <button
            onClick={() => handleGameAction(onSearchClick)}
            className="game-menu-item"
            title="Search Words"
          >
            <span className="game-icon">🔍</span>
            <span className="game-label">Search</span>
          </button>

          {/* Flashcard Controls - Only show when not in hard words view */}
          {!showHardWordsView && (
            <>
              <div className="menu-divider"></div>
            </>
          )}
        </div>
      )}

      {/* Main Floating Button */}
      <button
        onClick={toggleMenu}
        className={`floating-games-button ${isMenuOpen ? "menu-open" : ""}`}
        title="Games & Controls"
        aria-label="Games menu"
      >
        <span className="controller-icon">🎮</span>
      </button>

      {/* Background overlay when menu is open */}
      {isMenuOpen && (
        <div
          className="games-menu-overlay"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default FloatingGamesButton;
