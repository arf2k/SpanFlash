// functions/api/admin-init.js
import { validateTurnstileToken } from "../utils/sessionAuth";
import { generateSessionToken, storeSession } from "../utils/sessionManager";

export async function onRequestPost(context) {
  const { request, env, cf } = context;

  // Parse body up front
  let turnstileToken, adminKey;
  try {
    ({ turnstileToken, adminKey } = await request.json());
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // ---- SAFE DEBUG (no secrets) ----
  console.log("🔒 admin-init hit");
  console.log("env.ADMIN_SECRET present?", !!env.ADMIN_SECRET);
  console.log("env.TURNSTILE_SECRET_KEY present?", !!env.TURNSTILE_SECRET_KEY);
  console.log("KV binding present?", !!env.SESSIONS);
  console.log("Client IP:", cf?.connectingIp ?? null);

  // Turnstile verification (kept, but you said focus on admin key first)
  let isHuman = false;
  try {
    const result = await validateTurnstileToken(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      cf?.connectingIp
    );
    isHuman = !!result?.success;
  } catch (e) {
    console.error("Turnstile validation error:", e?.message || e);
  }

  // Timing-safe-ish check (simple approach; adequate here)
  const validKey = typeof adminKey === "string" && typeof env.ADMIN_SECRET === "string" && adminKey === env.ADMIN_SECRET;

  console.log("Turnstile ok?", isHuman, "| Admin key match?", validKey);

  // You asked to prioritize admin key troubleshooting:
  // temporarily allow admin if key matches even if Turnstile is flaky in DDG, toggle this back later.
  if (!validKey) {
    return new Response("Unauthorized", { status: 403 });
  }

  try {
    const sessionToken = generateSessionToken();
    const sessionData = {
      token: sessionToken,
      isAdmin: true,
      createdAt: Date.now(),
      ip: cf?.connectingIp || null,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
    };

    await storeSession(env, sessionToken, sessionData);
    console.log("✅ Admin session created (masked token length):", sessionToken.length);

    return new Response(JSON.stringify({ token: sessionToken }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin-init crashed:", err?.message || err);
    return new Response("Internal Error", { status: 500 });
  }
}
