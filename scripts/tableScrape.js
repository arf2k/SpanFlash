const mainContentSelector = 'div.RichTextstyle__StyledRichText-sc-1d1x1ie-0.gyeXSA';
const tableRowSelector = 'tbody tr'; 

const englishCellIndex = 0;
const spanishCellIndex = 1;

const wordData = []; 
const mainDiv = document.querySelector(mainContentSelector);

if (mainDiv) {
     const tables = mainDiv.querySelectorAll('table');
     console.log(`Found ${tables.length} table(s) to process.`);

     tables.forEach((table, tableIndex) => {
         console.log(`Processing table #${tableIndex + 1}...`);
         const rows = table.querySelectorAll(tableRowSelector);
         console.log(`  Found ${rows.length} rows in tbody of table #${tableIndex + 1}.`);

         rows.forEach((row, rowIndex) => {
             const cells = row.querySelectorAll('td'); 
             
             if (cells.length > Math.max(englishCellIndex, spanishCellIndex)) {
                 const englishWord = cells[englishCellIndex].innerText.trim();
                 const spanishWord = cells[spanishCellIndex].innerText.trim();

                 // Skip if it looks like a header row
                 if (englishWord.toLowerCase() === 'english' && 
                     spanishWord.toLowerCase() === 'spanish') {
                     console.log(`  Skipping potential header row in table #${tableIndex + 1}, row #${rowIndex + 1}: "${englishWord}" | "${spanishWord}"`);
                 } 
                 // Ensure both words are non-empty after trimming (and not a header)
                 else if (englishWord && spanishWord) {
                     wordData.push({
                         english: englishWord,
                         spanish: spanishWord
                     });
                 } else {
                     // Optional: log rows that had text but one part was empty (and not a header)
                     // console.warn(`  Skipping row in table #${tableIndex + 1}, row #${rowIndex + 1} due to empty field after trim (E: "${englishWord}", S: "${spanishWord}")`);
                 }
             } else {
                 // Optional: log rows with not enough cells
                 // console.warn(`  Skipping row in table #${tableIndex + 1}, row #${rowIndex + 1} due to not enough cells (${cells.length}).`);
             }
         });
     });
} else {
    console.log(`Main content div ("${mainContentSelector}") not found.`);
}

// Output the final cleaned data
console.log(`\nCollected ${wordData.length} valid word pairs:`);
if (wordData.length > 0) {
    console.log(JSON.stringify(wordData, null, 2));
} else {
    console.log("[] (No valid data extracted after filtering.)");
}