// src/services/dictionaryService.js
import axios from 'axios';

// Get the API key from environment variables
const apiKey = import.meta.env.VITE_MW_API_KEY;
const baseUrl = 'https://www.dictionaryapi.com/api/v3/references/spanish/json/';

/**
 * Fetches definition and usage examples for a Spanish word/phrase
 * from the Merriam-Webster Spanish-English Dictionary API.
 * @param {string} spanishWord - The word or phrase to look up.
 * @returns {Promise<object|null>} A promise that resolves to the API response data (usually an array) or null if an error occurs or key is missing.
 */
export const getMwHint = async (spanishWord) => {
    if (!apiKey) {
        console.error("Error: Merriam-Webster API key is missing. Make sure VITE_MW_API_KEY is set in your .env file.");
        return null; // Or throw an error
    }

    // Ensure the word is properly encoded for the URL
    const encodedWord = encodeURIComponent(spanishWord);
    const apiUrl = `<span class="math-inline">\{baseUrl\}</span>{encodedWord}?key=${apiKey}`;

    console.log(`Calling MW API: ${apiUrl}`); // For debugging - remove later if desired

    try {
        const response = await axios.get(apiUrl);
        console.log("MW API Response:", response.data); // For debugging the structure

        // The MW API often returns an array of results, even for a single word
        // You might need to inspect response.data to see exactly what you need for hints (e.g., shortdef, uros)
        return response.data;

    } catch (error) {
        console.error(`Error fetching hint for "${spanishWord}" from MW API:`, error.response || error.message);
        // Optionally, inspect error.response?.data for more specific API error messages
        return null; // Indicate failure
    }
};

