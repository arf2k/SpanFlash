import axios from 'axios';


const MW_PROXY_PATH = '/api/mw-dictionary-proxy'; 

/**
 * Fetches definition and usage examples for a Spanish word/phrase
 * by calling your Cloudflare Pages Function proxy for the Merriam-Webster API.
 * @param {string} spanishWord - The word or phrase to look up.
 * @returns {Promise<object|null>} A promise that resolves to the API response data 
 * (as returned by Merriam-Webster, usually an array) 
 * or null if an error occurs.
 */
export const getMwHint = async (spanishWord) => {
    if (!spanishWord || typeof spanishWord !== 'string' || spanishWord.trim() === '') {
        console.error("getMwHint: Spanish word is empty or invalid.");
        return null; // Or return an error object: { error: true, message: "Invalid word" }
    }

    const wordToLookup = spanishWord.trim();
    
  
    const proxyUrl = `${MW_PROXY_PATH}?word=${encodeURIComponent(wordToLookup)}`;

    console.log(`Calling MW Proxy for hint: ${proxyUrl}`);

    try {
        const response = await axios.get(proxyUrl);
        console.log("Response from MW Proxy:", response.data);

   
        if (response.data && response.data.error) {
            console.error(`Error from MW Proxy Function: ${response.data.details || response.data.error}`);
 
            return null; 
        }

        // If proxy call was successful and returned data from MW (usually an array)
        return response.data;

    } catch (error) {
      
        console.error(`Error fetching hint via proxy for "${wordToLookup}":`, error.message);
        if (error.response) {
          
            console.error("MW Proxy Error Response Data:", error.response.data);
            console.error("MW Proxy Error Response Status:", error.response.status);
        } else if (error.request) {
            console.error("MW Proxy: No response received for the request.", error.request);
        } else {
            console.error("MW Proxy: Error setting up the request:", error.message);
        }
        return null; // Indicate failure
    }
};