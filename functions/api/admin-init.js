import { validateTurnstileToken } from "../utils/sessionAuth";
import { generateSessionToken, storeSession } from "../utils/sessionManager";

/** Constant-time string compare to reduce timing leaks. */
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

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

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });

export async function onRequestPost(context) {
  const { request, env } = context;
  const reqId =
    (typeof crypto?.randomUUID === "function" && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2);
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";

  // Enforce method
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  // Enforce JSON
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return json({ error: "Unsupported Media Type" }, 415);
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const turnstileToken = (body?.turnstileToken || "").trim();
  const adminKey = (body?.adminKey || "").trim();

  // Basic input checks
  if (!turnstileToken) return json({ error: "Turnstile token required" }, 403);
  if (!adminKey || adminKey.length < 6) return json({ error: "Unauthorized" }, 401);

  // Config checks
  if (!env?.TURNSTILE_SECRET) return json({ error: "Server misconfigured" }, 500);
  if (!env?.ADMIN_KEY) return json({ error: "Server misconfigured" }, 500);

  // 1) Verify Turnstile via your util (Managed mode)
  try {
    const ts = await validateTurnstileToken(turnstileToken, env.TURNSTILE_SECRET, ip);
    if (!ts?.success) {
      console.log(
        JSON.stringify({
          reqId,
          event: "turnstile.verify",
          success: false,
          errors: ts?.["error-codes"] || null,
        })
      );
      return json({ error: "Human verification failed" }, 403);
    }
  } catch (e) {
    console.warn(JSON.stringify({ reqId, event: "turnstile.error", msg: String(e) }));
    return json({ error: "Human verification failed" }, 403);
  }

  // 2) Check admin key (timing-safe)
  if (!constantTimeEqual(adminKey, env.ADMIN_KEY)) {
    console.warn(JSON.stringify({ reqId, event: "admin.auth", verdict: "bad_key" }));
    return json({ error: "Unauthorized" }, 401);
  }

  // 3) Create server session (KV) + HttpOnly cookie
  const token = generateSessionToken();
  const now = Date.now();
  const maxAge = 3600; // 1 hour (aligns with storeSession TTL)
  const sessionData = {
    role: "admin",
    createdAt: now,
    ip,
    ua: request.headers.get("User-Agent") || "",
  };

  try {
    await storeSession(env, token, sessionData);
  } catch (e) {
    console.error(JSON.stringify({ reqId, event: "kv.put.error", msg: String(e) }));
    return json({ error: "Internal Error" }, 500);
  }

  console.log(JSON.stringify({ reqId, event: "admin.auth", verdict: "ok" }));

  // Return JSON token for current UI compatibility (SettingsModal),
  // AND set HttpOnly cookie for server-side checks on privileged routes.
  return json({ ok: true, token, role: "admin" }, 200, {
    "set-cookie": adminCookie(token, maxAge),
  });
}

// Optional: explicitly reject other methods on this route
export const onRequestGet = () => json({ error: "Method Not Allowed" }, 405);
export const onRequestPut = onRequestGet;
export const onRequestDelete = onRequestGet;
