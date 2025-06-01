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
      
        const response = await axios.get(apiUrl); 
        

        console.log("Response from PWA's Tatoeba Proxy:", response.data);

        if (response.data && response.data.error) {
            console.error("Error from Tatoeba proxy function:", response.data.details || response.data.error);
            throw new Error(response.data.details || response.data.error); 
        }
        
       
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
   
        console.error(`Error fetching examples via PWA's Tatoeba Proxy for "${spanishQuery}":`, error.message);
        if (error.response) { 
            console.error("Proxy API Error Response Data:", error.response.data);
            console.error("Proxy API Error Response Status:", error.response.status);
        }
        return []; 
    }
};