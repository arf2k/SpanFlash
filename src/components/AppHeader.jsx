import React from "react";
import "./AppHeader.css";

const AppHeader = ({
  currentDataVersion, // Keep prop for now, will remove later
  isInHardWordsMode,
  isAnyGameActive,
  onSettingsClick,
  onStatsClick,
  setIsVocabExtractionModalOpen,
}) => {
  const showHardModeIndicator = isInHardWordsMode && !isAnyGameActive;

  return (
    <div className="app-header">
      {/* Removed version display - now just shows hard mode if active */}
      {showHardModeIndicator && (
        <div className="hard-mode-indicator">
          Hard Mode
        </div>
      )}
      
      <div className="app-header-buttons">
        <button
          onClick={() => setIsVocabExtractionModalOpen(true)}
          title="Extract vocabulary from text"
          className="app-header-button extract"
          disabled={isAnyGameActive}
        >
          <span role="img" aria-label="vocabulary extraction icon">
            📰
          </span>
        </button>
        
        <button
          onClick={onStatsClick}
          title="Session Stats"
          className="app-header-button stats"
          disabled={isAnyGameActive}
        >
          <span role="img" aria-label="stats icon">
            📊
          </span>
        </button>
        
        <button
          onClick={onSettingsClick}
          title="Settings"
          className="app-header-button settings"
          disabled={isAnyGameActive}
        >
          <span role="img" aria-label="settings icon">
            ⚙️
          </span>
        </button>
      </div>
    </div>
  );
};

export default AppHeader;