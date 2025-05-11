import { useState, useCallback } from 'react';

export function useFlashcardGame(wordList = []) { 
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState("spa-eng");
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
    const [feedbackSignal, setFeedbackSignal] = useState(null);
    const [gameError, setGameError] = useState(null); // For errors specific to game logic, e.g., no cards found

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
                console.warn("useFlashcardGame: No valid pairs found in the wordList to select from.");
                setGameError("No valid flashcards available to display from the current list.");
                setCurrentPair(null);
            }
        } catch (err) {
            console.error("useFlashcardGame: Error in selectNewPairCard:", err);
            setGameError("Failed to select a new card due to an internal error.");
            setCurrentPair(null);
        }
    }, [wordList]); 

    const submitAnswer = useCallback((userAnswer) => {
        if (!currentPair || showFeedback) return; 

        const punctuationRegex = /[.?!¡¿]+$/;
        const englishArticleRegex = /^(the|a|an)\s+/i;
        const toVerbRegex = /^to\s+/i;

        const correctAnswerExpected = languageDirection === "spa-eng" ? currentPair.english : currentPair.spanish;
        let normalizedUserAnswer = userAnswer.toLowerCase().trim().replace(punctuationRegex, "");
        let normalizedCorrectAnswer = correctAnswerExpected.toLowerCase().trim().replace(punctuationRegex, "");

        if (languageDirection === "spa-eng") {
            normalizedUserAnswer = normalizedUserAnswer.replace(englishArticleRegex, "").replace(toVerbRegex, "");
            normalizedCorrectAnswer = normalizedCorrectAnswer.replace(englishArticleRegex, "").replace(toVerbRegex, "");
        }

        console.log(`useFlashcardGame: Comparing answer: "${normalizedUserAnswer}" vs "${normalizedCorrectAnswer}"`);

        if (normalizedUserAnswer === normalizedCorrectAnswer) {
            setScore((prevScore) => ({ ...prevScore, correct: prevScore.correct + 1 }));
            setFeedbackSignal("correct");
            
            setShowFeedback(true); // Show feedback, even if correct, for consistency
                                 
        } else {
            setScore((prevScore) => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
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
    };
}