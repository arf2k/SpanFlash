const VERBECC_API_BASE = 'http://verbe.cc/verbecc';

export async function onRequestGet(context) {
  const { params } = context;
  const { language, verb } = params;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  const targetUrl = `${VERBECC_API_BASE}/conjugate/${language}/${verb}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Cloudflare-Pages-Function-Flashcard-App-Conjugation-Proxy/1.0',
      },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Cache-Control': 's-maxage=86400'
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Proxy failed to fetch from conjugation service', 
      details: error.message 
    }), { 
      status: 502, 
      headers: corsHeaders 
    });
  }
}