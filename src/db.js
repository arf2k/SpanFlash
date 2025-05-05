import Dexie from 'dexie';

export const db = new Dexie('flashcardAppDB');

db.version(1).stores({
  appState: 'id', // Primary key 'id' (e.g., 'userScore')

  hardWords: '[spanish+english]',

  // ================================================
  // NEW store for the entire word list
  // ++id: Auto-incrementing primary key
  // spanish, english: Properties of the objects we will store
  // ================================================
  allWords: '++id, spanish, english'

});

