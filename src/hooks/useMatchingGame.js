import { useState, useEffect, useCallback } from 'react';

// Helper function (Fisher-Yates shuffle)
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

    const [availableWords, setAvailableWords] = useState([]);
    const [matchedPairIdsInSession, setMatchedPairIdsInSession] = useState(new Set());

    // Initialize availableWords when fullWordList changes
    useEffect(() => {
        setAvailableWords(shuffleArray(fullWordList)); // Shuffle once at the beginning or when list changes
        setMatchedPairIdsInSession(new Set()); // Reset matched session on new list
        setGameScore(0); // Reset score
    }, [fullWordList]);

    // Function to pick N unique words that haven't been matched in this session
    const pickNewWords = useCallback((count) => {
        const newWords = [];
        const currentActiveIds = new Set(activeWordPairs.map(p => p.id));
        
        let attempts = 0; // Safety break for loop
        const availablePool = availableWords.filter(word => !matchedPairIdsInSession.has(word.id) && !currentActiveIds.has(word.id));
        const shuffledPool = shuffleArray(availablePool);

        for (const word of shuffledPool) {
            if (newWords.length >= count) break;
            newWords.push(word);
            attempts++;
            if (attempts > availablePool.length + count) break; // Prevent infinite loop if not enough words
        }
        
        // If not enough unique words from availablePool, grab from anywhere not currently active (less ideal)
        if (newWords.length < count) {
            const fallbackPool = shuffleArray(fullWordList.filter(word => !matchedPairIdsInSession.has(word.id) && !currentActiveIds.has(word.id) && !newWords.some(nw => nw.id === word.id)));
            for (const word of fallbackPool) {
                if (newWords.length >= count) break;
                newWords.push(word);
            }
        }
        return newWords;
    }, [availableWords, matchedPairIdsInSession, activeWordPairs, fullWordList]);


    // Initialize or start a new round
    const initializeRound = useCallback(() => {
        console.log("useMatchingGame: Initializing new round...");
        setSelectedSpanish(null);
        setSelectedEnglish(null);

        const newPairs = pickNewWords(numPairsToDisplay);
        if (newPairs.length < numPairsToDisplay && newPairs.length === 0 && fullWordList.length > 0) {
         
            console.warn("useMatchingGame: Not enough unique words to start a new round of " + numPairsToDisplay);
            setActiveWordPairs([]);
            setSpanishOptions([]);
            setEnglishOptions([]);
            return; // Can't start
        }
        
        setActiveWordPairs(newPairs);

        // Prepare display options (text and original ID for matching)
        const spaOpts = newPairs.map(pair => ({ id: pair.id, text: pair.spanish, type: 'spanish', matched: false }));
        const engOpts = newPairs.map(pair => ({ id: pair.id, text: pair.english, type: 'english', matched: false }));

        setSpanishOptions(shuffleArray(spaOpts));
        setEnglishOptions(shuffleArray(engOpts));
        console.log("useMatchingGame: New round initialized with pairs:", newPairs);

    }, [pickNewWords, numPairsToDisplay, fullWordList]); 


    useEffect(() => {
        if (fullWordList.length > 0 && availableWords.length > 0) { 
            initializeRound();
        }
    }, [availableWords, initializeRound, fullWordList]); // Rerun if availableWords list changes


    // Placeholder for match checking and continuous flow logic
    const attemptMatch = useCallback(() => {
        if (selectedSpanish && selectedEnglish) {
            console.log("useMatchingGame: Attempting match...", selectedSpanish, selectedEnglish);
            
            // Find the original pair for the selected Spanish word
            const originalPair = activeWordPairs.find(p => p.id === selectedSpanish.id);

            if (originalPair && originalPair.english.toLowerCase().trim() === selectedEnglish.text.toLowerCase().trim()) {
                console.log("useMatchingGame: Correct Match!", originalPair);
                setGameScore(prev => prev + 1);
                setMatchedPairIdsInSession(prev => new Set(prev).add(originalPair.id));

                // Mark as matched in UI options (this will be used by the UI component)
                setSpanishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedSpanish.id ? {...opt, matched: true} : opt));
                setEnglishOptions(prevOpts => prevOpts.map(opt => opt.id === selectedEnglish.id ? {...opt, matched: true} : opt));
                
                // --- Continuous Flow: Replace matched pair ---
                // Find the matched pair in activeWordPairs and replace it
                const newWordsForReplacement = pickNewWords(1); // Get one new word
                if (newWordsForReplacement.length > 0) {
                    const newWord = newWordsForReplacement[0];
                    // Replace in activeWordPairs
                    setActiveWordPairs(prevActive => {
                        const updatedActive = prevActive.filter(p => p.id !== originalPair.id);
                        updatedActive.push(newWord);
                        return updatedActive;
                    });

                    // Remove old options, add new options, then shuffle again for display
                    // This ensures the "slot" of the matched item is refilled
                    setSpanishOptions(prevOpts => shuffleArray([
                        ...prevOpts.filter(opt => opt.id !== selectedSpanish.id),
                        { id: newWord.id, text: newWord.spanish, type: 'spanish', matched: false }
                    ]));
                    setEnglishOptions(prevOpts => shuffleArray([
                        ...prevOpts.filter(opt => opt.id !== selectedEnglish.id),
                        { id: newWord.id, text: newWord.english, type: 'english', matched: false }
                    ]));

                } else {
                    // No new words to replace with, might be end of available words
                    // The matched items are just marked as 'matched: true'
                    // If all active pairs are matched, the game/round might end
                    console.log("useMatchingGame: No new words available to replace the matched pair.");
                    // Check if all current active pairs are matched
                    const allMatched = activeWordPairs.every(ap => matchedPairIdsInSession.has(ap.id) || ap.id === originalPair.id); // Include current match
                    if(allMatched && activeWordPairs.every(ap => spanishOptions.find(so => so.id === ap.id)?.matched && englishOptions.find(eo => eo.id === ap.id)?.matched )) {
                        console.log("useMatchingGame: All currently displayed pairs matched! Consider re-initializing or ending.");
                        // Potentially call initializeRound() for a new set if desired, or set a game over state
                        // For now, it will just sit with all matched.
                    }
                }

            } else {
                console.log("useMatchingGame: Incorrect Match.");
                // Provide feedback for incorrect match (e.g., flash red, then deselect)
                // For now, just deselect
            }
            // Clear selections after attempting a match
            setSelectedSpanish(null);
            setSelectedEnglish(null);
        }
    }, [selectedSpanish, selectedEnglish, activeWordPairs, pickNewWords, numPairsToDisplay, matchedPairIdsInSession]);


    // Handle selections
    const handleSpanishSelection = useCallback((spanishItem) => {
        if (spanishItem.matched) return; // Don't select already matched items
        setSelectedSpanish(spanishItem);
    }, []);

    const handleEnglishSelection = useCallback((englishItem) => {
        if (englishItem.matched) return; // Don't select already matched items
        setSelectedEnglish(englishItem);
    }, []);

  
    useEffect(() => {
        if (selectedSpanish && selectedEnglish) {
             setTimeout(() => attemptMatch(), 300); 
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
        initializeRound, // Expose if manual reset/new round is needed from UI
        activePairCount: activeWordPairs.length, // To know if game can start/continue
        allWordsCount: fullWordList.length, // For UI checks
    };
}