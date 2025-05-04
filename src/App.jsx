import { useState, useEffect, useRef } from 'react';
import Flashcard from './components/Flashcard';
import ScoreStack from './components/ScoreStack';
import { getMwHint } from './services/dictionaryServices.js'; 
import { db } from './db.js'; 
import './App.css';

function App() {
    // === State Variables ===
    const [wordList, setWordList] = useState([]);
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState('spa-eng');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [hardWordsList, setHardWordsList] = useState([]);
    const [hintData, setHintData] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState('');
    const [maxWords, setMaxWords] = useState(5);
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [feedbackSignal, setFeedbackSignal] = useState(null);
    // --- ADDED state for toggling view ---
    const [showHardWordsView, setShowHardWordsView] = useState(false);

    // === Refs ===
    const incorrectScoreRef = useRef(null); // For incorrect score flash
    const isInitialMountScore = useRef(true); // Prevent effects on initial load
    const isInitialMountMaxWords = useRef(true);

    // === Selection Logic ===
    const selectNewPair = (listToUse = wordList, manageLoadingState = false) => {
        console.log(`Selecting pair (manageLoading: ${manageLoadingState})...`);
        if (manageLoadingState) { console.log("Setting isLoading = true (from selectNewPair)"); setIsLoading(true); }
        setError(null); setHintData(null); setCurrentPair(null); setShowFeedback(false);
        setIsHintLoading(false); setFeedbackSignal(null);
        if (!listToUse || listToUse.length === 0) {
            console.error("selectNewPair called with empty list."); setError("Word list empty."); setCurrentPair(null);
            if (manageLoadingState) { console.log("Setting isLoading = false (empty list)"); setIsLoading(false); } return;
        }
        try {
            const filteredData = listToUse.filter(pair => {
                if (!pair || typeof pair.english !== 'string' || typeof pair.spanish !== 'string') return false;
                const englishWords = pair.english.split(' ').filter(word => word.length > 0).length;
                const spanishWords = pair.spanish.split(' ').filter(word => word.length > 0).length;
                return englishWords > 0 && englishWords <= maxWords && spanishWords > 0 && spanishWords <= maxWords;
            });
            console.log(`Found ${filteredData.length} pairs matching criteria.`);
            if (filteredData.length > 0) { setCurrentPair(filteredData[Math.floor(Math.random() * filteredData.length)]); }
            else { const errMsg = `No pairs found with <= ${maxWords} words.`; console.warn(errMsg); setError(errMsg); setCurrentPair(null); }
        } catch (err) { console.error("Error selecting/filtering pair:", err); setError(err.message); setCurrentPair(null); }
        finally { if (manageLoadingState) { console.log("Setting isLoading = false (from selectNewPair finally)"); setIsLoading(false); } console.log("selectNewPair finished."); }
    };

    // === Combined Initial Load useEffect ===
    useEffect(() => {
        const loadInitialData = async () => {
            console.log("App mounted. Loading ALL initial data..."); setIsLoading(true); setError(null); setWordList([]); setScore({ correct: 0, incorrect: 0 }); setHardWordsList([]); setCurrentPair(null);
            try {
                console.log("Fetching word list..."); const response = await fetch('/scrapedSpan411.json'); if (!response.ok) throw new Error(`Word list fetch failed: ${response.status}`); const loadedList = await response.json(); if (!Array.isArray(loadedList)) throw new Error("Word list data invalid."); console.log(`Loaded ${loadedList.length} pairs.`); setWordList(loadedList);
                console.log("Loading score from DB..."); const savedScoreState = await db.appState.get('userScore'); if (savedScoreState) { setScore({ ...savedScoreState }); } else { await db.appState.put({ id: 'userScore', correct: 0, incorrect: 0 }); }
                console.log("Loading hard words from DB..."); const loadedHardWords = await db.hardWords.toArray(); if (loadedHardWords) { setHardWordsList(loadedHardWords); console.log(`Loaded ${loadedHardWords.length} hard words.`); }
                console.log("Selecting initial pair..."); selectNewPair(loadedList); // manageLoadingState defaults to false
            } catch (err) { console.error("Error initial load:", err); setError(err.message || "Failed load."); setWordList([]); setCurrentPair(null); setScore({ correct: 0, incorrect: 0 }); setHardWordsList([]); }
            finally { console.log("Setting isLoading false after initial sequence."); setIsLoading(false); isInitialMountScore.current = false; }
        };
        loadInitialData();
    }, []);

    // === Saving Score useEffect ===
    useEffect(() => { if (isInitialMountScore.current) return; const saveScoreToDB = async () => { try { await db.appState.put({ id: 'userScore', ...score }); console.log("Score saved."); } catch (err) { console.error("Failed save score:", err); } }; saveScoreToDB(); }, [score]);

    // === Incorrect Score Flash useEffect ===
    useEffect(() => { if (isInitialMountScore.current) return; if (score.incorrect > 0 && incorrectScoreRef.current) { const element = incorrectScoreRef.current; if (!element.classList.contains('score-flash-incorrect')) { console.log("ADDING flash INCORRECT score:", element); element.classList.add('score-flash-incorrect'); const dur = 1000; setTimeout(() => { if (element) { console.log("REMOVING flash INCORRECT score:", element); element.classList.remove('score-flash-incorrect'); } }, dur); } } }, [score.incorrect]);

    // === Mark Hard Word Handler ===
    const handleMarkHard = async (pairToMark) => { if (!pairToMark?.spanish || !pairToMark?.english) return; console.log("Marking hard:", pairToMark); try { await db.hardWords.put({ spanish: pairToMark.spanish, english: pairToMark.english }); console.log("Saved hard word DB."); if (!hardWordsList.some(w => w.spanish === pairToMark.spanish && w.english === pairToMark.english)) { setHardWordsList(prev => [...prev, { spanish: pairToMark.spanish, english: pairToMark.english }]); console.log("Updated hardWordsList state."); } } catch (error) { console.error("Failed save hard word:", error); } };

    // === Answer Submission Logic ===
    const handleAnswerSubmit = (userAnswer) => {
        const punctuationRegex = /[.?!¡¿]+$/; const englishArticleRegex = /^(the|a|an)\s+/i; const toVerbRegex = /^to\s+/i;
        if (!currentPair || showFeedback) { return; }
        const correctAnswer = languageDirection === 'spa-eng' ? currentPair.english : currentPair.spanish;
        let normUser = userAnswer.toLowerCase().trim().replace(punctuationRegex, '');
        let normCorrect = correctAnswer.toLowerCase().trim().replace(punctuationRegex, '');
        if (languageDirection === 'spa-eng') { normUser = normUser.replace(englishArticleRegex, '').replace(toVerbRegex, ''); normCorrect = normCorrect.replace(englishArticleRegex, '').replace(toVerbRegex, ''); }
        console.log(`Comparing: "${normUser}" vs "${normCorrect}"`);
        if (normUser === normCorrect) {
            setScore(prev => ({ ...prev, correct: prev.correct + 1 })); setFeedbackSignal('correct');
            setTimeout(() => { selectNewPair(); }, 50);
        } else {
            setScore(prev => ({ ...prev, incorrect: prev.incorrect + 1 })); setLastCorrectAnswer(correctAnswer);
            setShowFeedback(true); setFeedbackSignal('incorrect');
        }
     };

    // === Max Words Change ===
    const handleMaxWordsChange = (event) => { const newVal = parseInt(event.target.value, 10); setMaxWords(newVal >= 1 ? newVal : 1); };
    useEffect(() => { if (isInitialMountMaxWords.current) isInitialMountMaxWords.current = false; else if (wordList.length > 0) selectNewPair(); }, [maxWords, wordList]);

    // === Language Switch ===
    const switchLanguageDirection = () => { setLanguageDirection(prev => prev === 'spa-eng' ? 'eng-spa' : 'spa-eng'); setShowFeedback(false); setLastCorrectAnswer(''); setHintData(null); setFeedbackSignal(null); };

    // === Hint Logic ===
    const handleGetHint = async () => {
        if (!currentPair || hintData || showFeedback || isHintLoading || feedbackSignal === 'incorrect') return;
        const wordToLookup = (languageDirection === 'spa-eng') ? currentPair.spanish : currentPair.english;
        if (languageDirection !== 'spa-eng') { console.warn("Hint lookup currently optimized for Spanish words."); }
        console.log(`Getting hint for: "${wordToLookup}"`); setIsHintLoading(true); setHintData(null);
        try {
            const apiResponse = await getMwHint(wordToLookup); console.log("Raw Hint Data:", apiResponse); let definitionData = null;
            if (Array.isArray(apiResponse) && apiResponse.length > 0) { if (typeof apiResponse[0] === 'string') { setHintData({ type: 'suggestions', suggestions: apiResponse }); return; } else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta) { definitionData = apiResponse[0]; } else { setHintData({ type: 'unknown', raw: apiResponse }); return; } }
            else if (typeof apiResponse === 'object' && !Array.isArray(apiResponse) && apiResponse !== null && apiResponse?.meta) { definitionData = apiResponse; }
            if (definitionData) { setHintData({ type: 'definitions', data: definitionData }); }
            else if (!hintData) { setHintData({ type: 'error', message: "Hint data format error." }); }
        } catch (err) { console.error("Error in handleGetHint:", err); setHintData({ type: 'error', message: "Failed fetch hint." }); }
        finally { setIsHintLoading(false); }
    };

    // === Component Return ===
    return (
        <div className="App">
            <h1>Spanish Flashcards</h1>
            {/* Score Stacks Area */}
            <div className="score-stacks-container">
                <ScoreStack type="correct" label="Correct" count={score.correct} icon="✅" />
                <ScoreStack type="incorrect" label="Incorrect" count={score.incorrect} icon="❌" flashRef={incorrectScoreRef} />
              
                <ScoreStack
                    type="hard"
                    label="Hard Words"
                    count={hardWordsList.length}
                    icon="⭐"
                    onClick={() => setShowHardWordsView(prev => !prev)} // Toggle state
                />
            </div>

            {/* Controls Area */}
            <div className="controls" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
               <button onClick={switchLanguageDirection}>Switch Dir ({languageDirection === 'spa-eng' ? 'S->E' : 'E->S'})</button>
               <button onClick={() => selectNewPair(undefined, true)} disabled={isLoading || !wordList.length}> {isLoading ? 'Loading...' : 'New Card'} </button>
              
            </div>

            {/* Status Messages Area */}
            {isLoading && <p>Loading...</p>}
            {error && !isLoading && ( <div className="error-area"> <p>Error: {error}</p> <button onClick={() => selectNewPair(undefined, true)} disabled={isLoading || !wordList.length}> Try New Card </button> </div> )}

            {/* --- Main Content Area --- */}
            {/* --- Conditionally Render Flashcard Area or Hard Words Placeholder --- */}
            {showHardWordsView ? (
                // Show placeholder when showHardWordsView is true
                <div className="hard-words-view-placeholder" style={{ padding: '20px', border: '1px dashed grey', marginTop: '20px', backgroundColor: '#f0f0f0' }}>
                    <h2>Hard Words Review</h2>
                    <p>(List of hard words will appear here in the next step)</p>
                    {/* Add button to close this view */}
                    <button onClick={() => setShowHardWordsView(false)} style={{marginTop: '10px'}}>
                        Back to Practice
                    </button>
                </div>
            ) : (
                // Otherwise, show the normal flashcard area (if not loading/error/no pair)
                <> {/* Use Fragment */}
                    {!isLoading && !error && currentPair && (
                        <div className="flashcard-area">
                            {(() => {
                                const isCurrentCardMarked = hardWordsList.some( word => word.spanish === currentPair.spanish && word.english === currentPair.english );
                                return ( <Flashcard pair={currentPair} direction={languageDirection} onAnswerSubmit={handleAnswerSubmit} showFeedback={showFeedback} onGetHint={handleGetHint} hint={hintData} isHintLoading={isHintLoading} feedbackSignal={feedbackSignal} onMarkHard={handleMarkHard} isMarkedHard={isCurrentCardMarked} /> );
                            })()}
                            {showFeedback && ( <div className="feedback-area"> <p style={{ color: '#D90429', fontWeight: 'bold' }}>Incorrect. Correct: "{lastCorrectAnswer}"</p> </div> )}
                        </div>
                    )}
                    {/* Fallback Messages (only show if appropriate and not showing hard words) */}
                    {!isLoading && !error && !currentPair && wordList.length > 0 && ( <p>No card matching criteria. Try 'New Card'.</p> )}
                    {!isLoading && !error && !currentPair && wordList.length === 0 && ( <p>Word list failed or empty.</p> )}
                </>
            )}
            {/* --- END Conditional Rendering --- */}

         
        </div>
    );
}
export default App;