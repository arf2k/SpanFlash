// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import Flashcard from './components/Flashcard'; // Assuming Flashcard is imported
import { getMwHint } from './services/dictionaryServices.js'; // Assuming service is defined
import { db } from './db.js'
import './App.css';

function App() {
    // === State Variables ===
    const [wordList, setWordList] = useState([]);
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState('spa-eng');
    const [isLoading, setIsLoading] = useState(true); // Start true for initial load
    const [error, setError] = useState(null);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 }); // Default score
    const [hardWordsList, setHardWordsList] = useState([]); // List of hard word pairs
    const [hintData, setHintData] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false); // To show incorrect msg area
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState(''); // For incorrect msg
    const [maxWords, setMaxWords] = useState(5); // Max words filter
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [feedbackSignal, setFeedbackSignal] = useState(null); // For flashcard animation ('correct'/'incorrect')

    // === Refs ===
    const incorrectScoreRef = useRef(null);   // Ref for the INCORRECT score span flash
    const isInitialMountScore = useRef(true); // Ref to prevent score flash/save on initial load
    const isInitialMountMaxWords = useRef(true); // Ref for maxWords effect trigger

    // === Selection Logic ===
    // Selects a new pair, resets states, but DOES NOT manage isLoading
    const selectNewPair = (listToUse = wordList) => {
        console.log(`Selecting pair from list (${listToUse.length} items), max words: ${maxWords}`);
        setError(null); // Clear previous selection errors
        setHintData(null);
        setCurrentPair(null); // Clear current pair first
        setShowFeedback(false);
        setIsHintLoading(false);
        setFeedbackSignal(null);

        if (!listToUse || listToUse.length === 0) {
            console.error("selectNewPair called with empty list.");
            setError("Cannot select pair: Word list is empty.");
            setCurrentPair(null);
            return;
        }

        try {
            const filteredData = listToUse.filter(pair => {
                if (!pair || typeof pair.english !== 'string' || typeof pair.spanish !== 'string') return false;
                const englishWords = pair.english.split(' ').filter(word => word.length > 0).length;
                const spanishWords = pair.spanish.split(' ').filter(word => word.length > 0).length;
                // Ensure words are within limit (and > 0)
                return englishWords > 0 && englishWords <= maxWords &&
                       spanishWords > 0 && spanishWords <= maxWords;
            });
            console.log(`Found ${filteredData.length} pairs matching max words criteria.`);

            if (filteredData.length > 0) {
                const randomIndex = Math.floor(Math.random() * filteredData.length);
                const pair = filteredData[randomIndex];
                console.log("Successfully selected filtered pair:", pair);
                setCurrentPair(pair); // Set the new pair
            } else {
                 const errMsg = `No pairs found with <= ${maxWords} words per side.`;
                 console.warn(errMsg);
                 setError(errMsg);
                 setCurrentPair(null); // Ensure no card shown
            }
        } catch (err) {
            console.error("Error during pair selection/filtering:", err);
            setError(err.message || 'Failed to select flashcard pair.');
            setCurrentPair(null);
        } finally {
             console.log("selectNewPair finished execution.");
        }
    };

    // === Combined Initial Load useEffect ===
    // Loads word list, score, hard words, then selects first pair
    useEffect(() => {
        const loadInitialData = async () => {
            console.log("App component mounted. Loading ALL initial data...");
            setIsLoading(true); // Set loading true for the entire process
            setError(null);
            // Reset states visually
            setWordList([]); setScore({ correct: 0, incorrect: 0 });
            setHardWordsList([]); setCurrentPair(null);

            try {
                // 1. Fetch word list
                console.log("Fetching word list...");
                const response = await fetch('/scrapedSpan411.json'); // Adjust path if needed
                if (!response.ok) { throw new Error(`Word list fetch failed: ${response.status} ${response.statusText}`); }
                const loadedList = await response.json();
                if (!Array.isArray(loadedList)) { throw new Error("Word list data is not a valid array."); }
                console.log(`Successfully loaded ${loadedList.length} pairs.`);
                setWordList(loadedList);

                // 2. Load Score from DB
                console.log("Loading score from DB...");
                const savedScoreState = await db.appState.get('userScore');
                if (savedScoreState) {
                    console.log("Found saved score:", savedScoreState);
                    setScore({ correct: savedScoreState.correct, incorrect: savedScoreState.incorrect });
                } else {
                    console.log("No saved score found, saving default.");
                    await db.appState.put({ id: 'userScore', correct: 0, incorrect: 0 });
                }

                // 3. Load Hard Words from DB
                console.log("Loading hard words from DB...");
                const loadedHardWords = await db.hardWords.toArray();
                if (loadedHardWords) {
                    console.log(`Loaded ${loadedHardWords.length} hard words.`);
                    setHardWordsList(loadedHardWords);
                }

                // 4. Select the first pair
                console.log("Selecting initial pair...");
                selectNewPair(loadedList); // Use the just-loaded list

            } catch (err) {
                console.error("Error during initial data load:", err);
                setError(err.message || "Failed to load initial data.");
                // Ensure states are clean on error
                setWordList([]); setCurrentPair(null);
                setScore({ correct: 0, incorrect: 0 }); setHardWordsList([]);
            } finally {
                // Set loading false ONLY after all steps are done
                console.log("Setting isLoading to false after initial load sequence.");
                setIsLoading(false);
                // Signal initial DB load attempt is done
                isInitialMountScore.current = false;
            }
        };

        loadInitialData();
        // Empty dependency array ensures this runs only once on mount
    }, []); // END of combined initial load useEffect

    // === Saving Score useEffect ===
    // Saves score to DB whenever the score state changes (after initial load)
    useEffect(() => {
        // Prevent saving during initial mount before data load completes
        if (isInitialMountScore.current) { return; }

        const saveScoreToDB = async () => {
             console.log("Score changed, attempting to save to DB:", score);
            try {
                await db.appState.put({ id: 'userScore', correct: score.correct, incorrect: score.incorrect });
                console.log("Score saved successfully to DB.");
            } catch (err) { console.error("Failed to save score to DB:", err); }
        };
        saveScoreToDB();
    }, [score]); // Dependency: run whenever score state changes

    // === Incorrect Score Flash useEffect ===
    // Adds/removes CSS class to incorrect score number for flashing animation
    useEffect(() => {
        // Also prevent flash on initial mount before score is potentially loaded
        if (isInitialMountScore.current) { return; }

        // Check if score actually increased > 0 and ref exists
        if (score.incorrect > 0 && incorrectScoreRef.current) {
            const element = incorrectScoreRef.current;
            // Check if class is already present to prevent re-adding if effect runs quickly
            if (!element.classList.contains('score-flash-incorrect')) {
                console.log("ADDING flash class to INCORRECT score element:", element);
                element.classList.add('score-flash-incorrect');

                const animationDuration = 1000; // Must match CSS animation duration (1.0s)
                setTimeout(() => {
                    if (element) {
                        console.log("REMOVING flash class from INCORRECT score element:", element);
                        element.classList.remove('score-flash-incorrect');
                    }
                }, animationDuration);
            }
        }
    }, [score.incorrect]); // Dependency: run whenever incorrect score changes

    // === Mark Hard Word Handler ===
    // Saves the passed word pair to the 'hardWords' IndexedDB store
    const handleMarkHard = async (pairToMark) => {
        if (!pairToMark || !pairToMark.spanish || !pairToMark.english) {
            console.error("Invalid pair passed to handleMarkHard"); return;
        }
        console.log("Attempting to mark as hard:", pairToMark);
        try {
            // Use put with compound key defined in db.js schema '[spanish+english]'
            // This adds if new, or updates if already exists (effectively doing nothing)
            await db.hardWords.put({
                 spanish: pairToMark.spanish,
                 english: pairToMark.english
                 // Only saving keys for now, could save whole pair object
            });
            console.log("Successfully saved/updated hard word in DB:", pairToMark);

             // Update React state if it's not already visually marked in the list
            if (!hardWordsList.some(word => word.spanish === pairToMark.spanish && word.english === pairToMark.english)) {
                setHardWordsList(prevList => [...prevList, { spanish: pairToMark.spanish, english: pairToMark.english }]); // Add simple pair object
                 console.log("Updated hardWordsList state.");
            } else { console.log("Word already present in state list."); }
        } catch (error) { console.error("Failed to save hard word:", error); }
    };

    // === Answer Submission Logic ===
    // Checks answer, applies normalization (articles, 'to'), updates score/feedback
    const handleAnswerSubmit = (userAnswer) => {
        const punctuationRegex = /[.?!¡¿]+$/;
        const englishArticleRegex = /^(the|a|an)\s+/i;
        const toVerbRegex = /^to\s+/i;

        if (!currentPair || showFeedback) { return; } // Guard if no card or feedback showing

        const correctAnswer = languageDirection === 'spa-eng' ? currentPair.english : currentPair.spanish;
        let normalizedUserAnswer = userAnswer.toLowerCase().trim().replace(punctuationRegex, '');
        let normalizedCorrectAnswer = correctAnswer.toLowerCase().trim().replace(punctuationRegex, '');

        // Apply normalization only for English answers
        if (languageDirection === 'spa-eng') {
            normalizedUserAnswer = normalizedUserAnswer.replace(englishArticleRegex, '').replace(toVerbRegex, '');
            normalizedCorrectAnswer = normalizedCorrectAnswer.replace(englishArticleRegex, '').replace(toVerbRegex, '');
        }

        console.log(`Comparing (final normalized): "${normalizedUserAnswer}" vs "${normalizedCorrectAnswer}"`);

        if (normalizedUserAnswer === normalizedCorrectAnswer) {
            console.log("CORRECT branch executed.");
            setScore(prev => ({ ...prev, correct: prev.correct + 1 }));
            setFeedbackSignal('correct'); // Signal for flashcard animation
            // Short delay before selecting next pair allows feedback signal to render
            setTimeout(() => { selectNewPair(); }, 50);
        } else {
            console.log("INCORRECT branch executed.");
            setScore(prev => ({ ...prev, incorrect: prev.incorrect + 1 })); // Triggers incorrect score flash effect
            setLastCorrectAnswer(correctAnswer); // Store original correct answer for display
            setShowFeedback(true); // Show the feedback message area
            setFeedbackSignal('incorrect'); // Signal for flashcard animation
        }
    };

    // === Max Words Change Handler ===
    const handleMaxWordsChange = (event) => {
        const newVal = parseInt(event.target.value, 10);
        setMaxWords(newVal >= 1 ? newVal : 1);
        console.log("Max words changed to:", newVal >= 1 ? newVal : 1);
        // Trigger selection effect below
    };

    // === Effect for Max Words Change ===
    // Selects a new pair when maxWords changes (after initial mount)
    useEffect(() => {
         if (isInitialMountMaxWords.current) {
             isInitialMountMaxWords.current = false; // Skip effect on first render
         } else {
             // Only select if wordList is loaded
             if (wordList.length > 0) {
                 console.log(`Max words changed to ${maxWords}, selecting new pair...`);
                 // Set loading briefly for user feedback? Optional.
                 // setIsLoading(true);
                 selectNewPair();
                 // setIsLoading(false); // Need careful management if adding loading here
             }
         }
    }, [maxWords, wordList]); // Rerun if maxWords changes (or wordList loads after mount)

    // === Language Switch Handler ===
    const switchLanguageDirection = () => {
        setLanguageDirection(prev => prev === 'spa-eng' ? 'eng-spa' : 'spa-eng');
        // Reset states relevant to the current card/feedback
        setShowFeedback(false);
        setLastCorrectAnswer('');
        setHintData(null);
        setFeedbackSignal(null);
        // Maybe select a new card immediately? Optional.
        // selectNewPair();
    };

    // === Hint Logic Handler ===
    const handleGetHint = async () => {
        if (!currentPair || hintData || showFeedback || isHintLoading || feedbackSignal === 'incorrect') return;
        // Assuming hint lookup is always based on the Spanish word for M-W
        const wordToLookup = (languageDirection === 'spa-eng') ? currentPair.spanish : currentPair.english; // Adapt if needed
        if (languageDirection !== 'spa-eng') {
             console.warn("Hint lookup currently optimized for Spanish words via spa-eng direction.");
             // Potentially disable hint button or use a different API for English hints?
             // return;
        }
        console.log(`Getting hint for: "${wordToLookup}"`);
        setIsHintLoading(true); setHintData(null);
        try {
            const apiResponse = await getMwHint(wordToLookup); console.log("Raw Hint Data:", apiResponse);
            // Handle potential variations in API response structure
            let definitionData = null;
            if (Array.isArray(apiResponse) && apiResponse.length > 0) {
                 if (typeof apiResponse[0] === 'string') { setHintData({ type: 'suggestions', suggestions: apiResponse }); return; }
                 else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta) { definitionData = apiResponse[0]; }
                 else { setHintData({ type: 'unknown', raw: apiResponse }); return; }
            } else if (typeof apiResponse === 'object' && !Array.isArray(apiResponse) && apiResponse !== null && apiResponse?.meta) {
                 definitionData = apiResponse; // Handle direct object response
            }

            if (definitionData) {
                 setHintData({ type: 'definitions', data: definitionData });
            } else if (!hintData) { // Avoid overwriting suggestions/unknown state if def parsing failed
                setHintData({ type: 'error', message: "Hint data not found or in unexpected format." });
            }
        } catch (err) {
            console.error("Error in handleGetHint function:", err);
            setHintData({ type: 'error', message: "Failed to fetch hint." });
        } finally {
            setIsHintLoading(false);
        }
    };


    // === Component Return ===
    return (
        <div className="App">
            <h1>Spanish Flashcards</h1>

            {/* Score Stacks Area */}
            <div className="score-stacks-container">
                <div className="stack correct-stack">
                    <div className="stack-label">Correct</div>
                    <div className="cards">
                        <span className="card-icon correct-icon" role="img" aria-label="Correct answers">✅</span>
                        <span className="stack-count">{score.correct}</span>
                    </div>
                </div>
                <div className="stack incorrect-stack">
                    <div className="stack-label">Incorrect</div>
                    <div className="cards">
                        <span className="card-icon incorrect-icon" role="img" aria-label="Incorrect answers">❌</span>
                        {/* Ref for incorrect score flash */}
                        <span className="stack-count" ref={incorrectScoreRef}>{score.incorrect}</span>
                    </div>
                </div>
            </div>

            {/* Controls Area */}
            <div className="controls" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
               <button onClick={switchLanguageDirection}>Switch Direction ({languageDirection === 'spa-eng' ? 'Spa -> Eng' : 'Eng -> Spa'})</button>
               <button onClick={() => { setIsLoading(true); selectNewPair(); setIsLoading(false); }} disabled={isLoading || wordList.length === 0}>
                 {isLoading ? 'Loading...' : 'New Card'}
               </button>
                 {/* Optional Max Words Slider */}
                 {/* <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                     <label htmlFor="maxWordsInput">Max Words:</label>
                     <input type="range" id="maxWordsInput" value={maxWords} onChange={handleMaxWordsChange} min="1" max="10" />
                     <span>{maxWords}</span>
                 </div> */}
            </div>

            {/* Status Messages Area */}
            {isLoading && <p>Loading...</p> /* Simplified Loading Message */}
            {error && !isLoading && (
                <div className="error-area" style={{ marginBottom: '10px', color: 'red', border: '1px solid red', padding: '10px', borderRadius: '4px' }}>
                     <p>Error: {error}</p>
                     {/* Option to try getting a new card again */}
                     <button onClick={() => { setIsLoading(true); selectNewPair(); setIsLoading(false); }} disabled={isLoading || wordList.length === 0}>
                         Try New Card
                     </button>
                </div>
             )}

            {/* Flashcard Area */}
            {/* Only render Flashcard component etc. when NOT loading, NO error, and a pair IS selected */}
            {!isLoading && !error && currentPair && (
                <div className="flashcard-area">
                    {(() => {
                        // Calculate marked status here
                        const isCurrentCardMarked = hardWordsList.some(
                            word => word.spanish === currentPair.spanish && word.english === currentPair.english
                        );
                        // console.log(`Card marked: ${isCurrentCardMarked}`); // Debug log

                        return (
                            <Flashcard
                                pair={currentPair}
                                direction={languageDirection}
                                onAnswerSubmit={handleAnswerSubmit}
                                showFeedback={showFeedback} // Pass down to disable input etc.
                                onGetHint={handleGetHint}
                                hint={hintData}
                                isHintLoading={isHintLoading}
                                feedbackSignal={feedbackSignal} // For card flash animation
                                onMarkHard={handleMarkHard} // For marking word
                                isMarkedHard={isCurrentCardMarked} // For star icon state
                            />
                        );
                    })()}

                    {/* Incorrect Answer Feedback Display */}
                    {/* Show feedback message ONLY when showFeedback is true */}
                    {showFeedback && (
                        <div className="feedback-area" style={{ marginTop: '10px' }}>
                            <p style={{ color: '#D90429', fontWeight: 'bold', margin: '0' }}>Incorrect. Correct: "{lastCorrectAnswer}"</p>
                            {/* Removed Next Card button is correct */}
                        </div>
                    )}
                </div>
            )}

            {/* Fallback message if no card is selected but not loading and no error */}
            {!isLoading && !error && !currentPair && wordList.length > 0 && (
                 <p>No flashcard available matching criteria. Try clicking 'New Card' or check filters.</p>
            )}
             {!isLoading && !error && !currentPair && wordList.length === 0 && (
                 <p>Word list failed to load or is empty. Check console.</p>
             )}


            {/* Debug State Display */}
            <details style={{ marginTop: '20px', padding: '10px', border: '1px solid #eee', borderRadius: '4px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Show Current State</summary>
                <pre style={{ textAlign: 'left', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8em', marginTop: '10px' }}>
                    isLoading: {JSON.stringify(isLoading)}
                    {'\n'}Error: {JSON.stringify(error)}
                    {'\n'}Direction: {languageDirection}
                    {'\n'}Current Pair: {JSON.stringify(currentPair?.spanish)} / {JSON.stringify(currentPair?.english)}
                    {'\n'}Score: {JSON.stringify(score)}
                    {'\n'}Hard Words Count: {hardWordsList.length}
                    {'\n'}Show Feedback: {JSON.stringify(showFeedback)}
                    {'\n'}Feedback Signal: {JSON.stringify(feedbackSignal)}
                    {'\n'}Hint Loading: {JSON.stringify(isHintLoading)}
                    {/* {'\n'}Hint Data: {JSON.stringify(hintData)} */}
                    {/* {'\n'}Hard Words List: {JSON.stringify(hardWordsList)} */}
                </pre>
            </details>
        </div>
    );
}
export default App;