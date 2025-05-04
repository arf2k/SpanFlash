// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import Flashcard from './components/Flashcard';
import ScoreStack from './components/ScoreStack';
import HardWordsView from './components/HardWordsView';
import { getMwHint } from './services/dictionaryServices.js';
import { db } from './db';
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
    const [showHardWordsView, setShowHardWordsView] = useState(false);

    // === Refs ===
    const incorrectScoreRef = useRef(null);
    const isInitialMountScore = useRef(true);
    const isInitialMountMaxWords = useRef(true);

    // === Selection Logic ===
    const selectNewPair = (listToUse = wordList, manageLoadingState = false) => {
        console.log(`FUNC_START: selectNewPair (manageLoading: ${manageLoadingState})... List size: ${listToUse?.length}`);
        if (manageLoadingState) { console.log("LOAD_MANAGE: Setting isLoading = true"); setIsLoading(true); }
        setError(null); setHintData(null); setCurrentPair(null); setShowFeedback(false);
        setIsHintLoading(false); setFeedbackSignal(null);
        if (!listToUse || listToUse.length === 0) { console.error("ERROR: selectNewPair called with empty list."); setError("Word list empty."); setCurrentPair(null); if (manageLoadingState) { console.log("LOAD_MANAGE: Setting isLoading = false (empty list)"); setIsLoading(false); } return; }
        try {
            console.log("TRY_BLOCK: Entered try block."); const currentMaxWords = maxWords; console.log(`TRY_BLOCK: Using maxWords = ${currentMaxWords}`); console.log("TRY_BLOCK: Starting filter...");
            const filteredData = listToUse.filter(pair => { if (!pair?.spanish || !pair?.english || typeof pair.spanish !== 'string' || typeof pair.english !== 'string') { return false; } const eng = pair.english.split(' ').filter(w=>w.length>0).length; const spa = pair.spanish.split(' ').filter(w=>w.length>0).length; return eng > 0 && eng <= currentMaxWords && spa > 0 && spa <= currentMaxWords; });
            console.log("TRY_BLOCK: Filter completed."); console.log(`TRY_BLOCK: Found ${filteredData.length} pairs matching criteria.`);
            if (filteredData.length > 0) { const idx = Math.floor(Math.random() * filteredData.length); const pair = filteredData[idx]; console.log("TRY_BLOCK: Setting current pair:", pair); setCurrentPair(pair); }
            else { const errMsg = `No pairs found with <= ${currentMaxWords} words.`; console.warn("TRY_BLOCK: " + errMsg); setError(errMsg); setCurrentPair(null); }
        } catch (err) { console.error("CATCH_BLOCK: Error selecting/filtering pair:", err); setError(err.message || 'Failed select pair.'); setCurrentPair(null); }
        finally { if (manageLoadingState) { console.log("LOAD_MANAGE: Setting isLoading = false (from finally)"); setIsLoading(false); } console.log("FUNC_END: selectNewPair finished."); }
    };

    // === Combined Initial Load useEffect ===
    useEffect(() => {
        const loadInitialData = async () => {
            console.log("App mounted. Loading ALL initial data..."); setIsLoading(true); setError(null); setWordList([]); setScore({ correct: 0, incorrect: 0 }); setHardWordsList([]); setCurrentPair(null);
            try {
                console.log("Fetching word list..."); const response = await fetch('/scrapedSpan411.json'); if (!response.ok) throw new Error(`Word list fetch failed: ${response.status}`); const loadedList = await response.json(); if (!Array.isArray(loadedList)) throw new Error("Word list data invalid."); console.log(`Loaded ${loadedList.length} pairs.`); setWordList(loadedList);
                console.log("Loading score from DB..."); const savedScoreState = await db.appState.get('userScore'); if (savedScoreState) { setScore({ ...savedScoreState }); } else { await db.appState.put({ id: 'userScore', correct: 0, incorrect: 0 }); }
                console.log("Loading hard words from DB..."); const loadedHardWords = await db.hardWords.toArray(); if (loadedHardWords) { setHardWordsList(loadedHardWords); console.log(`Loaded ${loadedHardWords.length} hard words.`); }
                selectNewPair(loadedList);
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
    const handleMarkHard = async (pairToMark) => { if (!pairToMark?.spanish || !pairToMark?.english) return; console.log("Marking hard:", pairToMark); try { await db.hardWords.put({ spanish: pairToMark.spanish, english: pairToMark.english }); if (!hardWordsList.some(w => w.spanish === pairToMark.spanish && w.english === pairToMark.english)) { setHardWordsList(prev => [...prev, { spanish: pairToMark.spanish, english: pairToMark.english }]); console.log("Updated hardWordsList state."); } } catch (error) { console.error("Failed save hard word:", error); } };

    // === Remove Hard Word Handler ===
    const handleRemoveHardWord = async (pairToRemove) => { if (!pairToRemove?.spanish || !pairToRemove?.english) { console.error("Invalid pair to remove"); return; } console.log("Attempting remove hard word:", pairToRemove); const compoundKey = [pairToRemove.spanish, pairToRemove.english]; try { await db.hardWords.delete(compoundKey); console.log("Removed word DB."); setHardWordsList(prev => prev.filter(p => !(p.spanish === pairToRemove.spanish && p.english === pairToRemove.english) )); console.log("Updated hardWordsList state removal."); } catch (error) { console.error("Failed remove hard word:", error); } };

    // === Answer Submission Logic ===
    const handleAnswerSubmit = (userAnswer) => {
        console.log('--- App: handleAnswerSubmit CALLED with:', userAnswer); const punctuationRegex = /[.?!¡¿]+$/; const englishArticleRegex = /^(the|a|an)\s+/i; const toVerbRegex = /^to\s+/i; if (!currentPair || showFeedback) { return; } const correctAnswer = languageDirection === 'spa-eng' ? currentPair.english : currentPair.spanish; let normUser = userAnswer.toLowerCase().trim().replace(punctuationRegex, ''); let normCorrect = correctAnswer.toLowerCase().trim().replace(punctuationRegex, ''); if (languageDirection === 'spa-eng') { console.log('Normalizing English answer (articles/to)'); normUser = normUser.replace(englishArticleRegex, '').replace(toVerbRegex, ''); normCorrect = normCorrect.replace(englishArticleRegex, '').replace(toVerbRegex, ''); } console.log(`Comparing: "${normUser}" vs "${normCorrect}"`); if (normUser === normCorrect) { console.log("CORRECT."); setScore(prev => ({ ...prev, correct: prev.correct + 1 })); setFeedbackSignal('correct'); setTimeout(() => { selectNewPair(); }, 50); } else { console.log("INCORRECT."); setScore(prev => ({ ...prev, incorrect: prev.incorrect + 1 })); setLastCorrectAnswer(correctAnswer); setShowFeedback(true); setFeedbackSignal('incorrect'); }
     };

    // === Max Words Change ===
    const handleMaxWordsChange = (event) => { const newVal = parseInt(event.target.value, 10); setMaxWords(newVal >= 1 ? newVal : 1); };
    useEffect(() => { if (isInitialMountMaxWords.current) isInitialMountMaxWords.current = false; else if (wordList.length > 0) selectNewPair(); }, [maxWords, wordList]);

    // === Language Switch ===
    const switchLanguageDirection = () => { console.log('[App Render] languageDirection state is:', languageDirection); setLanguageDirection(prev => prev === 'spa-eng' ? 'eng-spa' : 'spa-eng'); setShowFeedback(false); setLastCorrectAnswer(''); setHintData(null); setFeedbackSignal(null); };

    // ================================================
    // === Hint Logic (Modified for forceLookup) ===
    // ================================================
    // Added forceLookup parameter (defaults to false)
    const handleGetHint = async (forceLookup = false) => {
        console.log(`handleGetHint called. forceLookup: ${forceLookup}, showFeedback: ${showFeedback}, hintData exists: ${!!hintData}`);

        // --- Updated Guard Conditions ---
        // Always block if no current pair or hint is currently loading
        if (!currentPair || isHintLoading) {
            console.log("Hint blocked: No current pair or hint already loading.");
            return;
        }
        // Block if NOT forcing lookup AND hint already exists OR feedback is showing OR incorrect signal was just set
        if (!forceLookup && (hintData || showFeedback || feedbackSignal === 'incorrect')) {
            console.log("Hint blocked: Not forcing and hint exists or feedback showing/incorrect.");
            return;
        }
        // --- End Updated Guard Conditions ---


        const wordToLookup = currentPair.spanish; // Assuming Spanish hint lookup
        if (!wordToLookup) { console.error("Cannot get hint: Spanish word is missing."); return; }

        console.log(`Attempting hint for: "${wordToLookup}"`);

        // Pre-processing (remove articles)
        const spanishArticleRegex = /^(el|la|los|las|un|una|unos|unas)\s+/i;
        let wordForApi = wordToLookup.replace(spanishArticleRegex, '').trim();
        console.log(`Original lookup: "${wordToLookup}", Sending to API: "${wordForApi}"`);

        setIsHintLoading(true);
        // Reset hintData ONLY if we are forcing a new lookup or no hint exists
        if (forceLookup || !hintData) {
             setHintData(null);
             console.log("Hint data reset.");
        }

        try {
            const apiResponse = await getMwHint(wordForApi);
            console.log("Raw Hint Data:", apiResponse);
            let definitionData = null;
            if (Array.isArray(apiResponse) && apiResponse.length > 0) {
                 if (typeof apiResponse[0] === 'string') { setHintData({ type: 'suggestions', suggestions: apiResponse }); console.log("API returned suggestions."); return; }
                 else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta) { definitionData = apiResponse[0]; console.log("API returned definition object(s)."); }
                 else { setHintData({ type: 'unknown', raw: apiResponse }); console.warn("API array: unknown content."); return; }
            } else if (typeof apiResponse === 'object' && !Array.isArray(apiResponse) && apiResponse !== null && apiResponse?.meta) { definitionData = apiResponse; console.log("API returned single definition object."); }
            if (definitionData) { setHintData({ type: 'definitions', data: definitionData }); console.log("Set hint data: definitions"); }
            else if (!hintData || forceLookup) { console.warn("No definition/suggestion data found."); setHintData({ type: 'error', message: "Hint format error." }); }
        } catch (err) { console.error("Error in handleGetHint:", err); setHintData({ type: 'error', message: "Failed fetch hint." }); }
        finally { setIsHintLoading(false); }
    };

    // === Handler to Close the Hard Words View ===
    const handleCloseHardWordsView = () => { console.log("Closing Hard Words View"); setShowHardWordsView(false); };

    // Log language direction before rendering return statement
    console.log('[App Render] languageDirection state is:', languageDirection);

    // === Component Return ===
    return (
        <div className="App">
            <h1>Spanish Flashcards</h1>
            {/* Score Stacks Area */}
            <div className="score-stacks-container"> <ScoreStack type="correct" label="Correct" count={score.correct} icon="✅" /> <ScoreStack type="incorrect" label="Incorrect" count={score.incorrect} icon="❌" flashRef={incorrectScoreRef} /> <ScoreStack type="hard" label="Hard Words" count={hardWordsList.length} icon="⭐" onClick={() => { console.log("Hard words stack clicked"); setShowHardWordsView(prev => !prev); }} /> </div>
            {/* Controls Area */}
            <div className="controls" style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '15px' }}> <button onClick={switchLanguageDirection}>Switch Dir ({languageDirection === 'spa-eng' ? 'S->E' : 'E->S'})</button> <button onClick={() => selectNewPair(undefined, true)} disabled={isLoading || !wordList.length}> {isLoading ? 'Loading...' : 'New Card'} </button> </div>
            {/* Status Messages Area */}
            {isLoading && <p>Loading...</p>} {error && !isLoading && ( <div className="error-area"> <p>Error: {error}</p> <button onClick={() => selectNewPair(undefined, true)} disabled={isLoading || !wordList.length}> Try New Card </button> </div> )}

            {/* Conditional Rendering for Main Content Area */}
            {showHardWordsView ? (
                <HardWordsView hardWordsList={hardWordsList} onClose={handleCloseHardWordsView} onRemoveWord={handleRemoveHardWord} />
            ) : (
                <>
                    {!isLoading && !error && currentPair && (
                        <div className="flashcard-area">
                            {(() => { const isCurrentCardMarked = hardWordsList.some( word => word.spanish === currentPair.spanish && word.english === currentPair.english ); return ( <Flashcard pair={currentPair} direction={languageDirection} onAnswerSubmit={handleAnswerSubmit} showFeedback={showFeedback} onGetHint={handleGetHint} hint={hintData} isHintLoading={isHintLoading} feedbackSignal={feedbackSignal} onMarkHard={handleMarkHard} isMarkedHard={isCurrentCardMarked} /> ); })()}
                            {/* ================================================ */}
                            {/* MODIFIED Feedback Area - Added Hint Button     */}
                            {/* ================================================ */}
                            {showFeedback && (
                                <div className="feedback-area" style={{ marginTop: '10px' }}>
                                    <p style={{ color: '#D90429', fontWeight: 'bold', marginBottom: '8px' /* Added margin */ }}>Incorrect. Correct: "{lastCorrectAnswer}"</p>
                                    {/* Add button to trigger hint lookup */}
                                    <button
                                        onClick={() => handleGetHint(true)} // Call with forceLookup = true
                                        disabled={isHintLoading || !!hintData} // Disable if loading or hint already shown
                                        className="hint-button" // Reuse hint button styling?
                                        style={{ /* Add specific styles if needed */ }}
                                    >
                                        {isHintLoading ? 'Getting Info...' : (hintData ? 'Hint/Info Loaded' : 'Show Hint / Related')}
                                    </button>
                                </div>
                            )}
                             {/* ================================================ */}
                             {/* END MODIFIED Feedback Area                      */}
                             {/* ================================================ */}
                        </div>
                    )}
                    {/* Fallback Messages */}
                    {!isLoading && !error && !currentPair && wordList.length > 0 && ( <p>No card matching criteria. Try 'New Card'.</p> )}
                    {!isLoading && !error && !currentPair && wordList.length === 0 && ( <p>Word list failed or empty.</p> )}
                </>
            )}
            {/* END Conditional Rendering */}
        </div>
    );
}
export default App;