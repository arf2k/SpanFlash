const fs = require('fs');
const path = require('path');
const readline = require('readline');


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
    processedText = processedText.replace(articles, "");
    
    // NEW: Only strip "to" if NOT in conservative mode
    const conservativeMode = process.argv.includes('--conservative');
    if (!conservativeMode) {
        const toVerb = /^to\s+/i;
        processedText = processedText.replace(toVerb, "");
    }
    return processedText.trim();
}

// ENHANCED: Prioritize words with learning progress
function getItemCompletenessScore(item) {
    let score = 0;
    
    // NEW: High priority for words with learning progress
    if (item.timesStudied > 0) score += 10;
    if (item.exposureLevel && item.exposureLevel !== 'new') score += 5;
    
    // Existing scoring
    if (item.notes && item.notes.trim() !== '') score += 2;
    if (item.synonyms_spanish && Array.isArray(item.synonyms_spanish) && item.synonyms_spanish.length > 0) score += 1;
    if (item.synonyms_english && Array.isArray(item.synonyms_english) && item.synonyms_english.length > 0) score += 1;
    if (item.category && item.category.trim() !== '') score += 1;
    if (item.frequencyRank && item.frequencyRank < 99999) score += 1;
    
    return score;
}


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

// NEW: Display usage information
function showUsage() {
    console.log('\n--- Enhanced cleanMasterList.cjs Usage ---');
    console.log('node scripts/cleanMasterList.cjs [options]');
    console.log('\nOptions:');
    console.log('  --dry-run         Show what would be changed without making changes');
    console.log('  --conservative    Preserve "to" verb distinctions (less aggressive)');
    console.log('  --fix-swapped     Automatically fix swapped Spanish/English entries');
    console.log('  --fix             Apply all detected changes (requires confirmation)');
    console.log('  --verbose         Show detailed duplicate detection information');
    console.log('  --help            Show this help message');
    console.log('\nExamples:');
    console.log('  node scripts/cleanMasterList.cjs --dry-run --conservative');
    console.log('  node scripts/cleanMasterList.cjs --fix-swapped --fix');
    console.log('  node scripts/cleanMasterList.cjs --verbose --dry-run');
}

