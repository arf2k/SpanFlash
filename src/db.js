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
  // Dexie handles adding the index automatically.
  console.log("Upgrading database schema to version 2 (for category index).");
  return tx.table('allWords').count(); // Return a promise to ensure transaction completes
});

// Version 3: Added SRS/Leitner fields to the word objects
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

db.version(4).stores({
    appState: 'id',
    hardWords: '[spanish+english]',
    allWords: '++id, spanish, english, category, dueDate, leitnerBox' 
}).upgrade(tx => {

    console.log("Upgrading database to version 4 to add 'leitnerBox' index to allWords store.");
    return Promise.resolve(); 
});