import { useState, useEffect } from "react";
import { db } from "../db";

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function useWordData() {
  const [wordList, setWordList] = useState([]);
  const [initialCard, setInitialCard] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [currentDataVersion, setCurrentDataVersion] = useState(null);

  useEffect(() => {
    const loadWordDataAsync = async () => {
      console.log("useWordData: Starting data load sequence...");
      setIsLoadingData(true);
      setDataError(null);
      setInitialCard(null);

      try {
        const response = await fetch("/scrapedSpan411.json");
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const remoteJsonData = await response.json();
        if (
          typeof remoteJsonData.version !== "string" ||
          !Array.isArray(remoteJsonData.words)
        ) {
          throw new Error("Fetched JSON data has an invalid format.");
        }

        const remoteVersion = remoteJsonData.version;
        const localDataVersionState = await db.appState.get("dataVersion");
        const localVersion = localDataVersionState?.version || null;

        const updateInProgress = await db.appState.get("dataUpdateInProgress");
        if (updateInProgress?.value === true) {
          console.log("Data update already in progress, skipping...");
          const finalWords = await db.allWords.toArray();
          setWordList(finalWords);
          setIsLoadingData(false);
          return;
        }

        if (!localVersion || remoteVersion !== localVersion) {
          console.log(
            `useWordData: Smart merging to version '${remoteVersion}' while preserving Leitner progress...`
          );

          await db.appState.put({ id: "dataUpdateInProgress", value: true });

          const validRemoteWords = remoteJsonData.words.filter(
            (item) =>
              item &&
              typeof item.spanish === "string" &&
              item.spanish.trim() &&
              typeof item.english === "string" &&
              item.english.trim()
          );

          if (validRemoteWords.length > 0) {
            const now = Date.now();

            const existingWords = await db.allWords.toArray();
            const existingWordsMap = new Map();

            existingWords.forEach((word) => {
              const key = `${word.spanish.toLowerCase().trim()}|${word.english
                .toLowerCase()
                .trim()}`;
              existingWordsMap.set(key, word);
            });

            const deduplicatedWords = [];
            const seenCombinations = new Set();

            validRemoteWords.forEach((newWord) => {
              const key = `${newWord.spanish
                .toLowerCase()
                .trim()}|${newWord.english.toLowerCase().trim()}`;

              if (!seenCombinations.has(key)) {
                seenCombinations.add(key);

                const existingWord = existingWordsMap.get(key);

                if (existingWord) {
                  deduplicatedWords.push({
                    ...newWord,
                    id: existingWord.id,
                    leitnerBox: existingWord.leitnerBox,
                    lastReviewed: existingWord.lastReviewed,
                    dueDate: existingWord.dueDate,
                  });
                  console.log(
                    `Merged existing word: "${newWord.spanish}" (preserving Box ${existingWord.leitnerBox})`
                  );
                } else {
                  deduplicatedWords.push({
                    ...newWord,
                    leitnerBox: 0,
                    lastReviewed: now,
                    dueDate: now,
                  });
                  console.log(
                    `Added new word: "${newWord.spanish}" (starting in Box 0)`
                  );
                }
              }
            });

            const newWordsKeys = new Set(
              validRemoteWords.map(
                (w) =>
                  `${w.spanish.toLowerCase().trim()}|${w.english
                    .toLowerCase()
                    .trim()}`
              )
            );

            const wordsToKeep = existingWords.filter((existingWord) => {
              const key = `${existingWord.spanish
                .toLowerCase()
                .trim()}|${existingWord.english.toLowerCase().trim()}`;
              const keepIt = newWordsKeys.has(key);
              if (!keepIt) {
                console.log(
                  `Word removed from master list: "${existingWord.spanish}"`
                );
              }
              return keepIt;
            });

            await db.transaction("rw", db.allWords, db.appState, async () => {
              await db.allWords.clear();
              await db.allWords.bulkPut(deduplicatedWords);
              await db.appState.put({
                id: "dataVersion",
                version: remoteVersion,
              });
              await db.appState.delete("dataUpdateInProgress");
            });

            console.log(
              `useWordData: Successfully merged ${
                deduplicatedWords.length
              } words (${
                deduplicatedWords.filter((w) => w.leitnerBox > 0).length
              } with preserved progress)`
            );
          } else {
            await db.transaction("rw", db.allWords, db.appState, async () => {
              await db.allWords.clear();
              await db.appState.put({
                id: "dataVersion",
                version: remoteVersion,
              });
              await db.appState.delete("dataUpdateInProgress");
            });
            setDataError("The new word list contained no valid words.");
          }
        } else {
          console.log(
            `useWordData: Data version '${localVersion}' is up to date.`
          );
        }

        const finalWords = await db.allWords.toArray();
        setWordList(finalWords);

        if (finalWords.length > 0) {
          const now = Date.now();
          const dueCards = await db.allWords
            .where("dueDate")
            .belowOrEqual(now)
            .toArray();

          console.log(
            `useWordData: Found ${dueCards.length} cards due for review.`
          );

          if (dueCards.length > 0) {
            const firstCard = shuffleArray(dueCards)[0];
            console.log(
              `useWordData: Setting initial card to: "${firstCard.spanish}"`
            );
            setInitialCard(firstCard);
          } else {
            const newCards = await db.allWords
              .where("leitnerBox")
              .equals(0)
              .toArray();
            if (newCards.length > 0) {
              const firstNewCard = shuffleArray(newCards)[0];
              console.log(
                `useWordData: No due cards, introducing new card: "${firstNewCard.spanish}"`
              );
              setInitialCard(firstNewCard);
            } else {
              console.log("useWordData: No cards due for review right now.");
              setInitialCard(null);
            }
          }
        }

        const finalVersionState = await db.appState.get("dataVersion");
        setCurrentDataVersion(finalVersionState?.version || null);
      } catch (err) {
        console.error("useWordData: FATAL ERROR during data load:", err);
        setDataError(err.message);
        await db.appState.delete("dataUpdateInProgress").catch(() => {});
      } finally {
        setIsLoadingData(false);
        console.log("useWordData: Word data loading sequence finished.");
      }
    };

    loadWordDataAsync();
  }, []);

  return {
    wordList,
    initialCard,
    isLoadingData,
    dataError,
    currentDataVersion,
    setWordList,
  };
}
