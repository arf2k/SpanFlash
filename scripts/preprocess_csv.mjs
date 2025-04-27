// scripts/preprocess_csv.js

import fs from 'fs'; // Use file system module
import path from 'path'; // Use path module for handling file paths
import csv from 'csv-parser'; // Use the installed csv-parser library
// --- Configuration ---
const csvFilePath = path.join(process.cwd(), 'scripts', 'largeSpanList.csv'); // Path to your input CSV **<-- RENAME if needed**
const outputDir = path.join(process.cwd(), 'public', 'data_chunks');       // Output directory for JSON chunks
const rowsPerChunk = 5000; // Number of rows (pairs) per JSON file          **<-- ADJUST if desired**
// --- End Configuration ---

let currentRow = 0;
let chunkNumber = 1;
let chunkData = []; // Array to hold rows for the current chunk

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
    console.log(`Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
} else {
    console.log(`Output directory already exists: ${outputDir}`);
}

console.log(`Starting processing of: ${csvFilePath}`);

// Create a readable stream from the CSV file
fs.createReadStream(csvFilePath)
    .pipe(csv({
        // Assuming NO headers in your CSV based on the sample.
        // If your *actual* CSV has headers (like 'English', 'Spanish'), uncomment the next line:
        // headers: ['english', 'spanish'],
        // If no headers, csv-parser outputs an array per row. We'll handle that.
        headers: false // Explicitly state there are no headers
     }))
    .on('data', (row) => {
        currentRow++;
        process.stdout.write(`Processing row: ${currentRow}\r`); // Show progress

        // Extract English and Spanish data.
        // Assumes English is the first column (index 0) and Spanish is the second (index 1).
        const english = row['0']?.trim(); // Access by index '0' when headers: false
        const spanish = row['1']?.trim(); // Access by index '1'

        // Basic validation - skip row if either part is empty
        if (!english || !spanish) {
            console.warn(`\nSkipping incomplete row ${currentRow}:`, row);
            return; // Skip this row
        }

        // Add the processed row to the current chunk
        chunkData.push({
            // You can add an ID if you want, but it's optional
            // id: currentRow,
            english: english,
            spanish: spanish
        });

        // If the chunk is full, write it to a file
        if (chunkData.length >= rowsPerChunk) {
            writeChunkToFile(chunkData, chunkNumber);
            chunkNumber++; // Increment for the next file name
            chunkData = []; // Reset chunk data for the next chunk
        }
    })
    .on('end', () => {
        // Write any remaining data in the last chunk
        if (chunkData.length > 0) {
            writeChunkToFile(chunkData, chunkNumber);
        }
        process.stdout.write("\n"); // Move cursor to next line after progress indicator
        console.log(`\nFinished processing ${currentRow} rows.`);
        console.log(`Total chunk files written: ${chunkNumber}`);
        console.log(`Output files are located in: ${outputDir}`);
    })
    .on('error', (error) => {
        console.error('\nError during CSV processing:', error);
    });

// --- Helper function to write chunk data to a JSON file ---
function writeChunkToFile(data, number) {
    const outputFilePath = path.join(outputDir, `chunk_${number}.json`);
    console.log(`\nWriting chunk ${number} (${data.length} rows) to ${outputFilePath}`);
    try {
        fs.writeFileSync(outputFilePath, JSON.stringify(data, null, 2)); // Pretty print JSON
    } catch (err) {
        console.error(`\nError writing file ${outputFilePath}:`, err);
    }
}