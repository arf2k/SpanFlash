import { useState, useEffect, useRef } from 'react';
import Flashcard from './components/Flashcard';
import { getMwHint } from './services/dictionaryServices.js';
import './App.css';

// Define constants
const TOTAL_CHUNKS = 23;

function App() {
    // === State Variables ===
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState('spa-eng');
    const [isLoading, setIsLoading] = useState(true); // Loading for fetching pairs
    const [error, setError] = useState(null);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [hintData, setHintData] = useState(null); // Stores raw hint data or error object
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState('');
    const [maxWords, setMaxWords] = useState(5);
    const [isHintLoading, setIsHintLoading] = useState(false); // State for hint loading

    const isInitialMount = useRef(true);

    // === Fetching Logic ===
    const fetchRandomPair = async () => {
        console.log("Attempting to fetch a new pair...");
        setIsLoading(true);
        setError(null);
        setHintData(null);      
        setCurrentPair(null);
        setShowFeedback(false);
        setIsHintLoading(false); 

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
            console.log(`Loaded ${currentChunkData.length} pairs from chunk ${randomChunkNum}. Filtering (max words: ${maxWords})...`);

            const filteredData = currentChunkData.filter(pair => {
                if (!pair || typeof pair.english !== 'string' || typeof pair.spanish !== 'string') return false;
                const englishWords = pair.english.split(' ').filter(word => word.length > 0).length;
                const spanishWords = pair.spanish.split(' ').filter(word => word.length > 0).length;
                return englishWords > 0 && englishWords <= maxWords && spanishWords > 0 && spanishWords <= maxWords;
            });
            console.log(`Found ${filteredData.length} pairs matching max words criteria.`);

            if (filteredData.length > 0) {
                const randomIndex = Math.floor(Math.random() * filteredData.length);
                const pair = filteredData[randomIndex];
                console.log("Successfully selected filtered pair:", pair);
                setCurrentPair(pair);
            } else {
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
        const correctAnswer = languageDirection === 'spa-eng' ? currentPair.english : currentPair.spanish;
        const normalizedUserAnswer = userAnswer.toLowerCase().trim().replace(punctuationRegex, '');
        const normalizedCorrectAnswer = correctAnswer.toLowerCase().trim().replace(punctuationRegex, '');
        console.log(`Comparing (punctuation ignored): "${normalizedUserAnswer}" vs "${normalizedCorrectAnswer}"`);
        if (normalizedUserAnswer === normalizedCorrectAnswer) {
            console.log("CORRECT branch executed. Fetching next card...");
            setScore(prevScore => ({ ...prevScore, correct: prevScore.correct + 1 }));
            fetchRandomPair();
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
        setShowFeedback(false);
        setLastCorrectAnswer('');
        setHintData(null); // Also clear hint on direction switch
    };

    // === Hint Handling Logic ===
    const handleGetHint = async () => {
        if (!currentPair || hintData || showFeedback || isHintLoading) return;
        const wordToLookup = currentPair.spanish;
        console.log(`Getting hint for: "${wordToLookup}"`);
        setIsHintLoading(true);
        setHintData(null); // Clear previous hint before fetching new one

        try {
            const apiResponse = await getMwHint(wordToLookup);
            console.log("Raw Hint Data:", apiResponse);

            if (Array.isArray(apiResponse) && apiResponse.length > 0) {
                 if (typeof apiResponse[0] === 'string') {
                     // If the first item is just a string, it's likely suggestions for a typo
                     setHintData({ type: 'suggestions', suggestions: apiResponse });
                 } else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta) {
                     // If it's an object with metadata, assume it's a definition entry
                     // Store the whole array for now, Flashcard can pick relevant info
                     setHintData({ type: 'definitions', data: apiResponse });
                 } else {
                     // Unknown format
                     console.warn("Hint API response has unexpected structure:", apiResponse);
                     setHintData({ type: 'unknown', raw: apiResponse });
                 }
            } else {
                 // Handle empty array or null/undefined response
                 setHintData({ type: 'error', message: "Hint not found or API error." });
            }

        } catch (err) {
            console.error("Error in handleGetHint function:", err);
            setHintData({ type: 'error', message: "Failed to fetch hint." });
        } finally {
            setIsHintLoading(false);
        }
    };

    // === Effect Hooks ===
    useEffect(() => {
        console.log("App component mounted. Fetching initial flashcard pair.");
        fetchRandomPair();
     }, []);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
        } else {
            console.log(`Max words changed to ${maxWords}, refetching...`);
            fetchRandomPair();
        }
    }, [maxWords]);

    // === Component Return ===
    return (
        <div className="App">
            <h1>Spanish Flashcards</h1>

            {/* Controls */}
            <div className="controls" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
                <button onClick={switchLanguageDirection}>
                    Switch Direction (Current: {languageDirection === 'spa-eng' ? 'Spanish -> English' : 'English -> Spanish'})
                </button>
                <div className="setting-max-words" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <label htmlFor="maxWordsInput">Max Words:</label>
                    <input type="range" id="maxWordsInput" value={maxWords} onChange={handleMaxWordsChange} min="1" max="10" style={{ cursor: 'pointer', flexGrow: '1' }} />
                    <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'right' }}>{maxWords}</span>
                </div>
            </div>

            {/* Status Messages */}
            {isLoading && <p>Loading flashcard...</p>}
            {error && !isLoading && (
                <div className="error-area" style={{ marginBottom: '10px' }}>
                     <p style={{ color: 'red' }}>Error: {error}</p>
                     <button onClick={fetchRandomPair}>Try Fetching New Card</button>
                </div>
            )}

            {/* Flashcard Area */}
            {!isLoading && !error && currentPair && (
                <div className="flashcard-area">
                    <Flashcard
                        pair={currentPair}
                        direction={languageDirection}
                        onAnswerSubmit={handleAnswerSubmit}
                        showFeedback={showFeedback}
                        // Pass Hint Props
                        onGetHint={handleGetHint}
                        hint={hintData} // Pass the hintData state object
                        isHintLoading={isHintLoading}
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
            {!isLoading && !error && !currentPair && (
                <p>No flashcard data available. Use controls to fetch.</p>
            )}

            {/* Debug State Display */}
            <details style={{ marginTop: '20px' }}>
                <summary>Show Current State</summary>
                <pre> {/* CSS for pre is in App.css */}
                    isLoading: {JSON.stringify(isLoading)}{'\n'}
                    isHintLoading: {JSON.stringify(isHintLoading)}{'\n'}
                    Error: {JSON.stringify(error)}{'\n'}
                    Current Pair: {JSON.stringify(currentPair, null, 2)}{'\n'}
                    Max Words: {JSON.stringify(maxWords)}{'\n'}
                    Show Feedback: {JSON.stringify(showFeedback)}{'\n'}
                    Score: {JSON.stringify(score)}{'\n'}
                    Hint Data: {JSON.stringify(hintData, null, 2)} {/* Now includes 'type' */}
                </pre>
            </details>
        </div>
    );
}
export default App;