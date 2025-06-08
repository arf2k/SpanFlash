// src/hooks/useFillInTheBlankGame.js
import { useState, useEffect, useCallback, useRef } from "react";
import { getTatoebaExamples } from "../services/tatoebaServices.js";

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const NUM_QUESTIONS_TO_PREFETCH = 7;
const REFETCH_QUEUE_THRESHOLD = 3;

export function useFillInTheBlankGame(wordList = [], numChoices = 4) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameMessage, setGameMessage] = useState("");
  const [gameScore, setGameScore] = useState(0);
  const [feedback, setFeedback] = useState({ message: "", type: "" });
  const [questionQueue, setQuestionQueue] = useState([]);
  const isFetchingQueue = useRef(false);

  const populateQuestionQueue = useCallback(async () => {
    if (!wordList || wordList.length < numChoices || isFetchingQueue.current)
      return [];

    isFetchingQueue.current = true;
    console.log("HOOK: Starting to fetch a batch of new questions...");

    const maxWordsToTry = Math.min(
      wordList.length,
      NUM_QUESTIONS_TO_PREFETCH * 2
    );
    const shuffledCandidates = shuffleArray(wordList);

    const promises = shuffledCandidates
      .slice(0, maxWordsToTry)
      .map(async (targetPair) => {
        if (!targetPair?.spanish || !targetPair.english) return null;
        const examples = await getTatoebaExamples(targetPair.spanish);
        if (!examples || examples.length === 0) return null;

        for (const example of shuffleArray(examples)) {
          const escapedWord = targetPair.english.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );
          const regex = new RegExp(`\\b${escapedWord}\\b`, "i");

          if (example.text_eng && regex.test(example.text_eng)) {
            const sentenceWithBlank = example.text_eng.replace(
              regex,
              "_______"
            );
            let distractors = shuffleArray(
              wordList.filter((p) => p.id !== targetPair.id)
            )
              .slice(0, numChoices - 1)
              .map((p) => p.english);
            if (distractors.length < numChoices - 1) continue;

            const choices = shuffleArray([targetPair.english, ...distractors]);
            return {
              targetPair,
              sentenceWithBlank,
              choices,
              correctAnswer: targetPair.english,
              originalSentenceSpa: example.text_spa,
              originalSentenceEng: example.text_eng,
            };
          }
        }
        return null;
      });

    const settledResults = await Promise.allSettled(promises);
    const newQuestions = [];
    settledResults.forEach((res) => {
      if (
        res.status === "fulfilled" &&
        res.value &&
        newQuestions.length < NUM_QUESTIONS_TO_PREFETCH
      ) {
        newQuestions.push(res.value);
      }
    });

    console.log(
      `HOOK: Fetch complete. Created ${newQuestions.length} new questions.`
    );
    isFetchingQueue.current = false;
    return newQuestions;
  }, [wordList, numChoices]);

  const serveNextQuestion = useCallback(
    (currentQueue) => {
      console.log("HOOK: Serving next question from queue.");
      setFeedback({ message: "", type: "" });

      if (currentQueue.length > 0) {
        const nextQuestion = currentQueue[0];
        const remainingQueue = currentQueue.slice(1);
        setCurrentQuestion(nextQuestion);
        setQuestionQueue(remainingQueue);

        // Check if we need to pre-fetch more in the background
        if (
          remainingQueue.length <= REFETCH_QUEUE_THRESHOLD &&
          !isFetchingQueue.current
        ) {
          console.log(
            `HOOK: Queue is low (${remainingQueue.length}). Pre-fetching more in background.`
          );
          populateQuestionQueue().then((newlyFetched) => {
            setQuestionQueue((q) => [...q, ...newlyFetched]); // Append new questions to the end of the queue
          });
        }
      } else {
        console.log("HOOK: Queue is empty. Must fetch a new batch now.");
        setIsLoading(true);
        setGameMessage("Preparing more questions...");
        populateQuestionQueue().then((newlyFetched) => {
          if (newlyFetched.length > 0) {
            serveNextQuestion(newlyFetched); // Recursively call with the new batch
          } else {
            setGameMessage(
              "Could not load more questions. Try starting a new game."
            );
            setIsLoading(false);
          }
        });
      }
    },
    [populateQuestionQueue]
  );

  const submitUserChoice = useCallback(
    (chosenWord) => {
      if (!currentQuestion) return;

      const isCorrect =
        chosenWord.toLowerCase().trim() ===
        currentQuestion.correctAnswer.toLowerCase().trim();
      setGameScore(isCorrect ? (prev) => prev + 1 : 0);
      setFeedback({
        message: isCorrect
          ? "Correct!"
          : `Oops! The correct answer was "${currentQuestion.correctAnswer}".`,
        type: isCorrect ? "correct" : "incorrect",
      });

      setTimeout(() => serveNextQuestion(questionQueue), 2000);
    },
    [currentQuestion, questionQueue, serveNextQuestion]
  );

  const startNewGame = useCallback(() => {
    setGameScore(0);
    setQuestionQueue([]);
    setCurrentQuestion(null);
    setIsLoading(true);
    setGameMessage("Preparing your game...");

    populateQuestionQueue().then((newQuestions) => {
      if (newQuestions.length > 0) {
        setGameMessage("");
        serveNextQuestion(newQuestions);
      } else {
        setGameMessage(
          "Could not start game. Try again or check your word list."
        );
        setIsLoading(false);
      }
    });
  }, [populateQuestionQueue, serveNextQuestion]);

  // This effect initializes the very first game when the hook mounts with a valid list
  useEffect(() => {
    if (wordList && wordList.length >= numChoices) {
      startNewGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordList]); // This is intended to run only when the master word list changes

  return {
    currentQuestion,
    isLoading,
    gameMessage,
    gameScore,
    feedback,
    submitUserChoice,
    startNewGame,
  };
}
