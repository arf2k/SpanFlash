// src/App.jsx
import { useState, useEffect, useRef } from "react";
import Flashcard from "./components/Flashcard";
import ScoreStack from "./components/ScoreStack";
import HardWordsView from "./components/HardWordsView";
import { getMwHint } from "./services/dictionaryServices.js";
import { db } from "./db";
import { useWordData } from "./hooks/useWordData"; // <-- Import the custom hook
import "./App.css";

function App() {
    // === Use the custom hook for word data ===
    const { wordList, isLoadingData, dataError, currentDataVersion } = useWordData();

    // === App-specific State Variables (excluding those managed by useWordData) ===
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState("spa-eng");
    // isLoading, error, dataVersion are now isLoadingData, dataError, currentDataVersion from the hook
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [hardWordsList, setHardWordsList] = useState([]);
    const [hintData, setHintData] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [feedbackSignal, setFeedbackSignal] = useState(null);
    const [showHardWordsView, setShowHardWordsView] = useState(false);
    
    // === Refs ===
    const incorrectScoreRef = useRef(null);
    const isInitialMountApp = useRef(true); // Used for app-specific initial data like score/hard words

    // === Selection Logic (remains in App.jsx as it uses currentPair, wordList) ===
    const selectNewPair = (listToUse = wordList, manageLoadingState = false) => {
        // Removed setIsLoading(true/false) from here as isLoadingData handles word list loading.
        // If selectNewPair itself had a loading state, it would be separate.
        console.log(
            `FUNC_START: selectNewPair... List size: ${listToUse?.length}`
        );
        // setError(null); // dataError from hook handles word list errors
        setHintData(null);
        setCurrentPair(null);
        setShowFeedback(false);
        setIsHintLoading(false);
        setFeedbackSignal(null);

        if (!listToUse || listToUse.length === 0) {
            console.warn("selectNewPair called with empty or undefined listToUse.");
            setCurrentPair(null);
            // dataError might be set by useWordData if the list is persistently empty
            return;
        }
        try {
            const filteredData = listToUse.filter((pair) =>
                pair &&
                typeof pair.spanish === 'string' && pair.spanish.trim().length > 0 &&
                typeof pair.english === 'string' && pair.english.trim().length > 0
            );
            if (filteredData.length > 0) {
                const idx = Math.floor(Math.random() * filteredData.length);
                const pair = filteredData[idx];
                setCurrentPair(pair);
                console.log("Selected new pair:", pair);
            } else {
                console.warn("No valid pairs found in the list to select from for selectNewPair.");
                // dataError should ideally be set by useWordData if list is problematic
                // If list is valid but filtering here yields nothing, that's a different issue
                // For now, let currentPair be null.
                setCurrentPair(null); 
            }
        } catch (err) {
            console.error("Error selecting/filtering pair in selectNewPair:", err);
            // setError(err.message || "Failed to select a new pair."); // This would be an app-level error
            setCurrentPair(null);
        }
    };

    // === useEffect for loading app-specific data (scores, hard words) ===
    // This runs once after initial mount.
    useEffect(() => {
        const loadAppSpecificData = async () => {
            console.log("App.jsx: Loading app-specific data (score, hard words)...");
            // Load Score from DB
            try {
                const savedScoreState = await db.appState.get("userScore");
                if (savedScoreState) {
                    setScore({ correct: savedScoreState.correct, incorrect: savedScoreState.incorrect });
                } else {
                    await db.appState.put({ id: "userScore", correct: 0, incorrect: 0 });
                    setScore({ correct: 0, incorrect: 0 });
                }
            } catch (err) {
                console.error("Failed to load/initialize score:", err);
                // Optionally set an app-level error if score loading is critical
            }

            // Load Hard Words from DB
            try {
                const loadedHardWords = await db.hardWords.toArray();
                setHardWordsList(loadedHardWords || []);
            } catch (err) {
                console.error("Failed to load hard words:", err);
            }
            isInitialMountApp.current = false; // Allow score saving effect, etc.
            console.log("App.jsx: App-specific data loading finished.");
        };
        loadAppSpecificData();
    }, []);


    // === useEffect to Select Initial/New Pair When Word List is Ready ===
    useEffect(() => {
        console.log(`App.jsx Effect: wordList (len ${wordList.length}), isLoadingData (${isLoadingData}), currentPair (${!!currentPair}), dataError (${!!dataError})`);
        if (!isLoadingData && wordList.length > 0 && !currentPair && !dataError) {
            console.log("App.jsx: wordList ready, selecting initial pair.");
            selectNewPair(wordList);
        } else if (!isLoadingData && wordList.length === 0 && !dataError) {
            console.log("App.jsx: Word list is confirmed empty from hook. No pair to select.");
            setCurrentPair(null);
        }
    }, [wordList, isLoadingData, dataError, currentPair]); // Added currentPair to re-evaluate if it becomes null and conditions are met

    // === Saving Score useEffect ===
    useEffect(() => {
        if (isInitialMountApp.current) return; // Use the App's mount ref now
        const saveScoreToDB = async () => {
            try {
                await db.appState.put({ id: "userScore", ...score });
                console.log("Score saved to DB:", score);
            } catch (err) {
                console.error("Failed to save score to DB:", err);
            }
        };
        saveScoreToDB();
    }, [score, isInitialMountApp]); // Add isInitialMountApp to deps for clarity, though its change won't re-run this specifically

    // === Incorrect Score Flash useEffect ===
    useEffect(() => {
        if (isInitialMountApp.current) return;
        if (score.incorrect > 0 && incorrectScoreRef.current) {
            // ... (rest of the flash logic as before) ...
            const element = incorrectScoreRef.current;
            if (!element.classList.contains("score-flash-incorrect")) {
                element.classList.add("score-flash-incorrect");
                setTimeout(() => {
                    if (incorrectScoreRef.current) {
                        incorrectScoreRef.current.classList.remove("score-flash-incorrect");
                    }
                }, 1000);
            }
        }
    }, [score.incorrect, isInitialMountApp]);


    // ... (handleMarkHard, handleRemoveHardWord, handleAnswerSubmit, switchLanguageDirection, handleGetHint, handleCloseHardWordsView remain the same) ...
    // Ensure these functions use `wordList` that now comes from the hook.
    // For example, `selectNewPair()` inside `handleAnswerSubmit` or `switchLanguageDirection`
    // will correctly use the `wordList` from the `useWordData` hook because `selectNewPair`
    // defaults to the `wordList` in its scope.

    // (Copy paste your existing handlers here, they should work fine)
    // === Mark Hard Word Handler ===
    const handleMarkHard = async (pairToMark) => {
        if (!pairToMark?.spanish || !pairToMark?.english) return;
        const hardWordEntry = { spanish: pairToMark.spanish, english: pairToMark.english };
        try {
            await db.hardWords.put(hardWordEntry);
            if (!hardWordsList.some(w => w.spanish === pairToMark.spanish && w.english === pairToMark.english)) {
                setHardWordsList((prev) => [...prev, hardWordEntry]);
            }
        } catch (error) {
            console.error("Failed to save hard word:", error);
        }
    };

    // === Remove Hard Word Handler ===
    const handleRemoveHardWord = async (pairToRemove) => {
        if (!pairToRemove?.spanish || !pairToRemove?.english) return;
        const compoundKey = [pairToRemove.spanish, pairToRemove.english];
        try {
            await db.hardWords.delete(compoundKey);
            setHardWordsList((prev) =>
                prev.filter(p => !(p.spanish === pairToRemove.spanish && p.english === pairToRemove.english))
            );
        } catch (error) {
            console.error("Failed to remove hard word:", error);
        }
    };

    // === Answer Submission Logic ===
    const handleAnswerSubmit = (userAnswer) => {
        if (!currentPair || showFeedback) return;
        const punctuationRegex = /[.?!¡¿]+$/;
        const englishArticleRegex = /^(the|a|an)\s+/i;
        const toVerbRegex = /^to\s+/i;

        const correctAnswer = languageDirection === "spa-eng" ? currentPair.english : currentPair.spanish;
        let normUser = userAnswer.toLowerCase().trim().replace(punctuationRegex, "");
        let normCorrect = correctAnswer.toLowerCase().trim().replace(punctuationRegex, "");

        if (languageDirection === "spa-eng") {
            normUser = normUser.replace(englishArticleRegex, "").replace(toVerbRegex, "");
            normCorrect = normCorrect.replace(englishArticleRegex, "").replace(toVerbRegex, "");
        }

        if (normUser === normCorrect) {
            setScore((prev) => ({ ...prev, correct: prev.correct + 1 }));
            setFeedbackSignal("correct");
            setTimeout(() => selectNewPair(), 600); 
        } else {
            setScore((prev) => ({ ...prev, incorrect: prev.incorrect + 1 }));
            setLastCorrectAnswer(correctAnswer);
            setShowFeedback(true);
            setFeedbackSignal("incorrect");
        }
    };

    // === Language Switch ===
    const switchLanguageDirection = () => {
        setLanguageDirection((prev) => (prev === "spa-eng" ? "eng-spa" : "spa-eng"));
        setShowFeedback(false);
        setLastCorrectAnswer("");
        setHintData(null);
        setFeedbackSignal(null);
        selectNewPair(); 
    };

    // === Hint Logic ===
    const handleGetHint = async (forceLookup = false) => {
        if (!currentPair || isHintLoading) return;
        if (!forceLookup && ((hintData && hintData.type !== 'error') || (showFeedback && feedbackSignal === 'incorrect'))) {
            return;
        }
        const wordToLookup = currentPair.spanish;
        if (!wordToLookup) {
            setHintData({ type: "error", message: "Internal error: Word missing for hint." });
            return;
        }
        const spanishArticleRegex = /^(el|la|los|las|un|una|unos|unas)\s+/i;
        let wordForApi = wordToLookup.replace(spanishArticleRegex, "").trim();
        if (!wordForApi) {
            setHintData({ type: "error", message: "Cannot look up article alone as hint." });
            return;
        }
        setIsHintLoading(true);
        if (forceLookup || !hintData) setHintData(null);

        try {
            const apiResponse = await getMwHint(wordForApi);
            let definitionData = null;
            let suggestions = null;

            if (Array.isArray(apiResponse) && apiResponse.length > 0) {
                if (typeof apiResponse[0] === "string") suggestions = apiResponse;
                else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta?.id) definitionData = apiResponse[0];
                else setHintData({ type: "unknown", raw: apiResponse });
            } else if (typeof apiResponse === 'object' && !Array.isArray(apiResponse) && apiResponse?.meta?.id) {
                definitionData = apiResponse;
            } else if (Array.isArray(apiResponse) && apiResponse.length === 0) {
                setHintData({ type: "error", message: `No definition found for "${wordForApi}".` });
            } else {
                 setHintData({ type: "unknown", raw: apiResponse });
            }

            if (definitionData) setHintData({ type: "definitions", data: definitionData });
            else if (suggestions) setHintData({ type: "suggestions", suggestions: suggestions });
            
        } catch (err) {
            console.error("Error in handleGetHint fetching/processing:", err);
            setHintData({ type: "error", message: "Failed to fetch hint." });
        } finally {
            setIsHintLoading(false);
        }
    };
    const handleCloseHardWordsView = () => setShowHardWordsView(false);


    // --- Adjust JSX to use isLoadingData, dataError, currentDataVersion ---
    return (
        <div className="App">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '700px', marginBottom: '10px' }}>
                <h1>Spanish Flashcards</h1>
                {currentDataVersion && ( // Use currentDataVersion from hook
                    <p style={{ fontSize: '0.8rem', color: '#6c757d', margin: '0' }}>
                        Data v: {currentDataVersion}
                    </p>
                )}
            </div>
            
            <div className="score-stacks-container">
                {/* ScoreStack components remain the same */}
                <ScoreStack type="correct" label="Correct" count={score.correct} icon="✅" />
                <ScoreStack type="incorrect" label="Incorrect" count={score.incorrect} icon="❌" flashRef={incorrectScoreRef} />
                <ScoreStack
                    type="hard"
                    label="Hard Words"
                    count={hardWordsList.length}
                    icon="⭐"
                    onClick={() => setShowHardWordsView((prev) => !prev)}
                />
            </div>

            <div className="controls">
                <button onClick={switchLanguageDirection}>
                    Switch Dir ({languageDirection === "spa-eng" ? "S->E" : "E->S"})
                </button>
                <button
                    onClick={() => selectNewPair(wordList, true)} // selectNewPair now correctly uses wordList from hook's scope by default if no arg
                    disabled={isLoadingData || !wordList.length || showHardWordsView} // Use isLoadingData
                >
                    {isLoadingData && !currentPair ? "Loading Words..." : "New Card"} {/* Use isLoadingData */}
                </button>
            </div>

            {/* Status Messages Area */}
            {isLoadingData && !currentPair && <p>Loading word list and preparing first card...</p>} {/* Use isLoadingData */}
            {dataError && ( /* Use dataError */
                <div className="error-area">
                    <p>{dataError}</p> {/* Display dataError message */}
                    {/* Consider if a reload button here should re-trigger the hook or just app specific things */}
                </div>
            )}

            {showHardWordsView ? (
                <HardWordsView
                    hardWordsList={hardWordsList}
                    onClose={handleCloseHardWordsView}
                    onRemoveWord={handleRemoveHardWord}
                />
            ) : (
                <>
                    {!isLoadingData && !dataError && currentPair && ( /* Use isLoadingData, dataError */
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
                                onMarkHard={handleMarkHard}
                                isMarkedHard={currentPair && hardWordsList.some(
                                    (word) => word.spanish === currentPair.spanish && word.english === currentPair.english
                                )}
                            />
                            {showFeedback && feedbackSignal === 'incorrect' && (
                                <div className="feedback-area">
                                    <p>Incorrect. The correct answer is: "{lastCorrectAnswer}"</p>
                                    <button onClick={() => handleGetHint(true)} disabled={isHintLoading} style={{marginRight: '10px'}}>
                                        {isHintLoading ? "Getting Info..." : "Show Hint / Related"}
                                    </button>
                                    <button onClick={() => selectNewPair()} >
                                        Next Card
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Fallback Messages for no card */}
                    {!isLoadingData && !dataError && !currentPair && wordList.length > 0 && (
                        <p>No card available. Try "New Card".</p>
                    )}
                     {!isLoadingData && !dataError && !currentPair && wordList.length === 0 && (
                        <p>Word list is empty or failed to load.</p>
                    )}
                </>
            )}
        </div>
    );
}

export default App;