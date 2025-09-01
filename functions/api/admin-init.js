// functions/api/admin-init.js
// Creates an admin session after verifying Cloudflare Turnstile + ADMIN_SECRET.
// On success: sets HttpOnly cookie "sf_admin_session" and returns { ok: true, token, role: "admin" }.
// Errors are returned as JSON with accurate 4xx/5xx codes (no silent 500s).

import { generateSessionToken, storeSession } from "../utils/sessionManager.js";

/** Build a JSON Response with status + headers */
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...extraHeaders,
    },
  });
}

/** Constant-time string compare to reduce timing leaks. */
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Builds the admin cookie */
function adminCookie(token, maxAgeSeconds = 3600) {
  return [
    `sf_admin_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

/** Extract caller IP for Turnstile "remoteip" (best effort) */
function getRemoteIp(request) {
  const h = request.headers;
  return (
    h.get("CF-Connecting-IP") ||
    (h.get("X-Forwarded-For") || "").split(",")[0].trim() ||
    null
  );
}

/** Verify Turnstile token with Cloudflare */
async function verifyTurnstile(secret, token, remoteIp) {
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  const resp = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  if (!resp.ok) {
    return { ok: false, status: resp.status, data: null };
  }

  const data = await resp.json();
  return { ok: true, status: 200, data };
}

export async function onRequestOptions() {
  // Preflight for CORS
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Correlation ids (useful in Wrangler tail)
  const reqId =
    request.headers.get("CF-Ray") ||
    Math.random().toString(36).slice(2, 10).toUpperCase();

  try {
    // --- 1) Ensure env/bindings exist
    const adminSecret = env.ADMIN_SECRET ?? env.ADMIN_KEY ?? null;
    const turnstileSecret =
      env.TURNSTILE_SECRET_KEY ?? env.TURNSTILE_SECRET ?? null;
    const sessionsKV = env.SESSIONS;

    if (!adminSecret) {
      console.error(
        JSON.stringify({
          reqId,
          event: "config.missing",
          key: "ADMIN_SECRET",
        })
      );
      return json({ error: "Server misconfiguration: ADMIN_SECRET missing" }, 500);
    }
    if (!turnstileSecret) {
      console.error(
        JSON.stringify({
          reqId,
          event: "config.missing",
          key: "TURNSTILE_SECRET_KEY",
        })
      );
      return json(
        { error: "Server misconfiguration: TURNSTILE_SECRET_KEY missing" },
        500
      );
    }
    if (!sessionsKV || typeof sessionsKV.put !== "function") {
      console.error(
        JSON.stringify({
          reqId,
          event: "config.missing",
          key: "SESSIONS KV",
        })
      );
      return json({ error: "Server misconfiguration: SESSIONS KV missing" }, 500);
    }

    // --- 2) Parse JSON body robustly
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const {
      // support multiple likely field names
      turnstileToken,
      cfTurnstileToken,
      token: turnstileTokenAlt,
      adminKey,
      key: adminKeyAlt,
      ttlSeconds,
    } = payload || {};

    const providedAdminKey = adminKey ?? adminKeyAlt ?? "";
    const providedTurnstile =
      turnstileToken ?? cfTurnstileToken ?? turnstileTokenAlt ?? "";

    if (!providedTurnstile) {
      return json({ error: "Missing Turnstile token" }, 400);
    }
    if (!providedAdminKey) {
      return json({ error: "Missing admin key" }, 400);
    }

    // --- 3) Verify Turnstile (include caller IP)
    const remoteIp = getRemoteIp(request);
    const verify = await verifyTurnstile(turnstileSecret, providedTurnstile, remoteIp);

    if (!verify.ok) {
      console.error(
        JSON.stringify({
          reqId,
          event: "turnstile.fetch_failed",
          httpStatus: verify.status,
        })
      );
      return json({ error: "Turnstile verification failed upstream" }, 502);
    }

    const v = verify.data;
    if (!v?.success) {
      console.warn(
        JSON.stringify({
          reqId,
          event: "turnstile.denied",
          "error-codes": v?.["error-codes"] || [],
          remoteIp,
        })
      );
      return json(
        { error: "Robot verification failed", details: v?.["error-codes"] || [] },
        401
      );
    }

    // --- 4) Check admin key (constant-time)
    if (!constantTimeEqual(providedAdminKey, adminSecret)) {
      console.warn(
        JSON.stringify({ reqId, event: "admin.key_mismatch", remoteIp })
      );
      return json({ error: "Unauthorized" }, 403);
    }

    // --- 5) Create session + persist in KV
    const now = Math.floor(Date.now() / 1000);
    const maxAge = Math.max(
      60,
      Math.min(60 * 60 * 12, Number(ttlSeconds) || 60 * 60) // default 1h, cap 12h, floor 1m
    );

    // Use your sessionManager to preserve consistency with admin-ping/adminGuard
    const token = await generateSessionToken(env); // typically random 32-48 bytes base64/hex
    const session = {
      role: "admin",
      iat: now,
      exp: now + maxAge,
      ip: remoteIp || undefined,
      ua: request.headers.get("User-Agent") || undefined,
      v: 1, // schema version (optional)
    };

    // Store with TTL to auto-expire
    await storeSession(env, token, session, { ttl: maxAge });

    console.log(JSON.stringify({ reqId, event: "admin.auth", verdict: "ok" }));

    // --- 6) Respond: set HttpOnly cookie; return JSON (keeps current UI happy)
    return json({ ok: true, token, role: "admin" }, 200, {
      "set-cookie": adminCookie(token, maxAge),
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        reqId,
        event: "admin-init.unhandled",
        message: err?.message,
        stack: err?.stack,
      })
    );
    return json({ error: "Internal Server Error" }, 500);
  }
}

// Optional: explicitly reject other methods on this route
export const onRequestGet = () => json({ error: "Method Not Allowed" }, 405);
export const onRequestPut = onRequestGet;
export const onRequestDelete = onRequestGet;
