// src/App.jsx
import { useState, useEffect, useRef } from 'react'; // Ensure useRef is imported
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
    // ========================================================================
    // Refs needed for score flash (incorrect only now) & maxWords effect
    // ========================================================================
    const incorrectScoreRef = useRef(null);   // Ref for the INCORRECT score span
    const isInitialMountScore = useRef(true); // Ref to prevent score flash on initial load
    const isInitialMountMaxWords = useRef(true); // Ref for maxWords effect

    // === Selection Logic ===
    const selectNewPair = (listToUse = wordList) => {
        console.log(`Selecting pair from list (${listToUse.length} items), max words: ${maxWords}`);
        setError(null);
        setHintData(null);
        setCurrentPair(null);
        setShowFeedback(false);
        setIsHintLoading(false);
        setFeedbackSignal(null); // Reset feedback signal for next card
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
            } else {
                throw new Error(`No pairs found with <= ${maxWords} words per side.`);
            }
        } catch (err) {
            console.error("Error selecting/filtering pair:", err);
            setError(err.message || 'Failed to select flashcard pair.');
            setCurrentPair(null);
        } finally { setIsLoading(false); }
    };

    // === Initial Load Logic ===
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
            } catch (err) {
                console.error("Error loading word list:", err); setError(err.message || "Failed to load word list."); setIsLoading(false);
            }
        };
        loadWordData();
    }, []);


    // ==================================================================
    // ADDED useEffect for INCORRECT Score Flash
    // ==================================================================
    useEffect(() => {
        // Prevent flash on the very first render
        if (isInitialMountScore.current) {
            // We only need this check once, so set it false after first run
            // for either score effect (though only incorrect runs now)
            isInitialMountScore.current = false;
            return;
        }

        // Check if the incorrect score increased and the ref is connected
        if (score.incorrect > 0 && incorrectScoreRef.current) {
            const element = incorrectScoreRef.current;
            console.log("ADDING flash class to INCORRECT score element:", element);
            element.classList.add('score-flash-incorrect');

            // Remove class after animation (match CSS duration)
            const animationDuration = 1000; // 1.0s in ms
            setTimeout(() => {
                if (element) {
                   console.log("REMOVING flash class from INCORRECT score element:", element);
                   element.classList.remove('score-flash-incorrect');
                }
            }, animationDuration);
        }
    }, [score.incorrect]); // This effect runs ONLY when score.incorrect changes


    // --- REMOVED useEffect for CORRECT Score Flash ---


    // === Answer Submission Logic ===
    const handleAnswerSubmit = (userAnswer) => {
        const punctuationRegex = /[.?!¡¿]+$/;
        const englishArticleRegex = /^(the|a|an)\s+/i;
        if (!currentPair || showFeedback) {
            console.log(`Submission blocked by guard: currentPair=${!!currentPair}, showFeedback=${showFeedback}`); return;
        }
        const correctAnswer = languageDirection === 'spa-eng' ? currentPair.english : currentPair.spanish;
        let normalizedUserAnswer = userAnswer.toLowerCase().trim().replace(punctuationRegex, '');
        let normalizedCorrectAnswer = correctAnswer.toLowerCase().trim().replace(punctuationRegex, '');
        if (languageDirection === 'spa-eng') {
            normalizedUserAnswer = normalizedUserAnswer.replace(englishArticleRegex, '');
            normalizedCorrectAnswer = normalizedCorrectAnswer.replace(englishArticleRegex, '');
        }
        console.log(`Comparing (punc/art ignored): "${normalizedUserAnswer}" vs "${normalizedCorrectAnswer}"`);

        if (normalizedUserAnswer === normalizedCorrectAnswer) {
            console.log("CORRECT branch executed.");
            setScore(prevScore => ({ ...prevScore, correct: prevScore.correct + 1 }));
            setFeedbackSignal('correct'); // Triggers flashcard flash
            setTimeout(() => {
                 console.log("Executing selectNewPair after correct answer timeout.");
                 selectNewPair();
            }, 50);
        } else {
            console.log("INCORRECT branch executed.");
            // This state update triggers the useEffect above for incorrect score flash
            setScore(prevScore => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
            setLastCorrectAnswer(correctAnswer);
            setShowFeedback(true);
            setFeedbackSignal('incorrect'); // Triggers flashcard flash
        }
    };

    // === Handling "Next Card" ===
    const handleNextCard = () => { setShowFeedback(false); setLastCorrectAnswer(''); selectNewPair(); };

    // === Handling Max Words Change ===
    const handleMaxWordsChange = (event) => { const newVal = parseInt(event.target.value, 10); setMaxWords(newVal >= 1 ? newVal : 1); console.log("Max words:", newVal >= 1 ? newVal : 1); };

    // === Effect for Max Words Change ===
    useEffect(() => {
         if (isInitialMountMaxWords.current) { isInitialMountMaxWords.current = false; }
         else { if (wordList.length > 0) { console.log(`Max words changed to ${maxWords}, selecting new pair...`); selectNewPair(); } }
    }, [maxWords, wordList]);

    // === Handling Language Direction Switch ===
    const switchLanguageDirection = () => {
        setLanguageDirection(prev => prev === 'spa-eng' ? 'eng-spa' : 'spa-eng');
        setShowFeedback(false); setLastCorrectAnswer(''); setHintData(null); setFeedbackSignal(null);
    };

    // === Hint Handling Logic ===
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

    // === Component Return ===
    return (
        <div className="App">
            <h1>Spanish Flashcards</h1>
            {/* === SCORE STACKS AREA === */}
            <div className="score-stacks-container">
                {/* Correct Stack */}
                <div className="stack correct-stack">
                    <div className="stack-label">Correct</div>
                    <div className="cards">
                        <span className="card-icon correct-icon" role="img" aria-label="Correct answers">✅</span>
                        {/* Correct score span - NO REF */}
                        <span className="stack-count">{score.correct}</span>
                    </div>
                </div>
                {/* Incorrect Stack */}
                <div className="stack incorrect-stack">
                    <div className="stack-label">Incorrect</div>
                    <div className="cards">
                        <span className="card-icon incorrect-icon" role="img" aria-label="Incorrect answers">❌</span>
                        {/* ================================================= */}
                        {/* ADD THE REF ATTRIBUTE to the INCORRECT score span */}
                        {/* ================================================= */}
                        <span className="stack-count" ref={incorrectScoreRef}>
                            {score.incorrect}
                        </span>
                    </div>
                </div>
            </div>
            {/* === END SCORE STACKS AREA === */}

            {/* --- Controls --- */}
            <div className="controls" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px' }}>
               <button onClick={switchLanguageDirection}>Switch Direction ({languageDirection === 'spa-eng' ? 'Spa -> Eng' : 'Eng -> Spa'})</button>
               <button onClick={() => selectNewPair()} disabled={isLoading || wordList.length === 0}>{isLoading ? 'Loading...' : 'New Card'}</button>
            </div>

            {/* --- Status Messages --- */}
            {isLoading && !currentPair && wordList.length === 0 && <p>Loading word list...</p>}
            {isLoading && currentPair && <p>Loading new card...</p>}
            {error && !isLoading && ( <div className="error-area" style={{ marginBottom: '10px' }}><p style={{ color: 'red' }}>Error: {error}</p><button onClick={() => selectNewPair()} disabled={isLoading || wordList.length === 0}>Try New Card</button></div> )}

            {/* --- Flashcard Area --- */}
            {!isLoading && !error && currentPair && (
                <div className="flashcard-area">
                    {/* Flashcard component receives feedbackSignal for its own flash */}
                    <Flashcard
                        pair={currentPair} direction={languageDirection} onAnswerSubmit={handleAnswerSubmit}
                        showFeedback={showFeedback} onGetHint={handleGetHint} hint={hintData}
                        isHintLoading={isHintLoading} feedbackSignal={feedbackSignal}
                    />
                    {/* Incorrect Answer Feedback Display */}
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

            {/* --- Debug State Display --- */}
            <details style={{ marginTop: '20px' }}>
                <summary>Show Current State</summary>
                <pre style={{ textAlign: 'left', backgroundColor: '#eee', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{/* ... state values ... */}</pre>
            </details>
        </div>
    );
}
export default App;