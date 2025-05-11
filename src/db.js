// src/db.js
import Dexie from 'dexie';

export const db = new Dexie('flashcardAppDB');

// Version 1: Your original schema
db.version(1).stores({
  appState: 'id',
  hardWords: '[spanish+english]',
  allWords: '++id, spanish, english'
});

// Version 2: Added 'category' index to allWords, 
// and acknowledges new (unindexed) fields like notes, synonyms_spanish, synonyms_english
// will be part of the objects.
db.version(2).stores({
  appState: 'id', // No change from v1, but good to list for clarity of v2 schema
  hardWords: '[spanish+english]', 
  allWords: '++id, spanish, english, category' // 'category' added as an indexed field
}).upgrade(tx => {
  console.log("Upgrading database to version 2: 'category' index added to allWords store.");

  return tx.table('allWords').toCollection().count().then(count => {
    console.log(`Database upgrade to version 2 successful. 'allWords' store now includes 'category' index. There are ${count} items in allWords.`);
  }).catch(err => {
    console.error("Error during database upgrade to version 2:", err);
  });
});

