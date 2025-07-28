export function generateSessionToken() {
  return crypto.randomUUID();
}

export async function storeSession(env, token, data) {
  await env.SESSION_KV.put(`session:${token}`, JSON.stringify(data), {
    expirationTtl: 3600, // 1 hour
  });
}
