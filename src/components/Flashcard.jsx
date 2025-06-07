// src/hooks/useFlashcardGame.js
import { useState, useCallback, useEffect } from 'react';
import { db } from '../db'; // Assuming db.js is in the parent src/ directory

const MAX_LEITNER_BOX = 7; // e.g., 7 boxes
const LEITNER_SCHEDULE_IN_DAYS = [
    0, // Box 0 doesn't exist, just a placeholder
    1, // Box 1: Review after 1 day
    3, // Box 2: Review after 3 days
    7, // Box 3: Review after 7 days (1 week)
    14, // Box 4: Review after 14 days (2 weeks)
    30, // Box 5: Review after 30 days (1 month)
    90, // Box 6: Review after 90 days (3 months)
    180 // Box 7: Review after 180 days (6 months)
];

export function useFlashcardGame(wordList = [], onCardReviewed) { // <-- Added onCardReviewed prop
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState("spa-eng");
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
    const [feedbackSignal, setFeedbackSignal] = useState(null);
    const [gameError, setGameError] = useState(null);

    const selectNewPairCard = useCallback(() => {
        // Your existing selectNewPairCard logic remains the same.
        // For a full SRS, this would change to only select "due" cards.
        // For now, it will continue to select randomly.
        console.log("useFlashcardGame: selectNewPairCard called (random selection for now)...");
        setGameError(null);
        setCurrentPair(null);
        setShowFeedback(false);
        setFeedbackSignal(null);
        setLastCorrectAnswer("");

        if (!wordList || wordList.length === 0) {
            setGameError("Word list is empty. Cannot select a new card.");
            setCurrentPair(null);
            return;
        }

        try {
            const filteredData = wordList.filter((pair) =>
                pair && typeof pair.spanish === 'string' && pair.spanish.trim().length > 0 &&
                typeof pair.english === 'string' && pair.english.trim().length > 0
            );

            if (filteredData.length > 0) {
                const idx = Math.floor(Math.random() * filteredData.length);
                setCurrentPair(filteredData[idx]);
            } else {
                setGameError("No valid flashcards available to display from the current list.");
                setCurrentPair(null);
            }
        } catch (err) {
            console.error("useFlashcardGame: Error in selectNewPairCard:", err);
            setGameError("Failed to select a new card due to an internal error.");
        }
    }, [wordList]);

    const loadSpecificCard = useCallback((pairToLoad) => {
        if (pairToLoad && typeof pairToLoad.spanish === 'string' && typeof pairToLoad.english === 'string') {
            setCurrentPair(pairToLoad);
            setShowFeedback(false);
            setFeedbackSignal(null);
            setLastCorrectAnswer("");
            setGameError(null);
        } else {
            setGameError("Could not load the selected card.");
        }
    }, []);

    const submitAnswer = useCallback(async (userAnswer) => { // <-- Now an async function
        if (!currentPair || showFeedback) return;

        // --- Answer Checking Logic (as before) ---
        const correctAnswerExpected = languageDirection === "spa-eng" ? currentPair.english : currentPair.spanish;
        let normalizedUserAnswer = userAnswer.toLowerCase().trim(); // Basic normalization for now
        // Add your more advanced normalization if needed
        let isCorrect = normalizedUserAnswer === correctAnswerExpected.toLowerCase().trim();
        // TODO: Re-integrate synonym check here if desired for flashcard mode
        // ...

        // --- NEW: Leitner System Logic ---
        let newBox;
        if (isCorrect) {
            newBox = Math.min((currentPair.leitnerBox || 1) + 1, MAX_LEITNER_BOX);
            setScore((prevScore) => ({ ...prevScore, correct: prevScore.correct + 1 }));
            setFeedbackSignal("correct");
        } else {
            newBox = 1; // Reset to Box 1 on incorrect answer
            setScore((prevScore) => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
            setLastCorrectAnswer(correctAnswerExpected);
            setFeedbackSignal("incorrect");
        }

        const now = Date.now();
        const intervalInMs = (LEITNER_SCHEDULE_IN_DAYS[newBox] || 1) * 24 * 60 * 60 * 1000;
        const newDueDate = now + intervalInMs;

        const updatedPair = {
            ...currentPair,
            leitnerBox: newBox,
            lastReviewed: now,
            dueDate: newDueDate,
        };

        try {
            await db.allWords.put(updatedPair); // Update the word in IndexedDB
            console.log(`Word "${updatedPair.spanish}" moved to Leitner Box ${newBox}. Next review due: ${new Date(newDueDate).toLocaleDateString()}`);
            if (onCardReviewed) {
                onCardReviewed(updatedPair); // Signal App.jsx to update its mainWordList state
            }
        } catch (error) {
            console.error("Failed to update word with Leitner data in DB:", error);
        }
        // --- End Leitner System Logic ---

        setShowFeedback(true); // Show feedback after processing

    }, [currentPair, languageDirection, showFeedback, onCardReviewed, setScore]); // Added onCardReviewed and setScore

    const switchToNextCard = useCallback(() => {
        selectNewPairCard();
    }, [selectNewPairCard]);

    const switchDirection = useCallback(() => {
        setLanguageDirection((prevDirection) => (prevDirection === "spa-eng" ? "eng-spa" : "spa-eng"));
        setShowFeedback(false);
        setLastCorrectAnswer("");
        setFeedbackSignal(null);
        selectNewPairCard();
    }, [selectNewPairCard]);

    return {
        currentPair, languageDirection, score, showFeedback, lastCorrectAnswer,
        feedbackSignal, gameError, selectNewPairCard, submitAnswer, switchDirection,
        switchToNextCard, setScore, setShowFeedback: setGameShowFeedback, loadSpecificCard,
    };
}