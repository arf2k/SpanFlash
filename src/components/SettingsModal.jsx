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
                Shows extra options like data export. This setting is saved in
                your browser.
              </p>
            </div>
          </div>

          {isAdminMode && (
            <div className="settings-section">
              <strong className="settings-section-title">
                Data Management
              </strong>
              <div className="setting-item">
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
                  Downloads your current word list as a JSON file. Remember to
                  manually update the 'version' in the downloaded file.
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