// --- Main Validation and Cleaning Logic ---
async function validateAndCleanJson() {
    // NEW: Check for help flag
    if (process.argv.includes('--help')) {
        showUsage();
        return;
    }

    // Parse command line flags
    const fixSwappedMode = process.argv.includes('--fix-swapped');
    const fixMode = process.argv.includes('--fix');
    const dryRunMode = process.argv.includes('--dry-run');
    const conservativeMode = process.argv.includes('--conservative');
    const verboseMode = process.argv.includes('--verbose');

    // NEW: Show mode information
    console.log(`Attempting to process JSON file: ${jsonFilePath}`);
    console.log(`Mode: ${dryRunMode ? 'DRY RUN' : 'ANALYSIS'} | Conservative: ${conservativeMode} | Verbose: ${verboseMode}`);
    
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

        console.log('\n--- Pass 1: Checking for Invalid, and Fixing Swapped Languages ---');
        const invalidEntries = [];
        const swappedAndFixedEntries = [];
        const potentiallySwappedButNotFixed = [];
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
        
        console.log('\n--- Pass 2: Finding and Removing Duplicates from Processed List ---');
        const duplicateReportEntries = [];
        const bestItemsMap = new Map();

        wordsAfterSwapPass.forEach((currentItem, index) => {
            const spanishRaw = currentItem.spanish;
            const englishRaw = currentItem.english;

            const normalizedSpanish = normalizeText(spanishRaw);
            const normalizedEnglish = normalizeText(englishRaw);
            const keyPartSpanish = stripSpanishArticles(normalizedSpanish);
            const keyPartEnglish = stripEnglishArticlesAndTo(normalizedEnglish);
            const normalizedPairKey = `${keyPartSpanish}:::${keyPartEnglish}`;

            if (bestItemsMap.has(normalizedPairKey)) {
                const existingEntry = bestItemsMap.get(normalizedPairKey);
                
                // NEW: Enhanced duplicate reporting
                if (verboseMode) {
                    console.log(`DUPLICATE FOUND: "${currentItem.spanish}" → "${currentItem.english}" matches existing "${existingEntry.item.spanish}" → "${existingEntry.item.english}"`);
                }
                
                const currentScore = getItemCompletenessScore(currentItem);
                const existingScore = getItemCompletenessScore(existingEntry.item);
                
                if (currentScore > existingScore) {
                    bestItemsMap.set(normalizedPairKey, { item: currentItem });
                    duplicateReportEntries.push({ 
                        discardedItem: existingEntry.item, 
                        keptItem: currentItem, 
                        reason: `Replaced by more complete version (score: ${currentScore} vs ${existingScore})`,
                        currentScore: currentScore,
                        existingScore: existingScore
                    });
                } else {
                    duplicateReportEntries.push({ 
                        discardedItem: currentItem, 
                        keptItem: existingEntry.item, 
                        reason: `Duplicate of better/earlier version (score: ${existingScore} vs ${currentScore})`,
                        currentScore: currentScore,
                        existingScore: existingScore
                    });
                }
            } else {
                bestItemsMap.set(normalizedPairKey, { item: currentItem });
            }
        });

        const uniqueWordsOutputArray = Array.from(bestItemsMap.values()).map(entry => entry.item);
        
        // NEW: Enhanced reporting section
        console.log('\n--- Validation & Cleaning Report ---');
        
        // Report on invalid entries
        if (invalidEntries.length > 0) {
            console.warn(`\nWARNING: Found ${invalidEntries.length} entries with missing/invalid/empty fields (these were ignored):`);
            if (verboseMode) {
                invalidEntries.forEach(entry => console.warn(` - Entry #${entry.index}: ${JSON.stringify(entry.item)}`));
            } else {
                console.warn(` - Use --verbose to see details`);
            }
        }

        // Report on swapped entries
        if (swappedAndFixedEntries.length > 0) {
            console.log(`\nINFO: Automatically corrected ${swappedAndFixedEntries.length} entries with swapped languages (due to --fix-swapped flag):`);
            if (verboseMode) {
                swappedAndFixedEntries.forEach(entry => {
                    console.log(` - Entry #${entry.index}: Swapped "${entry.originalItem.spanish}" ↔ "${entry.originalItem.english}"`);
                });
            } else {
                console.log(` - Use --verbose to see details`);
            }
        }
        
        if (potentiallySwappedButNotFixed.length > 0) {
            console.warn(`\nWARNING: Found ${potentiallySwappedButNotFixed.length} entries that might have SWAPPED content:`);
            if (verboseMode) {
                potentiallySwappedButNotFixed.forEach(entry => console.warn(` - Entry #${entry.index}: ${JSON.stringify(entry.item)}`));
            } else {
                console.warn(` - Use --verbose to see details, --fix-swapped to fix automatically`);
            }
        }
        
        // Enhanced duplicate reporting
        if (duplicateReportEntries.length > 0) {
            console.log(`\nINFO: Found and would remove ${duplicateReportEntries.length} duplicate entries (keeping the best version):`);
            
            // NEW: Show learning progress preservation stats
            const learningProgressPreserved = duplicateReportEntries.filter(entry => 
                entry.keptItem.timesStudied > 0 && entry.discardedItem.timesStudied === 0
            ).length;
            
            if (learningProgressPreserved > 0) {
                console.log(`      ${learningProgressPreserved} duplicates preserved learning progress`);
            }
            
            if (verboseMode) {
                duplicateReportEntries.slice(0, 10).forEach(entry => {
                    const learningInfo = entry.keptItem.timesStudied > 0 ? ` [${entry.keptItem.timesStudied} attempts]` : '';
                    console.log(` - Discard: "${entry.discardedItem.spanish}" → "${entry.discardedItem.english}"`);
                    console.log(`   Keep:    "${entry.keptItem.spanish}" → "${entry.keptItem.english}"${learningInfo}`);
                    console.log(`   Reason:  ${entry.reason}`);
                });
                if (duplicateReportEntries.length > 10) {
                    console.log(` - ... and ${duplicateReportEntries.length - 10} more duplicates`);
                }
            } else {
                console.log(` - Use --verbose to see details`);
            }
        }
        
        if (invalidEntries.length === 0 && potentiallySwappedButNotFixed.length === 0 && duplicateReportEntries.length === 0) {
            console.log('\nSUCCESS: JSON data is clean, unique, and appears correctly assigned!');
        }
        
        console.log(`\n--------------------------------------`);
        console.log(`Original count: ${originalWordsArray.length}`);
        console.log(`Final count:    ${uniqueWordsOutputArray.length}`);
        console.log(`Reduction:      ${originalWordsArray.length - uniqueWordsOutputArray.length} words (${Math.round(((originalWordsArray.length - uniqueWordsOutputArray.length) / originalWordsArray.length) * 100)}%)`);
        console.log(`Conservative:   ${conservativeMode ? 'YES (preserving "to" verb variants)' : 'NO (aggressive deduplication)'}`);
        console.log(`--------------------------------------`);

        const changesMade = swappedAndFixedEntries.length > 0 || duplicateReportEntries.length > 0;
        
        // NEW: Enhanced decision logic
        if (dryRunMode && changesMade) {
            console.log('\n--- DRY RUN COMPLETE ---');
            console.log('This was a dry run - no changes were made to your vocabulary file.');
            console.log(`Would reduce vocabulary from ${originalWordsArray.length} to ${uniqueWordsOutputArray.length} words.`);
            console.log('\nTo apply these changes:');
            if (conservativeMode) {
                console.log('  node scripts/cleanMasterList.cjs --conservative --fix');
            } else {
                console.log('  node scripts/cleanMasterList.cjs --fix');
            }
            if (swappedAndFixedEntries.length > 0) {
                console.log('  (Add --fix-swapped to also fix language swaps)');
            }
        } else if (fixMode && changesMade) {
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
                console.log(`Vocabulary reduced from ${originalWordsArray.length} to ${uniqueWordsOutputArray.length} words.`);
            } else {
                console.log("\nAborted. No changes were saved.");
            }
        } else if (changesMade && !fixMode && !dryRunMode) {
             console.log("\nACTION NEEDED: To apply these changes, run the script again with the --fix flag.");
             console.log("Or use --dry-run to see detailed analysis without making changes.");
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