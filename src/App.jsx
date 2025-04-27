// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import Flashcard from './components/Flashcard';
import './App.css'; // Make sure this contains the CSS for details > pre

// Define constants
const TOTAL_CHUNKS = 23;

function App() {
    // === State Variables ===
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState('spa-eng');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [hintData, setHintData] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState('');
    const [maxWords, setMaxWords] = useState(5); // State for max words, default 5

    const isInitialMount = useRef(true);


    // === Fetching Logic ===
    const fetchRandomPair = async () => {
        console.log("Attempting to fetch a new pair...");
        setIsLoading(true);
        setError(null);
        setHintData(null);
        setCurrentPair(null);
        setShowFeedback(false); // Reset feedback when fetching

        try {
            const randomChunkNum = Math.floor(Math.random() * TOTAL_CHUNKS) + 1;
            const chunkUrl = `/data_chunks/chunk_${randomChunkNum}.json`;
            console.log(`Workspaceing chunk file: ${chunkUrl}`);

            const response = await fetch(chunkUrl);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText} while fetching ${chunkUrl}`);
            }

            const currentChunkData = await response.json();
            if (!Array.isArray(currentChunkData)) {
                 throw new Error(`Data from chunk ${randomChunkNum} is not a valid array.`);
            }
            console.log(`Loaded ${currentChunkData.length} pairs from chunk ${randomChunkNum}. Filtering (max words: ${maxWords})...`); // Use state in log

            // Filter the loaded data based on maxWords state
            const filteredData = currentChunkData.filter(pair => {
                if (!pair || typeof pair.english !== 'string' || typeof pair.spanish !== 'string') {
                    return false;
                }
                const englishWords = pair.english.split(' ').filter(word => word.length > 0).length;
                const spanishWords = pair.spanish.split(' ').filter(word => word.length > 0).length;
                // Use maxWords state variable here for comparison
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
                // Handle cases where the chunk has no pairs meeting the criteria
                // Use maxWords state variable in the error message
                throw new Error(`No pairs found in chunk ${randomChunkNum} with <= ${maxWords} words per side. Try 'Next Card'.`);
            }

        } catch (err) {
            console.error("Error fetching/filtering random pair:", err);
            setError(err.message || 'Failed to load flashcard data. Please try again.');
            setCurrentPair(null);
        } finally {
            setIsLoading(false);
            console.log("Fetching attempt finished.");
        }
    };

    // === Answer Submission Logic ===
    const handleAnswerSubmit = (userAnswer) => {
        const punctuationRegex = /[.?!¡¿]+$/;
        if (!currentPair || showFeedback) return;

        console.log(`Checking answer: User submitted "${userAnswer}"`);

        const correctAnswer = languageDirection === 'spa-eng'
            ? currentPair.english
            : currentPair.spanish;

        const normalizedUserAnswer = userAnswer
            .toLowerCase()
            .trim()
            .replace(punctuationRegex, '');

        const normalizedCorrectAnswer = correctAnswer
            .toLowerCase()
            .trim()
            .replace(punctuationRegex, '');

        console.log(`Comparing (punctuation ignored): "${normalizedUserAnswer}" vs "${normalizedCorrectAnswer}"`);

        if (normalizedUserAnswer === normalizedCorrectAnswer) {
            console.log("CORRECT branch executed. Fetching next card...");
            setScore(prevScore => ({ ...prevScore, correct: prevScore.correct + 1 }));
            fetchRandomPair(); // Proceed to next card
        } else {
            console.log("INCORRECT branch executed. Setting showFeedback=true.");
            setScore(prevScore => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
            setLastCorrectAnswer(correctAnswer);
            setShowFeedback(true);
        }
    };

    // === Handling "Next Card" After Incorrect Answer ===
    const handleNextCard = () => {
        setShowFeedback(false);
        setLastCorrectAnswer('');
        fetchRandomPair();
    };

    // === Handling Max Words Setting Change ===
    const handleMaxWordsChange = (event) => {
        const newValue = parseInt(event.target.value, 10);
        setMaxWords(newValue >= 1 ? newValue : 1);
        console.log("Max words setting changed to:", newValue >= 1 ? newValue : 1);
    };

    // === Handling Language Direction Switch ===
    const switchLanguageDirection = () => {
        setLanguageDirection(prevDirection => {
            const newDirection = prevDirection === 'spa-eng' ? 'eng-spa' : 'spa-eng';
            console.log(`Switching direction from ${prevDirection} to ${newDirection}`);
            return newDirection;
        });
        setShowFeedback(false); // Reset feedback when direction changes
        setLastCorrectAnswer('');
    };

    // === Effects Hooks ===
    useEffect(() => {
        console.log("App component mounted. Fetching initial flashcard pair.");
        fetchRandomPair();
     }, []); // Empty dependency array runs only once on mount

     useEffect(() => {
      // Prevent fetching on the very first render when maxWords is initialized
      if (isInitialMount.current) {
          isInitialMount.current = false; // Toggle ref so effect runs on subsequent changes
      } else {
          // Only run fetch if it's NOT the initial mount/render
          console.log(`Max words changed to ${maxWords}, refetching...`);
          fetchRandomPair(); // Fetch a new pair matching the new criteria
      }
  }, [maxWords]); // Dependency array: run this effect when maxWords changes

    // === Component Return ===
    return (
        <div className="App">
            <h1>Spanish Flashcards</h1>

            {/* --- Controls --- */}
            <div className="controls" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}> {/* Added flexWrap and gap */}
                {/* Switch Direction Button */}
                <button onClick={switchLanguageDirection}>
                    Switch Direction (Current: {languageDirection === 'spa-eng' ? 'Spanish -> English' : 'English -> Spanish'})
                </button>

                {/* Max Words Slider Control */}
                <div className="setting-max-words" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <label htmlFor="maxWordsInput">
                        Max Words:
                    </label>
                    <input
                        type="range" // Use slider
                        id="maxWordsInput"
                        value={maxWords}
                        onChange={handleMaxWordsChange}
                        min="1"     // Min value
                        max="10"    // Max value (adjust if needed)
                        style={{ cursor: 'pointer', flexGrow: '1' }} // Allow slider to grow a bit
                    />
                    {/* Display the current value */}
                    <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'right' }}>
                        {maxWords}
                    </span>
                </div>
            </div>

            {/* --- Status Messages --- */}
            {isLoading && <p>Loading flashcard...</p>}
    {error && !isLoading && ( // Show error block only if not loading
        <div className="error-area" style={{ marginBottom: '10px' }}>
             <p style={{ color: 'red' }}>Error: {error}</p>
             {/* Add button specifically when there's an error */}
             <button onClick={fetchRandomPair}>Try Fetching New Card</button>
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
                    />

                    {/* Feedback Area (only shown after incorrect answer) */}
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
            {!isLoading && !error && !currentPair && (
                <p>No flashcard data available. Check console for errors or try refreshing.</p>
            )}

            {/* --- Debug State Display --- */}
            <details style={{ marginTop: '20px' }}>
                <summary>Show Current State</summary>
                <pre> {/* CSS for pre is in App.css */}
                    isLoading: {JSON.stringify(isLoading)}{'\n'}
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