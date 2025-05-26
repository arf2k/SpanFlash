// src/services/tatoebaService.js
import axios from 'axios';

const TATOEBA_API_BASE_URL = 'https://tatoeba.org/api_v0';

/**
 * Fetches example sentences for a given Spanish word/phrase from Tatoeba.
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

    const apiUrl = `${TATOEBA_API_BASE_URL}/search?${params.toString()}`;
    console.log(`Calling Tatoeba API: ${apiUrl}`);

    try {
        const response = await axios.get(apiUrl);
        // console.log("Tatoeba API Raw Response:", JSON.stringify(response.data, null, 2)); // For detailed debugging 

        if (response.data && Array.isArray(response.data.results)) {
            const sentencePairs = response.data.results.map(result => {
                if (result.text && result.translations && result.translations[0] && result.translations[0][0]) {
                    // Ensure we're getting the Spanish sentence if the query was Spanish
                    const sourceSentenceText = result.text;
                    const sourceSentenceId = result.id;
                    
                    // Find the English translation within the first translation group
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

            console.log("Processed Tatoeba Sentence Pairs:", sentencePairs);
            return sentencePairs;
        } else {
            console.warn("Tatoeba API response did not contain expected results array:", response.data);
            return [];
        }
    } catch (error) {
        console.error(`Error fetching examples from Tatoeba for "${spanishQuery}":`, error.message);
        if (error.response) {
            console.error("Tatoeba API Error Response Data:", error.response.data);
            console.error("Tatoeba API Error Response Status:", error.response.status);
        }
        return []; 
    }
};