// functions/api/admin-init.js
import { verifyTurnstile } from "../utils/sessionAuth";
import { generateSessionToken, storeSession } from "../utils/sessionManager";

export async function onRequestPost(context) {
  const { request, env, cf } = context;
  const { turnstileToken, adminKey } = await request.json();

  const isHuman = await verifyTurnstile(turnstileToken, env);
  const validKey = adminKey === env.ADMIN_SECRET;

  if (!isHuman || !validKey) {
    return new Response("Unauthorized", { status: 403 });
  }

  const sessionToken = generateSessionToken();
  const sessionData = {
    token: sessionToken,
    isAdmin: true,
    createdAt: Date.now(),
    ip: cf?.connectingIp || null,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  };

  await storeSession(env, sessionToken, sessionData);

  return new Response(JSON.stringify({ token: sessionToken }), {
    headers: { "Content-Type": "application/json" },
  });
}
