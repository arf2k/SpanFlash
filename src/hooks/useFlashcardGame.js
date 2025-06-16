import { useState, useCallback, useEffect } from "react";
import { StudyListService } from "../services/studyListService";
import { updateWordExposure } from "../utils/gameUtils";

export function useFlashcardGame(
  wordList = [],
  initialCard = null,
  recordAnswer = null
) {
  const [currentPair, setCurrentPair] = useState(initialCard);
  const [languageDirection, setLanguageDirection] = useState("spa-eng");
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
  const [feedbackSignal, setFeedbackSignal] = useState(null);
  const [gameError, setGameError] = useState(null);
  const [lastReviewedCard, setLastReviewedCard] = useState(null);
  
  // NEW: Session tracking to prevent repeats
  const [sessionShownIds, setSessionShownIds] = useState(new Set());
  const [sessionWordPool, setSessionWordPool] = useState([]);

  useEffect(() => {
    setCurrentPair(initialCard);
  }, [initialCard]);

  const selectNewPairCard = useCallback(async () => {
    console.log("useFlashcardGame: Selecting next card...");
    setGameError(null);
    setShowFeedback(false);
    setFeedbackSignal(null);
    setLastCorrectAnswer("");

    if (!wordList || wordList.length === 0) {
      setGameError("The current word list is empty.");
      setCurrentPair(null);
      return;
    }

    try {
      // If we've shown all words in the pool, get a new pool
      if (sessionWordPool.length === 0 || 
          sessionWordPool.every(w => sessionShownIds.has(w.id))) {
        
        console.log('Fetching new word pool...');
        const listService = new StudyListService(wordList);
        
        // Use the exclusion method to avoid repeats
        const flashcardList = listService.generateFlashcardsListWithExclusions(
          200, // Large pool
          sessionShownIds
        );
        
        if (!flashcardList.words || flashcardList.words.length === 0) {
          // All words seen - reset session
          console.log('All words seen this session, resetting...');
          setSessionShownIds(new Set());
          const freshList = listService.generateFlashcardsList(200);
          setSessionWordPool(freshList.words || []);
        } else {
          setSessionWordPool(flashcardList.words);
        }
      }
      
      // Select a random word from the pool that hasn't been shown
      const unseenWords = sessionWordPool.filter(w => !sessionShownIds.has(w.id));
      
      if (unseenWords.length > 0) {
        const randomCard = unseenWords[Math.floor(Math.random() * unseenWords.length)];
        console.log(`Selected "${randomCard.spanish}" (${unseenWords.length - 1} remaining in pool)`);
        
        // Mark as shown
        setSessionShownIds(prev => new Set([...prev, randomCard.id]));
        setCurrentPair(randomCard);
      } else {
        console.log('No unseen words in current pool');
        setSessionWordPool([]); // Force refresh on next call
      }
      
    } catch (err) {
      console.error("Error selecting flashcard:", err);
      setGameError("Failed to select a card.");
      setCurrentPair(null);
    }
  }, [wordList, sessionShownIds, sessionWordPool]);

  useEffect(() => {
    // Auto-select first card when wordList becomes available
    if (wordList && wordList.length > 0 && !currentPair) {
      console.log("useFlashcardGame: Auto-selecting initial card...");
      selectNewPairCard();
    }
  }, [wordList, currentPair, selectNewPairCard]);

  const loadSpecificCard = useCallback((pairToLoad) => {
    if (pairToLoad && pairToLoad.spanish && pairToLoad.english) {
      setCurrentPair(pairToLoad);
      setShowFeedback(false);
      setFeedbackSignal(null);
      setLastCorrectAnswer("");
      setGameError(null);
    } else {
      setGameError("Could not load the selected card.");
    }
  }, []);

  const submitAnswer = useCallback(
    async (userAnswer) => {
      if (!currentPair || showFeedback) return;

      const correctAnswerExpected =
        languageDirection === "spa-eng"
          ? currentPair.english
          : currentPair.spanish;
      const normalizedUserAnswer = userAnswer.toLowerCase().trim();
      let isCorrect =
        normalizedUserAnswer === correctAnswerExpected.toLowerCase().trim();

      // Check synonyms for spa-eng direction
      if (
        !isCorrect &&
        languageDirection === "spa-eng" &&
        Array.isArray(currentPair.synonyms_english)
      ) {
        isCorrect = currentPair.synonyms_english.some(
          (syn) => syn.toLowerCase().trim() === normalizedUserAnswer
        );
      }

      // Check synonyms for eng-spa direction
      if (
        !isCorrect &&
        languageDirection === "eng-spa" &&
        Array.isArray(currentPair.synonyms_spanish)
      ) {
        isCorrect = currentPair.synonyms_spanish.some(
          (syn) => syn.toLowerCase().trim() === normalizedUserAnswer
        );
      }

      // Update word exposure
      try {
        const updatedWord = await updateWordExposure(
          currentPair,
          isCorrect,
          "flashcards"
        );
        setLastReviewedCard(updatedWord);
      } catch (error) {
        console.error("Failed to update word exposure:", error);
      }

      // Record for session stats
      if (recordAnswer) {
        recordAnswer(isCorrect, "flashcards");
      }

      // Update UI feedback
      if (isCorrect) {
        setScore((prev) => ({ ...prev, correct: prev.correct + 1 }));
        setFeedbackSignal("correct");
      } else {
        setScore((prev) => ({ ...prev, incorrect: prev.incorrect + 1 }));
        setLastCorrectAnswer(correctAnswerExpected);
        setFeedbackSignal("incorrect");
      }
      setShowFeedback(true);
    },
    [currentPair, languageDirection, showFeedback, recordAnswer]
  );

  const switchToNextCard = useCallback(() => {
    selectNewPairCard();
  }, [selectNewPairCard]);

  const switchDirection = useCallback(() => {
    setLanguageDirection((prev) =>
      prev === "spa-eng" ? "eng-spa" : "spa-eng"
    );
    setShowFeedback(false);
    setLastCorrectAnswer("");
    setFeedbackSignal(null);
    selectNewPairCard();
  }, [selectNewPairCard]);

  // NEW: Reset session function (useful for "New Session" button)
  const resetSession = useCallback(() => {
    console.log('Resetting flashcard session');
    setSessionShownIds(new Set());
    setSessionWordPool([]);
    setScore({ correct: 0, incorrect: 0 });
    selectNewPairCard();
  }, [selectNewPairCard]);

  return {
    currentPair,
    languageDirection,
    score,
    showFeedback,
    lastCorrectAnswer,
    feedbackSignal,
    gameError,
    selectNewPairCard,
    submitAnswer,
    switchDirection,
    switchToNextCard,
    setScore,
    setShowFeedback,
    loadSpecificCard,
    lastReviewedCard,
    resetSession, // NEW
    sessionStats: { // NEW
      shown: sessionShownIds.size,
      poolSize: sessionWordPool.length,
      remaining: sessionWordPool.filter(w => !sessionShownIds.has(w.id)).length
    }
  };
}