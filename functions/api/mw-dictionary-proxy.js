const MW_API_BASE_URL_CONST =
  "https://www.dictionaryapi.com/api/v3/references/spanish/json/";
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
        "Access-Control-Allow-Headers": headers.get(
          "Access-Control-Request-Headers"
        ),
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

  // Define CORS headers for actual responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, CF-Turnstile-Response",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS preflight requests for CORS
  if (context.request.method === "OPTIONS") {
    return handleOptions(context.request);
  }
  const turnstileToken = context.request.headers.get("CF-Turnstile-Response");
  const remoteIP = context.request.headers.get("CF-Connecting-IP");

  if (!turnstileToken) {
    const errorResponse = {
      error: "Security Validation Required",
      details: "Turnstile token missing from request headers",
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

  console.log("Turnstile validation successful for MW API request");

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

  console.log(`Pages Function (MW Proxy): Requesting word: "${wordToLookup}"`);

  try {
    const mwResponse = await fetch(targetMwUrlString, {
      method: "GET",
      headers: {
        "User-Agent":
          "Cloudflare-Pages-Function-Flashcard-App-MW-Proxy/1.0 (https://spanflash.pages.dev)",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
      signal: AbortSignal.timeout(4000), // 4 second timeout for MW API specifically
    });

    const responseTime = Date.now() - requestStartTime;
    console.log(`MW API responded in ${responseTime}ms for "${wordToLookup}"`);

    if (!mwResponse.ok) {
      let errorDetails = `MW API responded with status ${mwResponse.status}`;
      try {
        const errorText = await mwResponse.text();
        errorDetails += `: ${errorText.substring(0, 200)}`;
      } catch (e) {
        /* ignore if can't get text */
      }
      console.error(
        `Pages Function (MW Proxy): ${errorDetails} (after ${responseTime}ms)`
      );
      const errorResponse = {
        error: "Merriam-Webster API Error",
        status: mwResponse.status,
        details: errorDetails,
        responseTime: `${responseTime}ms`,
      };
      return new Response(JSON.stringify(errorResponse), {
        status: mwResponse.status,
        headers: corsHeaders,
      });
    }

    const data = await mwResponse.json();

    const responseHeadersWithCache = {
      ...corsHeaders,
      "Cache-Control":
        "s-maxage=3600, stale-while-revalidate=1800, max-age=300",
      "X-Response-Time": `${responseTime}ms`, // Debug header to see performance
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: responseHeadersWithCache,
    });
  } catch (error) {
    const responseTime = Date.now() - requestStartTime;

    // error identification
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      console.error(
        `Pages Function (MW Proxy): MW API timeout after ${responseTime}ms for "${wordToLookup}"`
      );
      const errorResponse = {
        error: "MW API timeout",
        details: `Merriam-Webster API did not respond within 4 seconds`,
        responseTime: `${responseTime}ms`,
        word: wordToLookup,
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 504,
        headers: corsHeaders,
      });
    }

    console.error(
      `Pages Function (MW Proxy): Error after ${responseTime}ms:`,
      error
    );
    const errorResponse = {
      error: "Proxy failed during MW API interaction",
      details: error.message,
      responseTime: `${responseTime}ms`,
      word: wordToLookup,
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 502,
      headers: corsHeaders,
    });
  }
}
