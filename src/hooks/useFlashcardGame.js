import { useState, useEffect, useCallback } from "react";
import { db } from "../db";

const MAX_LEITNER_BOX = 7;
const LEITNER_SCHEDULE_IN_DAYS = [0, 1, 2, 4, 8, 16, 32, 90];

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}


export function useFlashcardGame(wordList = [], initialCard = null) {

  const [currentPair, setCurrentPair] = useState(initialCard);
  const [languageDirection, setLanguageDirection] = useState("spa-eng");
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
  const [feedbackSignal, setFeedbackSignal] = useState(null);
  const [gameError, setGameError] = useState(null);
  const [lastReviewedCard, setLastReviewedCard] = useState(null);


  useEffect(() => {
    setCurrentPair(initialCard);
  }, [initialCard]);

  const selectNewPairCard = useCallback(async () => {
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
      const now = Date.now();
      const activeListIds = new Set(wordList.map((p) => p.id));
      const dueCards = await db.allWords
        .where("dueDate")
        .belowOrEqual(now)
        .toArray();
      // Exclude the card that is currently being shown from being selected again immediately
      const relevantDueCards = dueCards.filter(
        (card) => activeListIds.has(card.id) && card.id !== currentPair?.id
      );

      if (relevantDueCards.length > 0) {
        const cardToReview = shuffleArray(relevantDueCards)[0];
        setCurrentPair(cardToReview);
      } else {
        setGameError("Great job! No more cards are due for review right now.");
        setCurrentPair(null);
      }
    } catch (err) {
      console.error("useFlashcardGame: Error fetching due cards from DB:", err);
      setGameError("Failed to get review cards from the database.");
      setCurrentPair(null);
    }
  }, [wordList, currentPair]); // Add currentPair to avoid selecting the same card again right away

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
      if (
        !isCorrect &&
        languageDirection === "spa-eng" &&
        Array.isArray(currentPair.synonyms_english)
      ) {
        isCorrect = currentPair.synonyms_english.some(
          (syn) => syn.toLowerCase().trim() === normalizedUserAnswer
        );
      }

      const newBox = isCorrect
        ? Math.min((currentPair.leitnerBox || 1) + 1, MAX_LEITNER_BOX)
        : 1;
      const now = Date.now();
      const intervalInDays = LEITNER_SCHEDULE_IN_DAYS[newBox] || 1;
      const intervalInMs = intervalInDays * 24 * 60 * 60 * 1000;
      const newDueDate = now + intervalInMs;
      const updatedPair = {
        ...currentPair,
        leitnerBox: newBox,
        lastReviewed: now,
        dueDate: newDueDate,
      };

      try {
        await db.allWords.put(updatedPair);
        setLastReviewedCard(updatedPair);
      } catch (error) {
        console.error("Failed to update word with Leitner data in DB:", error);
      }

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
    [currentPair, languageDirection, showFeedback]
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
  };
}
