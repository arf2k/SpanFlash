const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');

// Configuration
const FREQUENCY_URL = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt';
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'spanishFrequency.json');
const RAW_FILE = path.join(OUTPUT_DIR, 'es_50k_raw.txt');

// Words to filter out (too basic or problematic)
const WORDS_TO_FILTER = new Set([
  // Articles
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  // Pronouns  
  'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas',
  'me', 'te', 'se', 'nos', 'os', 'le', 'les', 'lo', 'las',
  // Very basic conjunctions/prepositions
  'y', 'o', 'pero', 'de', 'a', 'en', 'con', 'por', 'para',
  // Single letters and numbers
  'a', 'e', 'i', 'o', 'u', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
]);

// Helper for user confirmation
function askConfirmation(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

// Download file from URL
function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        console.log(`📥 Downloading frequency data from: ${url}`);
        
        const file = fs.createWriteStream(destination);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Download failed with status: ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`✅ Downloaded to: ${destination}`);
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(destination, () => {}); // Delete partial file
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Process the raw frequency file
function processFrequencyFile(rawFilePath) {
    console.log(`🔄 Processing frequency data...`);
    
    const fileContent = fs.readFileSync(rawFilePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    const frequencyData = [];
    let filteredCount = 0;
    let rank = 1;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse line: "word frequency" (tab or space separated)
        const parts = line.split(/\s+/);
        if (parts.length < 2) continue;
        
        const word = parts[0].toLowerCase().trim();
        const frequency = parseFloat(parts[1]);
        
        // Skip if invalid
        if (!word || isNaN(frequency)) continue;
        
        // Skip filtered words
        if (WORDS_TO_FILTER.has(word)) {
            filteredCount++;
            continue;
        }
        
        // Skip words with numbers or special characters (optional)
        if (/[0-9\.\,\?\!\;\:\"\'\(\)\[\]\{\}]/.test(word)) {
            filteredCount++;
            continue;
        }
        
        // Skip very short words (1-2 characters) as they're often not useful
        if (word.length <= 2) {
            filteredCount++;
            continue;
        }
        
        frequencyData.push({
            word,
            rank,
            frequency,
            originalRank: i + 1 // Keep track of original position
        });
        
        rank++;
    }
    
    console.log(`📊 Processing complete:`);
    console.log(`   Original words: ${lines.length}`);
    console.log(`   Filtered out: ${filteredCount}`);
    console.log(`   Final dataset: ${frequencyData.length} words`);
    
    return frequencyData;
}

// Create analysis functions
function createAnalysisFunctions(frequencyData) {
    return `// Auto-generated Spanish frequency analysis
// Source: Hermit Dave's FrequencyWords (OpenSubtitles corpus)
// Generated: ${new Date().toISOString()}
// Total words: ${frequencyData.length}

export const SPANISH_FREQUENCY_DATA = ${JSON.stringify(frequencyData.slice(0, 10000), null, 2)};

// Analysis functions
export const analyzeVocabularyFrequency = (userWordList) => {
  const userWords = new Set(
    userWordList.map(word => 
      word.spanish.toLowerCase().trim()
        .replace(/^(el|la|los|las|un|una|unos|unas)\\s+/i, '') // Remove articles
        .replace(/[\\.,;:!?¡¿"'()\\[\\]{}]/g, '') // Remove punctuation
    )
  );
  
  let knownInTop100 = 0;
  let knownInTop500 = 0;
  let knownInTop1000 = 0;
  let knownInTop5000 = 0;
  
  const missingHighFreq = [];
  const knownWords = [];
  
  SPANISH_FREQUENCY_DATA.forEach(({ word, rank, frequency }) => {
    const isKnown = userWords.has(word);
    
    if (isKnown) {
      knownWords.push({ word, rank, frequency });
      if (rank <= 100) knownInTop100++;
      if (rank <= 500) knownInTop500++;
      if (rank <= 1000) knownInTop1000++;
      if (rank <= 5000) knownInTop5000++;
    } else if (rank <= 5000) {
      missingHighFreq.push({ word, rank, frequency });
    }
  });
  
  return {
    coverage: {
      knownInTop100,
      knownInTop500,
      knownInTop1000,
      knownInTop5000,
      percentageTop100: Math.round((knownInTop100 / 100) * 100),
      percentageTop500: Math.round((knownInTop500 / 500) * 100),
      percentageTop1000: Math.round((knownInTop1000 / 1000) * 100),
      percentageTop5000: Math.round((knownInTop5000 / 5000) * 100),
    },
    suggestions: {
      criticalGaps: missingHighFreq.filter(w => w.rank <= 500).slice(0, 20),
      importantGaps: missingHighFreq.filter(w => w.rank <= 1500).slice(0, 30),
      valuableGaps: missingHighFreq.filter(w => w.rank <= 5000).slice(0, 50),
    },
    knownWords: knownWords.slice(0, 100), // Top 100 known high-frequency words
    totalVocabularySize: userWordList.length,
    estimatedFluencyLevel: knownInTop1000 > 800 ? 'Advanced' : 
                          knownInTop1000 > 600 ? 'Intermediate' : 
                          knownInTop1000 > 300 ? 'Beginner+' : 'Beginner'
  };
};

export const getWordFrequencyRank = (word) => {
  const normalizedWord = word.toLowerCase().trim()
    .replace(/^(el|la|los|las|un|una|unos|unas)\\s+/i, '')
    .replace(/[\\.,;:!?¡¿"'()\\[\\]{}]/g, '');
    
  const found = SPANISH_FREQUENCY_DATA.find(item => item.word === normalizedWord);
  return found ? found.rank : null;
};

export const suggestHighValueWords = (userWordList, maxSuggestions = 50) => {
  const analysis = analyzeVocabularyFrequency(userWordList);
  return [
    ...analysis.suggestions.criticalGaps.slice(0, 15),
    ...analysis.suggestions.importantGaps.slice(0, 20),
    ...analysis.suggestions.valuableGaps.slice(0, 15)
  ].slice(0, maxSuggestions);
};
`;
}

// Main execution
async function fetchAndProcessFrequencyData() {
    try {
        // Ensure output directory exists
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
        
        // Check if we already have the data
        if (fs.existsSync(OUTPUT_FILE)) {
            const overwrite = await askConfirmation(
                `Frequency data already exists at ${OUTPUT_FILE}. Overwrite? (y/n): `
            );
            if (!overwrite) {
                console.log('❌ Operation cancelled');
                return;
            }
        }
        
        // Download the frequency data
        await downloadFile(FREQUENCY_URL, RAW_FILE);
        
        // Process the file
        const frequencyData = processFrequencyFile(RAW_FILE);
        
        if (frequencyData.length === 0) {
            throw new Error('No valid frequency data found');
        }
        
        // Create the analysis module
        const moduleContent = createAnalysisFunctions(frequencyData);
        
        // Write the processed data
        fs.writeFileSync(OUTPUT_FILE.replace('.json', '.js'), moduleContent, 'utf-8');
        
        // Clean up raw file
        fs.unlinkSync(RAW_FILE);
        
        console.log(`\\n✅ Frequency data processing complete!`);
        console.log(`📁 Output file: ${OUTPUT_FILE.replace('.json', '.js')}`);
        console.log(`📊 Dataset contains ${frequencyData.length} high-quality Spanish words`);
        console.log(`\\n🎯 Top 10 most frequent words in dataset:`);
        
        frequencyData.slice(0, 10).forEach((item, i) => {
            console.log(`   ${i + 1}. ${item.word} (rank ${item.rank}, freq: ${item.frequency})`);
        });
        
        console.log(`\\n📝 Next steps:`);
        console.log(`1. Import the analysis functions in your React components`);
        console.log(`2. Add frequency analysis to your vocabulary management`);
        console.log(`3. Create UI to display vocabulary coverage and suggestions`);
        
    } catch (error) {
        console.error('❌ Error processing frequency data:', error.message);
        
        // Clean up partial files
        [RAW_FILE, OUTPUT_FILE].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    }
}

// Run the script
fetchAndProcessFrequencyData();