// src/hooks/useFlashcardGame.js
import { useState, useCallback } from 'react';

export function useFlashcardGame(wordList = []) {
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState("spa-eng");
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
    const [feedbackSignal, setFeedbackSignal] = useState(null);
    const [gameError, setGameError] = useState(null);

    const selectNewPairCard = useCallback(() => {
        console.log("useFlashcardGame: selectNewPairCard called...");
        setGameError(null);
        setCurrentPair(null);
        setShowFeedback(false);
        setFeedbackSignal(null);
        setLastCorrectAnswer("");

        if (!wordList || wordList.length === 0) {
            console.warn("useFlashcardGame: wordList is empty or undefined in selectNewPairCard.");
            setGameError("Word list is empty. Cannot select a new card.");
            setCurrentPair(null);
            return;
        }

        try {
            const filteredData = wordList.filter((pair) =>
                pair &&
                typeof pair.spanish === 'string' && pair.spanish.trim().length > 0 &&
                typeof pair.english === 'string' && pair.english.trim().length > 0
            );

            if (filteredData.length > 0) {
                const idx = Math.floor(Math.random() * filteredData.length);
                const pair = filteredData[idx];
                setCurrentPair(pair);
                console.log("useFlashcardGame: Selected new pair:", pair);
            } else {
                console.warn("useFlashcardGame: No valid pairs found in the wordList to select from after filtering.");
                setGameError("No valid flashcards available to display from the current list.");
                setCurrentPair(null);
            }
        } catch (err) {
            console.error("useFlashcardGame: Error in selectNewPairCard:", err);
            setGameError("Failed to select a new card due to an internal error.");
            setCurrentPair(null);
        }
    }, [wordList]);

    const loadSpecificCard = useCallback((pairToLoad) => {
        console.log("useFlashcardGame: loadSpecificCard called with:", pairToLoad);
        if (pairToLoad && typeof pairToLoad.spanish === 'string' && typeof pairToLoad.english === 'string') {
            setCurrentPair(pairToLoad);
            setShowFeedback(false);
            setFeedbackSignal(null);
            setLastCorrectAnswer("");
            setGameError(null);
        } else {
            console.error("useFlashcardGame: loadSpecificCard called with invalid pair.", pairToLoad);
            setGameError("Could not load the selected card.");
        }
    }, []);

    const submitAnswer = useCallback((userAnswer) => {
        if (!currentPair || showFeedback) return;

        const punctuationRegex = /[.?!¡¿]+$/;
        const englishArticleRegex = /^(the|a|an)\s+/i;
        const toVerbRegex = /^to\s+/i;

        const correctAnswerExpected = languageDirection === "spa-eng" ? currentPair.english : currentPair.spanish;
        
        let normalizedUserAnswer = userAnswer.toLowerCase().trim().replace(punctuationRegex, "");
        let normalizedPrimaryCorrectAnswer = correctAnswerExpected.toLowerCase().trim().replace(punctuationRegex, "");

        // Apply English-specific normalization to user's answer if direction is spa-eng
        if (languageDirection === "spa-eng") {
            normalizedUserAnswer = normalizedUserAnswer
                .replace(englishArticleRegex, "")
                .replace(toVerbRegex, "");
            normalizedPrimaryCorrectAnswer = normalizedPrimaryCorrectAnswer
                .replace(englishArticleRegex, "")
                .replace(toVerbRegex, "");
        }

        console.log(`useFlashcardGame: Comparing answer: User's normalized: "${normalizedUserAnswer}" vs Primary normalized: "${normalizedPrimaryCorrectAnswer}"`);

        let isCorrect = false;

        // Check against primary translation
        if (normalizedUserAnswer === normalizedPrimaryCorrectAnswer) {
            isCorrect = true;
        } 
        // If not correct and direction is spa-eng, check against English synonyms
        else if (languageDirection === "spa-eng" && 
                   currentPair.synonyms_english && 
                   Array.isArray(currentPair.synonyms_english) && 
                   currentPair.synonyms_english.length > 0) {
            
            console.log("useFlashcardGame: Primary answer didn't match. Checking English synonyms for:", normalizedUserAnswer);
            for (const synonym of currentPair.synonyms_english) {
                if (typeof synonym === 'string') {
                    let normalizedDBSynonym = synonym.toLowerCase().trim().replace(punctuationRegex, "");
                    // Apply the same English-specific normalizations to stored synonyms
                    normalizedDBSynonym = normalizedDBSynonym
                        .replace(englishArticleRegex, "")
                        .replace(toVerbRegex, "");
                    
                    if (normalizedUserAnswer === normalizedDBSynonym) {
                        console.log(`useFlashcardGame: Matched synonym: "${synonym}" (normalized to: "${normalizedDBSynonym}")`);
                        isCorrect = true;
                        break; // Found a match in synonyms
                    }
                }
            }
        }

        if (isCorrect) {
            setScore((prevScore) => ({ ...prevScore, correct: prevScore.correct + 1 }));
            setFeedbackSignal("correct");
            setShowFeedback(true);
        } else {
            setScore((prevScore) => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
            // Display the primary correct answer in feedback, even if synonyms were possible
            setLastCorrectAnswer(correctAnswerExpected); 
            setShowFeedback(true);
            setFeedbackSignal("incorrect");
        }
    }, [currentPair, languageDirection, showFeedback]);

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
    };
}