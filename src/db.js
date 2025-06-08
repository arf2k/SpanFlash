// src/db.js
import Dexie from 'dexie';

export const db = new Dexie('flashcardAppDB');

// Version 1: Your original schema
db.version(1).stores({
  appState: 'id',
  hardWords: '[spanish+english]',
  allWords: '++id, spanish, english'
});

// Version 2: Added 'category' index to allWords
db.version(2).stores({
  appState: 'id', 
  hardWords: '[spanish+english]', 
  allWords: '++id, spanish, english, category' 
}).upgrade(tx => {
  console.log("Upgrading database schema to version 2 (for category index).");
  return tx.table('allWords').count();
});

// Version 3: Added SRS/Leitner data fields to the word objects
db.version(3).stores({
  allWords: '++id, spanish, english, category, dueDate'
}).upgrade(async (tx) => {
    console.log("Upgrading database schema to version 3 for Leitner System fields...");
    const now = Date.now();
    await tx.table('allWords').toCollection().modify(word => {
        if (word.leitnerBox === undefined) word.leitnerBox = 1;
        if (word.lastReviewed === undefined) word.lastReviewed = now;
        if (word.dueDate === undefined) word.dueDate = now;
    });
});

// Version 4: Added leitnerBox index for querying
db.version(4).stores({
    appState: 'id',
    hardWords: '[spanish+english]',
    allWords: '++id, spanish, english, category, dueDate, leitnerBox'
}).upgrade(tx => {
    console.log("Upgrading database to version 4 to add 'leitnerBox' index.");
    return Promise.resolve();
});

// --- NEW: Version 5 to migrate all words to the "Box 0" / Unseen Pool ---
db.version(5).stores({
    // The schema string for the stores does not need to change from version 4
    appState: 'id',
    hardWords: '[spanish+english]',
    allWords: '++id, spanish, english, category, dueDate, leitnerBox'
}).upgrade(async (tx) => {
    // This upgrade function will run once for every user.
    // Its job is to move all existing cards into the "unseen" pool (Box 0).
    console.log("Attempting to upgrade database to version 5 for Leitner Box 0 system...");
    
    await tx.table('allWords').toCollection().modify(word => {
        // Move every card to Box 0 and nullify its due date.
        word.leitnerBox = 0;
        word.dueDate = null;
        // We can leave lastReviewed as is, or nullify it too. Let's nullify for consistency.
        word.lastReviewed = null;
    });

    const count = await tx.table('allWords').count();
    console.log(`Database upgrade to version 5 successful. All ${count} existing words moved to Leitner Box 0.`);
});