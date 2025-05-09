const fs = require('fs');
const path = require('path');

// --- Configuration ---
// Script location: span-flash-app/scripts/scrapeSpanOnly.js
// __dirname will be span-flash-app/scripts/

// Path to your existing JSON file of word pairs (span-flash-app/public/scrapedSpan411.json)
const EXISTING_WORDS_JSON_PATH = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');

// Name of your new file containing JSON array of word pairs (expected in the 'scripts' directory)
const NEW_PAIRS_FILENAME = 'compare.json'; // As specified by you
const NEW_PAIRS_INPUT_PATH = path.join(__dirname, NEW_PAIRS_FILENAME);

// Path for the output JSON file listing new pairs to add (will be saved in the 'scripts' directory)
const OUTPUT_JSON_FILE_PATH = path.join(__dirname, 'new_pairs_to_add.json');

// --- Helper Function to Normalize Words for Comparison ---
function normalizeWord(word) {
    if (typeof word !== 'string') return ''; // Handle cases where word might not be a string
    return word.trim().toLowerCase();
}

// --- Main Function ---
async function findNewWordPairs() {
    // 1. Load and process existing Spanish words from scrapedSpan411.json
    let existingSpanishWordsSet;
    try {
        if (!fs.existsSync(EXISTING_WORDS_JSON_PATH)) {
            console.warn(`Warning: Existing words file not found at ${EXISTING_WORDS_JSON_PATH}`);
            console.warn('This script expects scrapedSpan411.json to be in the "public" folder.');
            console.warn('Assuming your existing list is empty; all pairs from ${NEW_PAIRS_FILENAME} will be considered new.');
            existingSpanishWordsSet = new Set();
        } else {
            const existingJsonString = fs.readFileSync(EXISTING_WORDS_JSON_PATH, 'utf-8');
            const existingWordPairs = JSON.parse(existingJsonString);

            if (!Array.isArray(existingWordPairs)) {
                throw new Error(`Existing words JSON at ${EXISTING_WORDS_JSON_PATH} is not an array.`);
            }

            existingSpanishWordsSet = new Set(
                existingWordPairs.map(pair => {
                    if (pair && typeof pair.spanish === 'string') {
                        return normalizeWord(pair.spanish);
                    }
                    return null;
                }).filter(word => word !== null && word.length > 0)
            );
            console.log(`Loaded ${existingSpanishWordsSet.size} unique Spanish words from ${EXISTING_WORDS_JSON_PATH}.`);
        }
    } catch (error) {
        console.error(`Error processing existing words from ${EXISTING_WORDS_JSON_PATH}:`, error.message);
        return;
    }

    // 2. Load and process new word pairs from the input file (e.g., compare.txt)
    let newWordPairsList;
    try {
        if (!fs.existsSync(NEW_PAIRS_INPUT_PATH)) {
            console.error(`Error: New pairs file not found at ${NEW_PAIRS_INPUT_PATH}`);
            console.error(`Please make sure '${NEW_PAIRS_FILENAME}' is in the '${path.basename(__dirname)}' directory.`);
            return;
        }
        const newPairsString = fs.readFileSync(NEW_PAIRS_INPUT_PATH, 'utf-8');
        newWordPairsList = JSON.parse(newPairsString);

        if (!Array.isArray(newWordPairsList)) {
            throw new Error(`Content of ${NEW_PAIRS_FILENAME} is not a valid JSON array.`);
        }
        console.log(`Loaded ${newWordPairsList.length} pairs from ${NEW_PAIRS_INPUT_PATH}.`);

    } catch (error) {
        console.error(`Error processing new pairs from ${NEW_PAIRS_INPUT_PATH}:`, error.message);
        return;
    }

    // 3. Compare and find pairs whose Spanish word is new
    const newPairsToAdd = [];
    const spanishWordsFromNewFileProcessed = new Set(); // To handle duplicates within compare.txt itself

    for (const newPair of newWordPairsList) {
        if (!newPair || typeof newPair.spanish !== 'string' || typeof newPair.english !== 'string') {
            console.warn('Skipping invalid or incomplete pair in new list:', newPair);
            continue;
        }

        const normalizedNewSpanishWord = normalizeWord(newPair.spanish);

        if (normalizedNewSpanishWord.length === 0) {
            console.warn('Skipping pair with empty Spanish word in new list:', newPair);
            continue;
        }

        // Check if Spanish word is not in existing list AND not already added from the current new file
        if (!existingSpanishWordsSet.has(normalizedNewSpanishWord) &&
            !spanishWordsFromNewFileProcessed.has(normalizedNewSpanishWord)) {
            newPairsToAdd.push(newPair); // Add the original pair object
            spanishWordsFromNewFileProcessed.add(normalizedNewSpanishWord);
        }
    }

    // 4. Output results
    if (newPairsToAdd.length > 0) {
        console.log(`\nFound ${newPairsToAdd.length} new word pair(s) to add:`);
        // For brevity, just log the count here. The full list is in the JSON file.
        // newPairsToAdd.forEach(pair => console.log(JSON.stringify(pair))); 

        try {
            // Write as a nicely formatted JSON array
            fs.writeFileSync(OUTPUT_JSON_FILE_PATH, JSON.stringify(newPairsToAdd, null, 2), 'utf-8');
            console.log(`\nList of new word pairs saved to: ${OUTPUT_JSON_FILE_PATH}`);
        } catch (error) {
            console.error(`Error writing output JSON file at ${OUTPUT_JSON_FILE_PATH}:`, error.message);
        }
    } else {
        console.log(`\nNo new word pairs found in ${NEW_PAIRS_FILENAME} whose Spanish word isn't already in your existing list.`);
    }
}

// --- Run the Script ---
findNewWordPairs().catch(error => {
    console.error("An unexpected error occurred during script execution:", error);
});