import Dexie from "dexie";

export const db = new Dexie("flashcardAppDB");

db.version(1).stores({
  appState: "id",
  hardWords: "[spanish+english]",
  allWords: "++id, spanish, english",
});

db.version(2)
  .stores({
    appState: "id",
    hardWords: "[spanish+english]",
    allWords: "++id, spanish, english, category",
  })
  .upgrade((tx) => {
    console.log(
      "Upgrading database to version 2: 'category' index added to allWords store."
    );

    return tx
      .table("allWords")
      .toCollection()
      .count()
      .then((count) => {
        console.log(
          `Database upgrade to version 2 successful. 'allWords' store now includes 'category' index. There are ${count} items in allWords.`
        );
      })
      .catch((err) => {
        console.error("Error during database upgrade to version 2:", err);
      });
  });
