import Dexie from 'dexie';

export const db = new Dexie('flashcardAppDB');

// Version 1: Your original schema
db.version(1).stores({
  appState: 'id',
  hardWords: '[spanish+english]',
  allWords: '++id, spanish, english'
});

// Version 2: Added 'category' as an index to allWords
db.version(2).stores({
  appState: 'id', 
  hardWords: '[spanish+english]', 
  allWords: '++id, spanish, english, category' 
}).upgrade(tx => {
  console.log("Upgrading database to version 2 (for category index)...");
 
  return tx.table('allWords').count(); 
});


// --- NEW: Version 3 for Leitner System ---
db.version(3).stores({
  allWords: '++id, spanish, english, category, dueDate' // Added dueDate as an index
}).upgrade(async (tx) => {
    console.log("Attempting to upgrade database schema to version 3 for Leitner System...");

    const now = Date.now();

    // Use modify() to update each existing word object
    await tx.table('allWords').toCollection().modify(word => {
        // Only add fields if they don't already exist
        if (word.leitnerBox === undefined) {
            word.leitnerBox = 1; // Start all existing words in Box 1
        }
        if (word.lastReviewed === undefined) {
            word.lastReviewed = now; // Set initial review date to now
        }
        if (word.dueDate === undefined) {
            word.dueDate = now; // Make all existing cards due for review immediately
        }
    });

    const count = await tx.table('allWords').count();
    console.log(`Database upgrade to version 3 successful. All ${count} existing words now have default Leitner fields.`);
});