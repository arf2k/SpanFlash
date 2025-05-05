const fs = require('fs');
const path = require('path');

const jsonFilePath = path.join(__dirname, 'public', 'scrapedSpan411.json');

console.log(`Attempting to validate JSON file: ${jsonFilePath}`);

try {
    console.log('Reading file...');
    const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
    console.log(`File read successfully (${(fileContent.length / 1024).toFixed(2)} KB).`);

    console.log('Parsing JSON...');
    const data = JSON.parse(fileContent);
    console.log(`JSON parsed successfully. Found ${data.length} total entries.`);

    if (!Array.isArray(data)) {
        throw new Error("Parsed data is not an array.");
    }

    console.log('Validating entries and checking for duplicates...');
    const invalidEntries = [];
    const duplicateEntries = [];
    const seenPairsMap = new Map(); // { uniquePairKey -> firstIndex }

    data.forEach((item, index) => {
        const entryNumber = index + 1; // 1-based index for reporting

        // --- Completeness Check ---
        const spanishRaw = item?.spanish;
        const englishRaw = item?.english;
        const spanishTrimmed = typeof spanishRaw === 'string' ? spanishRaw.trim() : '';
        const englishTrimmed = typeof englishRaw === 'string' ? englishRaw.trim() : '';
        const hasSpanish = !!spanishTrimmed;
        const hasEnglish = !!englishTrimmed;

        if (!item || !hasSpanish || !hasEnglish) {
            let reason = 'Missing/invalid ';
            if (!hasSpanish) reason += "'spanish'";
            if (!hasSpanish && !hasEnglish) reason += " and ";
            if (!hasEnglish) reason += "'english'";
            reason += ' field (or field is empty string).';
            invalidEntries.push({ index: entryNumber, reason: reason, item: item });
            return; // Skip duplicate check for invalid entries
        }

        // --- Uniqueness Check ---
        // Create a unique key using a robust separator, lowercase, trimmed
        const spanishKeyPart = spanishTrimmed.toLowerCase();
        const englishKeyPart = englishTrimmed.toLowerCase();
        const pairKey = `${spanishKeyPart}:::${englishKeyPart}`; // Using ::: as separator

        // console.log(`DEBUG: Entry ${entryNumber} - Key: "${pairKey}"`); // Uncomment for extreme debugging

        if (seenPairsMap.has(pairKey)) {
            // Duplicate found!
            const firstIndex = seenPairsMap.get(pairKey);
             console.log(`DEBUG: Duplicate Found! Index ${entryNumber} ("${pairKey}") matches Index ${firstIndex}`); // Debug log
            duplicateEntries.push({
                index: entryNumber,
                item: item, // The duplicate item
                firstIndex: firstIndex // Index where it was first seen
            });
        } else {
            // New unique pair, store its index (1-based)
            seenPairsMap.set(pairKey, entryNumber);
        }
    });

    console.log('Validation complete.');
    console.log('\n--- Validation Report ---');

    // --- Report Results ---
    if (invalidEntries.length > 0) {
        console.warn(`\nWARNING: Found ${invalidEntries.length} entries with missing/invalid/empty fields:`);
        invalidEntries.forEach(entry => {
            console.warn(` - Entry #${entry.index}: ${entry.reason} | Content: ${JSON.stringify(entry.item)}`);
        });
    } else {
        console.log("\nINFO: All entries have non-empty 'spanish' and 'english' string properties.");
    }

    if (duplicateEntries.length > 0) {
        console.warn(`\nWARNING: Found ${duplicateEntries.length} duplicate entries (same spanish/english pair, case-insensitive):`);
        duplicateEntries.forEach(entry => {
            console.warn(` - Entry #${entry.index}: Duplicate of Entry #${entry.firstIndex} | Content: ${JSON.stringify(entry.item)}`);
        });
    } else {
        console.log("\nINFO: No duplicate spanish/english pairs found.");
    }

    if (invalidEntries.length === 0 && duplicateEntries.length === 0) {
        console.log('\nSUCCESS: JSON data structure appears valid and contains unique pairs!');
    } else {
        console.log('\nACTION NEEDED: Please review the warnings above and clean the JSON data.');
    }
    console.log('-------------------------');

} catch (error) {
    console.error('\n--- ERROR DURING VALIDATION ---');
    if (error instanceof SyntaxError) { console.error('Failed to parse JSON. Check file syntax.'); }
    else if (error.code === 'ENOENT') { console.error(`File not found: ${jsonFilePath}`); }
    else { console.error('An unexpected error occurred:', error); }
    console.log('-----------------------------');
}