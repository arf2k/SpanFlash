const fs = require('fs');
const path = require('path');

// Helper function to create a normalized key for matching words
function createWordKey(spanish, english) {
    return `${spanish.toLowerCase().trim()}|${english.toLowerCase().trim()}`;
}

async function mergePhoneExportWithMaster() {
    console.log('=== Phone Export Merge Tool ===\n');
    
    // File paths
    const exportPath = path.join(__dirname, '..', 'public', 'phone_export.json');
    const masterPath = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');
    const outputPath = path.join(__dirname, '..', 'public', 'scrapedSpan411_merged.json');
    const backupPath = masterPath + '.pre-merge-backup';
    
    try {
        // Step 1: Read both files
        console.log('📱 Reading phone export...');
        if (!fs.existsSync(exportPath)) {
            console.error(`❌ Phone export not found at: ${exportPath}`);
            console.log('Please save your exported file as "phone_export.json" in the public folder');
            return;
        }
        const phoneExport = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
        console.log(`   Found ${phoneExport.words.length} words with Leitner data`);
        
        console.log('\n📄 Reading master file...');
        const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
        console.log(`   Found ${masterData.words.length} words in master`);
        
        // Step 2: Create Leitner data map from phone export
        console.log('\n🧠 Building Leitner progress map...');
        const leitnerMap = new Map();
        let progressCount = 0;
        
        phoneExport.words.forEach(word => {
            const key = createWordKey(word.spanish, word.english);
            leitnerMap.set(key, {
                leitnerBox: word.leitnerBox || 0,
                lastReviewed: word.lastReviewed || null,
                dueDate: word.dueDate || null
            });
            
            if (word.leitnerBox > 0) progressCount++;
        });
        
        console.log(`   ${progressCount} words have learning progress (Box > 0)`);
        
        // Step 3: Create a map of all phone export words for tracking
        const phoneWordsMap = new Map();
        phoneExport.words.forEach(word => {
            const key = createWordKey(word.spanish, word.english);
            phoneWordsMap.set(key, word);
        });
        
        // Step 4: Merge process
        console.log('\n🔄 Merging data...');
        const mergedWords = [];
        let preservedProgressCount = 0;
        let newFromMasterCount = 0;
        let updatedCount = 0;
        
        // Process all words from master file
        masterData.words.forEach(masterWord => {
            const key = createWordKey(masterWord.spanish, masterWord.english);
            const leitnerData = leitnerMap.get(key);
            const phoneWord = phoneWordsMap.get(key);
            
            if (leitnerData) {
                // Word exists in both - merge with Leitner data preserved
                const mergedWord = {
                    ...masterWord, // Start with master (has latest edits)
                    ...leitnerData // Overlay Leitner progress
                };
                
                // Check if master has updates (like new synonyms)
                if (phoneWord) {
                    const masterSynEng = (masterWord.synonyms_english || []).sort().join(',');
                    const phoneSynEng = (phoneWord.synonyms_english || []).sort().join(',');
                    if (masterSynEng !== phoneSynEng) {
                        updatedCount++;
                    }
                }
                
                mergedWords.push(mergedWord);
                if (leitnerData.leitnerBox > 0) preservedProgressCount++;
            } else {
                // Word only in master (new word)
                mergedWords.push({
                    ...masterWord,
                    leitnerBox: 0,
                    lastReviewed: null,
                    dueDate: null
                });
                newFromMasterCount++;
            }
        });
        
        // Check for words that were in phone but not in master (deleted)
        const deletedWords = [];
        phoneExport.words.forEach(phoneWord => {
            const key = createWordKey(phoneWord.spanish, phoneWord.english);
            const existsInMaster = masterData.words.some(w => 
                createWordKey(w.spanish, w.english) === key
            );
            if (!existsInMaster) {
                deletedWords.push(phoneWord);
            }
        });
        
        // Step 5: Create backup
        console.log('\n💾 Creating backup...');
        fs.copyFileSync(masterPath, backupPath);
        console.log(`   Backup saved to: ${backupPath}`);
        
        // Step 6: Save merged result
        const mergedData = {
            version: masterData.version, // Keep master version, you'll update manually
            words: mergedWords
        };
        
        fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2), 'utf-8');
        
        // Step 7: Report
        console.log('\n✅ Merge Complete!\n');
        console.log('📊 Summary:');
        console.log(`   Total words in merged file: ${mergedWords.length}`);
        console.log(`   Words with preserved progress: ${preservedProgressCount}`);
        console.log(`   New words from master: ${newFromMasterCount}`);
        console.log(`   Words with updated content: ${updatedCount}`);
        console.log(`   Words deleted (not in master): ${deletedWords.length}`);
        
        if (deletedWords.length > 0) {
            console.log('\n⚠️  Deleted words (these had Leitner progress but were removed from master):');
            deletedWords.slice(0, 5).forEach(w => {
                console.log(`   - "${w.spanish}" (was in Box ${w.leitnerBox})`);
            });
            if (deletedWords.length > 5) {
                console.log(`   ... and ${deletedWords.length - 5} more`);
            }
        }
        
        // Box distribution
        const boxDist = {};
        mergedWords.forEach(w => {
            const box = w.leitnerBox || 0;
            boxDist[box] = (boxDist[box] || 0) + 1;
        });
        
        console.log('\n📦 Leitner Box Distribution:');
        Object.entries(boxDist).sort((a, b) => a[0] - b[0]).forEach(([box, count]) => {
            console.log(`   Box ${box}: ${count} words`);
        });
        
        console.log('\n📝 Next steps:');
        console.log('1. Check the merged file: public/scrapedSpan411_merged.json');
        console.log('2. Update the version number in the file');
        console.log('3. Rename it to scrapedSpan411.json when ready');
        console.log('4. Delete phone_export.json to avoid confusion');
        
    } catch (error) {
        console.error('\n❌ Error during merge:', error.message);
    }
}

// Run the merge
mergePhoneExportWithMaster();