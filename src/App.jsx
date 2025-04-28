// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import Flashcard from './components/Flashcard';
import { getMwHint } from './services/dictionaryServices.js';
import './App.css';

// Define constants (TOTAL_CHUNKS no longer needed for fetching)
// const TOTAL_CHUNKS = 23; // Comment out or remove

function App() {
    // === State Variables ===
    const [wordList, setWordList] = useState([]); // <-- ADD state for the full list
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState('spa-eng');
    const [isLoading, setIsLoading] = useState(true); // Loading now mainly for initial list load
    const [error, setError] = useState(null);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [hintData, setHintData] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState('');
    const [maxWords, setMaxWords] = useState(5);
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [feedbackSignal, setFeedbackSignal] = useState(null)

    const isInitialMount = useRef(true); // Used for maxWords effect

    // === NEW: Selection Logic (replaces fetchRandomPair's core selection part) ===
    const selectNewPair = (listToUse = wordList) => {
        console.log(`Selecting pair from list (${listToUse.length} items), max words: ${maxWords}`);
        setError(null);         
        setHintData(null);      
        setCurrentPair(null); 
        setShowFeedback(false); 
        setIsHintLoading(false); 
        setFeedbackSignal(null);

        if (!listToUse || listToUse.length === 0) {
            setError("Word list is empty or not loaded yet.");
            setIsLoading(false); // Ensure loading is off if list is empty
            return;
        }

        setIsLoading(true); // Show loading briefly while filtering/selecting

        try {
            // Filter the full list based on maxWords state
            const filteredData = listToUse.filter(pair => {
                if (!pair || typeof pair.english !== 'string' || typeof pair.spanish !== 'string') return false;
                const englishWords = pair.english.split(' ').filter(word => word.length > 0).length;
                const spanishWords = pair.spanish.split(' ').filter(word => word.length > 0).length;
                return englishWords > 0 && englishWords <= maxWords &&
                       spanishWords > 0 && spanishWords <= maxWords;
            });
            console.log(`Found ${filteredData.length} pairs matching max words criteria.`);

            // Select random pair from the FILTERED list
            if (filteredData.length > 0) {
                const randomIndex = Math.floor(Math.random() * filteredData.length);
                const pair = filteredData[randomIndex];
                console.log("Successfully selected filtered pair:", pair);
                setCurrentPair(pair); // Update state with the filtered pair
            } else {
                 // Handle cases where filtering yields no results
                throw new Error(`No pairs found in the list with <= ${maxWords} words per side. Try adjusting Max Words.`);
            }

        } catch (err) {
            console.error("Error selecting/filtering pair:", err);
            setError(err.message || 'Failed to select flashcard pair.');
            setCurrentPair(null);
        } finally {
             setIsLoading(false); // Stop loading indicator
        }
    };


    // === Initial Load Logic (useEffect on Mount) ===
    useEffect(() => {
        const loadWordData = async () => {
            console.log("App component mounted. Loading word list...");
            setIsLoading(true);
            setError(null);
            setWordList([]); // Clear previous list

            try {
                // Fetch the single JSON file
                const response = await fetch('/scrapedSpan411.json'); // <-- Fetch your file
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
                }
                const loadedList = await response.json();
                if (!Array.isArray(loadedList)) {
                    throw new Error("Loaded data is not a valid array.");
                }
                console.log(`Successfully loaded ${loadedList.length} pairs.`);
                setWordList(loadedList); // Store the full list in state
                selectNewPair(loadedList); // Select the FIRST pair from the freshly loaded list

            } catch (err) {
                console.error("Error loading word list:", err);
                setError(err.message || "Failed to load word list.");
                setIsLoading(false); // Stop loading on error
            }
            // setIsLoading(false) is handled by selectNewPair's finally block
        };

        loadWordData();

     }, []); // Empty dependency array runs only ONCE on mount


    // === Answer Submission Logic ===
    const handleAnswerSubmit = (userAnswer) => {
        // ... (Normalization and comparison logic remains the same) ...
        const punctuationRegex = /[.?!¡¿]+$/;
        if (!currentPair || showFeedback) {
          console.log(`Submission blocked by guard: currentPair=${!!currentPair}, showFeedback=${showFeedback}`);

          return;
      }
        const correctAnswer = languageDirection === 'spa-eng' ? currentPair.english : currentPair.spanish;
        const normalizedUserAnswer = userAnswer.toLowerCase().trim().replace(punctuationRegex, '');
        const normalizedCorrectAnswer = correctAnswer.toLowerCase().trim().replace(punctuationRegex, '');

        console.log(`Comparing (punctuation ignored): "${normalizedUserAnswer}" vs "${normalizedCorrectAnswer}"`);

        if (normalizedUserAnswer === normalizedCorrectAnswer) {
            console.log("CORRECT branch executed. Selecting next pair...");
            setScore(prevScore => ({ ...prevScore, correct: prevScore.correct + 1 }));
            setFeedbackSignal('correct');
            setTimeout(() => {
              console.log("Executing selectNewPair after correct answer timeout.");
              selectNewPair();
              // We don't need to setFeedbackSignal(null) here because
              // selectNewPair sets it to null at its start.
         }, 50); // Small delay in milliseconds

        } else {
            console.log("INCORRECT branch executed. Setting showFeedback=true.");
            setScore(prevScore => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
            setLastCorrectAnswer(correctAnswer);
            setShowFeedback(true);
            setFeedbackSignal('incorrect');
        }
    };

    // === Handling "Next Card" After Incorrect Answer ===
    const handleNextCard = () => {
        setShowFeedback(false);
        setLastCorrectAnswer('');
        selectNewPair(); // <-- CALL selectNewPair
    };

    // === Handling Max Words Setting Change ===
    // (Keep this function as is)
    const handleMaxWordsChange = (event) => {
        const newValue = parseInt(event.target.value, 10);
        setMaxWords(newValue >= 1 ? newValue : 1);
        console.log("Max words setting changed to:", newValue >= 1 ? newValue : 1);
        // We could optionally call selectNewPair() here too if we want immediate update
    };


    // === Effect for Max Words Change (Optional: Trigger new selection) ===
     useEffect(() => {
         if (isInitialMount.current) {
             isInitialMount.current = false;
         } else {
             // If the word list has already been loaded, select a new pair
             // matching the new criteria immediately.
             if (wordList.length > 0) {
                 console.log(`Max words changed to ${maxWords}, selecting new pair...`);
                 selectNewPair(); // <-- Call selectNewPair when maxWords changes (after initial load)
             }
         }
     }, [maxWords, wordList]); // Re-run if maxWords changes OR wordList loads


    // === Handling Language Direction Switch ===
    // (Keep this function as is)
    const switchLanguageDirection = () => {
        setLanguageDirection(prevDirection => {
            const newDirection = prevDirection === 'spa-eng' ? 'eng-spa' : 'spa-eng';
            console.log(`Switching direction from ${prevDirection} to ${newDirection}`);
            return newDirection;
        });
        setShowFeedback(false);
        setLastCorrectAnswer('');
        setHintData(null);
        setFeedbackSignal(null);
    };

    // === Hint Handling Logic ===
    // (Keep handleGetHint as is - it uses currentPair.spanish)
    const handleGetHint = async () => {
        if (!currentPair || hintData || showFeedback || isHintLoading || feedbackSignal === 'incorrect') return;
        const wordToLookup = currentPair.spanish;
        console.log(`Getting hint for: "${wordToLookup}"`);
        setIsHintLoading(true);
        setHintData(null);
        try {
            const apiResponse = await getMwHint(wordToLookup);
            console.log("Raw Hint Data:", apiResponse);
            if (Array.isArray(apiResponse) && apiResponse.length > 0) {
                 if (typeof apiResponse[0] === 'string') {
                     setHintData({ type: 'suggestions', suggestions: apiResponse });
                 } else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta) {
                     setHintData({ type: 'definitions', data: apiResponse });
                 } else {
                     console.warn("Hint API response has unexpected structure:", apiResponse);
                     setHintData({ type: 'unknown', raw: apiResponse });
                 }
            } else {
                 setHintData({ type: 'error', message: "Hint not found or API error." });
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
            <div className="score-display" style={{ marginBottom: '15px', fontSize: '1.1em', fontWeight: 'bold' }}> {/* Added margin & font weight */}
                <span>Correct: {score.correct}</span>
                <span style={{ marginLeft: '20px' }}>Incorrect: {score.incorrect}</span> {/* Increased margin */}
            </div>
            {/* --- Controls --- */}
             <div className="controls" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px' }}>
                <button onClick={switchLanguageDirection}>
                    Switch Direction (Current: {languageDirection === 'spa-eng' ? 'Spanish -> English' : 'English -> Spanish'})
                </button>
                 {/* <div className="setting-max-words" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                     <label htmlFor="maxWordsInput">Max Words:</label>
                     <input type="range" id="maxWordsInput" value={maxWords} onChange={handleMaxWordsChange} min="1" max="10" style={{ cursor: 'pointer', flexGrow: '1' }} />
                     <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'right' }}>{maxWords}</span>
                 </div> */}
                {/* --- Update General Next Card Button text and action --- */}
                 {/* This button now just selects a new pair from the loaded list */}
                <button onClick={() => selectNewPair()} disabled={isLoading || wordList.length === 0}>
                    {isLoading ? 'Loading...' : 'Get New Card'}
                </button>
            </div>

            {/* --- Status Messages --- */}
            {/* Updated loading message for initial load */}
            {isLoading && !currentPair && wordList.length === 0 && <p>Loading word list...</p>}
            {isLoading && currentPair && <p>Loading new card...</p>} {/* Loading message for subsequent selections */}
            {error && !isLoading && (
                <div className="error-area" style={{ marginBottom: '10px' }}>
                     <p style={{ color: 'red' }}>Error: {error}</p>
                     {/* Make button specific to selecting a new pair */}
                     <button onClick={() => selectNewPair()} disabled={isLoading || wordList.length === 0}>
                         Try Selecting New Card
                     </button>
                </div>
            )}

            {/* --- Flashcard Area --- */}
            {!isLoading && !error && currentPair && (
                <div className="flashcard-area">
                    <Flashcard
                        pair={currentPair}
                        direction={languageDirection}
                        onAnswerSubmit={handleAnswerSubmit}
                        showFeedback={showFeedback}
                        onGetHint={handleGetHint}
                        hint={hintData}
                        isHintLoading={isHintLoading}
                        feedbackSignal={feedbackSignal}
                    />
                    {/* Feedback Area */}
                    {showFeedback && (
                        <div className="feedback-area" style={{ marginTop: '10px' }}>
                            <p style={{ color: 'darkred', fontWeight: 'bold', margin: '0 0 5px 0' }}>
                                Incorrect. The correct answer was: "{lastCorrectAnswer}"
                            </p>
                            <button onClick={handleNextCard}>
                                Next Card
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Fallback message */}
            {!isLoading && !error && !currentPair && wordList.length > 0 && (
                 <p>No flashcard data available that matches criteria. Try adjusting Max Words or clicking Get New Card.</p> // More specific message
            )}
             {!isLoading && !error && !currentPair && wordList.length === 0 && (
                 <p>Word list failed to load. Check console.</p> // Message if initial load failed
             )}


            {/* --- Debug State Display --- */}
            <details style={{ marginTop: '20px' }}>
                <summary>Show Current State</summary>
                <pre> {/* CSS for pre is in App.css */}
                    Word List Length: {wordList.length}{'\n'} {/* Show list length */}
                    isLoading: {JSON.stringify(isLoading)}{'\n'}
                    isHintLoading: {JSON.stringify(isHintLoading)}{'\n'}
                    Error: {JSON.stringify(error)}{'\n'}
                    Current Pair: {JSON.stringify(currentPair, null, 2)}{'\n'}
                    Max Words: {JSON.stringify(maxWords)}{'\n'}
                    Show Feedback: {JSON.stringify(showFeedback)}{'\n'}
                    Score: {JSON.stringify(score)}{'\n'}
                    Hint Data: {JSON.stringify(hintData, null, 2)}
                </pre>
            </details>
        </div>
    );
}
export default App;