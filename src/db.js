import Dexie from 'dexie';

export const db = new Dexie('flashcardAppDB');

db.version(1).stores({
  appState: 'id', // Primary key is 'key' (e.g., 'score')
  hardWords: '[spanish+english]', // Compound primary key using spanish and english fields
  // Add other stores here if needed in the future
});

