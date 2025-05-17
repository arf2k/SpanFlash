import { useState, useEffect, useRef } from "react";
import Flashcard from "./components/Flashcard";
import ScoreStack from "./components/ScoreStack";
import HardWordsView from "./components/HardWordsView";
import SearchModal from "./components/SearchModal";
import AddWordModal from "./components/AddWordModal";
import WordEditModal from "./components/WordEditModal";
import { getMwHint } from "./services/dictionaryServices.js";
import { db } from "./db";
import { useWordData } from "./hooks/useWordData";
import { useFlashcardGame } from "./hooks/useFlashcardGame";
import "./App.css";

function App() {
    // === Custom Hooks ===
    const { wordList, isLoadingData, dataError, currentDataVersion, setWordList } = useWordData();
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
        setScore, // We get setScore from the hook
        setShowFeedback: setGameShowFeedback,
        loadSpecificCard,
    } = useFlashcardGame(wordList);

    // === App-specific State Variables ===
    const [hardWordsList, setHardWordsList] = useState([]);
    const [hintData, setHintData] = useState(null);
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [showHardWordsView, setShowHardWordsView] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [wordCurrentlyBeingEdited, setWordCurrentlyBeingEdited] = useState(null);

    // === Refs ===
    const incorrectScoreRef = useRef(null);
    const isInitialMountApp = useRef(true); // Tracks if the initial load of app-specific data (score, hard_words) is done
    const previousDataVersionRef = useRef(null); // To track changes in data version for score reset

    // === Effects ===

    // Effect for loading app-specific persistent data (scores, hard words)
    useEffect(() => {
        const loadAppSpecificData = async () => {
            console.log("App.jsx: Loading app-specific data (score, hard words)...");
            try {
                const savedScoreState = await db.appState.get("userScore");
                if (savedScoreState) {
                    setScore(savedScoreState);
                    console.log("App.jsx: Loaded score from DB:", savedScoreState);
                } else {
                    const initialScore = { correct: 0, incorrect: 0 };
                    await db.appState.put({ id: "userScore", ...initialScore });
                    setScore(initialScore); // Set to default if nothing in DB
                    console.log("App.jsx: Initialized score in DB.");
                }
            } catch (err) { console.error("Failed to load/initialize score:", err); }

            try {
                const loadedHardWords = await db.hardWords.toArray();
                setHardWordsList(loadedHardWords || []);
                console.log("App.jsx: Loaded hard words from DB.");
            } catch (err) { console.error("Failed to load hard words:", err); }

            isInitialMountApp.current = false; 
            console.log("App.jsx: App-specific data loading finished, isInitialMountApp is now false.");
        };
        loadAppSpecificData();
    }, [setScore]); // setScore is from useFlashcardGame, should be stable

    // Effect to Select Initial/New Pair
    useEffect(() => {
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
            // console.log("App.jsx: New currentPair detected, resetting hint data.");
            setHintData(null);
            setIsHintLoading(false);
        }
        if (!currentPair) { // Also clear if no card is shown
            setHintData(null);
            setIsHintLoading(false);
        }
    }, [currentPair]);


    // --- New useEffect to Reset Score on Data Version Change ---
    useEffect(() => {
        // Only proceed if currentDataVersion has a value (meaning useWordData has loaded something)
        if (currentDataVersion !== null) {
            // If previousDataVersionRef.current is null, it's the first time we're seeing a version
            // from useWordData in this session/lifecycle. Store it but don't act yet.
            if (previousDataVersionRef.current === null) {
                console.log(`App.jsx: Initial data version detected: ${currentDataVersion}. Storing as previous version.`);
                previousDataVersionRef.current = currentDataVersion;
            } else if (currentDataVersion !== previousDataVersionRef.current) {
                // Version has actually changed from a previously known version.
                // We also check isInitialMountApp.current is false to ensure we don't reset
                // a score that was just loaded from DB if the version changed on the very first complex load.
                if (isInitialMountApp.current === false) {
                    console.log(`App.jsx: Data version changed from ${previousDataVersionRef.current} to ${currentDataVersion}. Resetting score.`);
                    const newScore = { correct: 0, incorrect: 0 };
                    setScore(newScore); // Update score state via the hook's setter
                    // Persist this reset score to IndexedDB immediately
                    db.appState.put({ id: "userScore", ...newScore })
                        .then(() => console.log("App.jsx: Reset score saved to DB."))
                        .catch(err => console.error("App.jsx: Failed to save reset score to DB", err));
                } else {
                    console.log("App.jsx: Data version changed, but initial app data load (including score) not yet complete. Score will not be reset at this point.");
                }
                previousDataVersionRef.current = currentDataVersion; // Update the ref to the new current version
            }
            // If currentDataVersion is the same as previousDataVersionRef.current, do nothing.
        }
    }, [currentDataVersion, setScore, isInitialMountApp]); // isInitialMountApp (the ref object) won't trigger re-run for its .current change.
                                                          // This effect primarily reacts to currentDataVersion. The check for
                                                          // isInitialMountApp.current ensures we act appropriately.

    // Effect for Saving Score to DB (persists score changes from gameplay)
    useEffect(() => {
        if (isInitialMountApp.current) { // Don't save during the initial score load phase
            return;
        }
        // This will save the score whenever it changes (including when it's reset by the version change effect)
        const saveScoreToDB = async () => {
            try {
                // Ensure score isn't undefined if something went wrong, though setScore({0,0}) handles it
                const scoreToSave = score || { correct: 0, incorrect: 0 };
                await db.appState.put({ id: "userScore", ...scoreToSave });
                console.log("Score saved/updated in DB:", scoreToSave);
            } catch (err) {
                console.error("Failed to save score to DB:", err);
            }
        };
        saveScoreToDB();
    }, [score]); // Runs whenever the score object changes

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


    // === Event Handlers (ensure these are all complete from your working version) ===
    const handleMarkHard = async (pairToMark) => {
        if (!pairToMark?.spanish || !pairToMark?.english) return;
        const hardWordEntry = { spanish: pairToMark.spanish, english: pairToMark.english };
        try {
            await db.hardWords.put(hardWordEntry);
            if (!hardWordsList.some(w => w.spanish === pairToMark.spanish && w.english === pairToMark.english)) {
                setHardWordsList((prev) => [...prev, hardWordEntry]);
            }
        } catch (error) { console.error("Failed to save hard word:", error); }
    };

    const handleRemoveHardWord = async (pairToRemove) => {
        if (!pairToRemove?.spanish || !pairToRemove?.english) return;
        const compoundKey = [pairToRemove.spanish, pairToRemove.english];
        try {
            await db.hardWords.delete(compoundKey);
            setHardWordsList((prev) => prev.filter(p => !(p.spanish === pairToRemove.spanish && p.english === pairToRemove.english)));
        } catch (error) { console.error("Failed to remove hard word:", error); }
    };

    const handleGetHint = async (forceLookup = false) => {
        if (!currentPair || isHintLoading) return;
        if (!forceLookup && ((hintData && hintData.type !== 'error') || (showFeedback && feedbackSignal === 'incorrect'))) return;
        const wordToLookup = currentPair.spanish;
        if (!wordToLookup) { setHintData({ type: "error", message: "Internal error: Word missing for hint." }); return; }
        const spanishArticleRegex = /^(el|la|los|las|un|una|unos|unas)\s+/i;
        let wordForApi = wordToLookup.replace(spanishArticleRegex, "").trim();
        if (!wordForApi) { setHintData({ type: "error", message: "Cannot look up article alone as hint." }); return; }
        setIsHintLoading(true);
        if (forceLookup) setHintData(null);
        try {
            const apiResponse = await getMwHint(wordForApi);
            let definitionData = null, suggestions = null;
            if (Array.isArray(apiResponse) && apiResponse.length > 0) {
                if (typeof apiResponse[0] === "string") suggestions = apiResponse;
                else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta?.id) definitionData = apiResponse[0];
                else setHintData({ type: "unknown", raw: apiResponse });
            } else if (typeof apiResponse === 'object' && !Array.isArray(apiResponse) && apiResponse?.meta?.id) definitionData = apiResponse;
            else if (Array.isArray(apiResponse) && apiResponse.length === 0) setHintData({ type: "error", message: `No definition found for "${wordForApi}".` });
            else setHintData({ type: "unknown", raw: apiResponse });
            if (definitionData) setHintData({ type: "definitions", data: definitionData });
            else if (suggestions) setHintData({ type: "suggestions", suggestions: suggestions });
        } catch (err) { console.error("Error in handleGetHint:", err); setHintData({ type: "error", message: "Failed to fetch hint." });
        } finally { setIsHintLoading(false); }
    };

    const handleToggleHardWordsView = () => setShowHardWordsView(prev => { if (!prev) setGameShowFeedback(false); return !prev; });

    const handleAddWord = async (newWordObject) => {
        try {
            const newId = await db.allWords.add(newWordObject);
            const wordWithId = await db.allWords.get(newId);
            if (wordWithId) setWordList(prevWordList => [...prevWordList, wordWithId]);
            else console.error("Failed to retrieve new word from DB:", newId);
            console.log("New word added:", wordWithId);
        } catch (error) { console.error("Failed to add new word:", error); }
    };
    
    const openEditModal = (wordToEdit) => {
        if (!wordToEdit || wordToEdit.id == null) { console.error("Edit attempt on invalid word:", wordToEdit); return; }
        setWordCurrentlyBeingEdited(wordToEdit);
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => { setIsEditModalOpen(false); setWordCurrentlyBeingEdited(null); };

    const handleUpdateWord = async (updatedWordData) => {
        if (!updatedWordData || updatedWordData.id == null) { console.error("Update attempt with invalid data:", updatedWordData); return; }
        try {
            await db.allWords.put(updatedWordData);
            setWordList(prevWordList => prevWordList.map(w => w.id === updatedWordData.id ? updatedWordData : w));
            if (currentPair && currentPair.id === updatedWordData.id) selectNewPairCard();
            console.log("Word updated:", updatedWordData);
            closeEditModal();
        } catch (error) { console.error("Failed to update word:", error); }
    };

    const handleDeleteWord = async (idToDelete) => {
        if (idToDelete == null) { console.error("Delete attempt with invalid ID."); return; }
        try {
            await db.allWords.delete(idToDelete);
            setWordList(prevWordList => prevWordList.filter(word => word.id !== idToDelete));
            console.log(`Word ID ${idToDelete} deleted.`);
            if (currentPair && currentPair.id === idToDelete) selectNewPairCard();
            else if (wordList.length -1 === 0) if(wordList.length === 1) selectNewPairCard();
        } catch (error) { console.error(`Failed to delete word ID ${idToDelete}:`, error); }
    };

    const handleSelectWordFromSearch = (selectedPair) => {
        if (selectedPair && loadSpecificCard) {
            loadSpecificCard(selectedPair); 
            setIsSearchModalOpen(false);    
        } else console.warn("handleSelectWordFromSearch: invalid pair or loadSpecificCard.");
    };

    const handleExportWordList = async () => {
        console.log("App.jsx: Exporting word list...");
        try {
            const allWordsFromDB = await db.allWords.toArray();
            const wordsForExport = allWordsFromDB.map(({ id, ...restOfWord }) => restOfWord);
            const exportObject = { version: currentDataVersion || "1.0.0", words: wordsForExport };
            const jsonString = JSON.stringify(exportObject, null, 2); 
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date();
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            a.download = `flashcard_export_${dateString}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log("App.jsx: Word list exported successfully.");
        } catch (error) { console.error("App.jsx: Failed to export word list:", error); }
    };

    // --- JSX Structure ---
    return (
        <div className="App">
            {/* Header and Version Display */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '700px', marginBottom: '10px' }}>
                <h1>Spanish Flashcards</h1>
                {currentDataVersion && (
                    <p style={{ fontSize: '0.8rem', color: '#6c757d', margin: '0' }}>
                        Data v: {currentDataVersion}
                    </p>
                )}
            </div>
            
            {/* ScoreStacks */}
            <div className="score-stacks-container">
                <ScoreStack type="correct" label="Correct" count={score.correct} icon="✅" />
                <ScoreStack type="incorrect" label="Incorrect" count={score.incorrect} icon="❌" flashRef={incorrectScoreRef} />
                <ScoreStack type="hard" label="Hard Words" count={hardWordsList.length} icon="⭐" onClick={handleToggleHardWordsView} />
            </div>

            {/* Controls */}
            <div className="controls">
                <button onClick={() => setIsAddWordModalOpen(true)} title="Add New Word" style={{padding: '0.6rem 0.8rem'}}>
                    <span role="img" aria-label="add icon">➕</span> Add Word
                </button>
                <button onClick={() => setIsSearchModalOpen(true)} title="Search Words" style={{padding: '0.6rem 0.8rem'}}>
                    <span role="img" aria-label="search icon">🔍</span> Search
                </button>
                <button onClick={handleExportWordList} title="Export Word List" style={{padding: '0.6rem 0.8rem'}}>
                    <span role="img" aria-label="export icon">📤</span> Export Words
                </button>
                <button onClick={switchDirection}>
                    Switch Dir ({languageDirection === "spa-eng" ? "S->E" : "E->S"})
                </button>
                <button onClick={selectNewPairCard} disabled={isLoadingData || !wordList.length || showHardWordsView}>
                    {isLoadingData && !currentPair ? "Loading Words..." : "New Card"}
                </button>
            </div>

            {/* Status Messages */}
            {isLoadingData && !currentPair && <p>Loading word list and preparing first card...</p>}
            {dataError && <div className="error-area"><p>Word List Error: {dataError}</p>{/* Add a retry button? <button onClick={() => window.location.reload()}>Retry</button> */}</div>}
            {gameError && !dataError && <div className="error-area"><p>Game Error: {gameError}</p></div>}

            {/* Main Content Area */}
            {showHardWordsView ? (
                <HardWordsView hardWordsList={hardWordsList} onClose={handleToggleHardWordsView} onRemoveWord={handleRemoveHardWord} />
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
                                onEdit={() => openEditModal(currentPair)}
                            />
                            {showFeedback && feedbackSignal === 'incorrect' && (
                                <div className="feedback-area">
                                    <p>Incorrect. The correct answer is: "{lastCorrectAnswer}"</p>
                                    <button onClick={() => handleGetHint(true)} disabled={isHintLoading} style={{ marginRight: '10px' }}>
                                        {isHintLoading ? "Getting Info..." : "Show Hint / Related"}
                                    </button>
                                    <button onClick={switchToNextCard}>Next Card</button>
                                </div>
                            )}
                             {showFeedback && feedbackSignal === 'correct' && (
                                <div className="feedback-area" style={{ borderColor: 'var(--color-success)', backgroundColor: 'var(--bg-feedback-correct, #d4edda)' }}>
                                    <p style={{ color: 'var(--color-success-darker, #155724)' }}>Correct!</p>
                                    <button onClick={switchToNextCard}>Next Card</button>
                                </div>
                            )}
                        </div>
                    )}
                    {!isLoadingData && !dataError && !gameError && !currentPair && wordList.length > 0 && (
                        <p>No card available. Try "New Card" or check the word list.</p>
                    )}
                     {!isLoadingData && !dataError && !gameError && !currentPair && wordList.length === 0 && (
                        <p>Word list is empty. Add words or check data source.</p>
                    )}
                </>
            )}

            {/* Modals */}
            <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} wordList={wordList} onSelectResult={handleSelectWordFromSearch} />
            <AddWordModal isOpen={isAddWordModalOpen} onClose={() => setIsAddWordModalOpen(false)} onAddWord={handleAddWord} />
            <WordEditModal
                isOpen={isEditModalOpen}
                onClose={closeEditModal}
                wordToEdit={wordCurrentlyBeingEdited}
                onSaveWord={handleUpdateWord}
                onDeleteWord={handleDeleteWord}
            />
        </div>
    );
}

export default App;