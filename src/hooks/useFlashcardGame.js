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
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
  const [feedbackSignal, setFeedbackSignal] = useState(null);
  const [gameError, setGameError] = useState(null);
  const [lastReviewedCard, setLastReviewedCard] = useState(null);
  
  // NEW: Session tracking to prevent repeats
  const [sessionShownIds, setSessionShownIds] = useState(new Set());

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
      const listService = new StudyListService(wordList);
      
      // Simple approach - just get a large random pool each time
      const flashcardList = listService.generateFlashcardsList(Math.min(200, wordList.length));
      
      if (!flashcardList.words || flashcardList.words.length === 0) {
        console.error('No words returned from generateFlashcardsList');
        setGameError("Unable to generate word list.");
        return;
      }
      
      // Filter out already shown words
      const unseenWords = flashcardList.words.filter(w => !sessionShownIds.has(w.id));
      
      // If we've seen all words in this batch, reset session
      if (unseenWords.length === 0) {
        console.log('All words in pool seen, checking if need to reset session...');
        
        // If we've seen a significant portion of total words, reset
        if (sessionShownIds.size >= wordList.length * 0.8) {
          console.log('Resetting session - seen 80% of all words');
          setSessionShownIds(new Set());
          // Get fresh pool and select from it
          const freshList = listService.generateFlashcardsList(Math.min(200, wordList.length));
          if (freshList.words && freshList.words.length > 0) {
            const randomCard = freshList.words[Math.floor(Math.random() * freshList.words.length)];
            setSessionShownIds(new Set([randomCard.id]));
            setCurrentPair(randomCard);
            console.log(`Started new session with "${randomCard.spanish}"`);
          }
          return;
        } else {
          // Get a new batch
          console.log('Getting new batch of words...');
          const newBatch = listService.generateFlashcardsList(Math.min(200, wordList.length));
          const newUnseenWords = newBatch.words.filter(w => !sessionShownIds.has(w.id));
          
          if (newUnseenWords.length > 0) {
            const randomCard = newUnseenWords[Math.floor(Math.random() * newUnseenWords.length)];
            setSessionShownIds(prev => new Set([...prev, randomCard.id]));
            setCurrentPair(randomCard);
            console.log(`Selected "${randomCard.spanish}" from new batch`);
          }
          return;
        }
      }
      
      // Select a random unseen word
      const randomCard = unseenWords[Math.floor(Math.random() * unseenWords.length)];
      console.log(`Selected "${randomCard.spanish}" (${unseenWords.length - 1} more unseen in batch)`);
      
      // Mark as shown
      setSessionShownIds(prev => new Set([...prev, randomCard.id]));
      setCurrentPair(randomCard);
      
    } catch (err) {
      console.error("Error selecting flashcard:", err);
      setGameError("Failed to select a card.");
      setCurrentPair(null);
    }
  }, [wordList, sessionShownIds]);

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
        setFeedbackSignal("correct");
      } else {
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
    selectNewPairCard();
  }, [selectNewPairCard]);

  return {
    currentPair,
    languageDirection,
    showFeedback,
    lastCorrectAnswer,
    feedbackSignal,
    gameError,
    selectNewPairCard,
    submitAnswer,
    switchDirection,
    switchToNextCard,
    setShowFeedback,
    loadSpecificCard,
    lastReviewedCard,
    resetSession, // NEW
    sessionStats: { // NEW
      shown: sessionShownIds.size,
      totalWords: wordList.length,
      remaining: wordList.length - sessionShownIds.size
    }
  };
}