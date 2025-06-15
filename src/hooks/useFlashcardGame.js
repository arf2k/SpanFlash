import { useState, useCallback, useEffect } from 'react';
import { db } from '../db';
import { StudyListService } from '../services/studyListService';


export function useFlashcardGame(wordList = [], initialCard = null, recordAnswer = null) {
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
        const flashcardList = listService.generateFlashcardsList(50);
        
        if (flashcardList.words && flashcardList.words.length > 0) {
            const randomCard = flashcardList.words[Math.floor(Math.random() * flashcardList.words.length)];
            console.log(`Selected "${randomCard.spanish}" from flashcard list`);
            setCurrentPair(randomCard);
        } else {
            setCurrentPair(null);
            setGameError("No suitable words available for flashcard practice.");
        }
    } catch (err) {
        console.error("Error selecting flashcard:", err);
        setGameError("Failed to select a card.");
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
if (recordAnswer) {
    recordAnswer(isCorrect, 'flashcards');
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