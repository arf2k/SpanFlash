import { useState, useEffect, useRef } from "react";
import Flashcard from "./components/Flashcard";
import ScoreStack from "./components/ScoreStack";
import HardWordsView from "./components/HardWordsView";
import SearchModal from "./components/SearchModal"; 
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

    // === App-specific State Variables ===
    const [hardWordsList, setHardWordsList] = useState([]);
    const [hintData, setHintData] = useState(null);
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [showHardWordsView, setShowHardWordsView] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false); // <-- New state for search modal visibility

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
                    setScore(savedScoreState); 
                } else {
                    await db.appState.put({ id: "userScore", correct: 0, incorrect: 0 });
                    // setScore({ correct: 0, incorrect: 0 }); // Default is already set in useFlashcardGame
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

    // Effect to Select Initial/New Pair
    useEffect(() => {
        console.log(`App.jsx Effect: wordList (len ${wordList.length}), isLoadingData (${isLoadingData}), currentPair (${!!currentPair}), dataError (${!!dataError}), gameError (${!!gameError})`);
        if (!isLoadingData && wordList.length > 0 && !currentPair && !dataError && !gameError) {
            console.log("App.jsx: wordList ready, selecting initial pair via hook.");
            selectNewPairCard();
        } else if (!isLoadingData && (wordList.length === 0 || gameError) && !dataError) {
            console.log("App.jsx: Word list is empty or game error. No pair to select.");
        }
    }, [wordList, isLoadingData, dataError, gameError, currentPair, selectNewPairCard]);

    // Effect to reset hints when currentPair changes
    useEffect(() => {
        if (currentPair) {
            console.log("App.jsx: New currentPair detected, resetting hint data.");
            setHintData(null);
            setIsHintLoading(false);
        }
        if (!currentPair) { // Also clear if no card is shown
            setHintData(null);
            setIsHintLoading(false);
        }
    }, [currentPair]);

    // Effect for Saving Score to DB
    useEffect(() => {
        if (isInitialMountApp.current) return;
        const saveScoreToDB = async () => { 
            try {
                await db.appState.put({ id: "userScore", ...score });
                console.log("Score saved to DB:", score);
            } catch (err) {
                console.error("Failed to save score to DB:", err);
            }
        };
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


    // === Event Handlers ===
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
        if (forceLookup) setHintData(null); 

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
    const handleToggleHardWordsView = () => { 
        setShowHardWordsView(prev => {
            if (!prev) { 
                setGameShowFeedback(false); 
            }
            return !prev;
        });
    };

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
                    onClick={handleToggleHardWordsView}
                />
            </div>

            <div className="controls">
                {/* Search Button/Icon added here */}
                <button onClick={() => setIsSearchModalOpen(true)} title="Search Words" style={{padding: '0.6rem 0.8rem'}}>
                    <span role="img" aria-label="search icon">🔍</span> Search 
                </button>
                <button onClick={switchDirection}> 
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
                            {showFeedback && feedbackSignal === 'incorrect' && ( 
                                <div className="feedback-area">
                                    <p>Incorrect. The correct answer is: "{lastCorrectAnswer}"</p> 
                                    <button onClick={() => handleGetHint(true)} disabled={isHintLoading} style={{marginRight: '10px'}}>
                                        {isHintLoading ? "Getting Info..." : "Show Hint / Related"}
                                    </button>
                                    <button onClick={switchToNextCard} > 
                                        Next Card
                                    </button>
                                </div>
                            )}
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

           
            <SearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                wordList={wordList} // Pass the full wordList from useWordData
                // onSelectWord={(pair) => { // For future V2 functionality
                //     console.log("Word selected from search:", pair);
                //     setIsSearchModalOpen(false); 
                // }}
            />
        </div>
    );
}

export default App;