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

    getFallbackVerbList() {
        // Minimal essential list if all else fails
        console.log('Using minimal essential verb list...');
        return [
            'ser', 'estar', 'tener', 'hacer', 'ir', 'haber', 'decir', 'ver', 'dar', 'saber',
            'querer', 'poder', 'venir', 'llegar', 'pasar', 'deber', 'poner', 'parecer', 'quedar', 'creer',
            'hablar', 'llevar', 'dejar', 'seguir', 'encontrar', 'llamar', 'volver', 'empezar', 'conocer', 'vivir'
        ];
    }
    
    getFallbackVerbList() {
        // If all web scraping fails, use a curated essential list
        console.log('Using fallback essential verb list...');
        return [
            'ser', 'estar', 'tener', 'hacer', 'ir', 'haber', 'decir', 'ver', 'dar', 'saber',
            'querer', 'poder', 'venir', 'llegar', 'pasar', 'deber', 'poner', 'parecer', 'quedar', 'creer',
            'hablar', 'llevar', 'dejar', 'seguir', 'encontrar', 'llamar', 'volver', 'empezar', 'conocer', 'vivir',
            'sentir', 'tratar', 'mirar', 'contar', 'esperar', 'buscar', 'existir', 'entrar', 'trabajar', 'escribir',
            'perder', 'producir', 'ocurrir', 'entender', 'pedir', 'recibir', 'recordar', 'terminar', 'permitir', 'aparecer',
            'conseguir', 'comenzar', 'servir', 'sacar', 'necesitar', 'mantener', 'resultar', 'leer', 'caer', 'cambiar',
            'presentar', 'crear', 'abrir', 'considerar', 'oír', 'acabar', 'convertir', 'ganar', 'formar', 'traer',
            'partir', 'morir', 'aceptar', 'realizar', 'suponer', 'comprender', 'lograr', 'explicar', 'preguntar', 'tocar',
            'reconocer', 'estudiar', 'alcanzar', 'nacer', 'dirigir', 'correr', 'utilizar', 'pagar', 'ayudar', 'gustar',
            'jugar', 'escuchar', 'cumplir', 'ofrecer', 'descubrir', 'levantar', 'intentar', 'usar', 'decidir', 'acordar'
        ];
    }
    
    async getVerbList() {
        console.log('Using curated frequency-based Spanish verb list...');
        
        // Based on CORPES XXI (authoritative Spanish language corpus) + essential learning verbs
        // Organized by frequency and importance for learners
        const verbs = [
            // Top 100 Most Frequent (CORPES XXI)
            'ser', 'estar', 'tener', 'hacer', 'poder', 'decir', 'haber', 'ir', 'dar', 'ver', 
            'saber', 'pasar', 'deber', 'querer', 'llegar', 'dejar', 'llevar', 'encontrar', 'seguir', 'poner',
            'quedarse', 'parecer', 'hablar', 'pensar', 'volver', 'conocer', 'salir', 'realizar', 'tomar', 'tratar',
            'contar', 'llamarse', 'venir', 'mirar', 'presentar', 'permitir', 'esperar', 'sentir', 'vivir', 'buscar',
            'creer', 'crear', 'perder', 'existir', 'considerar', 'abrir', 'trabajar', 'recibir', 'mantener', 'explicar',
            'lograr', 'empezar', 'recordar', 'comenzar', 'pedir', 'preguntar', 'producir', 'convertir', 'entrar', 'mostrar',
            'señalar', 'escribir', 'utilizar', 'entender', 'terminar', 'ganar', 'incluir', 'morir', 'asegurar', 'ocurrir',
            'ofrecer', 'jugar', 'gustar', 'escuchar', 'sentar', 'cambiar', 'aparecer', 'acabar', 'decidir', 'resultar',
            'caer', 'desarrollar', 'necesitar', 'sacar', 'establecer', 'conseguir', 'indicar', 'formar', 'reconocer', 'dirigir',
            'servir', 'alcanzar', 'intentar', 'cumplir', 'leer', 'obtener', 'ayudar', 'usar', 'observar', 'responder',
            
            // Essential -AR verbs for learning
            'caminar', 'estudiar', 'comprar', 'cocinar', 'bailar', 'cantar', 'lavar', 'viajar', 'amar', 'odiar',
            'nadar', 'pintar', 'cenar', 'desayunar', 'despertar', 'acostarse', 'levantarse', 'bañarse', 'preparar', 'limpiar',
            'manejar', 'matar', 'saltar', 'cortar', 'tirar', 'tocar', 'cerrar', 'abrazar', 'besar', 'llorar',
            'descansar', 'relajarse', 'preocuparse', 'enojarse', 'alegrarse', 'casarse', 'divorciarse', 'mudarse', 'quedarse', 'olvidarse',
            'acordarse', 'fijarse', 'enamorarse', 'separarse', 'sentarse', 'pararse', 'acercarse', 'alejarse', 'calmarse', 'enfermarse',
            
            // Essential -ER verbs for learning  
            'comer', 'beber', 'correr', 'meter', 'romper', 'aprender', 'comprender', 'vender', 'coser', 'lamer',
            'barrer', 'toser', 'deber', 'temer', 'nacer', 'crecer', 'mover', 'resolver', 'devolver', 'envolver',
            'absorber', 'sorprender', 'responder', 'esconder', 'defender', 'ofender', 'encender', 'atender', 'extender', 'pretender',
            'depender', 'suspender', 'detener', 'mantener', 'contener', 'sostener', 'retener', 'obtener', 'entretener', 'convencer',
            
            // Essential -IR verbs for learning
            'vivir', 'escribir', 'subir', 'abrir', 'recibir', 'decidir', 'dividir', 'describir', 'descubrir', 'cubrir',
            'partir', 'repartir', 'admitir', 'permitir', 'omitir', 'transmitir', 'emitir', 'interrumpir', 'comprimir', 'imprimir',
            'existir', 'persistir', 'resistir', 'insistir', 'consistir', 'asistir', 'discutir', 'distribuir', 'constituir', 'sustituir',
            'incluir', 'excluir', 'concluir', 'influir', 'destruir', 'construir', 'instruir', 'contribuir', 'atribuir', 'distribuir',
            
            // Important Irregular Verbs
            'andar', 'caber', 'conducir', 'oír', 'huir', 'caer', 'traer', 'construir', 'destruir', 'leer',
            'creer', 'poseer', 'proveer', 'dormir', 'morir', 'sentir', 'mentir', 'preferir', 'herir', 'divertir',
            'convertir', 'advertir', 'sugerir', 'transferir', 'interferir', 'diferir', 'inferir', 'referir', 'conferir', 'adquirir',
            'medir', 'pedir', 'repetir', 'competir', 'servir', 'vestir', 'seguir', 'perseguir', 'conseguir', 'elegir',
            'corregir', 'dirigir', 'exigir', 'proteger', 'recoger', 'escoger', 'coger', 'surgir', 'sumergir', 'converger',
            
            // Stem-changing verbs (essential patterns)
            'cerrar', 'despertar', 'empezar', 'pensar', 'sentar', 'acertar', 'apretar', 'atravesar', 'calentar', 'confesar',
            'negar', 'regar', 'fregar', 'plegar', 'cegar', 'segar', 'tropezar', 'forzar', 'esforzar', 'almorzar',
            'contar', 'encontrar', 'mostrar', 'sonar', 'soñar', 'volar', 'recordar', 'acordar', 'colgar', 'soltar',
            'probar', 'aprobar', 'comprobar', 'rodar', 'renovar', 'innovar', 'costar', 'acostar', 'apostar', 'tostar',
            'perder', 'entender', 'tender', 'defender', 'ofender', 'encender', 'extender', 'atender', 'pretender', 'descender',
            'morder', 'torcer', 'retorcer', 'cocer', 'escocer', 'mover', 'remover', 'promover', 'conmover', 'llover',
            'doler', 'volver', 'devolver', 'resolver', 'absolver', 'disolver', 'envolver', 'revolver', 'desenvolver', 'involucrar',
            
            // Common reflexive verbs  
            'levantarse', 'acostarse', 'despertarse', 'vestirse', 'bañarse', 'ducharse', 'peinarse', 'afeitarse', 'lavarse', 'secarse',
            'maquillarse', 'cepillarse', 'llamarse', 'quedarse', 'irse', 'marcharse', 'mudarse', 'casarse', 'divorciarse', 'separarse',
            'enamorarse', 'comprometerse', 'despedirse', 'saludarse', 'conocerse', 'verse', 'encontrarse', 'reunirse', 'juntarse', 'abrazarse',
            'besarse', 'pelearse', 'reconciliarse', 'enfadarse', 'enojarse', 'alegrarse', 'preocuparse', 'tranquilizarse', 'relajarse', 'calmarse',
            'enfermarse', 'curarse', 'lastimarse', 'cortarse', 'quemarse', 'caerse', 'levantarse', 'sentarse', 'pararse', 'acercarse',
            
            // Professional/Academic verbs
            'estudiar', 'enseñar', 'aprender', 'explicar', 'entender', 'comprender', 'memorizar', 'recordar', 'olvidar', 'repasar',
            'practicar', 'ejercitar', 'entrenar', 'mejorar', 'progresar', 'avanzar', 'retroceder', 'fallar', 'aprobar', 'suspender',
            'graduar', 'titular', 'especializar', 'capacitar', 'formar', 'educar', 'instruir', 'adiestrar', 'orientar', 'guiar',
            'trabajar', 'laborar', 'emplearse', 'contratar', 'despedir', 'renunciar', 'jubilarse', 'descansar', 'colaborar', 'cooperar',
            
            // Technology/Modern verbs
            'conectar', 'desconectar', 'encender', 'apagar', 'funcionar', 'instalar', 'desinstalar', 'actualizar', 'descargar', 'subir',
            'navegar', 'buscar', 'encontrar', 'googlear', 'chatear', 'textear', 'llamar', 'videollamar', 'grabar', 'fotografiar',
            'filmar', 'editar', 'publicar', 'compartir', 'comentar', 'gustar', 'seguir', 'bloquear', 'reportar', 'eliminar'
        ];
        
        // Remove duplicates and return
        const uniqueVerbs = [...new Set(verbs)];
        console.log(`Curated list contains ${uniqueVerbs.length} essential Spanish verbs`);
        console.log('Sources: CORPES XXI corpus + Spanish learning essentials');
        
        return uniqueVerbs;
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