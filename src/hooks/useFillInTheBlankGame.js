// src/hooks/useFillInTheBlankGame.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { getTatoebaExamples } from '../services/tatoebaServices.js';

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export function useFillInTheBlankGame(wordList = [], numChoices = 4) {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [gameMessage, setGameMessage] = useState('');
    const [gameScore, setGameScore] = useState(0);
    const [feedback, setFeedback] = useState({ message: '', type: '' });
    
    // This ref will ensure our initial fetch only happens ONCE.
    const hasStartedGame = useRef(false);
    const isFetchingRef = useRef(false); // <-- Add this

    const fetchNewQuestion = useCallback(async () => {
        if (isFetchingRef.current) return; // <-- Prevent concurrent fetches
        isFetchingRef.current = true;
        setIsLoading(true);
        setGameMessage('');
        setFeedback({ message: '', type: '' });
        setCurrentQuestion(null);

        if (!wordList || wordList.length < numChoices) {
            setGameMessage(`Not enough words in list to start game (need at least ${numChoices}).`);
            setIsLoading(false);
            isFetchingRef.current = false; // <-- Reset after fetch
            return;
        }

        const candidateWordList = wordList.filter(
            (pair) => pair.spanish && pair.spanish.trim().split(' ').length <= 3
        );
        if (candidateWordList.length < numChoices) {
            setGameMessage("Not enough suitable short words to generate choices for the game.");
            setIsLoading(false);
            isFetchingRef.current = false; // <-- Reset after fetch
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
                    isFetchingRef.current = false; // <-- Reset after fetch
                    return; // Found a valid question, exit successfully
                }
            }
        }
        setGameMessage(`Could not find a suitable sentence after ${maxAttempts} attempts. Please try again.`);
        setIsLoading(false);
        isFetchingRef.current = false; // <-- Reset after fetch
    }, [wordList, numChoices]);

    const submitUserChoice = useCallback((chosenWord) => {
        if (!currentQuestion || feedback.message) return;
        const isCorrect = chosenWord.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
        setGameScore(isCorrect ? (prev) => prev + 1 : 0);
        setFeedback({
            message: isCorrect ? "Correct!" : `Oops! The correct answer was "${currentQuestion.correctAnswer}".`,
            type: isCorrect ? "correct" : "incorrect",
        });
    }, [currentQuestion]);

    const startNewGame = useCallback(() => {
        setGameScore(0);
        fetchNewQuestion();
    }, [fetchNewQuestion]);

    // This is the corrected initialization effect.
    useEffect(() => {
        // Run only if wordList is ready AND we have NOT run the initial fetch yet.
        if (wordList.length > 0 && !hasStartedGame.current) {
            console.log("HOOK: Word list is ready. Starting the first game session.");
            // Set the flag to true immediately to prevent this from ever running again
            hasStartedGame.current = true; 
            startNewGame();
        }
    }, [wordList, startNewGame]);

    return {
        currentQuestion, isLoading, gameMessage, gameScore, feedback,
        submitUserChoice, startNewGame, fetchNewQuestion, 
    };
}