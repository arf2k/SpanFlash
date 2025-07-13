import React from "react";

const AppHeader = ({
  currentDataVersion,
  isInHardWordsMode,
  isAnyGameActive,
  onSettingsClick,
  onStatsClick,
  setIsVocabExtractionModalOpen,
}) => {
  const showHardModeIndicator = isInHardWordsMode && !isAnyGameActive;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        maxWidth: "700px",
        marginBottom: "10px",
      }}
    >
      <h1>Xan's Spans</h1>
      <div>
        {currentDataVersion && (
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              margin: "0",
              display: "inline-block",
              marginRight: "15px",
            }}
          >
            v: {currentDataVersion} {showHardModeIndicator && "(Hard Mode)"}
          </p>
        )}
        {/* VOCABULARY EXTRACTION BUTTON */}
        <button
          onClick={() => setIsVocabExtractionModalOpen(true)}
          title="Extract vocabulary from text"
          style={{
            background: "none",
            border: "none",
            fontSize: "1.3em",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "0",
            marginRight: "10px",
          }}
          disabled={isAnyGameActive}
        >
          <span role="img" aria-label="vocabulary extraction icon">
            📰
          </span>
        </button>
        {/* STATS BUTTON */}
        <button
          onClick={onStatsClick}
          title="Session Stats"
          style={{
            background: "none",
            border: "none",
            fontSize: "1.3em",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "0",
            marginRight: "10px",
          }}
          disabled={isAnyGameActive}
        >
          <span role="img" aria-label="stats icon">
            📊
          </span>
        </button>
        {/* SETTINGS BUTTON */}
        <button
          onClick={onSettingsClick}
          title="Settings"
          style={{
            background: "none",
            border: "none",
            fontSize: "1.5em",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "0",
          }}
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
