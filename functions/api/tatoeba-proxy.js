const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes in seconds for KV TTL

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

  // Store in KV with TTL
  await kv.put(sessionToken, JSON.stringify(sessionData), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  console.log(
    `Tatoeba: Created session ${sessionToken} for IP ${remoteIP}, expires at ${new Date(
      expiresAt
    )}`
  );
  return { sessionToken, expiresAt };
}

// Validate session token from KV
async function validateSession(kv, sessionToken, remoteIP) {
  console.log(`=== TATOEBA SESSION VALIDATION ===`);
  console.log(`Looking for session: ${sessionToken}`);

  const sessionDataStr = await kv.get(sessionToken);

  if (!sessionDataStr) {
    console.log("Tatoeba: Session not found in KV");
    return { valid: false, reason: "Session not found" };
  }

  let session;
  try {
    session = JSON.parse(sessionDataStr);
  } catch (error) {
    console.error("Tatoeba: Failed to parse session data:", error);
    return { valid: false, reason: "Invalid session data" };
  }

  // Check expiration (redundant with KV TTL but good for logging)
  if (Date.now() > session.expiresAt) {
    console.log("Tatoeba: Session expired, deleting from KV");
    await kv.delete(sessionToken);
    return { valid: false, reason: "Session expired" };
  }

  // Optional: Validate IP consistency (log warning but still allow)
  if (session.remoteIP !== remoteIP) {
    console.warn(
      `Tatoeba: Session IP mismatch: expected ${session.remoteIP}, got ${remoteIP}`
    );
  }

  // Extend session on use - update both expiration and usage stats
  const updatedSession = {
    ...session,
    expiresAt: Date.now() + SESSION_DURATION,
    lastUsed: Date.now(),
    requestCount: session.requestCount + 1,
  };

  // Update in KV with fresh TTL
  await kv.put(sessionToken, JSON.stringify(updatedSession), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  console.log(
    `Tatoeba: Session ${sessionToken} validated and extended, expires at ${new Date(
      updatedSession.expiresAt
    )}`
  );
  return { valid: true, session: updatedSession };
}

async function validateTurnstileToken(token, secretKey, remoteIP = null) {
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

    const result = await response.json();
    console.log("Tatoeba: Turnstile validation result:", result);

    return result;
  } catch (error) {
    console.error("Tatoeba: Turnstile validation error:", error);
    return { success: false, error: "Validation request failed" };
  }
}

function handleOptions(request) {
  const headers = request.headers;
  if (
    headers.get("Origin") !== null &&
    headers.get("Access-Control-Request-Method") !== null &&
    headers.get("Access-Control-Request-Headers") !== null
  ) {
    // Handle CORS preflight requests.
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, CF-Turnstile-Response, CF-Session-Token",
        "Access-Control-Max-Age": "86400",
      },
    });
  } else {
    return new Response(null, {
      headers: {
        Allow: "GET, OPTIONS",
      },
    });
  }
}

