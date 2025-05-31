import { useState, useEffect, useCallback, useRef } from 'react';

// Helper function to shuffle an array (Fisher-Yates shuffle)
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
    
    // Ref to track if the game has been initialized for the current fullWordList
    const gameInitializedForCurrentListRef = useRef(false);

    const pickNewWords = useCallback((sourceList, count, excludeIdsSet = new Set()) => {
        const newWords = [];
        const validSourceList = Array.isArray(sourceList) ? sourceList : [];
        const availablePool = validSourceList.filter(word => !excludeIdsSet.has(word.id));
        const shuffledPool = shuffleArray(availablePool);

        for (const word of shuffledPool) {
            if (newWords.length >= count) break;
            newWords.push(word);
        }
        return newWords;
    }, []); 

    // Function to setup or reset a round.
    // isNewGameSession = true will reset score and used words history for a brand new game.
    const initializeNewRound = useCallback((isNewGameSession = false) => {
        console.log("useMatchingGame: initializeNewRound called. isNewGameSession:", isNewGameSession);
        setSelectedSpanish(null);
        setSelectedEnglish(null);

        let currentExclusions = sessionUsedWordIds;
        if (isNewGameSession) {
            setGameScore(0);
            const newSessionIdSet = new Set();
            setSessionUsedWordIds(newSessionIdSet);
            currentExclusions = newSessionIdSet; 
        }
        
        let newPairs = pickNewWords(fullWordList, numPairsToDisplay, currentExclusions);

        // If not enough words that haven't been used in this session,
        // reset sessionUsedWordIds and try picking again (allows words to repeat).
        if (newPairs.length < numPairsToDisplay && fullWordList.length >= numPairsToDisplay) {
            console.warn(`useMatchingGame: Not enough fresh words for a round (${newPairs.length}/${numPairsToDisplay}). Resetting session history and trying again.`);
            const freshSessionIdSet = new Set();
            setSessionUsedWordIds(freshSessionIdSet); 
            currentExclusions = freshSessionIdSet;    
            newPairs = pickNewWords(fullWordList, numPairsToDisplay, currentExclusions);
        }
        
        if (newPairs.length === 0 && fullWordList.length > 0) {
            console.warn("useMatchingGame: Could not pick any pairs. Word list might be too small or exhausted even after session reset.");
            setActiveWordPairs([]); 
            setSpanishOptions([]); 
            setEnglishOptions([]);
            return; 
        }
        if (newPairs.length > 0 && newPairs.length < numPairsToDisplay) {
            console.warn(`useMatchingGame: Round will have ${newPairs.length} pairs (less than ${numPairsToDisplay} requested).`);
        }
        
        setActiveWordPairs(newPairs);
        setSpanishOptions(shuffleArray(newPairs.map(p => ({ id: p.id, text: p.spanish, type: 'spanish', matched: false }))));
        setEnglishOptions(shuffleArray(newPairs.map(p => ({ id: p.id, text: p.english, type: 'english', matched: false }))));
        console.log("useMatchingGame: New round initialized with pairs:", newPairs);
    }, [fullWordList, numPairsToDisplay, pickNewWords, sessionUsedWordIds]); // 

 
    useEffect(() => {
        console.log("useMatchingGame: Effect for initial load / fullWordList change triggered.");
        if (fullWordList && fullWordList.length >= numPairsToDisplay) {
            console.log("useMatchingGame: fullWordList is sufficient. Initializing new game session.");
            initializeNewRound(true); 
            gameInitializedForCurrentListRef.current = true;
        } else {
            // Not enough words, or fullWordList is empty
            console.log("useMatchingGame: fullWordList not sufficient or empty. Clearing board.");
            setActiveWordPairs([]);
            setSpanishOptions([]);
            setEnglishOptions([]);
            setGameScore(0);
            setSessionUsedWordIds(new Set());
            gameInitializedForCurrentListRef.current = false;
        }
    }, [fullWordList, numPairsToDisplay, initializeNewRound]); // initializeNewRound is now a dependency

    const attemptMatch = useCallback(() => {
        if (selectedSpanish && selectedEnglish) {
            const originalPairForSpanish = activeWordPairs.find(p => p.id === selectedSpanish.id);
            let isCorrectMatch = false;

            // Ensure both selections refer to the same original word pair for a match
            if (originalPairForSpanish && originalPairForSpanish.id === selectedEnglish.id) {
                // Additional check if needed: verify if selectedEnglish.text actually matches originalPairForSpanish.english
                // For now, if IDs match, it means they selected the two parts of the same pair from the shuffled options.
                isCorrectMatch = true; 
            }

            if (isCorrectMatch) {
                console.log("useMatchingGame: Correct Match!", originalPairForSpanish);
                setGameScore(prev => prev + 1);
                
                const newMatchedIds = new Set(sessionUsedWordIds).add(originalPairForSpanish.id);
                setSessionUsedWordIds(newMatchedIds);

                // Mark as matched in UI options
                setSpanishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedSpanish.id ? {...opt, matched: true} : opt));
                setEnglishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedEnglish.id ? {...opt, matched: true} : opt));
                
                // Continuous Flow: Replace matched pair
                const currentActiveAndNotYetMatchedInSessionIds = new Set(activeWordPairs.map(p => p.id));
                newMatchedIds.forEach(id => currentActiveAndNotYetMatchedInSessionIds.delete(id)); // Remove already session-matched

                const replacementCandidates = pickNewWords(fullWordList, 1, newMatchedIds); // Pick 1 new word, excluding all session-matched
                
                if (replacementCandidates.length > 0) {
                    const newWordToDisplay = replacementCandidates[0];
                    
                    setActiveWordPairs(prevActive => 
                        [...prevActive.filter(p => p.id !== originalPairForSpanish.id), newWordToDisplay]
                    );
                    
                    setSpanishOptions(prevOpts => shuffleArray([
                        ...prevOpts.filter(opt => opt.id !== selectedSpanish.id), 
                        { id: newWordToDisplay.id, text: newWordToDisplay.spanish, type: 'spanish', matched: false }
                    ]));
                    setEnglishOptions(prevOpts => shuffleArray([
                        ...prevOpts.filter(opt => opt.id !== selectedEnglish.id), 
                        { id: newWordToDisplay.id, text: newWordToDisplay.english, type: 'english', matched: false }
                    ]));
                } else {
                    console.log("useMatchingGame: No new words available to replace. Matched pair removed from active display.");
                   
                     setActiveWordPairs(prevActive => prevActive.filter(p => p.id !== originalPairForSpanish.id));
                     setSpanishOptions(prevOpts => prevOpts.filter(opt => opt.id !== selectedSpanish.id));
                     setEnglishOptions(prevOpts => prevOpts.filter(opt => opt.id !== selectedEnglish.id));

                    if (activeWordPairs.filter(p => p.id !== originalPairForSpanish.id).length === 0) {
                        console.log("useMatchingGame: All pairs on current board matched & removed! User can click 'New Round'.");
                    }
                }
            } else {
                console.log("useMatchingGame: Incorrect Match.");
                // Add brief visual feedback for incorrect match if desired (e.g. state for feedback)
            }
            setSelectedSpanish(null);
            setSelectedEnglish(null);
        }
    }, [selectedSpanish, selectedEnglish, activeWordPairs, pickNewWords, sessionUsedWordIds, fullWordList, numPairsToDisplay]);

    const handleSpanishSelection = useCallback((spanishItem) => {
        if (spanishItem.matched) return; // Don't select already matched items
        setSelectedSpanish(spanishItem);
    }, []);

    const handleEnglishSelection = useCallback((englishItem) => {
        if (englishItem.matched) return; // Don't select already matched items
        setSelectedEnglish(englishItem);
    }, []);

    // Effect to attempt match when both a Spanish and an English item are selected
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