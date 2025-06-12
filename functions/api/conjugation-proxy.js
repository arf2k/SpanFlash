const VERBECC_API_BASE = 'http://verbe.cc/verbecc';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Parse the path after /api/conjugation-proxy/
  // Expected: /api/conjugation-proxy/es/hablar
  const pathParts = url.pathname.split('/').filter(p => p);
  // pathParts = ['api', 'conjugation-proxy', 'es', 'hablar']
  
  const language = pathParts[2]; // 'es'
  const verb = pathParts[3];     // 'hablar'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (!language || !verb) {
    const errorResponse = { 
      error: 'Bad Request', 
      details: 'Language or verb missing in URL path.',
      received: url.pathname 
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 400, 
      headers: corsHeaders 
    });
  }

  // Construct the target URL for the verbe.cc service
  const targetUrl = `${VERBECC_API_BASE}/conjugate/${language}/${verb}`;
  console.log(`Conjugation Proxy: Forwarding request to: ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Cloudflare-Pages-Function-Flashcard-App-Conjugation-Proxy/1.0',
      },
    });

    const data = await response.json();

    const responseHeadersWithCache = { 
      ...corsHeaders, 
      'Cache-Control': 's-maxage=86400' // Cache for 1 day
    };

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: responseHeadersWithCache,
    });

  } catch (error) {
    console.error('Conjugation Proxy Error:', error);
    const errorResponse = { 
      error: 'Proxy failed to fetch from conjugation service', 
      details: error.message 
    };
    return new Response(JSON.stringify(errorResponse), { 
      status: 502, 
      headers: corsHeaders 
    });
  }
}

// Also handle OPTIONS requests for CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}