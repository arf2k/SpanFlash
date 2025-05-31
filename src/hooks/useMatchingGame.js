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

    const initializeNewRound = useCallback((isNewSessionStart = false) => {
        console.log(
            "useMatchingGame: initializeNewRound called. isNewSessionStart:",
            isNewSessionStart
        );
        setSelectedSpanish(null);
        setSelectedEnglish(null);
        setIncorrectAttempt({ spanishId: null, englishId: null }); 

        let exclusionsForPicking = sessionUsedWordIds;
        if (isNewSessionStart) {
            setGameScore(0);
            const newSessionIdSet = new Set();
            setSessionUsedWordIds(newSessionIdSet);
            exclusionsForPicking = newSessionIdSet;
      
        }

        let newPairs = pickNewWords(numPairsToDisplay, exclusionsForPicking);

        if (
            newPairs.length < numPairsToDisplay &&
            fullWordList.length >= numPairsToDisplay
        ) {
     
            const completelyFreshExclusions = new Set();
            newPairs = pickNewWords(numPairsToDisplay, completelyFreshExclusions);
            if (isNewSessionStart) {
                setSessionUsedWordIds(completelyFreshExclusions);
            }
        }

        if (newPairs.length === 0 && fullWordList.length > 0) {
            console.warn(
                "useMatchingGame: Could not pick any pairs for new round. Displaying empty board."
            );
            setActiveWordPairs([]);
            setSpanishOptions([]);
            setEnglishOptions([]);
            return;
        }
        if (newPairs.length > 0 && newPairs.length < numPairsToDisplay) {
      
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
   
    }, [fullWordList, numPairsToDisplay, pickNewWords, sessionUsedWordIds]);

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
                setSessionUsedWordIds((prev) =>
                    new Set(prev).add(originalPairForSpanish.id)
                );

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
          
            } else {
                console.log("useMatchingGame: Incorrect Match.");
                // --- Set state for incorrect feedback ---
                setIncorrectAttempt({ spanishId: selectedSpanish.id, englishId: selectedEnglish.id });
                setTimeout(() => {
                    setIncorrectAttempt({ spanishId: null, englishId: null }); 
                }, 1000); 
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
        incorrectAttempt,
    };
}