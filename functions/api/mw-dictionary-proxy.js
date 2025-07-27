const MW_API_BASE_URL_CONST =
  "https://www.dictionaryapi.com/api/v3/references/spanish/json/";

// Session configuration
const SESSION_DURATION = 30 * 60 * 1000; 
const SESSION_TTL_SECONDS = 30 * 60; 

// Generate secure session token
function generateSessionToken() {
  return crypto.randomUUID() + '-' + Date.now().toString(36);
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
    requestCount: 0
  };
  
  // Store in KV with TTL
  await kv.put(sessionToken, JSON.stringify(sessionData), {
    expirationTtl: SESSION_TTL_SECONDS
  });
  
  console.log(`Created session ${sessionToken} for IP ${remoteIP}, expires at ${new Date(expiresAt)}`);
  return { sessionToken, expiresAt };
}

// Validate session token from KV
async function validateSession(kv, sessionToken, remoteIP) {
  console.log(`=== KV SESSION VALIDATION DEBUG ===`);
  console.log(`Looking for session: ${sessionToken}`);
  
  const sessionDataStr = await kv.get(sessionToken);
  
  if (!sessionDataStr) {
    console.log('Session not found in KV');
    return { valid: false, reason: 'Session not found' };
  }
  
  let session;
  try {
    session = JSON.parse(sessionDataStr);
  } catch (error) {
    console.error('Failed to parse session data:', error);
    return { valid: false, reason: 'Invalid session data' };
  }
  
  // Check expiration (redundant with KV TTL but good for logging)
  if (Date.now() > session.expiresAt) {
    console.log('Session expired, deleting from KV');
    await kv.delete(sessionToken);
    return { valid: false, reason: 'Session expired' };
  }
  
  // Optional: Validate IP consistency (log warning but still allow)
  if (session.remoteIP !== remoteIP) {
    console.warn(`Session IP mismatch: expected ${session.remoteIP}, got ${remoteIP}`);
  }
  
  // Extend session on use - update both expiration and usage stats
  const updatedSession = {
    ...session,
    expiresAt: Date.now() + SESSION_DURATION,
    lastUsed: Date.now(),
    requestCount: session.requestCount + 1
  };
  
  // Update in KV with fresh TTL
  await kv.put(sessionToken, JSON.stringify(updatedSession), {
    expirationTtl: SESSION_TTL_SECONDS
  });
  
  console.log(`Session ${sessionToken} validated and extended, expires at ${new Date(updatedSession.expiresAt)}`);
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
    console.log("Turnstile validation result:", result);

    return result;
  } catch (error) {
    console.error("Turnstile validation error:", error);
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
        "Access-Control-Allow-Headers": "Content-Type, CF-Turnstile-Response, CF-Session-Token",
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
    console.error("SESSIONS KV namespace not bound - check Pages Function bindings");
    return new Response(JSON.stringify({
      error: "Configuration Error",
      details: "Session storage not properly configured"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Define CORS headers for actual responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, CF-Turnstile-Response, CF-Session-Token",
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
    console.log(`Validating session token: ${sessionToken}`);
    const sessionResult = await validateSession(kv, sessionToken, remoteIP);
    
    if (sessionResult.valid) {
      console.log("Session validation successful");
      isValidated = true;
      sessionInfo = { 
        sessionToken, 
        expiresAt: sessionResult.session.expiresAt,
        isExisting: true 
      };
    } else {
      console.log(`Session validation failed: ${sessionResult.reason}`);
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
      console.error("MW Proxy: TURNSTILE_SECRET_KEY not configured");
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
      console.log("Turnstile validation failed:", validationResult);
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

    console.log("Turnstile validation successful - creating new session");
    const newSession = await createSession(kv, remoteIP);
    sessionInfo = {
      sessionToken: newSession.sessionToken,
      expiresAt: newSession.expiresAt,
      isExisting: false
    };
    isValidated = true;
  }

  const requestUrl = new URL(context.request.url);
  const wordToLookup = requestUrl.searchParams.get("word");

  if (!wordToLookup) {
    const errorResponse = {
      error: "Bad Request",
      details: 'Missing "word" query parameter.',
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const apiKey = context.env.MW_API_KEY;
  if (!apiKey) {
    console.error(
      "Pages Function (MW Proxy): MW_API_KEY secret is NOT DEFINED in Cloudflare environment."
    );
    const errorResponse = {
      error: "Configuration Error",
      details: "API key for Merriam-Webster is not configured on the server.",
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const encodedWord = encodeURIComponent(wordToLookup.trim());

  let targetMwUrlString;
  try {
    const urlObject = new URL(`${MW_API_BASE_URL_CONST}${encodedWord}`);
    urlObject.searchParams.append("key", apiKey);
    targetMwUrlString = urlObject.toString();
  } catch (e) {
    console.error(
      "Pages Function (MW Proxy): Error constructing MW API URL object:",
      e
    );
    const errorResponse = {
      error: "Proxy Internal Error",
      details: "Failed to construct target URL for MW API.",
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: corsHeaders,
    });
  }

  console.log(`MW Proxy: Forwarding to MW API: ${targetMwUrlString}`);

  try {
    const mwResponse = await fetch(targetMwUrlString, {
      method: "GET",
      headers: {
        "User-Agent": "Cloudflare-Pages-Function-Spanish-App-Proxy/1.0",
      },
    });

    const data = await mwResponse.json();
    const requestDuration = Date.now() - requestStartTime;

    console.log(
      `MW Proxy: Request completed in ${requestDuration}ms with status ${mwResponse.status}`
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
          isNew: !sessionInfo.isExisting
        }
      }
    };

    return new Response(JSON.stringify(enhancedResponse), {
      status: mwResponse.status,
      headers: {
        ...corsHeaders,
        "Cache-Control": "public, max-age=300, s-maxage=600", // 5min client, 10min edge
      },
    });
  } catch (error) {
    console.error(
      "Pages Function (MW Proxy): Error fetching from MW API:",
      error
    );

    const errorResponse = {
      error: "Proxy Request Failed",
      details: `Failed to fetch from Merriam-Webster API: ${error.message}`,
      timestamp: Date.now(),
      session: sessionInfo ? {
        token: sessionInfo.sessionToken,
        expiresAt: sessionInfo.expiresAt,
        isNew: !sessionInfo.isExisting
      } : null
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 502,
      headers: corsHeaders,
    });
  }
}