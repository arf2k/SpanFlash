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
  const [submitting, setSubmitting] = useState(false);
  const sitekey = import.meta.env.VITE_TURNSTILE_SITEKEY;

  const handleEscapeKey = useCallback(
    (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // Load Turnstile script once
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

  // Render Turnstile when modal opens
  useEffect(() => {
    if (isOpen && window.turnstile && turnstileRef.current) {
      window.turnstile.render(turnstileRef.current, {
        sitekey,
        theme: "light",
      });
    }
  }, [isOpen, sitekey]);

  // ESC handler
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

  // Submit handler wrapped in a proper <form>
  const handleAdminAccess = async (e) => {
    e?.preventDefault?.();
    if (submitting) return;
    setSubmitting(true);
    setStatusMessage(null);

    // 1) Get the Turnstile token
    const turnstileToken = window.turnstile?.getResponse?.();

    // 2) Client-side sanity + DEBUG
    console.log("Submitting admin-init with:", {
      turnstileTokenPresent: !!turnstileToken,
      adminKeyLength: adminKeyInput?.length ?? 0,
    });

    if (!turnstileToken || !adminKeyInput) {
      setStatusMessage("Turnstile and admin key required");
      setSubmitting(false);
      return;
    }

    try {
      // 3) Pages Function call
      const res = await fetch("/api/admin-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnstileToken,
          adminKey: adminKeyInput,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.warn("admin-init failed:", res.status, txt);
        setStatusMessage("Admin auth failed");
        setSubmitting(false);
        return;
      }

      const data = await res.json();

      // 4) Store token + immediately flip admin mode ON
      if (data?.token) {
        localStorage.setItem("CF-Session-Token", data.token);
        setStatusMessage("Admin session activated");

        if (typeof onToggleAdminMode === "function" && !isAdminMode) {
          onToggleAdminMode();
        }
      } else {
        setStatusMessage("No token returned from server");
      }
    } catch (err) {
      console.error("admin-init error:", err);
      setStatusMessage("Admin auth error");
    } finally {
      setSubmitting(false);
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

                {/* Turnstile widget */}
                <div ref={turnstileRef} />

                {/* Proper form wrapper fixes Chrome warning */}
                <form onSubmit={handleAdminAccess} className="admin-form">
                  <label htmlFor="adminKey" className="sr-only">
                    Admin key
                  </label>
                  <input
                    id="adminKey"
                    type="password"
                    placeholder="Admin key"
                    value={adminKeyInput}
                    onChange={(e) => setAdminKeyInput(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button type="submit" disabled={submitting}>
                    {submitting ? "Activating…" : "Activate Admin Session"}
                  </button>
                </form>

                {statusMessage && (
                  <p aria-live="polite" className="status-text">
                    {statusMessage}
                  </p>
                )}
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

                {/* Admin-only controls */}
                <div className="admin-actions-row">
                  <button
                    type="button"
                    onClick={onExportWordList}
                    className="button-secondary"
                  >
                    Export Word List
                  </button>

                  {/* Optional quick-add entrypoint if you want it here too */}
                  {typeof onTriggerAddWordModal === "function" && (
                    <button
                      type="button"
                      onClick={onTriggerAddWordModal}
                      className="button-secondary"
                    >
                      Add Word
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