export async function onRequestGet(context) {
  const requestStartTime = Date.now();

  // Access KV namespace through binding
  const kv = context.env.SESSIONS;
  if (!kv) {
    console.error(
      "Tatoeba: SESSIONS KV namespace not bound - check Pages Function bindings"
    );
    return new Response(
      JSON.stringify({
        error: "Configuration Error",
        details: "Session storage not properly configured",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Define CORS headers for actual responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, CF-Turnstile-Response, CF-Session-Token",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS preflight requests for CORS
  if (context.request.method === "OPTIONS") {
    return handleOptions(context.request);
  }

  const turnstileToken = context.request.headers.get("CF-Turnstile-Response");
  const sessionToken = context.request.headers.get("CF-Session-Token");
  const remoteIP = context.request.headers.get("CF-Connecting-IP");

  let isValidated = false;
  let sessionInfo = null;

  // Try session token first
  if (sessionToken) {
    console.log(`Tatoeba: Validating session token: ${sessionToken}`);
    const sessionResult = await validateSession(kv, sessionToken, remoteIP);

    if (sessionResult.valid) {
      console.log("Tatoeba: Session validation successful");
      isValidated = true;
      sessionInfo = {
        sessionToken,
        expiresAt: sessionResult.session.expiresAt,
        isExisting: true,
      };
    } else {
      console.log(
        `Tatoeba: Session validation failed: ${sessionResult.reason}`
      );
    }
  }

  // Fall back to Turnstile token if session invalid
  if (!isValidated) {
    if (!turnstileToken) {
      const errorResponse = {
        error: "Security Validation Required",
        details: "Either valid session token or Turnstile token required",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Validate Turnstile token
    const secretKey = context.env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      console.error("Tatoeba: TURNSTILE_SECRET_KEY not configured");
      const errorResponse = {
        error: "Server Configuration Error",
        details: "Turnstile validation not properly configured",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const validationResult = await validateTurnstileToken(
      turnstileToken,
      secretKey,
      remoteIP
    );

    if (!validationResult.success) {
      console.log("Tatoeba: Turnstile validation failed:", validationResult);
      const errorResponse = {
        error: "Security Validation Failed",
        details: "Invalid or expired security token",
        turnstile_error: validationResult.error || "Unknown validation error",
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 403,
        headers: corsHeaders,
      });
    }

    console.log(
      "Tatoeba: Turnstile validation successful - creating new session"
    );
    const newSession = await createSession(kv, remoteIP);
    sessionInfo = {
      sessionToken: newSession.sessionToken,
      expiresAt: newSession.expiresAt,
      isExisting: false,
    };
    isValidated = true;
  }

  // Now proceed with the original Tatoeba API logic
  const requestUrl = new URL(context.request.url);
  const incomingSearchParams = requestUrl.searchParams;

  const tatoebaApiBase = "https://tatoeba.org/api_v0/search";

  // Reconstruct the query string for Tatoeba carefully
  const tatoebaTargetUrl = new URL(tatoebaApiBase);
  incomingSearchParams.forEach((value, key) => {
    tatoebaTargetUrl.searchParams.append(key, value);
  });

  const finalTatoebaUrlString = tatoebaTargetUrl.toString();

  console.log(
    `Tatoeba: Received request for: ${requestUrl.pathname}${requestUrl.search}`
  );
  console.log(`Tatoeba: Forwarding to Tatoeba API: ${finalTatoebaUrlString}`);

  try {
    const tatoebaResponse = await fetch(finalTatoebaUrlString, {
      method: "GET",
      headers: {
        "User-Agent": "Cloudflare-Pages-Function-Spanish-App-Proxy/1.0",
      },
    });

    const data = await tatoebaResponse.json();
    const requestDuration = Date.now() - requestStartTime;

    console.log(
      `Tatoeba: Request completed in ${requestDuration}ms with status ${tatoebaResponse.status}`
    );

    // Enhanced response with session info
    const enhancedResponse = {
      ...data,
      _proxy: {
        duration_ms: requestDuration,
        timestamp: Date.now(),
        session: {
          token: sessionInfo.sessionToken,
          expiresAt: sessionInfo.expiresAt,
          isNew: !sessionInfo.isExisting,
        },
      },
    };

    return new Response(JSON.stringify(enhancedResponse), {
      status: tatoebaResponse.status,
      headers: {
        ...corsHeaders,
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error(
      "Tatoeba: Error in fetch or processing from Tatoeba API:",
      error
    );
    const errorResponse = {
      error: "Proxy failed to fetch from Tatoeba API",
      details: error.message || "An unexpected error occurred in the proxy.",
      attemptedUrl: finalTatoebaUrlString,
      timestamp: Date.now(),
      session: sessionInfo
        ? {
            token: sessionInfo.sessionToken,
            expiresAt: sessionInfo.expiresAt,
            isNew: !sessionInfo.isExisting,
          }
        : null,
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 502,
      headers: corsHeaders,
    });
  }
}
