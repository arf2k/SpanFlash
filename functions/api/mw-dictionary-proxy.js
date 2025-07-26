const MW_API_BASE_URL_CONST =
  "https://www.dictionaryapi.com/api/v3/references/spanish/json/";

// Session management
const sessions = new Map();
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

// Cleanup expired sessions (called during request processing)
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired sessions`);
  }
}

// Generate secure session token
function generateSessionToken() {
  return crypto.randomUUID() + '-' + Date.now().toString(36);
}

// Create new session
function createSession(remoteIP) {
  const sessionToken = generateSessionToken();
  const expiresAt = Date.now() + SESSION_DURATION;
  
  sessions.set(sessionToken, {
    remoteIP,
    createdAt: Date.now(),
    expiresAt,
    lastUsed: Date.now(),
    requestCount: 0
  });
  
  console.log(`Created session ${sessionToken} for IP ${remoteIP}, expires at ${new Date(expiresAt)}`);
  return { sessionToken, expiresAt };
}

// Validate session token
function validateSession(sessionToken, remoteIP) {
   console.log(`=== SESSION VALIDATION DEBUG ===`);
  console.log(`Looking for session: ${sessionToken}`);
  console.log(`Total sessions in memory: ${sessions.size}`);
  console.log(`Available sessions: ${Array.from(sessions.keys())}`);
  
  const session = sessions.get(sessionToken);
  
  if (!session) {
    return { valid: false, reason: 'Session not found' };
  }
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionToken);
    return { valid: false, reason: 'Session expired' };
  }
  
  // Optional: Validate IP consistency (comment out if causing issues)
  if (session.remoteIP !== remoteIP) {
    console.warn(`Session IP mismatch: expected ${session.remoteIP}, got ${remoteIP}`);
    // Still allow but log the discrepancy
  }
  
  // Extend session on use
  session.expiresAt = Date.now() + SESSION_DURATION;
  session.lastUsed = Date.now();
  session.requestCount++;
  
  console.log(`Session ${sessionToken} validated and extended, expires at ${new Date(session.expiresAt)}`);
  return { valid: true, session };
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

  // Cleanup expired sessions on each request (lazy cleanup)
  cleanupExpiredSessions();

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
    const sessionResult = validateSession(sessionToken, remoteIP);
    
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
    const newSession = createSession(remoteIP);
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