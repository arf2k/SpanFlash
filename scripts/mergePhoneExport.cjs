const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Helper function to create a normalized key for matching words
function createWordKey(spanish, english) {
    return `${spanish.toLowerCase().trim()}|${english.toLowerCase().trim()}`;
}

// Helper for user confirmation
function askConfirmation(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.toLowerCase());
        });
    });
}

// Helper to check if word has learning progress
function hasLearningProgress(word) {
    return (word.timesStudied > 0) || 
           (word.exposureLevel && word.exposureLevel !== 'new') ||
           (word.leitnerBox > 0); // Keep backward compatibility
}

// Helper to get progress summary for display
function getProgressSummary(word) {
    if (word.timesStudied > 0) {
        const accuracy = Math.round((word.timesCorrect / word.timesStudied) * 100);
        return `${word.exposureLevel} (${word.timesStudied} attempts, ${accuracy}% accuracy)`;
    } else if (word.leitnerBox > 0) {
        return `Leitner Box ${word.leitnerBox}`;
    }
    return 'no progress';
}

async function enhancedMergePhoneExportWithMaster() {
    console.log('=== Enhanced Phone Export Merge Tool (PHONE IS SOURCE OF TRUTH) ===\n');
    
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
        console.log(`   Found ${phoneExport.words.length} words with learning data`);
        
        console.log('\n📄 Reading master file...');
        const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
        console.log(`   Found ${masterData.words.length} words in master`);
        
        // Step 2: Create maps for analysis
        console.log('\n🔍 Analyzing differences...');
        
        const phoneWordsMap = new Map();
        let progressCount = 0;
        
        phoneExport.words.forEach(word => {
            const key = createWordKey(word.spanish, word.english);
            phoneWordsMap.set(key, word);
            
            // Count words with learning progress 
            if (hasLearningProgress(word)) {
                progressCount++;
            }
        });
        
        const masterWordsMap = new Map();
        masterData.words.forEach(word => {
            const key = createWordKey(word.spanish, word.english);
            masterWordsMap.set(key, word);
        });
        
        console.log(`   ${progressCount} words have learning progress`);
        
        // Step 3: Identify changes (PHONE IS SOURCE OF TRUTH)
        const phoneAdditions = []; // Words in phone but not in master
        const phoneDeletions = []; // Words in master but not in phone  
        const phoneUpdates = [];   // Words in both, but phone has changes
        
        // Find phone additions
        phoneWordsMap.forEach((phoneWord, key) => {
            if (!masterWordsMap.has(key)) {
                phoneAdditions.push(phoneWord);
            }
        });
        
        // Find deletions and updates
        masterWordsMap.forEach((masterWord, key) => {
            if (!phoneWordsMap.has(key)) {
                // Word deleted on phone
                phoneDeletions.push(masterWord);
            } else {
                // Word exists in both - check for updates
                const phoneWord = phoneWordsMap.get(key);
                
                // Check if phone has updates (synonyms, notes, etc.)
                const masterSynEng = JSON.stringify((masterWord.synonyms_english || []).sort());
                const phoneSynEng = JSON.stringify((phoneWord.synonyms_english || []).sort());
                const masterSynSpa = JSON.stringify((masterWord.synonyms_spanish || []).sort());
                const phoneSynSpa = JSON.stringify((phoneWord.synonyms_spanish || []).sort());
                const masterNotes = (masterWord.notes || '').trim();
                const phoneNotes = (phoneWord.notes || '').trim();
                const masterCategory = (masterWord.category || '').trim();
                const phoneCategory = (phoneWord.category || '').trim();
                
                if (masterSynEng !== phoneSynEng || masterSynSpa !== phoneSynSpa || 
                    masterNotes !== phoneNotes || masterCategory !== phoneCategory) {
                    phoneUpdates.push({ masterWord, phoneWord });
                }
            }
        });
        
        // Report findings
        console.log('\n📊 Analysis Results:');
        console.log(`   📝 Phone additions (new words): ${phoneAdditions.length}`);
        console.log(`   🗑️  Phone deletions (removed words): ${phoneDeletions.length}`);
        console.log(`   ✏️  Phone updates (modified words): ${phoneUpdates.length}`);
        
        // Step 4: Show deletions and updates (auto-applied)
        if (phoneDeletions.length > 0) {
            console.log('\n🗑️  Words to DELETE from master (phone removed these):');
            phoneDeletions.slice(0, 5).forEach(w => {
                console.log(`   - "${w.spanish}" - "${w.english}"`);
            });
            if (phoneDeletions.length > 5) {
                console.log(`   ... and ${phoneDeletions.length - 5} more`);
            }
        }
        
        if (phoneUpdates.length > 0) {
            console.log('\n✏️  Words to UPDATE from phone (phone has newer data):');
            phoneUpdates.slice(0, 3).forEach(({ masterWord, phoneWord }) => {
                console.log(`   - "${phoneWord.spanish}" - "${phoneWord.english}"`);
            });
            if (phoneUpdates.length > 3) {
                console.log(`   ... and ${phoneUpdates.length - 3} more`);
            }
        }
        
        // Step 5: Review phone additions
        let additionsToInclude = [];
        
        if (phoneAdditions.length > 0) {
            console.log('\n📝 Phone additions found:');
            phoneAdditions.forEach((word, index) => {
                const progress = hasLearningProgress(word) ? ` [${getProgressSummary(word)}]` : '';
                console.log(`   ${index + 1}. "${word.spanish}" - "${word.english}"${progress}`);
            });
            
            const addChoice = await askConfirmation(
                `\nAdd all ${phoneAdditions.length} new words? (y=yes all / n=no all / r=review individually): `
            );
            
            if (addChoice === 'y' || addChoice === 'yes') {
                additionsToInclude = [...phoneAdditions];
                console.log('✅ All phone additions will be included');
            } else if (addChoice === 'r' || addChoice === 'review') {
                for (const word of phoneAdditions) {
                    const progress = hasLearningProgress(word) ? ` [${getProgressSummary(word)}]` : '';
                    const includeWord = await askConfirmation(
                        `Include "${word.spanish}" - "${word.english}"${progress}? (y/n): `
                    );
                    if (includeWord === 'y' || includeWord === 'yes') {
                        additionsToInclude.push(word);
                    }
                }
                console.log(`✅ ${additionsToInclude.length} of ${phoneAdditions.length} additions will be included`);
            } else {
                console.log('❌ No phone additions will be included');
            }
        }
        
        // Step 6: Build final word list
        console.log('\n🔄 Building merged word list...');
        const finalWords = [];
        let preservedProgressCount = 0;
        
        // Add all phone words (existing + approved additions)
        phoneWordsMap.forEach((phoneWord, key) => {
            if (masterWordsMap.has(key) || additionsToInclude.includes(phoneWord)) {
                finalWords.push(phoneWord);
                
                // Count preserved progress 
                if (hasLearningProgress(phoneWord)) {
                    preservedProgressCount++;
                }
            }
        });
        
        // Step 7: Show final summary and confirm
        console.log('\n📋 Final Summary:');
        console.log(`   Total words in merged file: ${finalWords.length}`);
        console.log(`   Words with preserved progress: ${preservedProgressCount}`);
        console.log(`   Phone additions included: ${additionsToInclude.length}`);
        console.log(`   Phone deletions applied: ${phoneDeletions.length}`);
        console.log(`   Phone updates applied: ${phoneUpdates.length}`);
        
        const proceedChoice = await askConfirmation('\nProceed with merge? (y/n): ');
        
        if (proceedChoice !== 'y' && proceedChoice !== 'yes') {
            console.log('❌ Merge cancelled');
            return;
        }
        
        // Step 8: Create backup and save
        console.log('\n💾 Creating backup...');
        fs.copyFileSync(masterPath, backupPath);
        console.log(`   Backup saved to: ${backupPath}`);
        
        const mergedData = {
            version: masterData.version, // Keep master version, update manually if needed
            words: finalWords
        };
        
        fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2), 'utf-8');
        
        // Step 9: Progress distribution (shows exposure levels instead of Leitner boxes)
        const exposureDist = {};
        const progressDist = {};
        
        finalWords.forEach(w => {
            // Exposure level distribution
            const level = w.exposureLevel || 'new';
            exposureDist[level] = (exposureDist[level] || 0) + 1;
            
            // Progress attempts distribution
            const attempts = w.timesStudied || 0;
            if (attempts > 0) {
                const bracket = attempts <= 2 ? '1-2' : 
                               attempts <= 5 ? '3-5' : 
                               attempts <= 10 ? '6-10' : '10+';
                progressDist[bracket] = (progressDist[bracket] || 0) + 1;
            }
        });
        
        console.log('\n📊 Exposure Level Distribution:');
        Object.entries(exposureDist).sort().forEach(([level, count]) => {
            console.log(`   ${level}: ${count} words`);
        });
        
        if (Object.keys(progressDist).length > 0) {
            console.log('\n📈 Study Attempts Distribution:');
            Object.entries(progressDist).forEach(([bracket, count]) => {
                console.log(`   ${bracket} attempts: ${count} words`);
            });
        }
        
        console.log('\n✅ Enhanced Merge Complete!\n');
        console.log('📝 Next steps:');
        console.log('1. Check the merged file: public/scrapedSpan411_merged.json');
        console.log('2. Update the version number in the file if needed');
        console.log('3. Rename it to scrapedSpan411.json when ready');
        console.log('4. Delete phone_export.json to avoid confusion');
        console.log('5. Optionally run cleanMasterList.cjs --fix to deduplicate');
        
    } catch (error) {
        console.error('\n❌ Error during enhanced merge:', error.message);
    }
}

// Run the enhanced merge
enhancedMergePhoneExportWithMaster();