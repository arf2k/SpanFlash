const VERBECC_API_BASE = 'http://verbe.cc/verbecc';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // The verb will be part of the path, e.g., /api/conjugation-proxy/es/hablar
  // We need to extract the path segments after our proxy path.
  const pathSegments = url.pathname.split('/');
  // Expected path: ['', 'api', 'conjugation-proxy', 'es', 'hablar']
  const language = pathSegments[3]; 
  const verb = pathSegments[4];

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (!language || !verb) {
    const errorResponse = { error: 'Bad Request', details: 'Language or verb missing in URL path.' };
    return new Response(JSON.stringify(errorResponse), { status: 400, headers: corsHeaders });
  }

  // Reconstruct the target URL for the verbe.cc service
  const targetUrl = `<span class="math-inline">\{VERBECC\_API\_BASE\}/conjugate/es/${verb}`;
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
    const errorResponse = { error: 'Proxy failed to fetch from conjugation service', details: error.message };
    return new Response(JSON.stringify(errorResponse), { status: 502, headers: corsHeaders });
  }
}