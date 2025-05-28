const fs = require('fs');
const path = require('path');
const readline = require('readline');

const jsonFilePath = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');
const backupFilePath = jsonFilePath + '.bak';

function askConfirmation(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

// --- Normalization and Stripping Functions (largely as before) ---
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
    const articles = /^(the|a|an)\s+/i;
    const toVerb = /^to\s+/i;
    processedText = processedText.replace(articles, "");
    processedText = processedText.replace(toVerb, "");
    return processedText.trim();
}

function getItemCompletenessScore(item) { /* ... (as before) ... */ 
    let score = 0;
    if (item.notes && item.notes.trim() !== '') score += 2;
    if (item.synonyms_spanish && Array.isArray(item.synonyms_spanish) && item.synonyms_spanish.length > 0) score += 1;
    if (item.synonyms_english && Array.isArray(item.synonyms_english) && item.synonyms_english.length > 0) score += 1;
    if (item.category && item.category.trim() !== '') score += 1;
    return score;
}

// --- New Language Likelihood Heuristics ---
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
    // It's likely Spanish if it contains Spanish-specific chars OR common Spanish articles AND NOT common English articles
    // This is a heuristic and can be improved.
    return (containsSpanishChars(text) || containsCommonSpanishArticles(text)) && !containsCommonEnglishArticles(text);
}

function isLikelyEnglish(text) {
    if (typeof text !== 'string') return false;
    // It's likely English if it contains common English articles OR primarily common English chars AND NOT Spanish-specific chars/articles.
    return (containsCommonEnglishArticles(text) || !containsSpanishChars(text)) && !containsCommonSpanishArticles(text);
}
// --- End Language Likelihood Heuristics ---


