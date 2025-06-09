function handleOptions(request) {
  const headers = request.headers;
  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null &&
    headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS preflight requests.
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*', // Or your specific PWA domain
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': headers.get('Access-Control-Request-Headers'),
        'Access-Control-Max-Age': '86400', // Cache preflight for 1 day
      },
    });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        Allow: 'GET, OPTIONS',
      },
    });
  }
}

export async function onRequestGet(context) {
  // Define CORS headers for actual responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Or your specific PWA domain
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  
  // Handle OPTIONS preflight requests for CORS
  if (context.request.method === 'OPTIONS') {
    return handleOptions(context.request);
  }

  const requestUrl = new URL(context.request.url);
  
  // Extract verb from the URL path
  // Expected: /api/conjugation-proxy/es/VERB or /api/conjugation-proxy/conjugate/es/VERB
  const pathSegments = requestUrl.pathname.split('/').filter(Boolean);
  
  let verb;
  let language = 'es'; // Default to Spanish
  
  // Handle different URL patterns
  if (pathSegments.length >= 3 && pathSegments[pathSegments.length - 2] === 'es') {
    // Pattern: /api/conjugation-proxy/es/VERB
    verb = pathSegments[pathSegments.length - 1];
  } else if (pathSegments.length >= 4 && pathSegments[pathSegments.length - 3] === 'conjugate') {
    // Pattern: /api/conjugation-proxy/conjugate/es/VERB
    language = pathSegments[pathSegments.length - 2];
    verb = pathSegments[pathSegments.length - 1];
  } else if (pathSegments.length >= 1) {
    // Pattern: /api/conjugation-proxy/VERB (default to Spanish)
    verb = pathSegments[pathSegments.length - 1];
  }

  if (!verb) {
    const errorResponse = { 
      error: 'Bad Request', 
      details: 'Missing verb in URL path. Expected: /api/conjugation-proxy/es/VERB' 
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  // Validate verb (basic check)
  if (verb.length < 2 || !/^[a-záéíóúüñ]+$/i.test(verb)) {
    const errorResponse = { 
      error: 'Bad Request', 
      details: 'Invalid verb format. Must be Spanish letters only.' 
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  const encodedVerb = encodeURIComponent(verb.trim().toLowerCase());
  
  let targetUrlString;
  try {
    // Use verbe.cc API as the upstream source
    targetUrlString = `https://verbe.cc/verbecc/conjugate/${language}/${encodedVerb}`;
  } catch (e) {
    console.error("Pages Function (Conjugation Proxy): Error constructing target URL:", e);
    const errorResponse = { 
      error: 'Proxy Internal Error', 
      details: 'Failed to construct target URL for conjugation API.' 
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 500, 
      headers: corsHeaders 
    });
  }

  console.log(`Pages Function (Conjugation Proxy): Requesting verb: "${verb}"`);
  console.log(`Pages Function (Conjugation Proxy): Target URL: ${targetUrlString}`);

  try {
    const upstreamResponse = await fetch(targetUrlString, {
      method: 'GET',
      headers: {
        'User-Agent': 'Cloudflare-Pages-Function-Flashcard-App-Conjugation-Proxy/1.0',
        'Accept': 'application/json',
      },
    });

    if (!upstreamResponse.ok) {
      let errorDetails = `Conjugation API responded with status ${upstreamResponse.status}`;
      try {
        const errorText = await upstreamResponse.text();
        errorDetails += `: ${errorText.substring(0, 200)}`; // Get first 200 chars of error
      } catch (e) { /* ignore if can't get text */ }
      
      console.error(`Pages Function (Conjugation Proxy): ${errorDetails}`);
      
      const errorResponse = { 
        error: 'Conjugation API Error', 
        status: upstreamResponse.status, 
        details: errorDetails,
        verb: verb
      };
      return new Response(JSON.stringify(errorResponse), { 
        status: upstreamResponse.status, 
        headers: corsHeaders 
      });
    }

    const data = await upstreamResponse.json();
    
    // Add caching headers - conjugations don't change often
    const responseHeadersWithCache = { 
      ...corsHeaders, 
      'Cache-Control': 's-maxage=86400, stale-while-revalidate=43200' // Cache at edge for 1 day
    };
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: responseHeadersWithCache,
    });

  } catch (error) {
    console.error('Pages Function (Conjugation Proxy): Error fetching from conjugation API:', error);
    const errorResponse = { 
      error: 'Proxy failed during conjugation API interaction', 
      details: error.message,
      verb: verb,
      attemptedUrl: targetUrlString
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 502, 
      headers: corsHeaders 
    });
  }
}