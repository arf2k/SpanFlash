// src/hooks/useFlashcardGame.js
import { useState, useCallback, useEffect } from 'react';
import { db } from '../db';

const MAX_LEITNER_BOX = 7;
const LEITNER_SCHEDULE_IN_DAYS = [0, 1, 2, 4, 8, 16, 32, 90];

function shuffleArray(array) {
    if (!array || array.length === 0) return [];
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
        console.log("useFlashcardGame: Selecting next card based on Leitner schedule...");
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
            const activeListIds = new Set(wordList.map(p => p.id));
            let cardToReview = null;

            // --- Priority 1: Find a card due for scheduled review (Boxes 1-7) ---
            for (let box = 1; box <= MAX_LEITNER_BOX; box++) {
                const dueInBox = await db.allWords
                    .where({ leitnerBox: box })
                    .and(item => item.dueDate <= now)
                    .toArray();
                
                const relevantDueCards = dueInBox.filter(card => activeListIds.has(card.id));

                if (relevantDueCards.length > 0) {
                    cardToReview = shuffleArray(relevantDueCards)[0];
                    console.log(`Leitner: Found due card in Box ${box}. Selecting: "${cardToReview.spanish}"`);
                    break; 
                }
            }

            // --- Priority 2: If no scheduled reviews are due, introduce a new card from Box 0 ---
            if (!cardToReview) {
                console.log("Leitner: No scheduled reviews due. Checking for new cards in Box 0.");
                const newCards = await db.allWords.where({ leitnerBox: 0 }).toArray();
                const relevantNewCards = newCards.filter(card => activeListIds.has(card.id));

                if (relevantNewCards.length > 0) {
                    cardToReview = shuffleArray(relevantNewCards)[0];
                    console.log(`Leitner: Introducing new card from Box 0: "${cardToReview.spanish}"`);
                }
            }

            if (cardToReview) {
                setCurrentPair(cardToReview);
            } else {
                // This state now means there are no cards due AND no new cards to learn.
                console.log("Leitner: No cards due and no new cards to learn. All words mastered!");
                setCurrentPair(null);
                setGameError("Congratulations! You've reviewed all available cards for this mode.");
            }
        } catch (err) {
            console.error("useFlashcardGame: Error fetching due cards from DB:", err);
            setGameError("Failed to get review cards from the database.");
            setCurrentPair(null);
        }
    }, [wordList]);

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

    const submitAnswer = useCallback(async (userAnswer) => {
        if (!currentPair || showFeedback) return;

        const correctAnswerExpected = languageDirection === "spa-eng" ? currentPair.english : currentPair.spanish;
        const normalizedUserAnswer = userAnswer.toLowerCase().trim();
        let isCorrect = normalizedUserAnswer === correctAnswerExpected.toLowerCase().trim();
        
        // INTEGRATED: Check synonyms for spa-eng direction
        if (!isCorrect && languageDirection === "spa-eng" && Array.isArray(currentPair.synonyms_english)) {
            isCorrect = currentPair.synonyms_english.some(syn => syn.toLowerCase().trim() === normalizedUserAnswer);
        }
        
        // ADDED: Check synonyms for eng-spa direction (was missing from your version)
        if (!isCorrect && languageDirection === "eng-spa" && Array.isArray(currentPair.synonyms_spanish)) {
            isCorrect = currentPair.synonyms_spanish.some(syn => syn.toLowerCase().trim() === normalizedUserAnswer);
        }

        // Your existing logic here works correctly for cards from Box 0 as well.
        // A correct Box 0 card will have leitnerBox: (0 || 0) + 1 = 1.
        // An incorrect Box 0 card will have leitnerBox: 1.
        const newBox = isCorrect ? Math.min((currentPair.leitnerBox || 0) + 1, MAX_LEITNER_BOX) : 1;
        const now = Date.now();
        const intervalInDays = LEITNER_SCHEDULE_IN_DAYS[newBox] || 1;
        const intervalInMs = intervalInDays * 24 * 60 * 60 * 1000;
        const newDueDate = now + intervalInMs;
        const updatedPair = { ...currentPair, leitnerBox: newBox, lastReviewed: now, dueDate: newDueDate };

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
    }, [currentPair, languageDirection, showFeedback]);

    const switchToNextCard = useCallback(() => { 
        selectNewPairCard(); 
    }, [selectNewPairCard]);
    
    const switchDirection = useCallback(() => {
        setLanguageDirection(prev => (prev === "spa-eng" ? "eng-spa" : "spa-eng"));
        setShowFeedback(false); 
        setLastCorrectAnswer(""); 
        setFeedbackSignal(null);
        selectNewPairCard();
    }, [selectNewPairCard]);

    return {
        currentPair, languageDirection, score, showFeedback, lastCorrectAnswer,
        feedbackSignal, gameError, selectNewPairCard, submitAnswer, switchDirection,
        switchToNextCard, setScore, setShowFeedback, loadSpecificCard,
        lastReviewedCard 
    };
}