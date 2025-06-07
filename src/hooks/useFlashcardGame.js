// src/hooks/useFlashcardGame.js
import { useState, useCallback } from 'react';
import { db } from '../db';

const MAX_LEITNER_BOX = 7;
const LEITNER_SCHEDULE_IN_DAYS = [0, 1, 2, 4, 8, 16, 32, 90];

// Helper function to shuffle an array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export function useFlashcardGame(wordList = [], onCardReviewed) {
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState("spa-eng");
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
    const [feedbackSignal, setFeedbackSignal] = useState(null);
    const [gameError, setGameError] = useState(null);
    const [lastReviewedCard, setLastReviewedCard] = useState(null);

    // --- MODIFIED: selectNewPairCard now implements Leitner scheduling ---
    const selectNewPairCard = useCallback(async () => { // Now an async function
        console.log("useFlashcardGame: Selecting next DUE card based on Leitner schedule...");
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
            const now = Date.now();
            // Get the IDs of the words in the currently active list (e.g., 'All Words' or just 'Hard Words')
            const activeListIds = new Set(wordList.map(p => p.id));
            let cardToReview = null;

            // Loop from the lowest box (1) to the highest to find a due card
            for (let box = 1; box <= MAX_LEITNER_BOX; box++) {
                // Find all cards in this box that are due
                const dueInBox = await db.allWords
                    .where({ leitnerBox: box })
                    .and(item => item.dueDate <= now)
                    .toArray();
                
                // From those due cards, filter to get only the ones in our active study mode list
                const relevantDueCards = dueInBox.filter(card => activeListIds.has(card.id));

                if (relevantDueCards.length > 0) {
                    // We found due cards in this box! Pick one randomly from this box's due pile.
                    cardToReview = shuffleArray(relevantDueCards)[0];
                    console.log(`Leitner: Found ${relevantDueCards.length} due card(s) in Box ${box}. Selecting one to review.`);
                    break; // Exit the loop once we've found a card
                }
            }

            if (cardToReview) {
                setCurrentPair(cardToReview);
            } else {
                // We went through all boxes and found no due cards in the current study mode.
                console.log("Leitner: No cards are due for review in the current study mode.");
                setCurrentPair(null);
                setGameError("Great job! No cards are due for review right now.");
            }
        } catch (err) {
            console.error("useFlashcardGame: Error fetching due cards from DB:", err);
            setGameError("Failed to get review cards from the database.");
        }
    }, [wordList]); // Dependency on wordList ensures we respect the current study mode (All vs. Hard)

    const loadSpecificCard = useCallback((pairToLoad) => {
        // This function remains the same. It's for loading a specific card outside the Leitner schedule.
        if (pairToLoad && pairToLoad.spanish && pairToLoad.english) {
            setCurrentPair(pairToLoad);
            setShowFeedback(false); setFeedbackSignal(null);
            setLastCorrectAnswer(""); setGameError(null);
        } else {
            setGameError("Could not load the selected card.");
        }
    }, []);

    // The submitAnswer function remains exactly the same as your last working version.
    // It correctly updates the Leitner box and due date after each answer.
    const submitAnswer = useCallback(async (userAnswer) => {
        if (!currentPair || showFeedback) return;
        const correctAnswerExpected = languageDirection === "spa-eng" ? currentPair.english : currentPair.spanish;
        const normalizedUserAnswer = userAnswer.toLowerCase().trim();
        let isCorrect = normalizedUserAnswer === correctAnswerExpected.toLowerCase().trim();
        if (!isCorrect && languageDirection === "spa-eng" && Array.isArray(currentPair.synonyms_english)) {
            isCorrect = currentPair.synonyms_english.some(syn => syn.toLowerCase().trim() === normalizedUserAnswer);
        }

        const newBox = isCorrect ? Math.min((currentPair.leitnerBox || 1) + 1, MAX_LEITNER_BOX) : 1;
        const now = Date.now();
        const intervalInDays = LEITNER_SCHEDULE_IN_DAYS[newBox] || 1;
        const intervalInMs = intervalInDays * 24 * 60 * 60 * 1000;
        const newDueDate = now + intervalInMs;
        const updatedPair = { ...currentPair, leitnerBox: newBox, lastReviewed: now, dueDate: newDueDate };

        try {
            await db.allWords.put(updatedPair);
            console.log(`Word "${updatedPair.spanish}" moved to Leitner Box ${newBox}.`);
            if (onCardReviewed) onCardReviewed(updatedPair);
            setLastReviewedCard(updatedPair); // This line might be used by App.jsx in your setup
        } catch (error) {
            console.error("Failed to update word with Leitner data in DB:", error);
        }

        if (isCorrect) {
            setScore((prevScore) => ({ ...prevScore, correct: prevScore.correct + 1 }));
            setFeedbackSignal("correct");
        } else {
            setScore((prevScore) => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
            setLastCorrectAnswer(correctAnswerExpected);
            setFeedbackSignal("incorrect");
        }
        setShowFeedback(true);
    }, [currentPair, languageDirection, showFeedback, onCardReviewed, setScore]); // Ensure onCardReviewed is passed if App.jsx uses it

    const switchToNextCard = useCallback(() => { selectNewPairCard(); }, [selectNewPairCard]);
    const switchDirection = useCallback(() => {
        setLanguageDirection(prev => (prev === "spa-eng" ? "eng-spa" : "spa-eng"));
        setShowFeedback(false); setLastCorrectAnswer(""); setFeedbackSignal(null);
        selectNewPairCard();
    }, [selectNewPairCard]);

    return {
        currentPair, languageDirection, score, showFeedback, lastCorrectAnswer,
        feedbackSignal, gameError, selectNewPairCard, submitAnswer, switchDirection,
        switchToNextCard, setScore, setShowFeedback, loadSpecificCard,
        lastReviewedCard 
    };
}