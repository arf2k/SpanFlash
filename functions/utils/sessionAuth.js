// ======== Config ========
const COOKIE_NAME = "sf_admin_session"; // Issued by /api/admin-init (HttpOnly)
const KV_PREFIX = "session:"; // Matches sessionManager.js
const SESSION_HEADER = "CF-Session-Token"; // Legacy header (temporary fallback)

// ======== Cookie utils ========
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(";"); // simple parse; fine for our single cookie
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent((rest.join("=") || "").trim());
  }
  return out;
}

// ======== KV session helpers ========
// Returns { valid: true, session } or { valid: false, reason }
async function validateSession(kv, token) {
  try {
    const raw = await kv.get(`${KV_PREFIX}${token}`);
    if (!raw) return { valid: false, reason: "not_found" };
    //  TTL is enforced by KV expirationTtl.
    const session = JSON.parse(raw);
    return { valid: true, session };
  } catch (err) {
    console.error("validateSession error:", err);
    return { valid: false, reason: "kv_error" };
  }
}

// ======== Turnstile verify ========
export async function validateTurnstileToken(
  token,
  secretKey,
  remoteIP = null
) {
  if (!token || !secretKey) {
    return { success: false, error: "Missing token or secret key" };
  }
  try {
    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          remoteip: remoteIP || undefined,
        }),
      }
    );
    return await resp.json();
  } catch (e) {
    console.error("Turnstile verify error:", e);
    return { success: false, error: "network_error" };
  }
}

/**
 * authenticateRequest(context, apiName?, options?)
 * - By default, maintains your current behavior (cookie → header → optional Turnstile fallback).
 * - For **admin routes**, use adminGuard() below (no Turnstile fallback).
 *
 * Returns:
 *   { isAuthenticated: true, sessionInfo: {...} } OR
 *   { isAuthenticated: false, errorResponse: Response }
 */
export async function authenticateRequest(
  context,
  apiName = "API",
  options = { allowTurnstileFallback: true }
) {
  const kv = context.env?.SESSIONS;
  if (!kv) {
    return {
      isAuthenticated: false,
      errorResponse: new Response(
        JSON.stringify({
          error: "Configuration Error",
          details: "SESSIONS KV binding missing",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  const req = context.request;
  const headers = req.headers;

  // 1) Prefer cookie-based session (HttpOnly)
  const cookieHeader = headers.get("Cookie") || headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  const cookieToken = cookies[COOKIE_NAME];

  if (cookieToken) {
    const res = await validateSession(kv, cookieToken);
    if (res.valid) {
      return {
        isAuthenticated: true,
        sessionInfo: {
          token: cookieToken,
          session: res.session,
          via: "cookie",
        },
      };
    }
  }

  // 2) Legacy header fallback (while migrating client off localStorage)
  const headerToken = headers.get(SESSION_HEADER);
  if (headerToken) {
    const res = await validateSession(kv, headerToken);
    if (res.valid) {
      return {
        isAuthenticated: true,
        sessionInfo: {
          token: headerToken,
          session: res.session,
          via: "header",
        },
      };
    }
  }

  // 3) (Optional) Turnstile fallback — NOT for admin routes
  if (options?.allowTurnstileFallback) {
    const tsToken =
      headers.get("CF-Turnstile-Response") ||
      headers.get("cf-turnstile-response");
    const remoteIP = headers.get("CF-Connecting-IP") || undefined;

    if (!tsToken) {
      return {
        isAuthenticated: false,
        errorResponse: new Response(
          JSON.stringify({
            error: "Security Validation Required",
            details:
              "No session found. Complete human verification and/or sign in.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        ),
      };
    }

    const secret = context.env?.TURNSTILE_SECRET;
    const result = await validateTurnstileToken(tsToken, secret, remoteIP);
    if (result?.success) {
      return {
        isAuthenticated: true,
        sessionInfo: { token: null, session: null, via: "turnstile" },
      };
    }

    return {
      isAuthenticated: false,
      errorResponse: new Response(
        JSON.stringify({ error: "Human verification failed" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // No cookie/header session and fallback disabled
  return {
    isAuthenticated: false,
    errorResponse: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  };
}

/**
 * adminGuard(context, apiName?)
 * - For **admin-only** endpoints. Requires a valid KV-backed cookie session.
 * - No Turnstile fallback allowed here.
 */
export async function adminGuard(context, apiName = "Admin API") {
  return authenticateRequest(context, apiName, {
    allowTurnstileFallback: false,
  });
}

// Simple OPTIONS handler for CORS preflights (keep existing behavior)
export function handleOptionsRequest() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, CF-Turnstile-Response, CF-Session-Token",
      "Access-Control-Max-Age": "86400",
    },
  });
}
