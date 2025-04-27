import axios from 'axios';

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
        return null; // Indicate failure due to missing key
    }

    // Ensure the word is properly encoded for the URL, especially if it contains spaces or special chars
    const encodedWord = encodeURIComponent(spanishWord);
    // Construct the correct API URL using template literals
    const apiUrl = `${baseUrl}${encodedWord}?key=${apiKey}`;

    console.log(`Calling MW API: ${apiUrl}`); // For debugging

    try {
        const response = await axios.get(apiUrl);
        console.log("MW API Response:", response.data); // Log raw response for debugging structure

        // Return the data received from the API
        // The caller (App.jsx) will handle parsing this structure
        return response.data;

    } catch (error) {
        // Log detailed error information
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`Error fetching hint for "${spanishWord}" from MW API: Status ${error.response.status}`, error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error(`Error fetching hint for "${spanishWord}" from MW API: No response received`, error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(`Error fetching hint for "${spanishWord}" from MW API:`, error.message);
        }
        return null; // Indicate failure
    }
};

