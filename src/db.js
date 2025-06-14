import Dexie from 'dexie';

export const db = new Dexie('flashcardAppDB');

db.version(1).stores({
  appState: 'id',
  hardWords: '[spanish+english]',
  allWords: '++id, spanish, english'
});

db.version(2).stores({
  appState: 'id', 
  hardWords: '[spanish+english]', 
  allWords: '++id, spanish, english, category' 
}).upgrade(tx => {
  console.log("Upgrading database schema to version 2 (for category index).");
  return tx.table('allWords').count();
});

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
    console.log("Upgrading database to version 4 to add 'leitnerBox' index.");
    return Promise.resolve();
});


db.version(5).stores({
    appState: 'id',
    hardWords: '[spanish+english]',
    allWords: '++id, spanish, english, category, dueDate, leitnerBox'
}).upgrade(async (tx) => {

    
    await tx.table('allWords').toCollection().modify(word => {
     
        word.leitnerBox = 0;
        word.dueDate = null;

        word.lastReviewed = null;
    });

    const count = await tx.table('allWords').count();
    console.log(`Database upgrade to version 5 successful. All ${count} existing words moved to Leitner Box 0.`);
});
db.version(6).stores({
    appState: 'id',
    hardWords: '[spanish+english]',
    allWords: '++id, spanish, english, category, dueDate, leitnerBox',
    dailyStats: 'date' 
});