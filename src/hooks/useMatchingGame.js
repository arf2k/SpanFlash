// src/hooks/useMatchingGame.js
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
    const initialLoadAttemptedForCurrentList = useRef(false); // This ref might not be strictly needed with the revised effect below

    // Effect to reset game state when the source fullWordList changes
    useEffect(() => {
        console.log("useMatchingGame: fullWordList prop changed or initial mount. Resetting game session states.");
        setGameScore(0);
        setSessionUsedWordIds(new Set());
        setSelectedSpanish(null);
        setSelectedEnglish(null);
        // We will let the initialization effect handle activeWordPairs and options
        initialLoadAttemptedForCurrentList.current = false; // Mark that we need to re-initialize for this list
    }, [fullWordList]);


    // Stable pickNewWords using useCallback, depends only on fullWordList for its pool
    const pickNewWords = useCallback((count, currentExclusions = new Set()) => {
        const newWords = [];
        const validSourceList = Array.isArray(fullWordList) ? fullWordList : [];
        
        let availablePool = validSourceList.filter(word => !currentExclusions.has(word.id));
        
        if (availablePool.length < count && validSourceList.length >=count) {
            console.warn(`useMatchingGame: pickNewWords found only ${availablePool.length} words after exclusions (needed ${count}). Total list: ${validSourceList.length}. Exclusions: ${currentExclusions.size}`);
            // If not enough fresh words, for continuous flow, we might allow picking from already used in session,
            // but still exclude those *currently active on board* if this pick is for replacement.
            // For a full new round, this implies we might need to allow repeats if list is small.
        }

        const shuffledPool = shuffleArray(availablePool);

        for (const word of shuffledPool) {
            if (newWords.length >= count) break;
            newWords.push(word);
        }
        return newWords;
    }, [fullWordList]); 

    const initializeNewRound = useCallback((isNewGameSession = false) => {
        console.log("useMatchingGame: initializeNewRound called. isNewGameSession:", isNewGameSession);
        setSelectedSpanish(null);
        setSelectedEnglish(null);

        let exclusionsForPicking = sessionUsedWordIds;
        if (isNewGameSession) {
            setGameScore(0);
            const newSessionIdSet = new Set();
            setSessionUsedWordIds(newSessionIdSet); // Update state
            exclusionsForPicking = newSessionIdSet; // Use the fresh set immediately for picking
        }
        
        // *** CORRECTED CALL TO pickNewWords ***
        let newPairs = pickNewWords(numPairsToDisplay, exclusionsForPicking); 
        
        if (newPairs.length < numPairsToDisplay && fullWordList.length >= numPairsToDisplay) {
            console.warn(`useMatchingGame: Not enough unique words for a round from current session exclusions. Resetting session exclusions for this pick.`);
            const freshExclusions = new Set();
            setSessionUsedWordIds(freshExclusions); 
            // *** CORRECTED CALL TO pickNewWords ***
            newPairs = pickNewWords(numPairsToDisplay, freshExclusions); 
        }
        
        if (newPairs.length === 0 && fullWordList.length > 0) {
            console.warn("useMatchingGame: Could not pick any pairs for new round.");
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
    }, [fullWordList, numPairsToDisplay, pickNewWords, sessionUsedWordIds]);


    // Effect to initialize game when component mounts with a valid list,
    // OR when fullWordList itself changes identity.
    useEffect(() => {
        console.log("useMatchingGame: Effect for initial load / fullWordList change running.");
        if (fullWordList && fullWordList.length >= numPairsToDisplay) {
            // If the fullWordList reference has changed, initialLoadAttemptedForCurrentList will have been reset to false
            // by the other useEffect. Or, on first mount, it's false.
            if (!initialLoadAttemptedForCurrentList.current) {
                console.log("useMatchingGame: fullWordList is sufficient. Initializing new game session via effect.");
                initializeNewRound(true); // Start a new game session, reset score and used words
                initialLoadAttemptedForCurrentList.current = true; // Mark that we've initialized for this list
            }
        } else {
            console.log("useMatchingGame: fullWordList not sufficient or empty. Clearing board.");
            setActiveWordPairs([]);
            setSpanishOptions([]);
            setEnglishOptions([]);
            setGameScore(0); // Ensure score is reset if no game can be played
            setSessionUsedWordIds(new Set()); // Ensure session is reset
            initialLoadAttemptedForCurrentList.current = false; // Reset flag if list becomes too small
        }
    }, [fullWordList, numPairsToDisplay, initializeNewRound]);


    const attemptMatch = useCallback(() => {
        if (selectedSpanish && selectedEnglish) {
            // console.log("useMatchingGame: Attempting match...", {selectedSpanish}, {selectedEnglish});
            const originalPairForSpanish = activeWordPairs.find(p => p.id === selectedSpanish.id);
            let isCorrectMatch = false;

            // A match is correct if both selected items belong to the same original pair ID
            if (originalPairForSpanish && originalPairForSpanish.id === selectedEnglish.id) {
                isCorrectMatch = true; 
            }

            if (isCorrectMatch) {
                console.log("useMatchingGame: Correct Match!", originalPairForSpanish);
                setGameScore(prev => prev + 1);
                
                const newMatchedIds = new Set(sessionUsedWordIds).add(originalPairForSpanish.id);
                setSessionUsedWordIds(newMatchedIds);

                setSpanishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedSpanish.id ? {...opt, matched: true} : opt));
                setEnglishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedEnglish.id ? {...opt, matched: true} : opt));
                
                const currentActiveIds = new Set(activeWordPairs.map(p => p.id));
                // For the new word, we want to exclude everything currently active AND everything already matched in the session
                const exclusionsForReplacement = new Set([...newMatchedIds, ...currentActiveIds]);
                
                // *** CORRECTED CALL TO pickNewWords ***
                const replacementCandidates = pickNewWords(1, exclusionsForReplacement); 
                
                if (replacementCandidates.length > 0) {
                    const newWordToDisplay = replacementCandidates[0];
                    
                    setActiveWordPairs(prevActive => 
                        // Ensure newWordToDisplay isn't already somehow in prevActive before adding,
                        // though pickNewWords with currentActiveIds in exclusions should prevent this.
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
    }, [selectedSpanish, selectedEnglish, activeWordPairs, pickNewWords, sessionUsedWordIds, numPairsToDisplay, fullWordList]);

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