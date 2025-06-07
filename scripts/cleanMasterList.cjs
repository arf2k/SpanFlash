const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- CORRECTED --- The '..' navigates up from /scripts to the project root
const jsonFilePath = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');
const backupFilePath = jsonFilePath + '.bak';

// Helper for user confirmation (no changes)
function askConfirmation(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

// --- Normalization and Scoring Functions (no changes) ---
function normalizeText(text) {
    if (typeof text !== 'string') return '';
    let normalized = text.trim().toLowerCase();
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalized = normalized.replace(/^[¡¿]+|[.,;:?!¿¡]+$/g, "");
    return normalized.trim();
}

function stripSpanishArticles(text) {
    if (typeof text !== 'string') return '';
    const articles = /^(el|la|los|las|un|una|unos|unas)\s+/i;
    return text.replace(articles, "").trim();
}

function stripEnglishArticlesAndTo(text) {
    if (typeof text !== 'string') return '';
    let processedText = text;
    const articles = /^(the|a|an)\b\s*/i;
    const toVerb = /^to\s+/i;
    processedText = processedText.replace(articles, "");
    processedText = processedText.replace(toVerb, "");
    return processedText.trim();
}

function getItemCompletenessScore(item) {
    let score = 0;
    if (item.notes && item.notes.trim() !== '') score += 2;
    if (item.synonyms_spanish && Array.isArray(item.synonyms_spanish) && item.synonyms_spanish.length > 0) score += 1;
    if (item.synonyms_english && Array.isArray(item.synonyms_english) && item.synonyms_english.length > 0) score += 1;
    if (item.category && item.category.trim() !== '') score += 1;
    return score;
}

// --- Language Likelihood Heuristics (no changes) ---
function containsSpanishChars(text) {
    if (typeof text !== 'string') return false;
    return /[ñáéíóúü¡¿]/i.test(text);
}

function containsCommonEnglishArticles(text) {
    if (typeof text !== 'string') return false;
    return /\b(the|a|an)\b/i.test(text);
}

function containsCommonSpanishArticles(text) {
    if (typeof text !== 'string') return false;
    return /\b(el|la|los|las|un|una|unos|unas)\b/i.test(text);
}

function isLikelySpanish(text) {
    if (typeof text !== 'string') return false;
    return (containsSpanishChars(text) || containsCommonSpanishArticles(text)) && !containsCommonEnglishArticles(text);
}

function isLikelyEnglish(text) {
    if (typeof text !== 'string') return false;
    return (containsCommonEnglishArticles(text) || !containsSpanishChars(text)) && !containsCommonSpanishArticles(text);
}

// --- Main Validation and Cleaning Logic ---
async function validateAndCleanJson() {
    // --- NEW --- Added a flag for automatically fixing swapped entries
    const fixSwappedMode = process.argv.includes('--fix-swapped');
    const fixMode = process.argv.includes('--fix');

    console.log(`Attempting to process JSON file: ${jsonFilePath}`);
    try {
        if (!fs.existsSync(jsonFilePath)) {
            console.error(`File not found: ${jsonFilePath}`);
            return;
        }
        const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
        const originalJsonData = JSON.parse(fileContent);

        if (typeof originalJsonData !== 'object' || originalJsonData === null || typeof originalJsonData.version !== 'string' || !Array.isArray(originalJsonData.words)) {
            throw new Error("Parsed JSON data is not an object with a 'version' string and a 'words' array.");
        }

        const originalWordsArray = originalJsonData.words;
        console.log(`JSON parsed. Version "${originalJsonData.version}". Found ${originalWordsArray.length} entries in "words" array.`);

        console.log('--- Pass 1: Checking for Invalid, and Fixing Swapped Languages ---');
        const invalidEntries = [];
        const swappedAndFixedEntries = [];
        const potentiallySwappedButNotFixed = [];
        // --- MODIFIED --- This array will hold the result of the first pass (with swaps corrected).
        const wordsAfterSwapPass = [];

        originalWordsArray.forEach((currentItem, index) => {
            const currentOriginalIndex = index + 1;
            const spanishRaw = currentItem?.spanish;
            const englishRaw = currentItem?.english;

            if (typeof spanishRaw !== 'string' || spanishRaw.trim() === '' || typeof englishRaw !== 'string' || englishRaw.trim() === '') {
                invalidEntries.push({ index: currentOriginalIndex, reason: "Missing or empty 'spanish' or 'english' field.", item: currentItem });
                return; // Skip invalid entries entirely
            }

            const spaLower = spanishRaw.trim().toLowerCase();
            const engLower = englishRaw.trim().toLowerCase();

            let itemToProcess = currentItem; // Assume item is correct initially

            if (isLikelyEnglish(spaLower) && isLikelySpanish(engLower) && spaLower !== engLower) {
                // Swap is detected!
                if (fixSwappedMode) {
                    // --- NEW --- Swap the fields and create a new object
                    itemToProcess = {
                        ...currentItem,
                        spanish: currentItem.english, // Swapped
                        english: currentItem.spanish  // Swapped
                    };
                    swappedAndFixedEntries.push({ index: currentOriginalIndex, originalItem: currentItem });
                } else {
                    potentiallySwappedButNotFixed.push({ index: currentOriginalIndex, item: currentItem });
                }
            }
            
            wordsAfterSwapPass.push(itemToProcess);
        });
        
        console.log('--- Pass 2: Finding and Removing Duplicates from Processed List ---');
        const duplicateReportEntries = [];
        const bestItemsMap = new Map();

        // --- MODIFIED --- We now iterate over the CLEANED array from the first pass.
        wordsAfterSwapPass.forEach((currentItem, index) => {
            const spanishRaw = currentItem.spanish; // We know these exist from the first pass
            const englishRaw = currentItem.english;

            const normalizedSpanish = normalizeText(spanishRaw);
            const normalizedEnglish = normalizeText(englishRaw);
            const keyPartSpanish = stripSpanishArticles(normalizedSpanish);
            const keyPartEnglish = stripEnglishArticlesAndTo(normalizedEnglish);
            const normalizedPairKey = `${keyPartSpanish}:::${keyPartEnglish}`;

            if (bestItemsMap.has(normalizedPairKey)) {
                const existingEntry = bestItemsMap.get(normalizedPairKey);
                
                if (getItemCompletenessScore(currentItem) > getItemCompletenessScore(existingEntry.item)) {
                    bestItemsMap.set(normalizedPairKey, { item: currentItem });
                    duplicateReportEntries.push({ discardedItem: existingEntry.item, keptItem: currentItem, reason: `Replaced by more complete version.` });
                } else {
                    duplicateReportEntries.push({ discardedItem: currentItem, keptItem: existingEntry.item, reason: `Duplicate of better/earlier version.` });
                }
            } else {
                bestItemsMap.set(normalizedPairKey, { item: currentItem });
            }
        });

        const uniqueWordsOutputArray = Array.from(bestItemsMap.values()).map(entry => entry.item);
        
        console.log('\n--- Validation & Cleaning Report ---');
        // Report on invalid entries (unchanged)
        if (invalidEntries.length > 0) {
            console.warn(`\nWARNING: Found ${invalidEntries.length} entries with missing/invalid/empty fields (these were ignored):`);
            invalidEntries.forEach(entry => console.warn(` - Entry #${entry.index}: ${JSON.stringify(entry.item)}`));
        }

        // --- MODIFIED --- New and improved reporting for swaps
        if (swappedAndFixedEntries.length > 0) {
            console.log(`\nINFO: Automatically corrected ${swappedAndFixedEntries.length} entries with swapped languages (due to --fix-swapped flag):`);
            swappedAndFixedEntries.forEach(entry => {
                console.log(` - Original Entry #${entry.index}: Swapped ${JSON.stringify(entry.originalItem.spanish)} and ${JSON.stringify(entry.originalItem.english)}`);
            });
        }
        if (potentiallySwappedButNotFixed.length > 0) {
            console.warn(`\nWARNING: Found ${potentiallySwappedButNotFixed.length} entries that might have SWAPPED content:`);
            potentiallySwappedButNotFixed.forEach(entry => console.warn(` - Entry #${entry.index}: ${JSON.stringify(entry.item)}`));
            console.log("   (Run with --fix-swapped to fix these automatically)");
        }
        
        // Report on duplicates (mostly unchanged)
        if (duplicateReportEntries.length > 0) {
            console.log(`\nINFO: Found and removed ${duplicateReportEntries.length} duplicate entries (keeping the best version):`);
            duplicateReportEntries.forEach(entry => {
                console.log(` - Discarded: ${JSON.stringify(entry.discardedItem)} (was duplicate of ${JSON.stringify(entry.keptItem)})`);
            });
        }
        
        if (invalidEntries.length === 0 && potentiallySwappedButNotFixed.length === 0 && duplicateReportEntries.length === 0) {
            console.log('\nSUCCESS: JSON data is clean, unique, and appears correctly assigned!');
        }
        
        console.log(`\n--------------------------------------`);
        console.log(`Original count: ${originalWordsArray.length}`);
        console.log(`Final count:    ${uniqueWordsOutputArray.length}`);
        console.log(`--------------------------------------`);

        // --- MODIFIED --- Update the fix logic to account for all changes
        const changesMade = swappedAndFixedEntries.length > 0 || duplicateReportEntries.length > 0;
        
        if (fixMode && changesMade) {
            console.log('\n--- Applying Fixes ---');
            try {
                fs.copyFileSync(jsonFilePath, backupFilePath);
                console.log(`Successfully created backup: ${backupFilePath}`);
            } catch (backupError) {
                console.error(`FATAL: Could not create backup file at ${backupFilePath}. Aborting write operation.`, backupError);
                return;
            }

            const confirmationMessage = `This will REWRITE '${path.basename(jsonFilePath)}' with ${uniqueWordsOutputArray.length} entries, applying all swaps and de-duplication. Are you sure? (yes/no): `;
            const proceed = await askConfirmation(confirmationMessage);

            if (proceed) {
                const newJsonData = { version: originalJsonData.version, words: uniqueWordsOutputArray };
                fs.writeFileSync(jsonFilePath, JSON.stringify(newJsonData, null, 2), 'utf-8');
                console.log(`\nSUCCESS: File updated and saved.`);
            } else {
                console.log("\nAborted. No changes were saved.");
            }
        } else if (changesMade && !fixMode) {
             console.log("\nACTION NEEDED: To apply these changes, run the script again with the --fix flag.");
        } else if (invalidEntries.length > 0 || potentiallySwappedButNotFixed.length > 0) {
            console.log("\nACTION NEEDED: Review warnings above. Manual changes may be required.");
        }

    } catch (error) {
        console.error('\n--- ERROR DURING PROCESSING ---');
        if (error instanceof SyntaxError) { console.error('Failed to parse JSON. Check file syntax.'); }
        else if (error.code === 'ENOENT') { console.error(`File not found: ${jsonFilePath}`); }
        else { console.error('An unexpected error occurred:', error); }
    }
}

validateAndCleanJson();