async function validateAndCleanJson() {
    console.log(`Attempting to process JSON file: ${jsonFilePath}`);
    try {
        if (!fs.existsSync(jsonFilePath)) { /* ... */ return; }
        const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
        const originalJsonData = JSON.parse(fileContent);

        if (typeof originalJsonData !== 'object' || originalJsonData === null || typeof originalJsonData.version !== 'string' || !Array.isArray(originalJsonData.words)) {
            throw new Error("Parsed JSON data is not an object with a 'version' string and a 'words' array.");
        }
        
        const originalWordsArray = originalJsonData.words;
        console.log(`JSON parsed. Version "${originalJsonData.version}". Found ${originalWordsArray.length} entries in "words" array.`);

        console.log('Validating entries, checking for duplicates, and potentially swapped languages...');
        const invalidEntries = []; 
        const duplicateReportEntries = []; 
        const potentiallySwappedEntries = []; // <-- New array for swapped entries
        const bestItemsMap = new Map(); 

        originalWordsArray.forEach((currentItem, index) => {
            const currentOriginalIndex = index + 1; 
            const spanishRaw = currentItem?.spanish;
            const englishRaw = currentItem?.english;
            
            if (typeof spanishRaw !== 'string' || spanishRaw.trim() === '' || typeof englishRaw !== 'string' || englishRaw.trim() === '') {
                invalidEntries.push({ index: currentOriginalIndex, reason: "Missing or empty 'spanish' or 'english' field.", item: currentItem });
                return; 
            }

            // --- New Check for Potentially Swapped Entries ---
            // Apply this check before normalization for duplicate detection, using rawish values.
            // We use .trim().toLowerCase() for a slightly more robust language check.
            const spaLower = spanishRaw.trim().toLowerCase();
            const engLower = englishRaw.trim().toLowerCase();

            if (isLikelyEnglish(spaLower) && isLikelySpanish(engLower)) {
                // If the "spanish" field looks English AND the "english" field looks Spanish
                // This is a strong indicator of a swap.
                // We also check that they are not TOO similar to avoid flagging bilingual cognates that are correctly placed.
                // This simple check might not be perfect, but it's a start.
                if (spaLower !== engLower) { // Avoid flagging if they are identical (e.g. "taxi")
                     potentiallySwappedEntries.push({ index: currentOriginalIndex, item: currentItem });
                }
            }
            // --- End Swapped Entry Check ---


            const normalizedSpanish = normalizeText(spanishRaw);
            const normalizedEnglish = normalizeText(englishRaw);
            const keyPartSpanish = stripSpanishArticles(normalizedSpanish);
            const keyPartEnglish = stripEnglishArticlesAndTo(normalizedEnglish);
            const normalizedPairKey = `${keyPartSpanish}:::${keyPartEnglish}`;

            if (bestItemsMap.has(normalizedPairKey)) {
                const existingEntry = bestItemsMap.get(normalizedPairKey);
                const existingItem = existingEntry.item;
                
                if (getItemCompletenessScore(currentItem) > getItemCompletenessScore(existingItem)) {
                    bestItemsMap.set(normalizedPairKey, { item: currentItem, originalIndex: currentOriginalIndex });
                    duplicateReportEntries.push({
                        discardedItem: existingItem, discardedIndex: existingEntry.originalIndex,
                        keptItem: currentItem, keptIndex: currentOriginalIndex,
                        normalizedKey: normalizedPairKey, reason: `Replaced by more complete Entry #${currentOriginalIndex}`
                    });
                } else {
                    duplicateReportEntries.push({
                        discardedItem: currentItem, discardedIndex: currentOriginalIndex,
                        keptItem: existingItem, keptIndex: existingEntry.originalIndex,
                        normalizedKey: normalizedPairKey, reason: `Duplicate of better/earlier Entry #${existingEntry.originalIndex}`
                    });
                }
            } else {
                bestItemsMap.set(normalizedPairKey, { item: currentItem, originalIndex: currentOriginalIndex });
            }
        });

        const uniqueWordsOutputArray = Array.from(bestItemsMap.values()).map(entry => entry.item);

        console.log('Validation complete.');
        console.log('\n--- Validation Report ---');

        if (invalidEntries.length > 0) { /* ... (reporting invalid as before) ... */ }
        else { console.log("\nINFO: All entries have non-empty 'spanish' and 'english' string properties."); }

        // --- New Report for Potentially Swapped Entries ---
        if (potentiallySwappedEntries.length > 0) {
            console.warn(`\nWARNING: Found ${potentiallySwappedEntries.length} entries that might have SWAPPED spanish/english content:`);
            potentiallySwappedEntries.forEach(entry => {
                console.warn(` - Entry #${entry.index} (Original): Content: ${JSON.stringify(entry.item)}`);
            });
            console.log("   (Please review these manually. The script does not automatically swap them.)");
        } else {
            console.log("\nINFO: No obvious language swaps detected based on heuristics.");
        }
        // --- End Swapped Report ---

        if (duplicateReportEntries.length > 0) { /* ... (reporting duplicates as before) ... */ }
        else { console.log("\nINFO: No duplicate spanish/english pairs found after normalization and 'keep best' logic."); }
        
        console.log(`\nINFO: After processing, the de-duplicated list will contain ${uniqueWordsOutputArray.length} unique (best version) entries.`);
        // ... (rest of fix mode logic and error handling as before) ...
        
        const fixMode = process.argv.includes('--fix');

        if (invalidEntries.length === 0 && duplicateReportEntries.length === 0 && potentiallySwappedEntries.length === 0) {
            console.log('\nSUCCESS: "words" array appears valid, unique, and correctly assigned by language!');
        } else if (fixMode && duplicateReportEntries.length > 0 ) { // --fix only handles duplicates for now
            console.log('\n--- Attempting to Fix Duplicates by Keeping Best Versions ---');
            try { /* ... backup ... */ } catch (backupError) { /* ... */ return; }

            const proceed = await askConfirmation(`This will REWRITE '${path.basename(jsonFilePath)}' with ${uniqueWordsOutputArray.length} unique (best version) entries, removing detected duplicates. Potentially swapped or invalid entries are NOT automatically fixed by this flag. Are you sure? (yes/no): `);

            if (proceed) {
                const newJsonData = { version: originalJsonData.version, words: uniqueWordsOutputArray };
                fs.writeFileSync(jsonFilePath, JSON.stringify(newJsonData, null, 2), 'utf-8');
                console.log(`\nSUCCESS: File updated. Now contains ${uniqueWordsOutputArray.length} entries (duplicates removed).`);
                console.log(`Original file backed up at: ${backupFilePath}`);
                if (invalidEntries.length > 0) { /* ... warn about invalid ... */ }
                if (potentiallySwappedEntries.length > 0) {  console.warn("Reminder: Potentially swapped entries were reported but NOT automatically changed."); }
            } else { /* ... no changes made ... */ }
        } else {
            if (duplicateReportEntries.length > 0) console.log(`\nACTION NEEDED: To remove duplicates (keeping best versions), run with --fix`);
            if (invalidEntries.length > 0) console.log('\nACTION NEEDED: Please review entries with missing/invalid fields.');
            if (potentiallySwappedEntries.length > 0) console.log('\nACTION NEEDED: Please review potentially swapped entries.');
        }
        console.log('-------------------------');

    } catch (error) { /* ... (error handling as before) ... */ }
}

validateAndCleanJson();