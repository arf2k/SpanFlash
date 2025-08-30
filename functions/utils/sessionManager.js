export function generateSessionToken() {
  return crypto.randomUUID();
}

export async function storeSession(env, token, data) {
  // Use the bound KV namespace name from the Cloudflare dashboard
  // You shared: Type: KV namespace  Name: SESSIONS  Value: sessions
  if (!env.SESSIONS) {
    // Safe logging: don't dump secrets, just state presence
    console.error("KV binding 'SESSIONS' is not available in env");
    throw new Error("KV binding 'SESSIONS' missing");
  }
  await env.SESSIONS.put(`session:${token}`, JSON.stringify(data), {
    expirationTtl: 3600, // 1 hour
  });
}
