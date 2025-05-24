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

function normalizeText(text) {
    if (typeof text !== 'string') return '';
    let normalized = text.trim().toLowerCase();
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    normalized = normalized.replace(/^[¡¿]+|[.,;:?!¿¡]+$/g, ""); // Strip leading Spanish & common trailing punctuation
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

// Function to score an item based on its completeness
function getItemCompletenessScore(item) {
    let score = 0;
    if (item.notes && item.notes.trim() !== '') score += 2; // Notes are valuable
    if (item.synonyms_spanish && Array.isArray(item.synonyms_spanish) && item.synonyms_spanish.length > 0) score += 1;
    if (item.synonyms_english && Array.isArray(item.synonyms_english) && item.synonyms_english.length > 0) score += 1;
    if (item.category && item.category.trim() !== '') score += 1;
    // Optionally, give a small bonus if original spanish/english had accents vs not, if a way to check original pre-normalized state is kept
    return score;
}

async function validateAndCleanJson() {
    console.log(`Attempting to process JSON file: ${jsonFilePath}`);
    try {
        if (!fs.existsSync(jsonFilePath)) {
            console.error(`File not found: ${jsonFilePath}.`);
            return;
        }
        const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
        const originalJsonData = JSON.parse(fileContent);

        if (typeof originalJsonData !== 'object' || originalJsonData === null || typeof originalJsonData.version !== 'string' || !Array.isArray(originalJsonData.words)) {
            throw new Error("Parsed JSON data is not an object with a 'version' string and a 'words' array.");
        }
        
        const originalWordsArray = originalJsonData.words;
        console.log(`JSON parsed. Version "${originalJsonData.version}". Found ${originalWordsArray.length} entries in "words" array.`);

        console.log('Validating entries and checking for duplicates with enhanced normalization and "keep best" logic...');
        const invalidEntries = []; // For entries missing essential spanish/english
        const duplicateReportEntries = []; // For reporting what was considered a duplicate and discarded
        
        // Stores the best item found so far for each unique normalized key.
        // Map: { normalizedPairKey -> { item: bestItemObject, originalIndex: itsOriginalIndex } }
        const bestItemsMap = new Map(); 

        originalWordsArray.forEach((currentItem, index) => {
            const currentOriginalIndex = index + 1; // 1-based for reporting

            const spanishRaw = currentItem?.spanish;
            const englishRaw = currentItem?.english;
            
            if (typeof spanishRaw !== 'string' || spanishRaw.trim() === '' || typeof englishRaw !== 'string' || englishRaw.trim() === '') {
                invalidEntries.push({ index: currentOriginalIndex, reason: "Missing or empty 'spanish' or 'english' field.", item: currentItem });
                // We might still want to include invalid items in the output if not fixing duplicates,
                // or decide to filter them out during the --fix process.
                // For now, if an item is invalid, it won't be processed for duplicates or kept.
                return; // Skip further processing for this invalid item
            }

            const normalizedSpanish = normalizeText(spanishRaw);
            const normalizedEnglish = normalizeText(englishRaw);
            const keyPartSpanish = stripSpanishArticles(normalizedSpanish);
            const keyPartEnglish = stripEnglishArticlesAndTo(normalizedEnglish);
            const normalizedPairKey = `${keyPartSpanish}:::${keyPartEnglish}`;

            if (bestItemsMap.has(normalizedPairKey)) {
                const existingEntry = bestItemsMap.get(normalizedPairKey);
                const existingItem = existingEntry.item;
                
                // Compare currentItem with existingItem for "betterness"
                if (getItemCompletenessScore(currentItem) > getItemCompletenessScore(existingItem)) {
                    // Current item is better, replace the one in the map
                    bestItemsMap.set(normalizedPairKey, { item: currentItem, originalIndex: currentOriginalIndex });
                    duplicateReportEntries.push({
                        discardedItem: existingItem,
                        discardedIndex: existingEntry.originalIndex,
                        keptItem: currentItem,
                        keptIndex: currentOriginalIndex,
                        normalizedKey: normalizedPairKey,
                        reason: `Replaced by more complete Entry #${currentOriginalIndex}`
                    });
                } else {
                    // Existing item is better or equal, so current item is a duplicate to be discarded
                    duplicateReportEntries.push({
                        discardedItem: currentItem,
                        discardedIndex: currentOriginalIndex,
                        keptItem: existingItem,
                        keptIndex: existingEntry.originalIndex,
                        normalizedKey: normalizedPairKey,
                        reason: `Duplicate of better/earlier Entry #${existingEntry.originalIndex}`
                    });
                }
            } else {
                // This is the first time we're seeing this normalized key, or it's the best so far
                bestItemsMap.set(normalizedPairKey, { item: currentItem, originalIndex: currentOriginalIndex });
            }
        });

        const uniqueWordsOutputArray = Array.from(bestItemsMap.values()).map(entry => entry.item);

        console.log('Validation complete.');
        console.log('\n--- Validation Report ---');

        if (invalidEntries.length > 0) {
            console.warn(`\nWARNING: Found ${invalidEntries.length} entries with missing/invalid/empty 'spanish' or 'english' fields (these were skipped from de-duplication):`);
            invalidEntries.forEach(entry => {
                console.warn(` - Entry #${entry.index} (Original): ${entry.reason} | Content: ${JSON.stringify(entry.item)}`);
            });
        } else {
            console.log("\nINFO: All entries processed had non-empty 'spanish' and 'english' string properties.");
        }

        if (duplicateReportEntries.length > 0) {
            const numDuplicatesDiscarded = duplicateReportEntries.length;
            console.warn(`\nINFO: Identified ${numDuplicatesDiscarded} entries that were either less complete duplicates or later exact duplicates (after normalization).`);
            console.log("   The 'keep best' logic aims to retain the most complete version of a word pair.");
            // Optionally, list some examples of what was discarded and what was kept:
            // duplicateReportEntries.slice(0, 5).forEach(entry => {
            //     console.warn(`   - Discarded (Original Index #${entry.discardedIndex}): ${JSON.stringify(entry.discardedItem)} was considered a duplicate of Kept (Original Index #${entry.keptIndex}): ${JSON.stringify(entry.keptItem)} due to key "${entry.normalizedKey}"`);
            // });
        } else {
            console.log("\nINFO: No duplicate spanish/english pairs found after normalization and 'keep best' logic.");
        }
        
        console.log(`\nINFO: After processing, the list will contain ${uniqueWordsOutputArray.length} unique (best version) entries.`);
        if (originalWordsArray.length - invalidEntries.length !== uniqueWordsOutputArray.length + duplicateReportEntries.filter(d => d.discardedItem !== undefined).length) {
             console.warn("Count mismatch detected, review logic for item tracking."); // Sanity check
        }


        const fixMode = process.argv.includes('--fix');

        if (invalidEntries.length === 0 && duplicateReportEntries.length === 0) {
            console.log('\nSUCCESS: "words" array appears valid and contains unique (best) pairs after normalization!');
        } else if (fixMode && (duplicateReportEntries.length > 0 || invalidEntries.length > 0 /* if we decide to filter invalid ones too */) ) {
            // For now, --fix only addresses duplicates identified and removed by "keep best"
            if (duplicateReportEntries.length === 0) {
                console.log("\nINFO: No duplicates were identified to remove with --fix. Invalid entries (if any) are not removed by this flag.");
                return;
            }

            console.log('\n--- Attempting to Fix Duplicates by Keeping Best Versions ---');
            try {
                fs.copyFileSync(jsonFilePath, backupFilePath);
                console.log(`IMPORTANT: A backup of your original file has been created at: ${backupFilePath}`);
            } catch (backupError) { console.error(`ERROR: Could not create backup. Aborting fix.`, backupError); return; }

            const proceed = await askConfirmation(`This will REWRITE '${path.basename(jsonFilePath)}' with ${uniqueWordsOutputArray.length} unique (best version) entries, effectively removing ${originalWordsArray.length - uniqueWordsOutputArray.length - invalidEntries.length} detected duplicates. Are you sure? (yes/no): `);

            if (proceed) {
                // Reconstruct the final list: unique "best" items + any items that were initially invalid (if we want to keep them)
                // For now, uniqueWordsOutputArray already excludes the invalid items if they were skipped early.
                // If invalid items were pushed to uniqueWordsOutputArray earlier and we want to remove them during --fix:
                // const finalWordsArray = uniqueWordsOutputArray.filter(item => !invalidEntries.find(inv => inv.item === item));
                // For this version, invalid entries are skipped from duplicate processing and are not in uniqueWordsOutputArray if they fail the initial check.
                // So uniqueWordsOutputArray should only contain valid, "best" items.
                // We should also consider how to handle entries that were invalid from the start.
                // The `uniqueWordsOutputArray` is built from items that PASS the initial spanish/english check.
                // The `invalidEntries` are reported. If --fix, should these be removed too?
                // For now, let's assume --fix primarily addresses the duplicates among *valid* entries.
                // The user can manually fix invalid entries later.
                
                const newJsonData = {
                    version: originalJsonData.version,
                    words: uniqueWordsOutputArray 
                };
                fs.writeFileSync(jsonFilePath, JSON.stringify(newJsonData, null, 2), 'utf-8');
                console.log(`\nSUCCESS: File updated. Now contains ${uniqueWordsOutputArray.length} entries.`);
                console.log(`Original file backed up at: ${backupFilePath}`);
                if (invalidEntries.length > 0) {
                     console.warn(`Note: ${invalidEntries.length} entries with missing/invalid fields were reported and are NOT included in the fixed file if they failed the initial check. Please review them in your original file or backup.`);
                }
            } else {
                console.log('\nNo changes made. Original file is untouched (though a backup was created).');
            }
        } else if (duplicateReportEntries.length > 0) {
             console.log(`\nACTION NEEDED: To apply changes (keeping best versions, removing others), run with --fix`);
        } else if (invalidEntries.length > 0) {
            console.log('\nACTION NEEDED: Please review entries with missing/invalid fields in your source file.');
        }

        console.log('-------------------------');

    } catch (error) {
        console.error('\n--- ERROR DURING PROCESSING ---');
        if (error instanceof SyntaxError) { console.error('Failed to parse JSON. Check file syntax.'); }
        else if (error.code === 'ENOENT') { console.error(`File not found: ${jsonFilePath}.`); }
        else { console.error('An unexpected error occurred:', error.message, error.stack); }
        console.log('-----------------------------');
    }
}

validateAndCleanJson();