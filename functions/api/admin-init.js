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

export async function onRequestPost(context) {
  const { request, env, cf } = context;

  // Enforce POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  // Enforce JSON
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Unsupported Media Type" }), {
      status: 415,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const turnstileToken = body?.turnstileToken;
  const adminKey = body?.adminKey;
  const remoteIP = cf?.connectingIp || null;

  // Config presence
  if (!env?.TURNSTILE_SECRET_KEY || !env?.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  // Require BOTH inputs
  if (!turnstileToken || typeof adminKey !== "string") {
    return new Response(JSON.stringify({ error: "Missing credentials" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  try {
    // 1) Verify Turnstile on the server
    const result = await validateTurnstileToken(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      remoteIP
    );
    const isHuman = !!result?.success;
    if (!isHuman) {
      return new Response(
        JSON.stringify({ error: "Turnstile verification failed", details: result?.error || null }),
        { status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      );
    }

    // 2) Verify admin key using constant-time comparison
    const keyOK = constantTimeEqual(adminKey, env.ADMIN_SECRET);
    if (!keyOK) {
      // Do NOT reveal whether key or Turnstile was wrong
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // 3) Create short-lived admin session
    const sessionToken = generateSessionToken();
    const now = Date.now();
    const sessionData = {
      role: "admin",
      isAdmin: true,
      createdAt: now,
      ip: remoteIP,
      expiresAt: now + 60 * 60 * 1000, // 1 hour
    };

    await storeSession(env, sessionToken, sessionData);

    // Success
    return new Response(JSON.stringify({ token: sessionToken, role: "admin" }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    // Safe server error
    return new Response(JSON.stringify({ error: "Internal Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
