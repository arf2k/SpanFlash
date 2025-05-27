// functions/api/tatoeba-proxy.js

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const incomingSearchParams = requestUrl.searchParams; // These are the params from your PWA call

  const tatoebaApiBase = 'https://tatoeba.org/api_v0/search';
  
  // Reconstruct the query string for Tatoeba carefully
  const tatoebaTargetUrl = new URL(tatoebaApiBase);
  incomingSearchParams.forEach((value, key) => {
    tatoebaTargetUrl.searchParams.append(key, value);
  });

  const finalTatoebaUrlString = tatoebaTargetUrl.toString();

  console.log(`Pages Function: Received request for: ${requestUrl.pathname}${requestUrl.search}`);
  console.log(`Pages Function: Forwarding to Tatoeba API: ${finalTatoebaUrlString}`); // Log the final URL

  try {
    const tatoebaResponse = await fetch(finalTatoebaUrlString, { // Use the explicitly constructed string
      method: 'GET',
      headers: {
        'User-Agent': 'Cloudflare-Pages-Function-Flashcard-App-Proxy/1.0',
      },
    });

    // Get the body as JSON
    const data = await tatoebaResponse.json();

    const responseHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=1800'
    };
    
    return new Response(JSON.stringify(data), {
      status: tatoebaResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    // Log the error object itself for more details if it's not a simple message
    console.error('Pages Function: Error in fetch or processing from Tatoeba API:', error); 
    const errorResponse = { 
        error: 'Proxy failed to fetch from Tatoeba API', 
        details: error.message || 'An unexpected error occurred in the proxy.',
        attemptedUrl: finalTatoebaUrlString // Include the URL we tried to fetch
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 502, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}