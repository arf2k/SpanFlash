// Session configuration
const SESSION_DURATION = 30 * 60 * 1000;
const SESSION_TTL_SECONDS = 30 * 60;

// Generate secure session token
function generateSessionToken() {
  return crypto.randomUUID() + "-" + Date.now().toString(36);
}

// Create new session in KV
async function createSession(kv, remoteIP) {
  const sessionToken = generateSessionToken();
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION;

  const sessionData = {
    remoteIP,
    createdAt: now,
    expiresAt,
    lastUsed: now,
    requestCount: 0,
  };

  await kv.put(sessionToken, JSON.stringify(sessionData), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return { sessionToken, expiresAt };
}

// Validate session token from KV
async function validateSession(kv, sessionToken, remoteIP) {
  const sessionDataStr = await kv.get(sessionToken);

  if (!sessionDataStr) {
    return { valid: false, reason: "Session not found" };
  }

  let session;
  try {
    session = JSON.parse(sessionDataStr);
  } catch (error) {
    return { valid: false, reason: "Invalid session data" };
  }

  if (Date.now() > session.expiresAt) {
    await kv.delete(sessionToken);
    return { valid: false, reason: "Session expired" };
  }

  if (session.remoteIP !== remoteIP) {
    console.warn(
      `Session IP mismatch: expected ${session.remoteIP}, got ${remoteIP}`
    );
  }

  // Extend session on use
  const updatedSession = {
    ...session,
    expiresAt: Date.now() + SESSION_DURATION,
    lastUsed: Date.now(),
    requestCount: session.requestCount + 1,
  };

  await kv.put(sessionToken, JSON.stringify(updatedSession), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return { valid: true, session: updatedSession };
}

// Validate Turnstile token
export async function validateTurnstileToken(token, secretKey, remoteIP = null) {
  if (!token || !secretKey) {
    return { success: false, error: "Missing token or secret key" };
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          remoteip: remoteIP,
        }),
      }
    );

    return await response.json();
  } catch (error) {
    return { success: false, error: "Validation request failed" };
  }
}

// Main authentication function - handles complete auth flow
export async function authenticateRequest(context, apiName = "API") {
  const kv = context.env.SESSIONS;
  if (!kv) {
    return {
      isAuthenticated: false,
      errorResponse: new Response(
        JSON.stringify({
          error: "Configuration Error",
          details: "Session storage not properly configured",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  const turnstileToken = context.request.headers.get("CF-Turnstile-Response");
  const sessionToken = context.request.headers.get("CF-Session-Token");
  const remoteIP = context.request.headers.get("CF-Connecting-IP");

  // Try session token first
  if (sessionToken) {
    console.log(`${apiName}: Validating session token: ${sessionToken}`);
    const sessionResult = await validateSession(kv, sessionToken, remoteIP);

    if (sessionResult.valid) {
      console.log(`${apiName}: Session validation successful`);
      return {
        isAuthenticated: true,
        sessionInfo: {
          sessionToken,
          expiresAt: sessionResult.session.expiresAt,
          isExisting: true,
        },
      };
    } else {
      console.log(
        `${apiName}: Session validation failed: ${sessionResult.reason}`
      );
    }
  }

  // Fall back to Turnstile token
  if (!turnstileToken) {
    return {
      isAuthenticated: false,
      errorResponse: new Response(
        JSON.stringify({
          error: "Security Validation Required",
          details: "Either valid session token or Turnstile token required",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      ),
    };
  }

  const secretKey = context.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    return {
      isAuthenticated: false,
      errorResponse: new Response(
        JSON.stringify({
          error: "Server Configuration Error",
          details: "Turnstile validation not properly configured",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      ),
    };
  }

  const validationResult = await validateTurnstileToken(
    turnstileToken,
    secretKey,
    remoteIP
  );

  if (!validationResult.success) {
    console.log(`${apiName}: Turnstile validation failed:`, validationResult);
    return {
      isAuthenticated: false,
      errorResponse: new Response(
        JSON.stringify({
          error: "Security Validation Failed",
          details: "Invalid or expired security token",
          turnstile_error: validationResult.error || "Unknown validation error",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      ),
    };
  }

  console.log(
    `${apiName}: Turnstile validation successful - creating new session`
  );
  const newSession = await createSession(kv, remoteIP);
  return {
    isAuthenticated: true,
    sessionInfo: {
      sessionToken: newSession.sessionToken,
      expiresAt: newSession.expiresAt,
      isExisting: false,
    },
  };
}

// Handle OPTIONS requests
export function handleOptionsRequest() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, CF-Turnstile-Response, CF-Session-Token",
      "Access-Control-Max-Age": "86400",
    },
  });
}
