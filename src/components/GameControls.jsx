import React from 'react';

const GameControls = ({
  // Game mode handlers
  onFillInBlankToggle,
  onMatchingGameToggle,
  onVerbConjugationToggle,
  onHardModeToggle,
  
  // Other handlers
  onSearchClick,
  onSwitchDirection,
  onNewCard,
  
  // State
  isAnyGameActive,
  isInHardWordsMode,
  languageDirection,
  isLoadingData,
  listForFlashcardGame,
  showHardWordsView
}) => {
  return (
    <div className="controls">
      <button
        onClick={onFillInBlankToggle}
        title="Fill-in-the-Blank Game"
        style={{ padding: "0.6rem 0.8rem" }}
      >
        <span role="img" aria-label="pencil and paper icon">
          📝
        </span>{" "}
        Fill-in-Blank
      </button>

      <button
        onClick={onMatchingGameToggle}
        title="Matching Game"
        style={{ padding: "0.6rem 0.8rem" }}
      >
        <span role="img" aria-label="game icon">
          🎮
        </span>{" "}
        Matching Game
      </button>
      
      <button
        onClick={onSearchClick}
        title="Search Words"
        style={{ padding: "0.6rem 0.8rem" }}
        disabled={isAnyGameActive}
      >
        <span role="img" aria-label="search icon">
          🔍
        </span>{" "}
        Search
      </button>
      
      <button
        onClick={onVerbConjugationToggle}
        title="Verb Conjugation Game"
        style={{ padding: "0.6rem 0.8rem" }}
        disabled={isAnyGameActive}
      >
        <span role="img" aria-label="verb conjugation icon">
          🔗
        </span>{" "}
        Conjugation
      </button>
      
      <button
        onClick={onHardModeToggle}
        title={
          isInHardWordsMode ? "Practice All Words" : "Practice Hard Words"
        }
        style={{ padding: "0.6rem 0.8rem" }}
        disabled={isAnyGameActive}
      >
        <span
          role="img"
          aria-label={isInHardWordsMode ? "list icon" : "brain icon"}
        >
          {isInHardWordsMode ? "📋" : "🧠"}
        </span>
        {isInHardWordsMode ? "All Words" : "Hard Mode"}
      </button>
      
      <button
        onClick={onSwitchDirection}
        disabled={
          isLoadingData ||
          !listForFlashcardGame.length ||
          showHardWordsView ||
          isAnyGameActive
        }
      >
        Switch Dir ({languageDirection === "spa-eng" ? "S->E" : "E->S"})
      </button>
      
      <button
        onClick={onNewCard}
        disabled={
          isLoadingData ||
          !listForFlashcardGame.length ||
          showHardWordsView ||
          isAnyGameActive
        }
      >
        {isLoadingData ? "Loading..." : "New Card"}
      </button>
    </div>
  );
};

export default GameControls;