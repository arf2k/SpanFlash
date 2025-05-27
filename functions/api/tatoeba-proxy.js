export async function onRequestGet(context) {
  // context.request.url gives the URL of this function itself.
  // The query parameters intended for Tatoeba will be on this URL.
  const requestUrl = new URL(context.request.url);
  const tatoebaQueryParams = requestUrl.searchParams; 

  const tatoebaApiBase = 'https://tatoeba.org/api_v0/search';
  const tatoebaTargetUrl = `<span class="math-inline">\{tatoebaApiBase\}?</span>{tatoebaQueryParams.toString()}`;

  console.log(`Pages Function: Received request for: <span class="math-inline">\{requestUrl\.pathname\}</span>{requestUrl.search}`);
  console.log(`Pages Function: Forwarding to Tatoeba API: ${tatoebaTargetUrl}`);

  try {
    const tatoebaResponse = await fetch(tatoebaTargetUrl, {
      method: 'GET',
      headers: {
        // It's good practice to identify your bot/proxy if possible
        'User-Agent': 'Cloudflare-Pages-Function-Flashcard-App-Proxy/1.0',
      },
    });

    // Get the body as JSON (Tatoeba responds with JSON)
    const data = await tatoebaResponse.json();

    // Create a new response to send back to your PWA
    // Cloudflare Pages Functions automatically handle appropriate CORS headers
    // for same-origin requests (PWA on spanflash.dev calling /api/ on spanflash.dev).
    // If you were calling this function from a *different* domain, you'd add explicit CORS headers here.
    const responseHeaders = {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=1800' // Example: Cache for 1hr, SWR for 30min
    };

    return new Response(JSON.stringify(data), {
      status: tatoebaResponse.status, // Pass through Tatoeba's status
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Pages Function: Error fetching or processing from Tatoeba API:', error);
    const errorResponse = { error: 'Proxy failed to fetch from Tatoeba API', details: error.message };
    return new Response(JSON.stringify(errorResponse), {
      status: 502, // Bad Gateway
      headers: {
        'Content-Type': 'application/json',
        // Add CORS headers for error responses too, just in case,
        // though same-origin shouldn't strictly need it for the PWA itself.
        'Access-Control-Allow-Origin': '*', 
      },
    });
  }
}