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
      setInitialCard(null); // Reset on each load sequence

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

        // --- Populate DB if needed ---
        if (!localVersion || remoteVersion !== localVersion) {
          console.log(
            `useWordData: Refreshing DB to version '${remoteVersion}'.`
          );
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
            const wordsWithDefaults = validRemoteWords.map((word) => ({
              ...word,
              leitnerBox: 1,
              lastReviewed: now,
              dueDate: now,
            }));
            await db.transaction("rw", db.allWords, db.appState, async () => {
              await db.allWords.clear();
              await db.allWords.bulkPut(wordsWithDefaults);
              await db.appState.put({
                id: "dataVersion",
                version: remoteVersion,
              });
            });
          } else {
            await db.allWords.clear();
            await db.appState.put({
              id: "dataVersion",
              version: remoteVersion,
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
            console.log("useWordData: No cards due for review right now.");
            setInitialCard(null); 
          }
        }
        const finalVersionState = await db.appState.get("dataVersion");
        setCurrentDataVersion(finalVersionState?.version || null);
      } catch (err) {
        console.error("useWordData: FATAL ERROR during data load:", err);
        setDataError(err.message);
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
