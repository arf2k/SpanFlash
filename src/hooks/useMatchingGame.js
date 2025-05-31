import { useState, useEffect, useCallback, useRef } from 'react';

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export function useMatchingGame(fullWordList = [], numPairsToDisplay = 6) {
    const [activeWordPairs, setActiveWordPairs] = useState([]); 
    const [spanishOptions, setSpanishOptions] = useState([]); 
    const [englishOptions, setEnglishOptions] = useState([]); 

    const [selectedSpanish, setSelectedSpanish] = useState(null); 
    const [selectedEnglish, setSelectedEnglish] = useState(null);
    
    const [incorrectAttempt, setIncorrectAttempt] = useState({ spanishId: null, englishId: null });
  
    
    const [gameScore, setGameScore] = useState(0);
    const [sessionUsedWordIds, setSessionUsedWordIds] = useState(new Set());
    
    const initializedForCurrentListRef = useRef(false);

    const pickNewWords = useCallback((count, excludeIds = new Set()) => {
        const newWords = [];
        const sourceList = Array.isArray(fullWordList) ? fullWordList : [];
        
        const availablePool = sourceList.filter(
            (word) => !excludeIds.has(word.id)
        );
        const shuffledPool = shuffleArray(availablePool);

        for (const word of shuffledPool) {
            if (newWords.length >= count) break;
            newWords.push(word);
        }

        if (newWords.length < count && sourceList.length >= count) {
            console.warn(
              `useMatchingGame: pickNewWords found only ${newWords.length} words after exclusions (needed ${count}). Pool size: ${availablePool.length}. Exclusions: ${excludeIds.size}`
            );
        }
        return newWords;
    }, [fullWordList]); 


// src/hooks/useMatchingGame.js
// ... (other code in the hook)

    const initializeNewRound = useCallback((isNewGameSession = false) => {
        console.log(
            "useMatchingGame: initializeNewRound called. isNewGameSession:",
            isNewGameSession // <-- CORRECTED to use the actual parameter name
        );
        setSelectedSpanish(null);
        setSelectedEnglish(null);
        setIncorrectAttempt({ spanishId: null, englishId: null }); 

        let exclusionsForPicking = sessionUsedWordIds; 
        if (isNewGameSession) { 
            setGameScore(0);
            const newSessionIdSet = new Set();
            setSessionUsedWordIds(newSessionIdSet); 
            exclusionsForPicking = newSessionIdSet; 
            console.log(
              "useMatchingGame: New game session started. Score and sessionUsedWordIds reset."
            );
        }
        // If !isNewGameSession (auto-advance), exclusionsForPicking will use the *current* sessionUsedWordIds.

        let newPairs = pickNewWords(numPairsToDisplay, exclusionsForPicking);

        if (
            newPairs.length < numPairsToDisplay &&
            fullWordList.length >= numPairsToDisplay
        ) {
            // This 'if' block regarding !isNewGameSession for auto-advance needs to use the correct parameter name too
            if (!isNewGameSession) { 
                console.warn(
                    `useMatchingGame: Auto-advance: Not enough unique words from session. Allowing reuse from full list for this board.`
                );
                newPairs = pickNewWords(numPairsToDisplay, new Set(activeWordPairs.map(p => p.id)));
            } else { 
                 console.warn(
                    `useMatchingGame: (New Round) Not enough unique words. List may be small or nearly exhausted for session.`
                 );
            }
        }

        if (newPairs.length === 0 && fullWordList.length > 0) {
            console.warn(
                "useMatchingGame: Could not pick ANY pairs for new round. Displaying empty board."
            );
            setActiveWordPairs([]);
            setSpanishOptions([]);
            setEnglishOptions([]);
            return false; 
        }
        if (newPairs.length > 0 && newPairs.length < numPairsToDisplay) {
             console.warn( // This log was commented out in your paste, uncomment if you want it
               `useMatchingGame: Round will have ${newPairs.length} pairs (less than ${numPairsToDisplay} requested).`
             );
        }

        setActiveWordPairs(newPairs);
        setSpanishOptions(
            shuffleArray(
                newPairs.map((p) => ({
                    id: p.id,
                    text: p.spanish,
                    type: "spanish",
                    matched: false,
                }))
            )
        );
        setEnglishOptions(
            shuffleArray(
                newPairs.map((p) => ({
                    id: p.id,
                    text: p.english,
                    type: "english",
                    matched: false,
                }))
            )
        );
        console.log( 
             "useMatchingGame: New round initialized with pairs:",
             newPairs
        );
        return true;
    }, [fullWordList, numPairsToDisplay, pickNewWords, sessionUsedWordIds, activeWordPairs]); 



    useEffect(() => {
    
        if (
            fullWordList &&
            fullWordList.length > 0 &&
            fullWordList.length >= numPairsToDisplay
        ) {
            if (!initializedForCurrentListRef.current) {
    
                initializeNewRound(true);
                initializedForCurrentListRef.current = true;
            }
        } else {
      
            setActiveWordPairs([]);
            setSpanishOptions([]);
            setEnglishOptions([]);
            setGameScore(0);
            setSessionUsedWordIds(new Set());
            initializedForCurrentListRef.current = false; 
        }
    }, [fullWordList, numPairsToDisplay, initializeNewRound]); 

    useEffect(() => {
     
        initializedForCurrentListRef.current = false;
    }, [fullWordList]);

const attemptMatch = useCallback(() => {
    if (selectedSpanish && selectedEnglish) {
        const originalPairForSpanish = activeWordPairs.find(
            (p) => p.id === selectedSpanish.id
        );
        let isCorrectMatch = false;

        if (
            originalPairForSpanish &&
            originalPairForSpanish.id === selectedEnglish.id
        ) {
            isCorrectMatch = true;
        }

        if (isCorrectMatch) {
            console.log("useMatchingGame: Correct Match!", originalPairForSpanish);
            setGameScore((prev) => prev + 1);

            // Update sessionUsedWordIds *before* checking if all are matched
            const newMatchedIdsInSession = new Set(sessionUsedWordIds).add(originalPairForSpanish.id);
            setSessionUsedWordIds(newMatchedIdsInSession);

            setSpanishOptions((prevOpts) =>
                prevOpts.map((opt) =>
                    opt.id === selectedSpanish.id ? { ...opt, matched: true } : opt
                )
            );
            setEnglishOptions((prevOpts) =>
                prevOpts.map((opt) =>
                    opt.id === selectedEnglish.id ? { ...opt, matched: true } : opt
                )
            );

            console.log(
              "useMatchingGame: Pair matched. Items will remain visually matched."
            );

            // --- Check if all currently active pairs on the board are now matched ---
            // Every pair in activeWordPairs must now be in the newMatchedIdsInSession
            const allCurrentlyOnBoardAreMatched = activeWordPairs.length > 0 && activeWordPairs.every(ap => 
                newMatchedIdsInSession.has(ap.id)
            );

            if (allCurrentlyOnBoardAreMatched) {
                console.log("useMatchingGame: All pairs on current board fully matched! Auto-advancing to next set...");
                setTimeout(() => {
                    initializeNewRound(false); // Call with false to continue session (keep score, try new words from session pool)
                }, 1200); // UI Delay (e.g., 1.2 seconds)
            }
       

        } else {
            console.log("useMatchingGame: Incorrect Match.");
            setIncorrectAttempt({ spanishId: selectedSpanish.id, englishId: selectedEnglish.id });
            setTimeout(() => {
                setIncorrectAttempt({ spanishId: null, englishId: null }); 
            }, 1000); 
        }
        setSelectedSpanish(null);
        setSelectedEnglish(null);
    }
}, [selectedSpanish, selectedEnglish, activeWordPairs, sessionUsedWordIds, initializeNewRound, numPairsToDisplay]); 

    const handleSpanishSelection = useCallback((spanishItem) => {
        if (spanishItem.matched) return;
        setSelectedSpanish(spanishItem);
    }, []);

    const handleEnglishSelection = useCallback((englishItem) => {
        if (englishItem.matched) return;
        setSelectedEnglish(englishItem);
    }, []);

    useEffect(() => {
        if (selectedSpanish && selectedEnglish) {
            attemptMatch();
        }
    }, [selectedSpanish, selectedEnglish, attemptMatch]);

    return {
        spanishOptions,
        englishOptions,
        selectedSpanish,
        selectedEnglish,
        gameScore,
        handleSpanishSelection,
        handleEnglishSelection,
        initializeNewRound,
        activePairCount: activeWordPairs.length,
        allWordsCount: fullWordList.length,
        incorrectAttempt,
    };
}