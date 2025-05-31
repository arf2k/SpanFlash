// The Merriam-Webster Spanish-English Dictionary API base URL
const MW_API_BASE_URL = 'https://www.dictionaryapi.com/api/v3/references/spanish/json/';

export async function onRequestGet(context) {
  // context.env contains your environment variables (including secrets)
  // context.request.url contains the URL the PWA called on this function

  const requestUrl = new URL(context.request.url);
  const wordToLookup = requestUrl.searchParams.get('word'); // PWA will send e.g., /api/mw-dictionary-proxy?word=hola

  if (!wordToLookup) {
    const errorResponse = { error: 'Bad Request', details: 'Missing "word" query parameter.' };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Retrieve the API key from Cloudflare's environment secrets
  const apiKey = context.env.MW_API_KEY; 

  if (!apiKey) {
    console.error("Pages Function: MW_API_KEY secret is not defined in Cloudflare environment.");
    const errorResponse = { error: 'Configuration Error', details: 'API key for Merriam-Webster is not set up on the server.' };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const encodedWord = encodeURIComponent(wordToLookup.trim());
  const targetMwUrl = `<span class="math-inline">\{MW\_API\_BASE\_URL\}</span>{encodedWord}?key=${apiKey}`;

  console.log(`Pages Function (MW Proxy): Received request for word: "${wordToLookup}"`);
  console.log(`Pages Function (MW Proxy): Forwarding to MW API: <span class="math-inline">\{MW\_API\_BASE\_URL\}</span>{encodedWord}?key=YOUR_API_KEY_HIDDEN`);

  try {
    const mwResponse = await fetch(targetMwUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Cloudflare-Pages-Function-Flashcard-App-MW-Proxy/1.0',
      },
    });

    const data = await mwResponse.json();

    const responseHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Or your specific PWA domain for production
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 's-maxage=86400, stale-while-revalidate=43200' // Cache for 1 day, SWR for 12h
    };

    return new Response(JSON.stringify(data), {
      status: mwResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Pages Function (MW Proxy): Error fetching or processing from MW API:', error);
    const errorResponse = { 
        error: 'Proxy failed to fetch from Merriam-Webster API', 
        details: error.message 
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 502, // Bad Gateway
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}