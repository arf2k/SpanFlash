import {
  authenticateRequest,
  handleOptionsRequest,
} from "../../../utils/sessionAuth.js";

const VERBECC_API_BASE = "http://verbe.cc/verbecc";

export async function onRequestGet(context) {
  const requestStartTime = Date.now();

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, CF-Turnstile-Response, CF-Session-Token",
    "Content-Type": "application/json; charset=utf-8",
  };

  // Handle OPTIONS preflight requests
  if (context.request.method === "OPTIONS") {
    return handleOptionsRequest();
  }

  // Authenticate request using shared utility
  const auth = await authenticateRequest(context, "Conjugation");
  if (!auth.isAuthenticated) {
    return auth.errorResponse;
  }

  // Extract route parameters
  const { params } = context;
  const { language, verb } = params;

  if (!language || !verb) {
    const errorResponse = {
      error: "Bad Request",
      details: "Missing language or verb parameter",
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Call conjugation API
  const targetUrl = `${VERBECC_API_BASE}/conjugate/${language}/${verb}`;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Cloudflare-Pages-Function-Spanish-App-Conjugation-Proxy/1.0",
      },
    });

    const data = await response.json();
    const requestDuration = Date.now() - requestStartTime;

    console.log(
      `Conjugation: Request completed in ${requestDuration}ms with status ${response.status}`
    );

    // Enhanced response with session info
    const enhancedResponse = {
      ...data,
      _proxy: {
        duration_ms: requestDuration,
        timestamp: Date.now(),
        session: {
          token: auth.sessionInfo.sessionToken,
          expiresAt: auth.sessionInfo.expiresAt,
          isNew: !auth.sessionInfo.isExisting,
        },
      },
    };

    return new Response(JSON.stringify(enhancedResponse), {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Cache-Control": "s-maxage=86400",
      },
    });
  } catch (error) {
    console.error(
      "Conjugation: Error fetching from conjugation service:",
      error
    );

    const errorResponse = {
      error: "Proxy failed to fetch from conjugation service",
      details: error.message,
      timestamp: Date.now(),
      session: {
        token: auth.sessionInfo.sessionToken,
        expiresAt: auth.sessionInfo.expiresAt,
        isNew: !auth.sessionInfo.isExisting,
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 502,
      headers: corsHeaders,
    });
  }
}
