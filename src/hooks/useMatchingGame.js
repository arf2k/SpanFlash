import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "../db";
import { shuffleArray, updateWordLeitnerData } from "../utils/gameUtils";

export function useMatchingGame(fullWordList = [], numPairsToDisplay = 6) {
  const [activeWordPairs, setActiveWordPairs] = useState([]);
  const [spanishOptions, setSpanishOptions] = useState([]);
  const [englishOptions, setEnglishOptions] = useState([]);

  const [selectedSpanish, setSelectedSpanish] = useState(null);
  const [selectedEnglish, setSelectedEnglish] = useState(null);

  const [incorrectAttempt, setIncorrectAttempt] = useState({
    spanishId: null,
    englishId: null,
  });

  const [gameScore, setGameScore] = useState(0);
  const [sessionUsedWordIds, setSessionUsedWordIds] = useState(new Set());

  const [lastUpdatedWords, setLastUpdatedWords] = useState([]);

  const initializedForCurrentListRef = useRef(false);
  const incorrectTimeoutRef = useRef(null);
  const autoAdvanceTimeoutRef = useRef(null);

  const pickNewWords = useCallback(
    (count, excludeIds = new Set()) => {
      const newWords = [];
      const sourceList = Array.isArray(fullWordList) ? fullWordList : [];

      const availablePool = sourceList.filter(
        (word) => !excludeIds.has(word.id)
      );
      const shuffledPool = shuffleArray(availablePool);

      for (const word of shuffledPool) {
        if (newWords.length >= count) break;
        newWords.push(word);
      }

      if (newWords.length < count && sourceList.length >= count) {
        console.warn(
          `useMatchingGame: pickNewWords found only ${newWords.length} words after exclusions (needed ${count}). Pool size: ${availablePool.length}. Exclusions: ${excludeIds.size}`
        );
      }
      return newWords;
    },
    [fullWordList]
  );

  const initializeNewRound = useCallback(
    (isNewGameSession = false) => {
      isNewGameSession;
      setSelectedSpanish(null);
      setSelectedEnglish(null);
      setIncorrectAttempt({ spanishId: null, englishId: null });

      let exclusionsForPicking = sessionUsedWordIds;
      if (isNewGameSession) {
        setGameScore(0);
        const newSessionIdSet = new Set();
        setSessionUsedWordIds(newSessionIdSet);
        exclusionsForPicking = newSessionIdSet;
      }

      let newPairs = pickNewWords(numPairsToDisplay, exclusionsForPicking);

      if (
        newPairs.length < numPairsToDisplay &&
        fullWordList.length >= numPairsToDisplay
      ) {
        if (!isNewGameSession) {
          newPairs = pickNewWords(
            numPairsToDisplay,
            new Set(activeWordPairs.map((p) => p.id))
          );
        } else {
          console.warn(
            `useMatchingGame: (New Round) Not enough unique words. List may be small or nearly exhausted for session.`
          );
        }
      }

      if (newPairs.length === 0 && fullWordList.length > 0) {
        setActiveWordPairs([]);
        setSpanishOptions([]);
        setEnglishOptions([]);
        return false;
      }
      if (newPairs.length > 0 && newPairs.length < numPairsToDisplay) {
        console.warn(
          `useMatchingGame: Round will have ${newPairs.length} pairs (less than ${numPairsToDisplay} requested).`
        );
      }

      setActiveWordPairs(newPairs);
      setSpanishOptions(
        shuffleArray(
          newPairs.map((p) => ({
            id: p.id,
            text: p.spanish,
            type: "spanish",
            matched: false,
          }))
        )
      );
      setEnglishOptions(
        shuffleArray(
          newPairs.map((p) => ({
            id: p.id,
            text: p.english,
            type: "english",
            matched: false,
          }))
        )
      );
      console.log(
        "useMatchingGame: New round initialized with pairs:",
        newPairs
      );
      return true;
    },
    [fullWordList, numPairsToDisplay, pickNewWords]
  );

  useEffect(() => {
    if (
      fullWordList &&
      fullWordList.length > 0 &&
      fullWordList.length >= numPairsToDisplay
    ) {
      if (!initializedForCurrentListRef.current) {
        initializeNewRound(true);
        initializedForCurrentListRef.current = true;
      }
    } else {
      setActiveWordPairs([]);
      setSpanishOptions([]);
      setEnglishOptions([]);
      setGameScore(0);
      setSessionUsedWordIds(new Set());
      initializedForCurrentListRef.current = false;
    }
  }, [fullWordList, numPairsToDisplay, initializeNewRound]);

  useEffect(() => {
    initializedForCurrentListRef.current = false;
  }, [fullWordList]);

  const attemptMatch = useCallback(async () => {
    if (selectedSpanish && selectedEnglish) {
      const originalPairForSpanish = activeWordPairs.find(
        (p) => p.id === selectedSpanish.id
      );
      let isCorrectMatch = false;

      if (
        originalPairForSpanish &&
        originalPairForSpanish.id === selectedEnglish.id
      ) {
        isCorrectMatch = true;
      }

      if (originalPairForSpanish) {
        const updatedWord = await updateWordLeitnerData(
          originalPairForSpanish,
          isCorrectMatch,
          "Matching"
        );
        setLastUpdatedWords((prev) => [...prev, updatedWord]);
      }

      if (isCorrectMatch) {
        console.log("useMatchingGame: Correct Match!", originalPairForSpanish);
        setGameScore((prev) => prev + 1);

        const newMatchedIdsInSession = new Set(sessionUsedWordIds).add(
          originalPairForSpanish.id
        );
        setSessionUsedWordIds(newMatchedIdsInSession);

        setSpanishOptions((prevOpts) =>
          prevOpts.map((opt) =>
            opt.id === selectedSpanish.id ? { ...opt, matched: true } : opt
          )
        );
        setEnglishOptions((prevOpts) =>
          prevOpts.map((opt) =>
            opt.id === selectedEnglish.id ? { ...opt, matched: true } : opt
          )
        );

        console.log(
          "useMatchingGame: Pair matched. Items will remain visually matched."
        );

        const allCurrentlyOnBoardAreMatched =
          activeWordPairs.length > 0 &&
          activeWordPairs.every((ap) => newMatchedIdsInSession.has(ap.id));

        if (allCurrentlyOnBoardAreMatched) {
          console.log(
            "useMatchingGame: All pairs on current board fully matched! Auto-advancing to next set..."
          );
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            initializeNewRound(false);
          }, 1200);
        }
      } else {
        console.log("useMatchingGame: Incorrect Match.");
        setIncorrectAttempt({
          spanishId: selectedSpanish.id,
          englishId: selectedEnglish.id,
        });
        setGameScore(0);
        incorrectTimeoutRef.current = setTimeout(() => {
          setIncorrectAttempt({ spanishId: null, englishId: null });
        }, 1000);
      }
      setSelectedSpanish(null);
      setSelectedEnglish(null);
    }
  }, [selectedSpanish, selectedEnglish, activeWordPairs, sessionUsedWordIds]);

  const handleSpanishSelection = useCallback(
    (spanishItem) => {
      if (spanishItem.matched) return;
      if (selectedSpanish && selectedSpanish.id === spanishItem.id) {
        setSelectedSpanish(null);
      } else {
        setSelectedSpanish(spanishItem);
      }
    },
    [selectedSpanish]
  );

  const handleEnglishSelection = useCallback(
    (englishItem) => {
      if (englishItem.matched) return;
      if (selectedEnglish && selectedEnglish.id === englishItem.id) {
        setSelectedEnglish(null);
      } else {
        setSelectedEnglish(englishItem);
      }
    },
    [selectedEnglish]
  );

  useEffect(() => {
    if (selectedSpanish && selectedEnglish) {
      attemptMatch();
    }
  }, [selectedSpanish, selectedEnglish, attemptMatch]);

  const clearLastUpdatedWords = useCallback(() => {
    setLastUpdatedWords([]);
  }, []);

  useEffect(() => {
    return () => {
      if (incorrectTimeoutRef.current) {
        clearTimeout(incorrectTimeoutRef.current);
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  return {
    spanishOptions,
    englishOptions,
    selectedSpanish,
    selectedEnglish,
    gameScore,
    handleSpanishSelection,
    handleEnglishSelection,
    initializeNewRound,
    activePairCount: activeWordPairs.length,
    allWordsCount: fullWordList.length,
    incorrectAttempt,
    lastUpdatedWords,
    clearLastUpdatedWords,
  };
}
