// src/hooks/useMatchingGame.js
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
    // Tracks words correctly matched in the current "super-session"
    // This set is reset when the "New Round" button is pressed (via initializeNewRound(true))
    // or when fullWordList changes.
    const [sessionUsedWordIds, setSessionUsedWordIds] = useState(new Set());
    
    const gameInitializedForCurrentList = useRef(false);

    // pickNewWords: Fetches 'count' words from 'sourceList', excluding any IDs in 'excludeIdsSet'.
    const pickNewWords = useCallback((sourceList, count, excludeIdsSet = new Set()) => {
        const newWords = [];
        const validSourceList = Array.isArray(sourceList) ? sourceList : [];
        
        // Filter out already excluded words from the source list
        const availablePool = validSourceList.filter(word => !excludeIdsSet.has(word.id));
        const shuffledPool = shuffleArray(availablePool); // Shuffle the filtered pool

        for (const word of shuffledPool) {
            if (newWords.length >= count) break;
            newWords.push(word);
        }
        
        if (newWords.length < count && validSourceList.length >= count) {
             console.warn(`useMatchingGame: pickNewWords could only find ${newWords.length} words to pick from ${availablePool.length} available (needed ${count}). Source list: ${validSourceList.length}. Exclusions: ${excludeIdsSet.size}`);
        }
        return newWords;
    }, []); // This hook is stable and only depends on its arguments directly

    // Function to setup/reset a round. Called by UI button or initial effect.
    const initializeNewRound = useCallback((isNewGameSession = false) => {
        console.log("useMatchingGame: initializeNewRound called. isNewGameSession:", isNewGameSession);
        setSelectedSpanish(null);
        setSelectedEnglish(null);

        let exclusionsForPicking;
        if (isNewGameSession) { // Typically when "New Round" button is pressed or fullWordList changes
            setGameScore(0);
            const newSessionIdSet = new Set();
            setSessionUsedWordIds(newSessionIdSet); // Reset session used words
            exclusionsForPicking = newSessionIdSet; // Pick from anything in fullWordList
            console.log("useMatchingGame: New game session started. Score and sessionUsedWordIds reset.");
        } else {
            // This case would be if we wanted to initialize without resetting session (e.g. just filling board)
            // For current design, "New Round" button implies isNewGameSession = true.
            exclusionsForPicking = sessionUsedWordIds;
        }
        
        let newPairs = pickNewWords(fullWordList, numPairsToDisplay, exclusionsForPicking);
        
        // If after trying to pick from "unused in session", we still don't have enough,
        // it means we might have exhausted the truly unique words for this session.
        // For a "New Round" button, we expect it to always try to provide a full board if possible,
        // even if it means reusing words from the overall fullWordList that might have been in previous rounds of this session.
        // The logic in pickNewWords with sessionUsedWordIds handles trying fresh ones first.
        // If newPairs is still too short, it means the overall fullWordList itself is small.
        if (newPairs.length < numPairsToDisplay && fullWordList.length >= numPairsToDisplay && isNewGameSession) {
             console.warn(`useMatchingGame: Still couldn't get ${numPairsToDisplay} unique pairs after session reset for new round. The overall list might be small or mostly used. Picking from full list again.`);
             // The pickNewWords already tries to get from fullWordList if initial pool is small based on exclusions.
             // This condition might indicate very few words overall compared to numPairsToDisplay.
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
    }, [fullWordList, numPairsToDisplay, pickNewWords, sessionUsedWordIds]); // Added sessionUsedWordIds back

    // Effect to initialize game when fullWordList is first available or changes
    useEffect(() => {
        console.log("useMatchingGame: Effect for fullWordList change or initial mount running.");
        if (fullWordList && fullWordList.length > 0 && fullWordList.length >= numPairsToDisplay) {
            if (!gameInitializedForCurrentList.current) {
                console.log("useMatchingGame: fullWordList is sufficient and game not yet initialized for this list. Initializing new game session.");
                initializeNewRound(true); // Start a brand new game session
                gameInitializedForCurrentList.current = true;
            }
        } else {
            console.log("useMatchingGame: fullWordList not sufficient or empty for game. Clearing board.");
            setActiveWordPairs([]);
            setSpanishOptions([]);
            setEnglishOptions([]);
            setGameScore(0);
            setSessionUsedWordIds(new Set());
            gameInitializedForCurrentList.current = false;
        }
    }, [fullWordList, numPairsToDisplay, initializeNewRound]);


    // Effect to reset initialization flag if fullWordList reference changes
    useEffect(() => {
        // This ensures that if App.jsx provides a new mainWordList array,
        // we treat it as a trigger to re-initialize the game session.
        gameInitializedForCurrentList.current = false;
        console.log("useMatchingGame: fullWordList reference changed, reset initialization flag.");
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
                
                // Add to sessionUsedWordIds: This set tracks words correctly matched in the current "super-session"
                // to try and avoid them when initializeNewRound is called for a fresh board.
                setSessionUsedWordIds(prev => new Set(prev).add(originalPairForSpanish.id));

                // Mark as matched in UI options
                setSpanishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedSpanish.id ? {...opt, matched: true} : opt));
                setEnglishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedEnglish.id ? {...opt, matched: true} : opt));
                
                console.log("useMatchingGame: Pair matched. Items will remain visually matched. Click 'New Round' when done with current board.");

                // Check if all currently displayed active pairs are now visually matched
                // This requires checking the *options* arrays, not activeWordPairs against sessionUsedWordIds
                const allOptionsNowMatched = spanishOptions.every(opt => opt.matched || !activeWordPairs.find(ap => ap.id === opt.id)) &&
                                           englishOptions.every(opt => opt.matched || !activeWordPairs.find(ap => ap.id === opt.id));

                // A simpler check might be if the number of non-matched items is zero,
                // or if activeWordPairs count becomes zero after we implement removal below.
                // For now, let's focus on the user clicking "New Round".

                // If we want to remove the items from active display to shrink the board:
                // This makes the "continuous flow" be "shrinking board"
                // setActiveWordPairs(prevActive => prevActive.filter(p => p.id !== originalPairForSpanish.id));
                // The above line would remove them from being "active truth".
                // The spanishOptions/englishOptions are already marked "matched".
                // If we don't remove from activeWordPairs, they stay as part of the "current board".
                // Let's keep them in activeWordPairs for now, relying on the 'matched' flag for UI.

            } else {
                console.log("useMatchingGame: Incorrect Match.");
                // Visual feedback for incorrect match (e.g. temporary red highlight) would be good here.
            }
            setSelectedSpanish(null);
            setSelectedEnglish(null);
        }
    }, [selectedSpanish, selectedEnglish, activeWordPairs, sessionUsedWordIds]); // Removed pickNewWords, fullWordList, numPairsToDisplay

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
        initializeNewRound, // This is for the "New Round / Reshuffle" button
        activePairCount: activeWordPairs.length,
        allWordsCount: fullWordList.length,
    };
}