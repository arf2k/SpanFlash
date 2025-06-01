
const MW_API_BASE_URL_CONST = 'https://www.dictionaryapi.com/api/v3/references/spanish/json/';

// Helper function to handle CORS preflight requests
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
        'Access-Control-Allow-Headers': headers.get('Access-Control-Request-Headers'), // Reflect requested headers
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS', // Only GET is primarily used by this proxy
    'Access-Control-Allow-Headers': 'Content-Type', // Allow common headers
    'Content-Type': 'application/json',
  };
  
  // Handle OPTIONS preflight requests for CORS
  if (context.request.method === 'OPTIONS') {
    return handleOptions(context.request);
  }

  const requestUrl = new URL(context.request.url);
  const wordToLookup = requestUrl.searchParams.get('word');

  if (!wordToLookup) {
    const errorResponse = { error: 'Bad Request', details: 'Missing "word" query parameter.' };
    return new Response(JSON.stringify(errorResponse), { status: 400, headers: corsHeaders });
  }

  const apiKey = context.env.MW_API_KEY; // Retrieve from Cloudflare environment secrets
  if (!apiKey) {
    console.error("Pages Function (MW Proxy): MW_API_KEY secret is NOT DEFINED in Cloudflare environment.");
    const errorResponse = { error: 'Configuration Error', details: 'API key for Merriam-Webster is not configured on the server.' };
    return new Response(JSON.stringify(errorResponse), { status: 500, headers: corsHeaders });
  }

  const encodedWord = encodeURIComponent(wordToLookup.trim());
  
  let targetMwUrlString;
  try {
    const urlObject = new URL(`${MW_API_BASE_URL_CONST}${encodedWord}`); // Path construction
    urlObject.searchParams.append('key', apiKey);                 // Append key as query param
    targetMwUrlString = urlObject.toString();
  } catch (e) {
    console.error("Pages Function (MW Proxy): Error constructing MW API URL object:", e);
    const errorResponse = { error: 'Proxy Internal Error', details: 'Failed to construct target URL for MW API.' };
    return new Response(JSON.stringify(errorResponse), { status: 500, headers: corsHeaders });
  }

  console.log(`Pages Function (MW Proxy): Requesting word: "${wordToLookup}"`);
  // Avoid logging the full URL with the key for better security in logs, even server-side.
  console.log(`Pages Function (MW Proxy): Target MW Base: ${MW_API_BASE_URL_CONST}${encodedWord}?key=YOUR_API_KEY_IS_USED_HERE`);

  try {
    const mwResponse = await fetch(targetMwUrlString, {
      method: 'GET',
      headers: {
        // MW API doesn't strictly require a User-Agent, but it can be good practice
        'User-Agent': 'Cloudflare-Pages-Function-Flashcard-App-MW-Proxy/1.0 (https://spanflash.pages.dev)',
      },
    });

    if (!mwResponse.ok) {
        let errorDetails = `MW API responded with status ${mwResponse.status}`;
        try {
            const errorText = await mwResponse.text();
            errorDetails += `: ${errorText.substring(0, 200)}`; // Get first 200 chars of error
        } catch (e) { /* ignore if can't get text */ }
        console.error(`Pages Function (MW Proxy): ${errorDetails}`);
        const errorResponse = { error: 'Merriam-Webster API Error', status: mwResponse.status, details: errorDetails };
        return new Response(JSON.stringify(errorResponse), { status: mwResponse.status, headers: corsHeaders });
    }

    const data = await mwResponse.json(); // Assume MW always returns JSON on success
    
    const responseHeadersWithCache = { 
        ...corsHeaders, 
      'Cache-Control': 's-maxage=86400, stale-while-revalidate=43200' // Cache at edge for 1 day
    };
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: responseHeadersWithCache,
    });

  } catch (error) {
    console.error('Pages Function (MW Proxy): Error fetching from or processing MW API response:', error);
    const errorResponse = { 
        error: 'Proxy failed during MW API interaction', 
        details: error.message,
        attemptedUrl: `${MW_API_BASE_URL_CONST}${encodedWord}?key=YOUR_API_KEY_WAS_USED_HERE` // Log problematic part without key
    };
    return new Response(JSON.stringify(errorResponse), { status: 502, headers: corsHeaders });
  }
}

