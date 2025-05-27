import axios from 'axios';


const TATOEBA_PROXY_PATH = '/api/tatoeba-proxy'; 
/**
 * Fetches example sentences for a given Spanish word/phrase from Tatoeba
 * via your Cloudflare Pages Function proxy.
 * @param {string} spanishQuery - The Spanish word or phrase to search for.
 * @returns {Promise<Array<{id_spa: number, text_spa: string, id_eng: number, text_eng: string}>>} 
 * A promise that resolves to an array of example sentence pairs, or an empty array if none found/error.
 */
export const getTatoebaExamples = async (spanishQuery) => {
    if (!spanishQuery || typeof spanishQuery !== 'string' || spanishQuery.trim() === '') {
        console.warn("getTatoebaExamples: spanishQuery is empty or invalid.");
        return []; 
    }

    // Query parameters remain the same as Tatoeba expects them
    const params = new URLSearchParams({
        query: spanishQuery.trim(), 
        from: 'spa',            
        to: 'eng',              
        orphans: 'no',          
        sort: 'relevance',      
        limit: '5',             
    });

    // Construct the URL to call your proxy
    const apiUrl = `${TATOEBA_PROXY_PATH}?${params.toString()}`; 
    // When running locally, this will be e.g. http://localhost:5173/api/tatoeba-proxy?query=...
    // When deployed, this will be e.g. https://spanflash.pages.dev/api/tatoeba-proxy?query=...

    console.log(`Calling PWA's Tatoeba Proxy: ${apiUrl}`);

    try {
        // Axios will automatically use the correct base URL (localhost or your deployed domain)
        const response = await axios.get(apiUrl); 
        
        // The proxy already returns the .results part or an error structure
        // So, response.data should directly be what Tatoeba's results array was, or your proxy's error object.
        console.log("Response from PWA's Tatoeba Proxy:", response.data);

        // Check if the proxy returned an error object that we defined
        if (response.data && response.data.error) {
            console.error("Error from Tatoeba proxy function:", response.data.details || response.data.error);
            throw new Error(response.data.details || response.data.error); // Propagate error
        }
        
        // If proxy was successful, response.data should be the original Tatoeba response structure
        // { paging: {...}, results: [...] }
        if (response.data && Array.isArray(response.data.results)) {
            const sentencePairs = response.data.results.map(result => {
                if (result.text && result.translations && result.translations[0] && result.translations[0][0]) {
                    const sourceSentenceText = result.text;
                    const sourceSentenceId = result.id;
                    const englishTranslation = result.translations[0].find(trans => trans.lang === 'eng');
                    
                    if (englishTranslation && englishTranslation.text) {
                        return {
                            id_spa: sourceSentenceId,
                            text_spa: sourceSentenceText,
                            id_eng: englishTranslation.id,
                            text_eng: englishTranslation.text
                        };
                    }
                }
                return null; 
            }).filter(pair => pair !== null); 

            console.log("Processed Tatoeba Sentence Pairs via Proxy:", sentencePairs);
            return sentencePairs;
        } else {
            console.warn("Tatoeba proxy response did not contain expected results array:", response.data);
            return [];
        }
    } catch (error) {
        // This catch block will now catch errors from the axios call to your proxy
        // OR errors propagated from the proxy's own error handling (like the one thrown above)
        console.error(`Error fetching examples via PWA's Tatoeba Proxy for "${spanishQuery}":`, error.message);
        if (error.response) { // Axios-specific error structure for network errors to the proxy
            console.error("Proxy API Error Response Data:", error.response.data);
            console.error("Proxy API Error Response Status:", error.response.status);
        }
        return []; 
    }
};