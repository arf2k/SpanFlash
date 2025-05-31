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
    
    // Ref to track if we've tried to initialize for the current fullWordList
    const initialLoadAttemptedForCurrentList = useRef(false);


    // Stable pickNewWords using useCallback, depends only on fullWordList for its pool
    const pickNewWords = useCallback((count, currentExclusions = new Set()) => {
        const newWords = [];
        const validSourceList = Array.isArray(fullWordList) ? fullWordList : [];
        
        // Primary pool: words not in currentExclusions
        let availablePool = validSourceList.filter(word => !currentExclusions.has(word.id));
        
        // If primary pool is smaller than needed count, and we allow repeats (by not adding to sessionUsedWordIds here)
        // we might need a strategy if sessionUsedWordIds has exhausted almost everything.
        // For now, this just picks from what's left if we strictly avoid currentExclusions.
        if (availablePool.length < count && validSourceList.length >= count) {
            console.warn(`useMatchingGame: pickNewWords found only ${availablePool.length} words after exclusions. Total list: ${validSourceList.length}. Exclusions: ${currentExclusions.size}`);
            // If we want to allow repeats from the whole list if fresh ones are exhausted (excluding only active ones for a given board fill)
            // this logic would need to be more sophisticated, perhaps by also passing activeWordIds to exclude.
            // For now, it will return fewer than 'count' if pool is small.
        }

        const shuffledPool = shuffleArray(availablePool);

        for (const word of shuffledPool) {
            if (newWords.length >= count) break;
            newWords.push(word);
        }
        return newWords;
    }, [fullWordList]); 

    // This function is primarily for the "New Round" button and initial setup.
    // It always starts a "fresh session" in terms of words used for picking.
    const initializeNewRound = useCallback(() => {
        console.log("useMatchingGame: initializeNewRound called (resets session used words & score).");
        setSelectedSpanish(null);
        setSelectedEnglish(null);
        setGameScore(0);
        
        const newSessionExclusions = new Set(); 
        setSessionUsedWordIds(newSessionExclusions); 

        const newPairs = pickNewWords(numPairsToDisplay, fullWordList, newSessionExclusions); 
        if (newPairs.length === 0 && fullWordList.length > 0) {
            console.warn("useMatchingGame: Could not pick any pairs for new round even after session reset.");
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
    }, [fullWordList, numPairsToDisplay, pickNewWords]); 

    // Effect to initialize game ONCE when component mounts with a valid list,
    // OR when fullWordList itself changes identity (signifying a new master list from App.jsx).
    useEffect(() => {
        console.log("useMatchingGame: Initial Mount / fullWordList change effect running.");
        if (fullWordList && fullWordList.length >= numPairsToDisplay) {
            console.log("useMatchingGame: fullWordList is sufficient. Initializing new game session via effect.");
            initializeNewRound(); 
        } else {
            console.log("useMatchingGame: fullWordList not sufficient or empty. Clearing board.");
            setActiveWordPairs([]);
            setSpanishOptions([]);
            setEnglishOptions([]);
            setGameScore(0);
            setSessionUsedWordIds(new Set());
        }
        // This effect should run when fullWordList changes, or numPairsToDisplay changes.
        // The initializeNewRound reference changes only when fullWordList or numPairsToDisplay change (because pickNewWords depends on fullWordList).
    }, [fullWordList, numPairsToDisplay, initializeNewRound]);


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
                
                // Add to sessionUsedWordIds to avoid re-picking immediately in *this continuous session*
                // before "New Round" is hit.
                const newSessionUsed = new Set(sessionUsedWordIds).add(originalPairForSpanish.id);
                setSessionUsedWordIds(newSessionUsed);

                setSpanishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedSpanish.id ? {...opt, matched: true} : opt));
                setEnglishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedEnglish.id ? {...opt, matched: true} : opt));
                
                // Continuous Flow: Replace matched pair
                // We need to pick a new word that isn't currently active AND isn't in newSessionUsed yet
                const activeIds = new Set(activeWordPairs.map(p => p.id));
                const exclusionsForReplacement = new Set([...newSessionUsed, ...activeIds].filter(id => id !== originalPairForSpanish.id));
                
                const replacementCandidates = pickNewWords(fullWordList, 1, exclusionsForReplacement);
                
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
            }
            setSelectedSpanish(null);
            setSelectedEnglish(null);
        }
    }, [selectedSpanish, selectedEnglish, activeWordPairs, pickNewWords, sessionUsedWordIds, fullWordList, numPairsToDisplay]);

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