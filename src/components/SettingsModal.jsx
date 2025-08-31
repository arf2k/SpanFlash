import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const adminKeyInputRef = useRef(null);

  const [adminKey, setAdminKey] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [usernameForA11y] = useState("admin");

  // Pull Turnstile token if your hook puts it here; otherwise window.turnstile?.getResponse()
  const getTurnstileToken = () => {
    try {
      const t = sessionStorage.getItem("cf_turnstile_token") || localStorage.getItem("cf_turnstile_token");
      if (t) return t;
      if (window?.turnstile && typeof window.turnstile.getResponse === "function") {
        return window.turnstile.getResponse();
      }
    } catch {}
    return null;
  };

  const sanitizeKey = (value) => {
    if (typeof value !== "string") return "";
    // Normalize line breaks and trim outer whitespace
    let v = value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
    // Hard cap to prevent accidental mega-pastes
    const MAX = 128; // adjust if your real key is longer
    if (v.length > MAX) v = v.slice(0, MAX);
    return v;
  };

  const handleSubmitAdmin = useCallback(async (e) => {
    e?.preventDefault?.();
    setStatusMessage(null);

    // Sanitize + bound the key
    const cleanKey = sanitizeKey(adminKey);
    if (!cleanKey) {
      setStatusMessage({ type: "error", text: "Please enter the admin key." });
      adminKeyInputRef.current?.focus();
      return;
    }
    if (cleanKey.length < 6) {
      setStatusMessage({ type: "error", text: "Admin key looks too short." });
      adminKeyInputRef.current?.focus();
      return;
    }

    const turnstileToken = getTurnstileToken();
    if (!turnstileToken) {
      setStatusMessage({
        type: "error",
        text: "Human verification missing. Please complete the Turnstile check and try again.",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Debug line you saw earlier—keep but make it accurate
      console.log("Submitting admin-init with:", {
        turnstileTokenPresent: !!turnstileToken,
        adminKeyLength: cleanKey.length,
      });

      const resp = await fetch("/api/admin-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnstileToken,
          adminKey: cleanKey,
        }),
      });

      const isJSON = (resp.headers.get("content-type") || "").includes("application/json");
      const data = isJSON ? await resp.json() : null;

      if (resp.status === 200 && data?.token) {
        // Store session token for admin-only actions
        sessionStorage.setItem("sf_admin_token", data.token);
        // Only now flip the UI admin mode
        onToggleAdminMode?.();
        setStatusMessage({ type: "success", text: "Admin mode enabled." });
        setAdminKey("");
        return;
      }

      if (resp.status === 401) {
        setStatusMessage({
          type: "error",
          text: "Unauthorized: admin key incorrect.",
        });
        return;
      }
      if (resp.status === 403) {
        setStatusMessage({
          type: "error",
          text: "Human verification failed. Please retry the Turnstile check.",
        });
        return;
      }
      if (resp.status === 415) {
        setStatusMessage({
          type: "error",
          text: "Unsupported request format. Please try again.",
        });
        return;
      }
      if (resp.status === 405) {
        setStatusMessage({
          type: "error",
          text: "Method not allowed. Please try again.",
        });
        return;
      }
      setStatusMessage({
        type: "error",
        text: "Server error. Please try again shortly.",
      });
    } catch (err) {
      console.error("Admin init error:", err);
      setStatusMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }, [adminKey, onToggleAdminMode]);

  useEffect(() => {
    if (isOpen) {
      // Focus the admin input when opening
      setTimeout(() => adminKeyInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    // Close on Escape
    const handler = (ev) => {
      if (ev.key === "Escape") onClose?.();
    };
    if (isOpen) {
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        ref={modalDialogRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-content">
          <section className="settings-section">
            <h3>Theme</h3>
            <p>Current: <strong>{currentTheme}</strong></p>
            <button onClick={onToggleTheme}>Toggle Theme</button>
          </section>

          <section className="settings-section">
            <h3>Admin</h3>

            <form className="admin-form" onSubmit={handleSubmitAdmin} autoComplete="off">
              {/* a11y username field (hidden) */}
              <input
                type="text"
                name="username"
                value={usernameForA11y}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}
              />

              <label htmlFor="adminKey">Admin key</label>
              <input
                id="adminKey"
                ref={adminKeyInputRef}
                type="password"
                inputMode="text"
                autoComplete="current-password"
                placeholder="Enter admin key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onBlur={(e) => {
                  const v = sanitizeKey(e.target.value);
                  if (v !== e.target.value) {
                    setAdminKey(v);
                  }
                }}
                maxLength={128}
                aria-describedby="adminKeyHelp"
              />
              <small id="adminKeyHelp" className="form-hint">
                For security, only the server can enable admin mode.
              </small>

              <div className="admin-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? "Verifying…" : (isAdminMode ? "Re-authenticate" : "Enable Admin")}
                </button>
              </div>
            </form>

            {statusMessage && (
              <div
                role="status"
                className={`status ${statusMessage.type}`}
                style={{ marginTop: "8px" }}
              >
                {statusMessage.text}
              </div>
            )}
          </section>

          <section className="settings-section">
            <h3>Data</h3>
            <div className="data-actions">
              <button
                onClick={onTriggerAddWordModal}
                title="Add a new word"
              >
                Add Word
              </button>
              <button
                onClick={() => {
                  const hasToken = !!sessionStorage.getItem("sf_admin_token");
                  if (!hasToken) {
                    setStatusMessage({
                      type: "error",
                      text: "Admin session required to export. Please enable admin first.",
                    });
                    return;
                  }
                  onExportWordList?.();
                }}
                disabled={!isAdminMode}
                title="Export word list (admin only)"
              >
                Export Words
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
