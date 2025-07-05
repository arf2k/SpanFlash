import { useState, useEffect } from "react";
import { ConjugationService } from "../services/conjugationService.js";
import { updateWordExposure, shuffleArray } from "../utils/gameUtils";
import { normalizeForAnswerCheck } from "../utils/textUtils.js";

export function useVerbConjugationGame(wordList, recordAnswer = null) {
  const [conjugationService] = useState(() => new ConjugationService());
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [verbWords, setVerbWords] = useState([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });

  const initializeGame = async () => {
    setIsLoading(true);

    const likelyVerbs = wordList.filter((word) =>
      conjugationService.isVerb(word.spanish)
    );

    const shuffledLikelyVerbs = shuffleArray(likelyVerbs);
    const verbsToTest = shuffledLikelyVerbs.slice(0, 50);

    console.log(
      `Found ${likelyVerbs.length} potential verbs, testing up to 50 of them.`
    );

    // Create promises for parallel verb testing (much faster)
    const verbTestPromises = verbsToTest.slice(0, 25).map(async (word) => {
      try {
        const question = await conjugationService.generateConjugationQuestion(
          word
        );
        return question ? word : null;
      } catch (error) {
        console.warn(`Failed to test verb ${word.spanish}:`, error);
        return null;
      }
    });

    // Wait for all tests to complete simultaneously
    const testResults = await Promise.all(verbTestPromises);

    // Filter successful verbs and take first 20
    const confirmedVerbs = testResults
      .filter((word) => word !== null)
      .slice(0, 20);

    console.log(`Confirmed ${confirmedVerbs.length} working verbs`);
    setVerbWords(confirmedVerbs);
    setIsLoading(false);

    if (confirmedVerbs.length > 0) {
      generateNewQuestion(confirmedVerbs);
    }
  };

  const generateNewQuestion = async (words = verbWords) => {
    if (words.length === 0) return;

    setIsLoading(true);
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const question = await conjugationService.generateConjugationQuestion(
      randomWord
    );

    if (question) {
      setCurrentQuestion(question);
      setUserAnswer("");
      setFeedback(null);
      setShowAnswer(false);
    }
    setIsLoading(false);
  };

  const checkAnswer = async () => {
    if (!currentQuestion || !userAnswer.trim()) return;

    const normalizedUserAnswer = normalizeForAnswerCheck(userAnswer);
    const normalizedCorrectAnswer = normalizeForAnswerCheck(
      currentQuestion.answer
    );

    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

    // Record answer for session stats
    if (recordAnswer) {
      recordAnswer(isCorrect, "conjugation");
    }

    setFeedback({
      isCorrect,
      userAnswer: userAnswer.trim(),
      correctAnswer: currentQuestion.answer,
      fullAnswer: currentQuestion.fullAnswer,
    });
    setShowAnswer(true);

    try {
      await updateWordExposure(currentQuestion.word, isCorrect, "conjugation");
    } catch (error) {
      console.error("Failed to update Leitner data:", error);
    }

    if (isCorrect) {
      setScore((prev) => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      setScore((prev) => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }

    setQuestionsAnswered((prev) => prev + 1);
  };

  const nextQuestion = () => {
    if (questionsAnswered >= 10) {
      setGameCompleted(true);
      return;
    }
    generateNewQuestion();
  };

  const resetGame = () => {
    setGameCompleted(false);
    setQuestionsAnswered(0);
    generateNewQuestion();
    setScore({ correct: 0, incorrect: 0 });
  };

  const updateUserAnswer = (value) => {
    setUserAnswer(value);
  };

  // Initialize game when wordList changes
  useEffect(() => {
    if (wordList && wordList.length > 0 && !gameCompleted) {
      initializeGame();
    }
  }, [wordList, gameCompleted, conjugationService]);

  return {
    // State
    currentQuestion,
    userAnswer,
    feedback,
    questionsAnswered,
    isLoading,
    verbWords,
    showAnswer,
    gameCompleted,
    score,

    // Actions
    checkAnswer,
    nextQuestion,
    resetGame,
    updateUserAnswer,
    generateNewQuestion,
  };
}
