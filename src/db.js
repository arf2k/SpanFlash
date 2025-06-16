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
});db.version(7).stores({
    appState: 'id',
    hardWords: '[spanish+english]',
    allWords: '++id, spanish, english, category, dueDate, leitnerBox, exposureLevel',
    dailyStats: 'date' 
}).upgrade(async (tx) => {
    console.log("Upgrading database to version 7: Adding exposure tracking system...");
    
    await tx.table('allWords').toCollection().modify(word => {
        // Convert Leitner box to exposure level
        if (word.leitnerBox === 0) word.exposureLevel = 'new';
        else if (word.leitnerBox <= 2) word.exposureLevel = 'learning';
        else if (word.leitnerBox <= 4) word.exposureLevel = 'familiar';
        else word.exposureLevel = 'mastered';
        
        // Add exposure tracking fields
        word.timesStudied = Math.max(word.leitnerBox || 0, 0);
        word.timesCorrect = Math.max(Math.floor((word.leitnerBox || 0) * 0.7), 0);
        word.lastStudied = word.lastReviewed || null;
        word.source = 'scraped';
        word.gamePerformance = {
            flashcards: { correct: 0, total: 0 },
            matching: { correct: 0, total: 0 },
            fillInBlank: { correct: 0, total: 0 },
            conjugation: { correct: 0, total: 0 }
        };
    });

    const count = await tx.table('allWords').count();
    console.log(`Database upgrade to version 7 successful. Migrated ${count} words to exposure system.`);
});
db.version(8).stores({
    appState: 'id',
    hardWords: '[spanish+english]',
    allWords: '++id, spanish, english, category, dueDate, leitnerBox, exposureLevel',
    dailyStats: 'date' 
}).upgrade(async (tx) => {
    console.log("Fixing exposure level access - making all vocabulary available...");
    
    await tx.table('allWords').toCollection().modify(word => {
        const box = word.leitnerBox || 0;
        
        if (box === 0) {
            word.exposureLevel = 'new';
        } else {
            // Everything else becomes 'learning' - accessible to all games
            word.exposureLevel = 'learning';
        }
        
        // Conservative exposure tracking
        word.timesStudied = Math.max(box, 0);
        word.timesCorrect = Math.max(Math.floor(box * 0.8), 0);
    });

    const count = await tx.table('allWords').count();
    console.log(`Fixed access for ${count} words - full vocabulary now available`);
});

