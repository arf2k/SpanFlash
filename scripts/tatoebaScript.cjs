const path = require('path');

const tatoebaServicePath = path.join(__dirname, '..', 'src', 'services', 'tatoebaServices.js');

async function runTests() {
    const { getTatoebaExamples } = await import(tatoebaServicePath); // Use await import()

    const testWords = [
        "casa", "correr", "feliz", "echar de menos", 
        "manzana", "trabajar", "interesante"
    ];

    console.log("--- Testing getTatoebaExamples ---");

    for (const word of testWords) {
        console.log(`\nFetching examples for: "${word}"`);
        try {
            const examples = await getTatoebaExamples(word);
            if (examples && examples.length > 0) {
                console.log(`Found ${examples.length} examples:`);
                examples.forEach((ex, index) => {
                    console.log(`  <span class="math-inline">\{index \+ 1\}\. SPA \(</span>{ex.id_spa}): ${ex.text_spa}`);
                    console.log(`     ENG (${ex.id_eng}): ${ex.text_eng}`);
                });
            } else {
                console.log(`  No examples found or returned for "${word}".`);
            }
        } catch (error) {
            console.error(`  Error fetching examples for "${word}":`, error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 500)); 
    }
    console.log("\n--- Tests Finished ---");
}

runTests().catch(error => {
    console.error("Error in runTests:", error);
});