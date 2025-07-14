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
            `useWordData: Updating to version '${remoteVersion}' while preserving learning progress...`
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
                  // Preserve all existing learning data
                  deduplicatedWords.push({
                    ...newWord,
                    id: existingWord.id,
                    // Preserve existing exposure tracking
                    exposureLevel: existingWord.exposureLevel,
                    timesStudied: existingWord.timesStudied,
                    timesCorrect: existingWord.timesCorrect,
                    lastStudied: existingWord.lastStudied,
                    gamePerformance: existingWord.gamePerformance,
                    // Preserve legacy Leitner data for migration
                    leitnerBox: existingWord.leitnerBox,
                    lastReviewed: existingWord.lastReviewed,
                    dueDate: existingWord.dueDate,
                  });
                  console.log(
                    `Merged existing word: "${newWord.spanish}" (preserving learning progress)`
                  );
                } else {
                  // Use progress data from master file if it exists, otherwise use defaults
                  deduplicatedWords.push({
                    ...newWord,
                    exposureLevel: newWord.exposureLevel || "new",
                    timesStudied: newWord.timesStudied || 0,
                    timesCorrect: newWord.timesCorrect || 0,
                    lastStudied: newWord.lastStudied || null,
                    source: newWord.source || "scraped",
                    gamePerformance: newWord.gamePerformance || {
                      flashcards: { correct: 0, total: 0 },
                      matching: { correct: 0, total: 0 },
                      fillInBlank: { correct: 0, total: 0 },
                      conjugation: { correct: 0, total: 0 },
                    },
                    // Legacy Leitner data for backward compatibility
                    leitnerBox: newWord.leitnerBox || 0,
                    lastReviewed: newWord.lastReviewed || now,
                    dueDate: newWord.dueDate || now,
                  });
                  console.log(
                    `Added word: "${newWord.spanish}" (${
                      newWord.timesStudied ? "with progress" : "new"
                    })`
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

            const wordsWithProgress = deduplicatedWords.filter(
              (w) =>
                (w.exposureLevel && w.exposureLevel !== "new") ||
                w.leitnerBox > 0
            ).length;

            console.log(
              `useWordData: Successfully merged ${deduplicatedWords.length} words (${wordsWithProgress} with existing progress)`
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
          // No longer need initial card - StudyListService handles card selection
          console.log(
            "useWordData: Word data loaded, card selection handled by StudyListService"
          );
          setInitialCard(null);
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
