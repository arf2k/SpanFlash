import { adminGuard, handleOptionsRequest } from "../sessionAuth.js";

export async function onRequestOptions() {
  // Keep your standard preflight behavior.
  return handleOptionsRequest();
}

export async function onRequest(context) {
  // Enforce KV-backed, cookie-based session (no Turnstile fallback).
  const auth = await adminGuard(context, "admin-ping");
  if (!auth.isAuthenticated) {
    return auth.errorResponse; // 401 / 403 / 500 with JSON body
  }

  // If we get here, the session is valid.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // If you later want to call from a different origin, update this.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
