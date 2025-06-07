// src/hooks/useFlashcardGame.js
import { useState, useCallback } from 'react';
import { db } from '../db'; // Assuming db.js is in src/

const MAX_LEITNER_BOX = 7; // The highest box a card can reach
// Define the review schedule in days for each box
const LEITNER_SCHEDULE_IN_DAYS = [
    0, // Placeholder for index 0
    1, // Box 1: Review after 1 day
    2, // Box 2: Review after 2 days
    4, // Box 3: Review after 4 days
    8, // Box 4: Review after 8 days
    16, // Box 5: Review after 16 days
    32, // Box 6: Review after 32 days (~1 month)
    90, // Box 7: Review after 90 days (~3 months)
];

// The hook now accepts an onCardReviewed callback function
export function useFlashcardGame(wordList = [], onCardReviewed) {
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState("spa-eng");
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
    const [feedbackSignal, setFeedbackSignal] = useState(null);
    const [gameError, setGameError] = useState(null);

    // This function will eventually be updated to select "due" cards for Leitner review.
    // For now, its random selection logic remains the same.
    const selectNewPairCard = useCallback(() => {
        console.log("useFlashcardGame: selectNewPairCard called (random selection for now)...");
        setGameError(null);
        setCurrentPair(null);
        setShowFeedback(false);
        setFeedbackSignal(null);
        setLastCorrectAnswer("");

        if (!wordList || wordList.length === 0) {
            setGameError("The current word list is empty.");
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

    // submitAnswer is now an async function that handles Leitner system logic
    const submitAnswer = useCallback(async (userAnswer) => {
        if (!currentPair || showFeedback) return;

        // --- Answer Checking Logic ---
        const correctAnswerExpected = languageDirection === "spa-eng" ? currentPair.english : currentPair.spanish;
        // Use your full normalization logic here, including synonym check from before
        const normalizedUserAnswer = userAnswer.toLowerCase().trim();
        const normalizedPrimaryAnswer = correctAnswerExpected.toLowerCase().trim();
        
        let isCorrect = (normalizedUserAnswer === normalizedPrimaryAnswer);
        if (!isCorrect && languageDirection === "spa-eng" && Array.isArray(currentPair.synonyms_english)) {
            isCorrect = currentPair.synonyms_english.some(syn => syn.toLowerCase().trim() === normalizedUserAnswer);
        }
        // ---

        // --- NEW: Leitner System Logic ---
        let newBox;
        if (isCorrect) {
            // On correct, increment the box number, up to the max
            newBox = Math.min((currentPair.leitnerBox || 1) + 1, MAX_LEITNER_BOX);
            setScore((prevScore) => ({ ...prevScore, correct: prevScore.correct + 1 }));
            setFeedbackSignal("correct");
        } else {
            // On incorrect, reset to Box 1
            newBox = 1;
            setScore((prevScore) => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
            setLastCorrectAnswer(correctAnswerExpected);
            setFeedbackSignal("incorrect");
        }

        const now = Date.now();
        // Calculate interval in milliseconds from the schedule array
        const intervalInDays = LEITNER_SCHEDULE_IN_DAYS[newBox] || 1; // Default to 1 day if box not in schedule
        const intervalInMs = intervalInDays * 24 * 60 * 60 * 1000;
        const newDueDate = now + intervalInMs;

        const updatedPair = {
            ...currentPair,
            leitnerBox: newBox,
            lastReviewed: now,
            dueDate: newDueDate,
        };

        try {
            await db.allWords.put(updatedPair); // Update the word in IndexedDB with new Leitner data
            console.log(`Word "${updatedPair.spanish}" moved to Leitner Box ${newBox}. Next review due: ${new Date(newDueDate).toLocaleDateString()}`);
            if (onCardReviewed) {
                onCardReviewed(updatedPair); // Signal App.jsx to update its mainWordList state
            }
        } catch (error) {
            console.error("Failed to update word with Leitner data in DB:", error);
        }
        // --- End Leitner System Logic ---

        setShowFeedback(true); // Show feedback after all processing is done

    }, [currentPair, languageDirection, showFeedback, onCardReviewed, setScore]);

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