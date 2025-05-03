// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import Flashcard from './components/Flashcard';
import { getMwHint } from './services/dictionaryServices.js';
import './App.css';

function App() {
    // === State Variables ===
    const [wordList, setWordList] = useState([]);
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState('spa-eng');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [hintData, setHintData] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState('');
    const [maxWords, setMaxWords] = useState(5);
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [feedbackSignal, setFeedbackSignal] = useState(null);

    // === Refs ===
    const incorrectScoreRef = useRef(null);
    const isInitialMountScore = useRef(true);
    const isInitialMountMaxWords = useRef(true);

    // === Selection Logic === (No changes needed here)
    const selectNewPair = (listToUse = wordList) => {
        console.log(`Selecting pair from list (${listToUse.length} items), max words: ${maxWords}`);
        setError(null); setHintData(null); setCurrentPair(null); setShowFeedback(false);
        setIsHintLoading(false); setFeedbackSignal(null);
        if (!listToUse || listToUse.length === 0) {
            setError("Word list is empty or not loaded yet."); setIsLoading(false); return;
        }
        setIsLoading(true);
        try {
            const filteredData = listToUse.filter(pair => {
                if (!pair || typeof pair.english !== 'string' || typeof pair.spanish !== 'string') return false;
                const englishWords = pair.english.split(' ').filter(word => word.length > 0).length;
                const spanishWords = pair.spanish.split(' ').filter(word => word.length > 0).length;
                return englishWords > 0 && englishWords <= maxWords && spanishWords > 0 && spanishWords <= maxWords;
            });
            console.log(`Found ${filteredData.length} pairs matching max words criteria.`);
            if (filteredData.length > 0) {
                const randomIndex = Math.floor(Math.random() * filteredData.length);
                setCurrentPair(filteredData[randomIndex]);
            } else { throw new Error(`No pairs found with <= ${maxWords} words per side.`); }
        } catch (err) {
            console.error("Error selecting/filtering pair:", err); setError(err.message || 'Failed to select flashcard pair.'); setCurrentPair(null);
        } finally { setIsLoading(false); }
    };

    // === Initial Load Logic === (No changes needed here)
    useEffect(() => {
        const loadWordData = async () => {
            console.log("App component mounted. Loading word list...");
            setIsLoading(true); setError(null); setWordList([]);
            try {
                const response = await fetch('/scrapedSpan411.json');
                if (!response.ok) { throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`); }
                const loadedList = await response.json();
                if (!Array.isArray(loadedList)) { throw new Error("Loaded data is not a valid array."); }
                console.log(`Successfully loaded ${loadedList.length} pairs.`);
                setWordList(loadedList); selectNewPair(loadedList);
            } catch (err) { console.error("Error loading word list:", err); setError(err.message || "Failed to load word list."); setIsLoading(false); }
        };
        loadWordData();
    }, []);

    // === Effect for INCORRECT Score Flash === (No changes needed here)
    useEffect(() => {
        if (isInitialMountScore.current) { isInitialMountScore.current = false; return; }
        if (score.incorrect > 0 && incorrectScoreRef.current) {
            const element = incorrectScoreRef.current;
            console.log("ADDING flash class to INCORRECT score element:", element);
            element.classList.add('score-flash-incorrect');
            const animationDuration = 1000;
            setTimeout(() => {
                if (element) { console.log("REMOVING flash class from INCORRECT score element:", element); element.classList.remove('score-flash-incorrect'); }
            }, animationDuration);
        }
    }, [score.incorrect]);

    // ========================================================
    // === Answer Submission Logic (Article & "To" Logic Updated) ===
    // ========================================================
    const handleAnswerSubmit = (userAnswer) => {
        const punctuationRegex = /[.?!¡¿]+$/;
        // Regex for English articles
        const englishArticleRegex = /^(the|a|an)\s+/i;
        // --- >>> NEW: Regex for leading "to " for verbs <<< ---
        const toVerbRegex = /^to\s+/i;

        // Guard clause
        if (!currentPair || showFeedback) {
            console.log(`Submission blocked by guard: currentPair=${!!currentPair}, showFeedback=${showFeedback}`); return;
        }

        // Determine correct answer
        const correctAnswer = languageDirection === 'spa-eng' ? currentPair.english : currentPair.spanish;

        // Basic normalization
        let normalizedUserAnswer = userAnswer.toLowerCase().trim().replace(punctuationRegex, '');
        let normalizedCorrectAnswer = correctAnswer.toLowerCase().trim().replace(punctuationRegex, '');

        // --- >>> ARTICLE & "TO" STRIPPING LOGIC <<< ---
        if (languageDirection === 'spa-eng') {
            console.log('Direction is spa-eng, attempting normalization.');
            // Store initial normalized versions for logging
            const originalNormalizedUser = normalizedUserAnswer;
            const originalNormalizedCorrect = normalizedCorrectAnswer;

            // 1. Strip articles
            normalizedUserAnswer = normalizedUserAnswer.replace(englishArticleRegex, '');
            normalizedCorrectAnswer = normalizedCorrectAnswer.replace(englishArticleRegex, '');

            // --- >>> 2. Strip leading "to " AFTER stripping articles <<< ---
            normalizedUserAnswer = normalizedUserAnswer.replace(toVerbRegex, '');
            normalizedCorrectAnswer = normalizedCorrectAnswer.replace(toVerbRegex, '');

            // Optional logging to see changes
            if(originalNormalizedUser !== normalizedUserAnswer) console.log(`Normalized user answer: "${originalNormalizedUser}" -> "${normalizedUserAnswer}"`);
            if(originalNormalizedCorrect !== normalizedCorrectAnswer) console.log(`Normalized correct answer: "${originalNormalizedCorrect}" -> "${normalizedCorrectAnswer}"`);
        }
        // --- >>> END ARTICLE & "TO" STRIPPING LOGIC <<< ---

        // Log final versions being compared
        console.log(`Comparing (final normalized): "${normalizedUserAnswer}" vs "${normalizedCorrectAnswer}"`);

        // Comparison
        if (normalizedUserAnswer === normalizedCorrectAnswer) {
            console.log("CORRECT branch executed.");
            setScore(prevScore => ({ ...prevScore, correct: prevScore.correct + 1 }));
            setFeedbackSignal('correct');
            setTimeout(() => {
                 console.log("Executing selectNewPair after correct answer timeout.");
                 selectNewPair();
            }, 50);
        } else {
            console.log("INCORRECT branch executed.");
            setScore(prevScore => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
            setLastCorrectAnswer(correctAnswer); // Show original correct answer
            setShowFeedback(true);
            setFeedbackSignal('incorrect');
        }
    };
    // ========================================================
    // === End Answer Submission Logic Update ===
    // ========================================================

    // === Handling "Next Card" === (No changes needed here)
    const handleNextCard = () => { setShowFeedback(false); setLastCorrectAnswer(''); selectNewPair(); };

    // === Handling Max Words Change === (No changes needed here)
    const handleMaxWordsChange = (event) => { const newVal = parseInt(event.target.value, 10); setMaxWords(newVal >= 1 ? newVal : 1); console.log("Max words:", newVal >= 1 ? newVal : 1); };

    // === Effect for Max Words Change === (No changes needed here)
    useEffect(() => {
         if (isInitialMountMaxWords.current) { isInitialMountMaxWords.current = false; }
         else { if (wordList.length > 0) { console.log(`Max words changed to ${maxWords}, selecting new pair...`); selectNewPair(); } }
    }, [maxWords, wordList]);

    // === Handling Language Direction Switch === (No changes needed here)
    const switchLanguageDirection = () => {
        setLanguageDirection(prev => prev === 'spa-eng' ? 'eng-spa' : 'spa-eng');
        setShowFeedback(false); setLastCorrectAnswer(''); setHintData(null); setFeedbackSignal(null);
    };

    // === Hint Handling Logic === (No changes needed here)
    const handleGetHint = async () => {
        if (!currentPair || hintData || showFeedback || isHintLoading || feedbackSignal === 'incorrect') return;
        const wordToLookup = currentPair.spanish; setIsHintLoading(true); setHintData(null);
        try {
            const apiResponse = await getMwHint(wordToLookup); console.log("Raw Hint Data:", apiResponse);
            if (Array.isArray(apiResponse) && apiResponse.length > 0) {
                 if (typeof apiResponse[0] === 'string') { setHintData({ type: 'suggestions', suggestions: apiResponse }); }
                 else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta) { setHintData({ type: 'definitions', data: apiResponse[0] }); }
                 else { setHintData({ type: 'unknown', raw: apiResponse }); }
            } else if (typeof apiResponse === 'object' && apiResponse?.meta) { setHintData({ type: 'definitions', data: apiResponse }); }
            else { setHintData({ type: 'error', message: "Hint not found or API error." }); }
        } catch (err) { console.error("Error in handleGetHint function:", err); setHintData({ type: 'error', message: "Failed to fetch hint." }); }
        finally { setIsHintLoading(false); }
    };

    // === Component Return === (No changes needed here)
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
                        <span className="stack-count" ref={incorrectScoreRef}>{score.incorrect}</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="controls" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px' }}>
               <button onClick={switchLanguageDirection}>Switch Direction ({languageDirection === 'spa-eng' ? 'Spa -> Eng' : 'Eng -> Spa'})</button>
               <button onClick={() => selectNewPair()} disabled={isLoading || wordList.length === 0}>{isLoading ? 'Loading...' : 'New Card'}</button>
            </div>

            {/* Status Messages */}
            {isLoading && !currentPair && wordList.length === 0 && <p>Loading word list...</p>}
            {isLoading && currentPair && <p>Loading new card...</p>}
            {error && !isLoading && ( <div className="error-area" style={{ marginBottom: '10px' }}><p style={{ color: 'red' }}>Error: {error}</p><button onClick={() => selectNewPair()} disabled={isLoading || wordList.length === 0}>Try New Card</button></div> )}

            {/* Flashcard Area */}
            {!isLoading && !error && currentPair && (
                <div className="flashcard-area">
                    <Flashcard
                        pair={currentPair} direction={languageDirection} onAnswerSubmit={handleAnswerSubmit}
                        showFeedback={showFeedback} onGetHint={handleGetHint} hint={hintData}
                        isHintLoading={isHintLoading} feedbackSignal={feedbackSignal}
                    />
                    {showFeedback && (
                        <div className="feedback-area" style={{ marginTop: '10px' }}>
                            <p style={{ color: '#D90429', fontWeight: 'bold', margin: '0 0 5px 0' }}>Incorrect. Correct: "{lastCorrectAnswer}"</p>
                            <button onClick={handleNextCard}>Next Card</button>
                        </div>
                    )}
                </div>
            )}

            {/* Fallback messages */}
            {!isLoading && !error && !currentPair && wordList.length > 0 && ( <p>No flashcard data matching criteria. Try clicking New Card.</p> )}
            {!isLoading && !error && !currentPair && wordList.length === 0 && ( <p>Word list failed to load. Check console.</p> )}

            {/* Debug State Display */}
            <details style={{ marginTop: '20px' }}>
                <summary>Show Current State</summary>
                <pre style={{ textAlign: 'left', backgroundColor: '#eee', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    State: {JSON.stringify({ isLoading, error: error?.message, currentPair, languageDirection, score, maxWords, feedbackSignal }, null, 2)}
                    {'\n'}Hint Data Type: {hintData?.type}
                </pre>
            </details>
        </div>
    );
}
export default App;