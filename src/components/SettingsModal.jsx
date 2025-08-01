import React, { useEffect, useCallback, useRef, useState } from "react";
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
}) => {
  const modalDialogRef = useRef(null);
  const turnstileRef = useRef(null);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const sitekey = import.meta.env.VITE_TURNSTILE_SITEKEY;

  const handleEscapeKey = useCallback(
    (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!window.turnstile && !document.getElementById("turnstile-script")) {
      const script = document.createElement("script");
      script.id = "turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (isOpen && window.turnstile && turnstileRef.current) {
      window.turnstile.render(turnstileRef.current, {
        sitekey,
        theme: "light",
      });
    }
  }, [isOpen, sitekey]);

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

  const handleAdminAccess = async () => {
    setStatusMessage(null);
    const turnstileToken = window.turnstile?.getResponse();
    if (!turnstileToken || !adminKeyInput) {
      setStatusMessage("Turnstile and admin key required");
      return;
    }
    try {
      const res = await fetch("/api/admin-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnstileToken,
          adminKey: adminKeyInput,
        }),
      });
      if (!res.ok) {
        throw new Error("Unauthorized");
      }
      const data = await res.json();
      localStorage.setItem("CF-Session-Token", data.token);
      setStatusMessage("Admin session activated ✅");
      onToggleAdminMode();
    } catch (err) {
      console.error("Admin auth failed:", err);
      setStatusMessage("Failed to authenticate as admin ❌");
    }
  };

  if (!isOpen) return null;

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
            <strong className="settings-section-title">Admin Access</strong>
            {!isAdminMode && (
              <div className="setting-item">
                <p>Unlock admin features with Turnstile + key:</p>
                <div ref={turnstileRef}></div>
                <input
                  type="password"
                  placeholder="Admin key"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                />
                <button onClick={handleAdminAccess}>
                  Activate Admin Session
                </button>
                {statusMessage && <p>{statusMessage}</p>}
              </div>
            )}

            {isAdminMode && (
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
                  Shows extra options like data export and word addition.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
