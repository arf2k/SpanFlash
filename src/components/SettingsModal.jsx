import React, { useEffect, useCallback, useRef } from "react";
import "./SearchModal.css";
import "./SettingsModal.css";

const SettingsModal = ({
  isOpen,
  onClose,
  onExportWordList,
  isAdminMode,
  onToggleAdminMode,
  currentTheme,
  onToggleTheme,
  onTriggerAddWordModal,
  onVocabAnalysisClick,
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

  return (
    <div className="search-modal-overlay" onClick={handleClickOutside}>
      <div
        className="search-modal-content settings-modal-shell"
        ref={modalDialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search-modal-header">
          <h2>Settings</h2>
          <button onClick={onClose} className="search-modal-close-btn">
            &times;
          </button>
        </div>
        <div className="settings-modal-scrollable-area">
          <div className="settings-section">
            <strong className="settings-section-title">Appearance</strong>
            <div className="setting-item">
              <button onClick={onToggleTheme} className="button-theme-toggle">
                Switch to {currentTheme === "light" ? "Dark" : "Light"} Mode
                {currentTheme === "light" ? " 🌙" : " ☀️"}
              </button>
              <p className="setting-description">
                Change the application's color theme.
              </p>
            </div>
          </div>

          <div className="settings-section">
            <strong className="settings-section-title">
              Admin Configuration
            </strong>
            <div className="setting-item">
              <label htmlFor="adminModeToggle" className="admin-toggle-label">
                <input
                  type="checkbox"
                  id="adminModeToggle"
                  checked={isAdminMode}
                  onChange={onToggleAdminMode}
                  className="admin-toggle-checkbox"
                />
                Enable Admin Features
              </label>
              <p className="setting-description">
                Shows extra options like data export and word addition. This
                setting is saved in your browser.
              </p>
            </div>
          </div>

          {isAdminMode && ( // Only show Data Management if admin mode is enabled
            <div className="settings-section">
              <strong className="settings-section-title">
                Data Management
              </strong>
              {/* Add New Word Button */}
              <div className="setting-item">
                <button
                  onClick={onVocabAnalysisClick}
                  className="button-export-settings"
                  title="Vocabulary Analysis (admin only - data may be inaccurate)"
                >
                  <span role="img" aria-label="vocabulary analysis">
                    📚
                  </span>{" "}
                  Vocabulary Analysis
                </button>
                <p className="setting-description">
                  Note: Analysis assumes words in list are "known" which may not
                  be accurate.
                </p>
                <button
                  onClick={onTriggerAddWordModal}
                  className="button-add-word-settings"
                  title="Add a new word pair to your local list"
                >
                  <span role="img" aria-label="add icon">
                    ➕
                  </span>{" "}
                  Add New Word
                </button>
                <p className="setting-description">
                  Opens the form to add a new word with details to your local
                  list.
                </p>
              </div>

              {/* Export Word List Button */}
              <div className="setting-item" style={{ marginTop: "20px" }}>
                {" "}
                {/* Added some top margin */}
                <button
                  onClick={onExportWordList}
                  className="button-export-settings"
                  title="Export current local word list to JSON"
                >
                  <span role="img" aria-label="export icon">
                    📤
                  </span>{" "}
                  Export Word List
                </button>
                <p className="setting-description">
                  Downloads your current word list. Remember to manually update
                  the 'version' in the downloaded file before replacing your
                  master `scrapedSpan411.json`.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="settings-modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="button-close-settings"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
