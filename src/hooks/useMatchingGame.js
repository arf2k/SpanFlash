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
    
    const [gameScore, setGameScore] = useState(0);
    const [sessionUsedWordIds, setSessionUsedWordIds] = useState(new Set());
    
    // This ref will track if we have initialized for the current fullWordList instance
    const initializedForCurrentListRef = useRef(false);

    // pickNewWords uses fullWordList from closure, takes count and exclusions
    const pickNewWords = useCallback((count, excludeIds = new Set()) => {
        const newWords = [];
        const sourceList = Array.isArray(fullWordList) ? fullWordList : [];
        
        const availablePool = sourceList.filter(word => !excludeIds.has(word.id));
        const shuffledPool = shuffleArray(availablePool);

        for (const word of shuffledPool) {
            if (newWords.length >= count) break;
            newWords.push(word);
        }
        
        if (newWords.length < count && sourceList.length >= count) {
             console.warn(`useMatchingGame: pickNewWords found only ${newWords.length} words after exclusions (needed ${count}). Pool size: ${availablePool.length}. Exclusions: ${excludeIds.size}`);
        }
        return newWords;
    }, [fullWordList]); // Depends on fullWordList, so pickNewWords reference changes if fullWordList changes

    // initializeNewRound is called by UI or the initial effect
    const initializeNewRound = useCallback((isNewSessionStart = false) => {
        console.log("useMatchingGame: initializeNewRound called. isNewSessionStart:", isNewSessionStart);
        setSelectedSpanish(null);
        setSelectedEnglish(null);

        let exclusionsForPicking = sessionUsedWordIds;
        if (isNewSessionStart) {
            setGameScore(0);
            const newSessionIdSet = new Set();
            setSessionUsedWordIds(newSessionIdSet); 
            exclusionsForPicking = newSessionIdSet; 
            console.log("useMatchingGame: New game session started. Score and sessionUsedWordIds reset.");
        }
        
        // Corrected call to pickNewWords
        let newPairs = pickNewWords(numPairsToDisplay, exclusionsForPicking); 
        
        if (newPairs.length < numPairsToDisplay && fullWordList.length >= numPairsToDisplay) {
            console.warn(`useMatchingGame: Not enough unique words for round. Trying to pick again, allowing reuse from session.`);
            // If truly starting a new round and can't find enough, allow reuse by clearing session exclusions for this pick
            const completelyFreshExclusions = new Set(); 
            newPairs = pickNewWords(numPairsToDisplay, completelyFreshExclusions);
            if (isNewSessionStart) { // If this was a new session start, reflect the reset sessionUsedWordIds
                 setSessionUsedWordIds(completelyFreshExclusions);
            }
        }
        
        if (newPairs.length === 0 && fullWordList.length > 0) {
            console.warn("useMatchingGame: Could not pick any pairs for new round. Displaying empty board.");
            setActiveWordPairs([]); setSpanishOptions([]); setEnglishOptions([]);
            return;
        }
        if (newPairs.length > 0 && newPairs.length < numPairsToDisplay) {
            console.warn(`useMatchingGame: Round will have ${newPairs.length} pairs (less than ${numPairsToDisplay} requested).`);
        }
        
        setActiveWordPairs(newPairs);
        setSpanishOptions(shuffleArray(newPairs.map(p => ({ id: p.id, text: p.spanish, type: 'spanish', matched: false }))));
        setEnglishOptions(shuffleArray(newPairs.map(p => ({ id: p.id, text: p.english, type: 'english', matched: false }))));
        console.log("useMatchingGame: New round initialized with pairs:", newPairs);
    }, [fullWordList, numPairsToDisplay, pickNewWords, sessionUsedWordIds]); // sessionUsedWordIds is a dep

    // Effect to initialize game when fullWordList is first available or changes.
    useEffect(() => {
        console.log("useMatchingGame: Effect for fullWordList change or initial mount.");
        if (fullWordList && fullWordList.length > 0 && fullWordList.length >= numPairsToDisplay) {
            // If fullWordList identity has changed, the initializedForCurrentListRef.current will be false
            // (due to the effect below). Or on first mount it's false.
            if (!initializedForCurrentListRef.current) {
                console.log("useMatchingGame: fullWordList ready and not yet initialized for this list instance. Initializing new game session.");
                initializeNewRound(true); // Start a brand new game session
                initializedForCurrentListRef.current = true; // Mark as initialized for *this* fullWordList instance
            }
        } else {
            console.log("useMatchingGame: fullWordList not sufficient or empty for game. Clearing board.");
            setActiveWordPairs([]);
            setSpanishOptions([]);
            setEnglishOptions([]);
            setGameScore(0);
            setSessionUsedWordIds(new Set());
            initializedForCurrentListRef.current = false; // Reset if list becomes too small
        }
    // `initializeNewRound` is NOT in this dependency array to prevent loops.
    // This effect relies on `fullWordList` changing its reference to trigger a full reset and re-initialization.
    // The `initializeNewRound` function is called using its latest available reference from the hook's scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps 
    }, [fullWordList, numPairsToDisplay]); 

    // Effect to reset initialization flag when fullWordList reference itself changes
    useEffect(() => {
        console.log("useMatchingGame: fullWordList reference changed, resetting initialization flag.");
        initializedForCurrentListRef.current = false;
    }, [fullWordList]);


    const attemptMatch = useCallback(() => {
        if (selectedSpanish && selectedEnglish) {
            const originalPairForSpanish = activeWordPairs.find(p => p.id === selectedSpanish.id);
            let isCorrectMatch = false;

            if (originalPairForSpanish && originalPairForSpanish.id === selectedEnglish.id) {
                isCorrectMatch = true; 
            }

            if (isCorrectMatch) {
                console.log("useMatchingGame: Correct Match!", originalPairForSpanish);
                setGameScore(prev => prev + 1);
                setSessionUsedWordIds(prev => new Set(prev).add(originalPairForSpanish.id));

                setSpanishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedSpanish.id ? {...opt, matched: true} : opt));
                setEnglishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedEnglish.id ? {...opt, matched: true} : opt));
                
                console.log("useMatchingGame: Pair matched. Items will remain visually matched. Click 'New Round' for new set.");

                // Check if all active pairs on the board are now matched
                const allCurrentlyActiveAreMatched = activeWordPairs.every(ap => 
                    sessionUsedWordIds.has(ap.id) || // Check against updated sessionUsedWordIds
                    (ap.id === originalPairForSpanish.id) // Include the one just matched
                );

                if (allCurrentlyActiveAreMatched) {
                    console.log("useMatchingGame: All pairs on current board appear to be matched! User can click 'New Round'.");
                }

            } else {
                console.log("useMatchingGame: Incorrect Match.");
            }
            setSelectedSpanish(null);
            setSelectedEnglish(null);
        }
    }, [selectedSpanish, selectedEnglish, activeWordPairs, sessionUsedWordIds]);

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
    };
}