// span-flash-app/scripts/findMissingSpanish.js
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const MASTER_JSON_PATH = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');
const NEW_SPANISH_WORDS_FILENAME = 'new_spanish_words.txt'; // <<<< NAME OF YOUR NEW LIST FILE
const NEW_SPANISH_WORDS_PATH = path.join(__dirname, NEW_SPANISH_WORDS_FILENAME);
const OUTPUT_MISSING_FILENAME = 'missing_spanish_words.txt';
const OUTPUT_MISSING_PATH = path.join(__dirname, OUTPUT_MISSING_FILENAME);

// --- Normalization and Stripping Functions (similar to cleanMasterList.js) ---
function normalizeText(text) {
    if (typeof text !== 'string') return '';
    let normalized = text.trim().toLowerCase();
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
    normalized = normalized.replace(/^[¡¿]+|[.,;:?!¿¡]+$/g, ""); // Strip leading Spanish & common trailing punctuation
    return normalized.trim();
}

function stripSpanishArticles(text) {
    if (typeof text !== 'string') return '';
    // More comprehensive list of articles and also common prepositions that might be attached or introduce nouns
    const articlesAndCommonPreps = /^(el|la|los|las|un|una|unos|unas|al|del|en|de|a|con|por|para|sin|sobre|tras)\s+/i;
    // Keep stripping if multiple articles/preps appear (e.g. "a la") by using a loop or a more complex regex.
    // For simplicity, this will strip the first one found.
    // A loop would be better:
    let strippedText = text;
    let previousText;
    do {
        previousText = strippedText;
        strippedText = strippedText.replace(articlesAndCommonPreps, "").trim();
    } while (strippedText !== previousText && strippedText.length > 0);
    return strippedText;
}

function getNormalizedKey(spanishText) {
    if (typeof spanishText !== 'string' || spanishText.trim() === '') return null;
    const normalized = normalizeText(spanishText);
    const keyPart = stripSpanishArticles(normalized);
    return keyPart;
}
// --- End Normalization ---

async function findMissingWords() {
    console.log(`Processing master list: ${MASTER_JSON_PATH}`);
    console.log(`Processing new Spanish words list: ${NEW_SPANISH_WORDS_PATH}`);

    // 1. Load and process existing Spanish words from master JSON
    let existingNormalizedSpanishWords = new Set();
    try {
        if (!fs.existsSync(MASTER_JSON_PATH)) {
            console.error(`Master JSON file not found: ${MASTER_JSON_PATH}`);
            return;
        }
        const fileContent = fs.readFileSync(MASTER_JSON_PATH, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        if (typeof jsonData !== 'object' || jsonData === null || !Array.isArray(jsonData.words)) {
            throw new Error("Master JSON data is not an object with a 'words' array property.");
        }
        
        jsonData.words.forEach(item => {
            if (item && typeof item.spanish === 'string' && item.spanish.trim() !== '') {
                const normalizedKey = getNormalizedKey(item.spanish);
                if (normalizedKey) {
                    existingNormalizedSpanishWords.add(normalizedKey);
                }
            }
        });
        console.log(`Loaded ${existingNormalizedSpanishWords.size} unique normalized Spanish words/phrases from master list.`);

    } catch (error) {
        console.error(`Error processing master JSON file: ${error.message}`);
        return;
    }

    // 2. Load new Spanish words from the text file
    let newSpanishWordsRaw = [];
    try {
        if (!fs.existsSync(NEW_SPANISH_WORDS_PATH)) {
            console.error(`New Spanish words file not found: ${NEW_SPANISH_WORDS_PATH}`);
            console.error(`Please create a file named '${NEW_SPANISH_WORDS_FILENAME}' in the 'scripts' directory with one Spanish word/phrase per line.`);
            return;
        }
        const newWordsFileContent = fs.readFileSync(NEW_SPANISH_WORDS_PATH, 'utf-8');
        newSpanishWordsRaw = newWordsFileContent
            .split(/\r?\n/) // Split by new line
            .map(word => word.trim())
            .filter(word => word.length > 0); // Remove empty lines
        console.log(`Loaded ${newSpanishWordsRaw.length} words/phrases from the new list file.`);
    } catch (error) {
        console.error(`Error processing new Spanish words file: ${error.message}`);
        return;
    }

    // 3. Compare and find words from the new list that are missing from the master list
    const missingWords = [];
    const seenInNewListNormalized = new Set(); // To avoid reporting duplicates from the new list itself

    newSpanishWordsRaw.forEach(rawNewWord => {
        const normalizedNewWordKey = getNormalizedKey(rawNewWord);
        if (normalizedNewWordKey) { // Ensure it's a valid word after normalization
            if (!existingNormalizedSpanishWords.has(normalizedNewWordKey) && !seenInNewListNormalized.has(normalizedNewWordKey)) {
                missingWords.push(rawNewWord); // Add the original raw word
                seenInNewListNormalized.add(normalizedNewWordKey);
            }
        }
    });

    // 4. Output results
    console.log('\n--- Comparison Report ---');
    if (missingWords.length > 0) {
        console.log(`Found ${missingWords.length} Spanish words/phrases from '${NEW_SPANISH_WORDS_FILENAME}' that are NOT in your master list (after normalization & article stripping):`);
        missingWords.forEach(word => console.log(` - ${word}`));
        try {
            fs.writeFileSync(OUTPUT_MISSING_PATH, missingWords.join('\n'), 'utf-8');
            console.log(`\nThis list of missing words has been saved to: ${OUTPUT_MISSING_PATH}`);
        } catch (error) {
            console.error(`Error writing output file at ${OUTPUT_MISSING_PATH}:`, error.message);
        }
    } else {
        console.log(`All Spanish words/phrases from '${NEW_SPANISH_WORDS_FILENAME}' appear to be present in your master list (after normalization & article stripping).`);
    }
    console.log('-------------------------');
}

findMissingWords().catch(error => {
    console.error("An unexpected error occurred:", error);
});