const fs = require('fs');
const path = require('path');

// Import the frequency analysis function
async function generateMissingReport() {
    try {
        // Load your current vocabulary
        const masterPath = path.join(__dirname, '..', 'public', 'scrapedSpan411.json');
        const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
        console.log(`Loaded ${masterData.words.length} words from master list`);

        // Load frequency data 
        const frequencyPath = path.join(__dirname, '..', 'src', 'data', 'spanishFrequency.js');
        const frequencyContent = fs.readFileSync(frequencyPath, 'utf-8');
        
        // Extract the frequency data array (quick and dirty parsing)
        const dataStart = frequencyContent.indexOf('export const SPANISH_FREQUENCY_DATA = ') + 'export const SPANISH_FREQUENCY_DATA = '.length;
        const dataEnd = frequencyContent.indexOf('];', dataStart) + 1;
        const frequencyDataStr = frequencyContent.substring(dataStart, dataEnd);
        const frequencyData = JSON.parse(frequencyDataStr);

        // Create set of your current words (normalized)
        const yourWords = new Set();
        masterData.words.forEach(word => {
            if (word.spanish) {
                const normalized = word.spanish.toLowerCase().trim()
                    .replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '')
                    .replace(/[.,;:!?¡¿"'()\[\]{}]/g, '');
                yourWords.add(normalized);
            }
        });

        // Find missing words by frequency tier
        const missing = {
            top500: [],
            top1000: [],
            top3000: [],
            top5000: []
        };

        frequencyData.forEach(({ word, rank }) => {
            if (!yourWords.has(word)) {
                if (rank <= 500) missing.top500.push({word, rank});
                else if (rank <= 1000) missing.top1000.push({word, rank});
                else if (rank <= 3000) missing.top3000.push({word, rank});
                else if (rank <= 5000) missing.top5000.push({word, rank});
            }
        });

        // Generate report
        const reportPath = path.join(__dirname, 'missing_frequency_words_report.txt');
        let report = `MISSING HIGH-FREQUENCY SPANISH WORDS REPORT\n`;
        report += `Generated: ${new Date().toISOString()}\n`;
        report += `Your vocabulary: ${masterData.words.length} words\n\n`;

        report += `SUMMARY:\n`;
        report += `Missing from top 500: ${missing.top500.length}\n`;
        report += `Missing from top 1000: ${missing.top1000.length}\n`;
        report += `Missing from top 3000: ${missing.top3000.length}\n`;
        report += `Missing from top 5000: ${missing.top5000.length}\n\n`;

        // Detailed lists
        ['top500', 'top1000', 'top3000', 'top5000'].forEach(tier => {
            if (missing[tier].length > 0) {
                report += `MISSING FROM ${tier.toUpperCase()}:\n`;
                missing[tier].forEach(({word, rank}) => {
                    report += `${rank}. ${word}\n`;
                });
                report += '\n';
            }
        });

        fs.writeFileSync(reportPath, report, 'utf-8');
        
        console.log(`\n📊 MISSING WORDS SUMMARY:`);
        console.log(`Missing from top 500: ${missing.top500.length}`);
        console.log(`Missing from top 1000: ${missing.top1000.length}`);
        console.log(`Missing from top 3000: ${missing.top3000.length}`);
        console.log(`Missing from top 5000: ${missing.top5000.length}`);
        console.log(`\n📁 Detailed report saved to: ${reportPath}`);

    } catch (error) {
        console.error('Error generating report:', error);
    }
}

generateMissingReport();