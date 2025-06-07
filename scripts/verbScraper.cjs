const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class EllaVerbsScraper {
    constructor() {
        this.baseUrl = 'https://ellaverbs.com';
        this.outputFile = path.join(__dirname, '..', 'public', 'conjugations.json');
        this.requestDelay = 1500; // 1.5 seconds between requests
        this.maxRetries = 3;
        this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async makeRequest(url, retries = 0) {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 10000
            });
            return response;
        } catch (error) {
            if (retries < this.maxRetries) {
                console.log(`Retry ${retries + 1} for ${url}`);
                await this.delay(2000);
                return this.makeRequest(url, retries + 1);
            }
            throw error;
        }
    }

    async getVerbList() {
        console.log('Fetching verb list from EllaVerbs...');
        const response = await this.makeRequest(`${this.baseUrl}/spanish-verbs/`);
        const $ = cheerio.load(response.data);
        
        const verbs = [];
        
        // Extract verb links from the main list
        $('a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && href.includes('/spanish-verbs/') && href.includes('-conjugation/')) {
                const verbMatch = href.match(/\/spanish-verbs\/(.+)-conjugation\//);
                if (verbMatch) {
                    const verb = verbMatch[1];
                    if (!verbs.includes(verb)) {
                        verbs.push(verb);
                    }
                }
            }
        });

        console.log(`Found ${verbs.length} verbs`);
        return verbs; // Return full list
    }

    extractConjugationTable($, sectionTitle) {
        const conjugations = {};
        
        // Find the section by title
        let section = null;
        $('h2, h3, h4').each((i, elem) => {
            if ($(elem).text().toLowerCase().includes(sectionTitle.toLowerCase())) {
                section = $(elem);
                return false;
            }
        });
        
        if (!section) return conjugations;
        
        // Find the table after this section
        const table = section.nextAll('table').first();
        if (table.length === 0) return conjugations;
        
        // Extract pronouns and conjugations
        table.find('tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 2) {
                const pronoun = $(cells.eq(0)).text().trim().toLowerCase();
                const conjugation = $(cells.eq(1)).text().trim();
                
                if (pronoun && conjugation) {
                    conjugations[pronoun] = conjugation;
                }
            }
        });
        
        return conjugations;
    }

    extractTenseData($, verb) {
        const tenses = {};
        const tenseNames = [
            'infinitive_forms', 'present', 'preterite', 'imperfect', 'present_continuous',
            'informal_future', 'future', 'conditional', 'present_perfect', 'past_perfect',
            'future_perfect', 'conditional_perfect', 'subjunctive_present', 'subjunctive_imperfect',
            'subjunctive_future', 'subjunctive_present_perfect', 'subjunctive_past_perfect',
            'subjunctive_future_perfect', 'imperative_affirmative', 'imperative_negative'
        ];
        
        $('table').each((i, table) => {
            const conjugations = {};
            $(table).find('tr').each((j, row) => {
                const cells = $(row).find('td');
                if (cells.length >= 2) {
                    let pronoun = $(cells.eq(0)).text().trim();
                    const conjugation = $(cells.eq(1)).text().trim();
                    
                    // Simplify pronoun keys
                    pronoun = pronoun.replace(/nosotras \/ /, '').replace(/vosotras \/ /, '')
                                   .replace(/ellas \/ ellos \/ /, '').replace(/ella \/ él \/ /, '');
                    
                    if (conjugation && pronoun) {
                        conjugations[pronoun.toLowerCase()] = conjugation;
                    }
                }
            });
            
            if (Object.keys(conjugations).length >= 2) {
                const tenseName = tenseNames[i] || `tense_${i}`;
                tenses[tenseName] = conjugations;
            }
        });

        return tenses;
    }

    async scrapeVerb(verb) {
        try {
            console.log(`Scraping ${verb}...`);
            const url = `${this.baseUrl}/spanish-verbs/${verb}-conjugation/`;
            const response = await this.makeRequest(url);
            const $ = cheerio.load(response.data);
            
            // Extract English translation
            let englishTranslation = '';
            
            // Method 1: Look for translation in heading
            $('h1, h2').each((i, elem) => {
                const text = $(elem).text();
                const match = text.match(/[""](.+?)[""]|"(.+?)"/);
                if (match && !englishTranslation) {
                    englishTranslation = match[1] || match[2];
                }
            });
            
            // Method 2: Look in first paragraph or intro text
            if (!englishTranslation) {
                $('p').first().each((i, elem) => {
                    const text = $(elem).text();
                    const match = text.match(/means?\s+[""](.+?)[""]|means?\s+"(.+?)"|is\s+the\s+Spanish\s+verb\s+for\s+[""](.+?)[""]|is\s+the\s+Spanish\s+verb\s+for\s+"(.+?)"/i);
                    if (match) {
                        englishTranslation = match[1] || match[2] || match[3] || match[4];
                    }
                });
            }
            
            // Method 3: Look for specific EllaVerbs pattern
            if (!englishTranslation) {
                const bodyText = $('body').text();
                const patterns = [
                    new RegExp(`${verb}\\s+is\\s+the\\s+Spanish\\s+verb\\s+meaning\\s+[""](.+?)[""]`, 'i'),
                    new RegExp(`${verb}\\s+is\\s+the\\s+Spanish\\s+verb\\s+for\\s+[""](.+?)[""]`, 'i'),
                    new RegExp(`The\\s+Spanish\\s+verb\\s+${verb}\\s+means\\s+[""](.+?)[""]`, 'i')
                ];
                
                for (const pattern of patterns) {
                    const match = bodyText.match(pattern);
                    if (match) {
                        englishTranslation = match[1];
                        break;
                    }
                }
            }
            
            // Check if verb is irregular
            const isIrregular = $('.red-dot, .irregular, [class*="irregular"]').length > 0 ||
                              $('body').text().toLowerCase().includes('irregular');
            
            // Extract all tenses
            const tenses = this.extractTenseData($, verb);
            
            // Extract verb type (ar, er, ir)
            let verbType = 'unknown';
            if (verb.endsWith('ar')) verbType = 'ar';
            else if (verb.endsWith('er')) verbType = 'er';
            else if (verb.endsWith('ir')) verbType = 'ir';
            
            return {
                verb,
                english: englishTranslation,
                type: verbType,
                irregular: isIrregular,
                tenses,
                scraped: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Failed to scrape ${verb}: ${error.message}`);
            return null;
        }
    }

    async scrapeAll() {
        try {
            const verbs = await this.getVerbList();
            const results = {
                version: '1.0.0',
                source: 'ellaverbs.com',
                scrapeDate: new Date().toISOString(),
                totalVerbs: verbs.length,
                verbs: {}
            };
            
            let processed = 0;
            let successful = 0;
            
            for (const verb of verbs) {
                const conjugationData = await this.scrapeVerb(verb);
                
                if (conjugationData && Object.keys(conjugationData.tenses).length > 0) {
                    results.verbs[verb] = conjugationData;
                    successful++;
                }
                
                processed++;
                console.log(`Progress: ${processed}/${verbs.length} (${successful} successful)`);
                
                // Rate limiting
                if (processed < verbs.length) {
                    await this.delay(this.requestDelay);
                }
            }
            
            // Save results
            fs.writeFileSync(this.outputFile, JSON.stringify(results, null, 2));
            console.log(`\nScraping complete!`);
            console.log(`Successfully scraped: ${successful}/${verbs.length} verbs`);
            console.log(`Output saved to: ${this.outputFile}`);
            
            // Summary
            const summary = {
                total: results.totalVerbs,
                successful,
                failed: verbs.length - successful,
                irregularVerbs: Object.values(results.verbs).filter(v => v.irregular).length,
                verbTypes: {
                    ar: Object.values(results.verbs).filter(v => v.type === 'ar').length,
                    er: Object.values(results.verbs).filter(v => v.type === 'er').length,
                    ir: Object.values(results.verbs).filter(v => v.type === 'ir').length
                }
            };
            
            console.log('\nSummary:', JSON.stringify(summary, null, 2));
            
        } catch (error) {
            console.error('Scraping failed:', error.message);
            throw error;
        }
    }
}

// CLI usage
if (require.main === module) {
    const scraper = new EllaVerbsScraper();
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const testMode = args.includes('--test');
    const verbCount = args.find(arg => arg.startsWith('--count='));
    
    if (testMode) {
        console.log('Running in test mode (5 verbs only)');
        scraper.scrapeVerb('hablar').then(result => {
            console.log('Test result:', JSON.stringify(result, null, 2));
        });
    } else {
        if (verbCount) {
            const count = parseInt(verbCount.split('=')[1]);
            console.log(`Limiting to ${count} verbs`);
            const originalMethod = scraper.getVerbList;
            scraper.getVerbList = async function() {
                const verbs = await originalMethod.call(this);
                return verbs.slice(0, count);
            };
        }
        
        scraper.scrapeAll().catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
    }
}

module.exports = EllaVerbsScraper;