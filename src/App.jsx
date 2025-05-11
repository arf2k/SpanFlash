import { useState, useEffect, useRef } from "react";
import Flashcard from "./components/Flashcard";
import ScoreStack from "./components/ScoreStack";
import HardWordsView from "./components/HardWordsView";
import { getMwHint } from "./services/dictionaryServices.js";
import { db } from "./db";
import { useWordData } from "./hooks/useWordData";
import { useFlashcardGame } from "./hooks/useFlashcardGame"; 
import "./App.css";

function App() {
    // === Custom Hooks ===
    const { wordList, isLoadingData, dataError, currentDataVersion } = useWordData();
    const {
        currentPair,
        languageDirection,
        score,
        showFeedback,
        lastCorrectAnswer,
        feedbackSignal,
        gameError, 
        selectNewPairCard,
        submitAnswer,
        switchDirection,
        switchToNextCard, 
        setScore, 
        setShowFeedback: setGameShowFeedback, 
    } = useFlashcardGame(wordList); 

    // === App-specific State Variables (UI, non-game, non-word-data) ===
    const [hardWordsList, setHardWordsList] = useState([]);
    const [hintData, setHintData] = useState(null);
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [showHardWordsView, setShowHardWordsView] = useState(false);
    
    // === Refs ===
    const incorrectScoreRef = useRef(null);
    const isInitialMountApp = useRef(true);

    // === Effects ===

    // Effect for loading app-specific persistent data (scores, hard words)
    useEffect(() => {
        const loadAppSpecificData = async () => {
            console.log("App.jsx: Loading app-specific data (score, hard words)...");
            try {
                const savedScoreState = await db.appState.get("userScore");
                if (savedScoreState) {
                    setScore(savedScoreState); // Use setScore from useFlashcardGame
                } else {
                    await db.appState.put({ id: "userScore", correct: 0, incorrect: 0 });
                  
                }
            } catch (err) { console.error("Failed to load/initialize score:", err); }

            try {
                const loadedHardWords = await db.hardWords.toArray();
                setHardWordsList(loadedHardWords || []);
            } catch (err) { console.error("Failed to load hard words:", err); }
            
            isInitialMountApp.current = false;
            console.log("App.jsx: App-specific data loading finished.");
        };
        loadAppSpecificData();
    }, [setScore]); 

    useEffect(() => {
        console.log(`App.jsx Effect: wordList (len ${wordList.length}), isLoadingData (${isLoadingData}), currentPair (${!!currentPair}), dataError (${!!dataError}), gameError (${!!gameError})`);
        if (!isLoadingData && wordList.length > 0 && !currentPair && !dataError && !gameError) {
            console.log("App.jsx: wordList ready, no current pair, no errors. Selecting initial pair via hook.");
            selectNewPairCard();
        } else if (!isLoadingData && (wordList.length === 0 || gameError) && !dataError) {
            console.log("App.jsx: Word list is empty or game error. No pair to select.");
            // currentPair should be null from useFlashcardGame if no card can be selected
        }
    }, [wordList, isLoadingData, dataError, gameError, currentPair, selectNewPairCard]);


    // Effect to reset hints when currentPair changes (i.e., a new card is selected)
    useEffect(() => {
        if (currentPair) { // If a new card is set
            console.log("App.jsx: New currentPair detected, resetting hint data.");
            setHintData(null);
            setIsHintLoading(false);
        }
        // This effect should also run if currentPair becomes null after having a value,
        // ensuring hints are cleared if no card is displayed.
        // However, selectNewPairCard in the hook already sets currentPair to null before selecting a new one,
        // which triggers this effect.
        if (!currentPair) {
            setHintData(null);
            setIsHintLoading(false);
        }
    }, [currentPair]);


    // Effect for Saving Score to DB
    useEffect(() => {
        if (isInitialMountApp.current) return;
        const saveScoreToDB = async () => {
            try {
                await db.appState.put({ id: "userScore", ...score }); // score comes from useFlashcardGame
                console.log("Score saved to DB:", score);
            } catch (err) {
                console.error("Failed to save score to DB:", err);
            }
        };
        // Only save if score is not the initial {0,0} unless it's no longer the initial mount
        if (score.correct > 0 || score.incorrect > 0 || !isInitialMountApp.current) {
            saveScoreToDB();
        }
    }, [score, isInitialMountApp]);

    // Effect for Incorrect Score Flash Animation
    useEffect(() => {
        if (isInitialMountApp.current) return;
        if (score.incorrect > 0 && incorrectScoreRef.current) {
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


    // === Event Handlers (some are now directly from the hook, others remain or adapt) ===
    const handleMarkHard = async (pairToMark) => {
        // This logic remains in App.jsx as it manages hardWordsList state
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

    const handleRemoveHardWord = async (pairToRemove) => {
        // This logic remains in App.jsx
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
    
    // Hint Logic still primarily managed in App.jsx, but reset is triggered by currentPair change
    const handleGetHint = async (forceLookup = false) => {
        if (!currentPair || isHintLoading) return; // currentPair from useFlashcardGame
        // showFeedback from useFlashcardGame
        if (!forceLookup && ((hintData && hintData.type !== 'error') || (showFeedback && feedbackSignal === 'incorrect'))) {
            return;
        }
        const wordToLookup = currentPair.spanish;
        // ... (rest of getMwHint logic as before)
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
        // setHintData(null) is now handled by useEffect watching currentPair if !forceLookup
        // If forceLookup, we might want to reset it here.
        if (forceLookup) setHintData(null); 

        try {
            const apiResponse = await getMwHint(wordForApi);
            let definitionData = null;
            let suggestions = null;

            if (Array.isArray(apiResponse) && apiResponse.length > 0) {
                if (typeof apiResponse[0] === "string") suggestions = apiResponse;
                else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta?.id) definitionData = apiResponse[0];
                else setHintData({ type: "unknown", raw: apiResponse });
            } else if (typeof api_response === 'object' && !Array.isArray(apiResponse) && apiResponse?.meta?.id) {
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

    const handleToggleHardWordsView = () => {
        setShowHardWordsView(prev => {
            if (!prev) { // If we are about to show hard words view
                setGameShowFeedback(false); // Hide game feedback
                // Hint data reset is handled by currentPair becoming null if we desire
            }
            return !prev;
        });
    };


    // --- JSX ---
    // Use isLoadingData, dataError, currentDataVersion, gameError
    // Use functions from useFlashcardGame hook: submitAnswer, switchDirection, selectNewPairCard, switchToNextCard
    return (
        <div className="App">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '700px', marginBottom: '10px' }}>
                <h1>Spanish Flashcards</h1>
                {currentDataVersion && (
                    <p style={{ fontSize: '0.8rem', color: '#6c757d', margin: '0' }}>
                        Data v: {currentDataVersion}
                    </p>
                )}
            </div>
            
            <div className="score-stacks-container">
                <ScoreStack type="correct" label="Correct" count={score.correct} icon="✅" />
                <ScoreStack type="incorrect" label="Incorrect" count={score.incorrect} icon="❌" flashRef={incorrectScoreRef} />
                <ScoreStack
                    type="hard"
                    label="Hard Words"
                    count={hardWordsList.length}
                    icon="⭐"
                    onClick={handleToggleHardWordsView} // Updated
                />
            </div>

            <div className="controls">
                <button onClick={switchDirection}> {/* From useFlashcardGame */}
                    Switch Dir ({languageDirection === "spa-eng" ? "S->E" : "E->S"})
                </button>
                <button
                    onClick={selectNewPairCard} 
                    disabled={isLoadingData || !wordList.length || showHardWordsView}
                >
                    {isLoadingData && !currentPair ? "Loading Words..." : "New Card"}
                </button>
            </div>

            {isLoadingData && !currentPair && <p>Loading word list and preparing first card...</p>}
            {dataError && <div className="error-area"><p>Word List Error: {dataError}</p></div>}
            {gameError && !dataError && <div className="error-area"><p>Game Error: {gameError}</p></div>}


            {showHardWordsView ? (
                <HardWordsView
                    hardWordsList={hardWordsList}
                    onClose={handleToggleHardWordsView} 
                    onRemoveWord={handleRemoveHardWord}
                />
            ) : (
                <>
                    {!isLoadingData && !dataError && !gameError && currentPair && (
                        <div className="flashcard-area">
                            <Flashcard
                                pair={currentPair} 
                                direction={languageDirection} 
                                onAnswerSubmit={submitAnswer} 
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
                            {showFeedback && feedbackSignal === 'incorrect' && ( // showFeedback & feedbackSignal from useFlashcardGame
                                <div className="feedback-area">
                                    <p>Incorrect. The correct answer is: "{lastCorrectAnswer}"</p> {/* lastCorrectAnswer from useFlashcardGame */}
                                    <button onClick={() => handleGetHint(true)} disabled={isHintLoading} style={{marginRight: '10px'}}>
                                        {isHintLoading ? "Getting Info..." : "Show Hint / Related"}
                                    </button>
                                    <button onClick={switchToNextCard} > {/* From useFlashcardGame */}
                                        Next Card
                                    </button>
                                </div>
                            )}
                            {/* Logic for correct feedback can be added here if desired, or handled by auto-advancing */}
                             {showFeedback && feedbackSignal === 'correct' && (
                                <div className="feedback-area" style={{borderColor: 'var(--color-success)', backgroundColor: 'var(--bg-feedback-correct, #d4edda)'}}> 
                                    <p style={{color: 'var(--color-success-darker, #155724)'}}>Correct!</p>
                                    <button onClick={switchToNextCard} >
                                        Next Card
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {!isLoadingData && !dataError && !gameError && !currentPair && wordList.length > 0 && (
                        <p>No card available. Try "New Card".</p>
                    )}
                     {!isLoadingData && !dataError && !gameError && !currentPair && wordList.length === 0 && (
                        <p>Word list is empty or failed to load.</p>
                    )}
                </>
            )}
        </div>
    );
}

export default App;