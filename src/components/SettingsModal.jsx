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

  // --- NEW: refs/state for Turnstile-in-Settings ---
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetIdRef = useRef(null);

  const [adminKey, setAdminKey] = useState("");
  const [statusMessage, setStatusMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [usernameForA11y] = useState("admin");

  // Use your existing env var (you referenced this earlier in Settings) 
  // If undefined, the Turnstile block will show a graceful error message instead of rendering.
  const sitekey = import.meta.env.VITE_TURNSTILE_SITEKEY;

  // Pull Turnstile token from storage or window.turnstile (matches your prior pattern) :contentReference[oaicite:2]{index=2}
  const getTurnstileToken = () => {
    try {
      const t =
        sessionStorage.getItem("cf_turnstile_token") ||
        localStorage.getItem("cf_turnstile_token");
      if (t) return t;
      if (window?.turnstile && typeof window.turnstile.getResponse === "function") {
        const wid = turnstileWidgetIdRef.current;
        return window.turnstile.getResponse(wid ?? undefined);
      }
    } catch {}
    return null;
  };

  const sanitizeKey = (value) => {
    if (typeof value !== "string") return "";
    let v = value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
    const MAX = 128;
    if (v.length > MAX) v = v.slice(0, MAX);
    return v;
  };

  // --- NEW: ensure Turnstile script present & render in Settings ---
  const ensureTurnstileScript = useCallback(async () => {
    if (window.turnstile) return true;

    // Already requested?
    if (document.querySelector('script[data-turnstile="1"]')) {
      // Wait briefly for it to initialize
      for (let i = 0; i < 20; i++) {
        if (window.turnstile) return true;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
      }
      return !!window.turnstile;
    }

    // Inject script
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-turnstile", "1");
    document.head.appendChild(s);

    // Wait for load
    return new Promise((resolve) => {
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      // Fallback wait loop in case onload isn’t fired
      (async () => {
        for (let i = 0; i < 30; i++) {
          if (window.turnstile) {
            resolve(true);
            return;
          }
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 100));
        }
        resolve(!!window.turnstile);
      })();
    });
  }, []);

  const renderTurnstile = useCallback(async () => {
    if (!isOpen) return;
    if (!turnstileContainerRef.current) return;
    if (!sitekey) {
      console.warn("VITE_TURNSTILE_SITEKEY not set; Turnstile cannot render.");
      return;
    }
    const ok = await ensureTurnstileScript();
    if (!ok || !window.turnstile) {
      console.error("Turnstile script failed to load.");
      return;
    }

    // If a widget already exists in this ref, reset it
    if (turnstileWidgetIdRef.current != null) {
      try {
        window.turnstile.remove(turnstileWidgetIdRef.current);
      } catch {}
      turnstileWidgetIdRef.current = null;
    }

    // Render widget into our modal container
    const wid = window.turnstile.render(turnstileContainerRef.current, {
      sitekey,
      theme: document.body.dataset.theme === "dark" ? "dark" : "light",
      action: "settings_admin_login",
      callback: (token) => {
        try {
          sessionStorage.setItem("cf_turnstile_token", token);
        } catch {}
      },
      "error-callback": () => {
        setStatusMessage({
          type: "error",
          text: "Human verification failed. Please try again.",
        });
      },
      "expired-callback": () => {
        try {
          sessionStorage.removeItem("cf_turnstile_token");
        } catch {}
      },
    });

    turnstileWidgetIdRef.current = wid;
  }, [ensureTurnstileScript, isOpen, sitekey]);

  // Render Turnstile when Settings opens; clean up when closing
  useEffect(() => {
    if (isOpen) {
      renderTurnstile();
      // Focus admin input
      setTimeout(() => adminKeyInputRef.current?.focus(), 50);
    } else {
      // Remove widget instance to avoid zombie widgets
      if (window?.turnstile && turnstileWidgetIdRef.current != null) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {}
      }
      turnstileWidgetIdRef.current = null;
      // Clear token so a new challenge is required next time
      try {
        sessionStorage.removeItem("cf_turnstile_token");
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (ev) => {
      if (ev.key === "Escape") onClose?.();
    };
    if (isOpen) {
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }
  }, [isOpen, onClose]);

  const handleSubmitAdmin = useCallback(
    async (e) => {
      e?.preventDefault?.();
      setStatusMessage(null);

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
          text: "Human verification missing. Please complete the Turnstile check in Settings.",
        });
        // Try forcing a reset/render in case the widget silently failed
        if (window?.turnstile && turnstileWidgetIdRef.current != null) {
          try {
            window.turnstile.reset(turnstileWidgetIdRef.current);
          } catch {}
        } else {
          renderTurnstile();
        }
        return;
      }

      setSubmitting(true);
      try {
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

        if (resp.status === 200) {
          // Back-compat: if server still returns a token, keep it for UI gating
          if (data?.token) {
            try {
              sessionStorage.setItem("sf_admin_token", data.token);
            } catch {}
          }
          onToggleAdminMode?.(); // flips the local UI switch (UX only) :contentReference[oaicite:3]{index=3}
          setStatusMessage({ type: "success", text: "Admin mode enabled." });
          setAdminKey("");
          return;
        }

        if (resp.status === 401) {
          setStatusMessage({ type: "error", text: "Unauthorized: admin key incorrect." });
          return;
        }
        if (resp.status === 403) {
          setStatusMessage({
            type: "error",
            text: "Human verification failed. Please retry the Turnstile check.",
          });
          // Force a new challenge
          if (window?.turnstile && turnstileWidgetIdRef.current != null) {
            try {
              window.turnstile.reset(turnstileWidgetIdRef.current);
            } catch {}
          }
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
    },
    [adminKey, onToggleAdminMode, renderTurnstile]
  );

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

            {/* --- NEW: Turnstile widget lives inside Settings, above the form --- */}
            <div style={{ marginBottom: "10px" }}>
              {sitekey ? (
                <div ref={turnstileContainerRef} className="cf-turnstile" />
              ) : (
                <small className="form-hint" style={{ color: "var(--text-error)" }}>
                  Turnstile sitekey is not configured. Set VITE_TURNSTILE_SITEKEY to enable human verification.
                </small>
              )}
            </div>

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
                  if (v !== e.target.value) setAdminKey(v);
                }}
                maxLength={128}
                aria-describedby="adminKeyHelp"
              />
              <small id="adminKeyHelp" className="form-hint">
                Complete the human check above, then submit your admin key.
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
              <button onClick={onTriggerAddWordModal} title="Add a new word">
                Add Word
              </button>

              {/* Keep your current client-side export flow intact */}
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
