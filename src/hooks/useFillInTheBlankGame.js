import { useState, useEffect, useCallback, useRef } from 'react';
import { getTatoebaExamples } from '../services/tatoebaServices.js';
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

const updateWordLeitnerData = async (word, isCorrect) => {
  const newBox = isCorrect
    ? Math.min((word.leitnerBox || 0) + 1, MAX_LEITNER_BOX)
    : 1;

  const now = Date.now();
  const intervalInDays = LEITNER_SCHEDULE_IN_DAYS[newBox] || 1;
  const intervalInMs = intervalInDays * 24 * 60 * 60 * 1000;
  const newDueDate = now + intervalInMs;

  const updatedWord = {
    ...word,
    leitnerBox: newBox,
    lastReviewed: now,
    dueDate: newDueDate,
  };

  try {
    await db.allWords.put(updatedWord);
    console.log(
      `Fill-in-Blank: Updated "${word.spanish}" to Box ${newBox} (${
        isCorrect ? "correct" : "incorrect"
      })`
    );
    return updatedWord;
  } catch (error) {
    console.error("Fill-in-Blank: Failed to update word with Leitner data:", error);
    return word; 
  }
};

export function useFillInTheBlankGame(wordList = [], numChoices = 4) {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [gameMessage, setGameMessage] = useState('');
    const [gameScore, setGameScore] = useState(0);
    const [feedback, setFeedback] = useState({ message: '', type: '' });
    
  
    const [lastUpdatedWords, setLastUpdatedWords] = useState([]);
    
   
    const hasStartedGame = useRef(false);
    const isFetchingRef = useRef(false);

    const fetchNewQuestion = useCallback(async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setIsLoading(true);
        setGameMessage('');
        setFeedback({ message: '', type: '' });
        setCurrentQuestion(null);

        if (!wordList || wordList.length < numChoices) {
            setGameMessage(`Not enough words in list to start game (need at least ${numChoices}).`);
            setIsLoading(false);
            isFetchingRef.current = false;
            return;
        }

        const candidateWordList = wordList.filter(
            (pair) => pair.spanish && pair.spanish.trim().split(' ').length <= 3
        );
        if (candidateWordList.length < numChoices) {
            setGameMessage("Not enough suitable short words to generate choices for the game.");
            setIsLoading(false);
            isFetchingRef.current = false;
            return;
        }

        let attempts = 0;
        const maxAttempts = 15;
        while (attempts < maxAttempts) {
            attempts++;
            const targetPair = candidateWordList[Math.floor(Math.random() * candidateWordList.length)];
            if (!targetPair?.spanish) continue;

            const examples = await getTatoebaExamples(targetPair.spanish);
            if (!examples || examples.length === 0) continue;

            for (const example of shuffleArray(examples)) {
                const escapedWord = targetPair.spanish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');

                if (example.text_spa && regex.test(example.text_spa)) {
                    const sentenceWithBlank = example.text_spa.replace(regex, "_______");
                    const distractors = shuffleArray(candidateWordList.filter(p => p.id !== targetPair.id))
                                      .slice(0, numChoices - 1).map(p => p.spanish);

                    if (distractors.length < numChoices - 1) continue;

                    const choices = shuffleArray([targetPair.spanish, ...distractors]);
                    setCurrentQuestion({
                        targetPair, sentenceWithBlank, choices,
                        correctAnswer: targetPair.spanish,
                        originalSentenceEng: targetPair.english,
                        originalSentenceSpa: example.text_spa,   
                    });
                    setIsLoading(false);
                    isFetchingRef.current = false;
                    return;
                }
            }
        }
        setGameMessage(`Could not find a suitable sentence after ${maxAttempts} attempts. Please try again.`);
        setIsLoading(false);
        isFetchingRef.current = false;
    }, [wordList, numChoices]);

  
    const submitUserChoice = useCallback(async (chosenWord) => {
        if (!currentQuestion || feedback.message) return;
        
        const isCorrect = chosenWord.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
        setGameScore(isCorrect ? (prev) => prev + 1 : 0);
        setFeedback({
            message: isCorrect ? "Correct!" : `Oops! The correct answer was "${currentQuestion.correctAnswer}".`,
            type: isCorrect ? "correct" : "incorrect",
        });

        if (currentQuestion.targetPair) {
            const updatedWord = await updateWordLeitnerData(currentQuestion.targetPair, isCorrect);
            setLastUpdatedWords((prev) => [...prev, updatedWord]);
        }
    }, [currentQuestion, feedback.message]);

    const startNewGame = useCallback(() => {
        setGameScore(0);
        fetchNewQuestion();
    }, [fetchNewQuestion]);

    const clearLastUpdatedWords = useCallback(() => {
        setLastUpdatedWords([]);
    }, []);

    useEffect(() => {
        if (wordList.length > 0 && !hasStartedGame.current) {
            console.log("HOOK: Word list is ready. Starting the first game session.");
            hasStartedGame.current = true; 
            startNewGame();
        }
    }, [wordList, startNewGame]);

    return {
        currentQuestion, isLoading, gameMessage, gameScore, feedback,
        submitUserChoice, startNewGame, fetchNewQuestion,
        lastUpdatedWords, 
        clearLastUpdatedWords,
    };
}