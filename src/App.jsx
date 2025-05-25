// src/App.jsx
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
  const {
    wordList: mainWordList, // Renamed to avoid conflict with listForGame
    isLoadingData,
    dataError,
    currentDataVersion,
    setWordList,
  } = useWordData();

  // === App-specific State Variables ===
  const [hardWordsList, setHardWordsList] = useState([]);
  const [hintData, setHintData] = useState(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [showHardWordsView, setShowHardWordsView] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAddWordModalOpen, setIsAddWordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [wordCurrentlyBeingEdited, setWordCurrentlyBeingEdited] =
    useState(null);
  const [isInHardWordsMode, setIsInHardWordsMode] = useState(false); // <-- New state for hard words mode
  const [modeChangeMessage, setModeChangeMessage] = useState(""); // <-- For messages like "Hard words list is empty"

  // Determine which list to use for the game
  const listForGame = isInHardWordsMode ? hardWordsList : mainWordList;

  const {
    currentPair,
    languageDirection,
    score,
    showFeedback,
    lastCorrectAnswer,
    feedbackSignal,
    gameError, // This error will now reflect issues from listForGame
    selectNewPairCard,
    submitAnswer,
    switchDirection,
    switchToNextCard,
    setScore,
    setShowFeedback: setGameShowFeedback,
    loadSpecificCard,
  } = useFlashcardGame(listForGame); // <-- Pass the dynamically chosen list

  // === Refs ===
  const incorrectScoreRef = useRef(null);
  const isInitialMountApp = useRef(true);
  const previousDataVersionRef = useRef(null);

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
          setScore(initialScore);
          console.log("App.jsx: Initialized score in DB.");
        }
      } catch (err) {
        console.error("Failed to load/initialize score:", err);
      }

      try {
        const loadedHardWords = await db.hardWords.toArray();
        setHardWordsList(loadedHardWords || []);
        console.log("App.jsx: Loaded hard words from DB.");
      } catch (err) {
        console.error("Failed to load hard words:", err);
      }

      isInitialMountApp.current = false;
      console.log(
        "App.jsx: App-specific data loading finished, isInitialMountApp is now false."
      );
    };
    loadAppSpecificData();
  }, [setScore]);

  // Effect to Select Initial/New Pair, or when listForGame changes due to mode switch
  useEffect(() => {
    console.log(`App.jsx Effect: listForGame (len ${listForGame.length}), isLoadingData (${isLoadingData}), currentPair (${!!currentPair}), dataError (${!!dataError}), gameError (${!!gameError})`);
    if (!isLoadingData && listForGame.length > 0 && !currentPair && !dataError && !gameError) {
      console.log("App.jsx: listForGame ready, selecting initial/new pair via hook.");
      selectNewPairCard(); // selectNewPairCard in useFlashcardGame will use the current listForGame
    } else if (!isLoadingData && (listForGame.length === 0 || gameError) && !dataError) {
      console.log(
        "App.jsx: listForGame is empty or game error. No pair to select."
      );
      // currentPair should be set to null by selectNewPairCard if list is empty
    }
  }, [listForGame, isLoadingData, dataError, gameError, currentPair, selectNewPairCard]);


  // Effect to reset hints when currentPair changes
  useEffect(() => {
    if (currentPair) {
      setHintData(null);
      setIsHintLoading(false);
    }
    if (!currentPair) {
      setHintData(null);
      setIsHintLoading(false);
    }
  }, [currentPair]);

  // Effect to Reset Score on Data Version Change
  useEffect(() => {
    if (currentDataVersion !== null) {
      if (previousDataVersionRef.current === null) {
        console.log(
          `App.jsx: Initial data version detected: ${currentDataVersion}. Storing as previous version.`
        );
        previousDataVersionRef.current = currentDataVersion;
      } else if (currentDataVersion !== previousDataVersionRef.current) {
        if (isInitialMountApp.current === false) {
          console.log(
            `App.jsx: Data version changed from ${previousDataVersionRef.current} to ${currentDataVersion}. Resetting score.`
          );
          const newScore = { correct: 0, incorrect: 0 };
          setScore(newScore);
          db.appState
            .put({ id: "userScore", ...newScore })
            .then(() => console.log("App.jsx: Reset score saved to DB."))
            .catch((err) =>
              console.error("App.jsx: Failed to save reset score to DB", err)
            );
        } else {
          console.log(
            "App.jsx: Data version changed, but initial app data load not yet complete. Score will not be reset now."
          );
        }
        previousDataVersionRef.current = currentDataVersion;
      }
    }
  }, [currentDataVersion, setScore]);

  // Effect for Saving Score to DB
  useEffect(() => {
    if (isInitialMountApp.current) {
      return;
    }
    const saveScoreToDB = async () => {
      try {
        const scoreToSave = score || { correct: 0, incorrect: 0 };
        await db.appState.put({ id: "userScore", ...scoreToSave });
        console.log("Score saved/updated in DB:", scoreToSave);
      } catch (err) {
        console.error("Failed to save score to DB:", err);
      }
    };
    saveScoreToDB();
  }, [score]);

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
  }, [score.incorrect]);


  // === Event Handlers ===
  const handleToggleHardWordsMode = () => {
    setModeChangeMessage(""); // Clear previous messages
    if (!isInHardWordsMode) { // If trying to enter hard words mode
      if (!hardWordsList || hardWordsList.length === 0) {
        setModeChangeMessage("Your hard words list is empty. Add some words as hard first!");
        // Optionally, briefly show this message using a timed state or an alert
        // For now, just log it and don't switch mode
        console.warn("Attempted to enter hard words mode, but the list is empty.");
        setTimeout(() => setModeChangeMessage(""), 3000); // Clear message after 3s
        return;
      }
    }
    setIsInHardWordsMode(prevMode => !prevMode);
    // Selecting a new pair will be handled by the useEffect watching listForGame/currentPair
    // but we can also explicitly call it to ensure immediate change if needed,
    // though it might lead to double selection if listForGame change also triggers it.
    // For now, rely on the useEffect watching listForGame.
    console.log("Toggled hard words mode. New state:", !isInHardWordsMode);
  };

  const handleMarkHard = async (pairToMark) => {
    // ... (implementation as before, but ensure hardWordsList state is updated) ...
    if (!pairToMark?.spanish || !pairToMark?.english) return;
    const hardWordEntry = {
      spanish: pairToMark.spanish,
      english: pairToMark.english,
    };
    // Also include other fields if you want them in hardWordsList objects
    // For now, hardWordsList schema is just spanish/english from db.js
    // If word is already hard, this will effectively do nothing or update it (if other fields were there)
    try {
        await db.hardWords.put(hardWordEntry); // Dexie's put adds or updates
        // Refresh hardWordsList from DB to ensure consistency
        const updatedHardWords = await db.hardWords.toArray();
        setHardWordsList(updatedHardWords);
        console.log("Updated hard words list from DB after mark/unmark action.");
    } catch (error) {
        console.error("Failed to save/update hard word:", error);
    }
  };

  const handleRemoveHardWord = async (pairToRemove) => {
    // ... (implementation as before, but ensure hardWordsList state is updated) ...
    if (!pairToRemove?.spanish || !pairToRemove?.english) return;
    const compoundKey = [pairToRemove.spanish, pairToRemove.english];
    try {
      await db.hardWords.delete(compoundKey);
      // Refresh hardWordsList from DB
      const updatedHardWords = await db.hardWords.toArray();
      setHardWordsList(updatedHardWords);
      console.log("Updated hard words list from DB after removal.");
    } catch (error) {
      console.error("Failed to remove hard word:", error);
    }
  };

  // ... (handleGetHint, handleToggleHardWordsView (for opening the list view), handleAddWord, openEditModal, closeEditModal, handleUpdateWord, handleDeleteWord, handleSelectWordFromSearch, handleExportWordList as before)
  // Make sure these are the full versions from your working App.jsx
    const handleGetHint = async (forceLookup = false) => { /* ... full implementation ... */ 
        if (!currentPair || isHintLoading) return;
        if (!forceLookup && ((hintData && hintData.type !== "error") || (showFeedback && feedbackSignal === "incorrect"))) return;
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
    const handleAddWord = async (newWordObject) => { /* ... full implementation ... */ 
        try {
            const newId = await db.allWords.add(newWordObject);
            const wordWithId = await db.allWords.get(newId);
            if (wordWithId) setWordList(prevWordList => [...prevWordList, wordWithId]);
            else console.error("Failed to retrieve new word from DB:", newId);
            console.log("New word added:", wordWithId);
        } catch (error) { console.error("Failed to add new word:", error); }
    };
    const openEditModal = (wordToEdit) => { /* ... full implementation ... */ 
        if (!wordToEdit || wordToEdit.id == null) { console.error("Edit attempt on invalid word:", wordToEdit); return; }
        setWordCurrentlyBeingEdited(wordToEdit);
        setIsEditModalOpen(true);
    };
    const closeEditModal = () => { /* ... full implementation ... */ setIsEditModalOpen(false); setWordCurrentlyBeingEdited(null); };
    const handleUpdateWord = async (updatedWordData) => { /* ... full implementation ... */ 
        if (!updatedWordData || updatedWordData.id == null) { console.error("Update attempt with invalid data:", updatedWordData); return; }
        try {
            await db.allWords.put(updatedWordData);
            setWordList(prevWordList => prevWordList.map(w => w.id === updatedWordData.id ? updatedWordData : w));
            if (currentPair && currentPair.id === updatedWordData.id) selectNewPairCard();
            console.log("Word updated:", updatedWordData);
            closeEditModal();
        } catch (error) { console.error("Failed to update word:", error); }
    };
    const handleDeleteWord = async (idToDelete) => { /* ... full implementation ... */ 
        if (idToDelete == null) { console.error("Delete attempt with invalid ID."); return; }
        try {
            await db.allWords.delete(idToDelete);
            setWordList(prevWordList => prevWordList.filter(word => word.id !== idToDelete));
            console.log(`Word ID ${idToDelete} deleted.`);
            if (currentPair && currentPair.id === idToDelete) selectNewPairCard();
            else if (listForGame.filter(w => w.id !== idToDelete).length === 0) { // Check the list that was active
                 selectNewPairCard(); // This will handle setting currentPair to null if the list is empty
            }
        } catch (error) { console.error(`Failed to delete word ID ${idToDelete}:`, error); }
    };
    const handleSelectWordFromSearch = (selectedPair) => { /* ... full implementation ... */ 
        if (selectedPair && loadSpecificCard) {
            loadSpecificCard(selectedPair); 
            setIsSearchModalOpen(false);    
        } else console.warn("handleSelectWordFromSearch: invalid pair or loadSpecificCard.");
    };
    const handleExportWordList = async () => { /* ... full implementation ... */ 
        console.log("App.jsx: Exporting word list...");
        try {
            const allWordsFromDB = await db.allWords.toArray();
            const wordsForExport = allWordsFromDB.map(({ id, ...restOfWord }) => restOfWord);
            const exportObject = { version: currentDataVersion || "1.0.0", words: wordsForExport };
            const jsonString = JSON.stringify(exportObject, null, 2); 
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const date = new Date();
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            a.download = `flashcard_export_${dateString}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log("App.jsx: Word list exported successfully.");
        } catch (error) { console.error("App.jsx: Failed to export word list:", error); }
    };


  // --- JSX Structure ---
  return (
    <div className="App">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: "700px", marginBottom: "10px" }}>
        <h1>Spanish Flashcards</h1>
        {currentDataVersion && (
          <p style={{ fontSize: "0.8rem", color: "#6c757d", margin: "0" }}>
            Data v: {currentDataVersion} {isInHardWordsMode && "(Hard Mode)"} {/* Indicate Hard Mode */}
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
          onClick={handleToggleHardWordsView} // This opens the hard words list view
        />
      </div>

      <div className="controls">
        <button onClick={() => setIsAddWordModalOpen(true)} title="Add New Word" style={{ padding: "0.6rem 0.8rem" }}>
          <span role="img" aria-label="add icon">➕</span> Add Word
        </button>
        <button onClick={() => setIsSearchModalOpen(true)} title="Search Words" style={{ padding: "0.6rem 0.8rem" }}>
          <span role="img" aria-label="search icon">🔍</span> Search
        </button>
        <button onClick={handleExportWordList} title="Export Word List" style={{ padding: "0.6rem 0.8rem" }}>
          <span role="img" aria-label="export icon">📤</span> Export Words
        </button>
        {/* New Button to Toggle Hard Words Study Mode */}
        <button onClick={handleToggleHardWordsMode} title={isInHardWordsMode ? "Practice All Words" : "Practice Hard Words"} style={{padding: '0.6rem 0.8rem'}}>
            <span role="img" aria-label={isInHardWordsMode ? "list icon" : "brain icon"}>{isInHardWordsMode ? "📋" : "🧠"}</span> 
            {isInHardWordsMode ? "All Words" : "Hard Mode"}
        </button>
        <button onClick={switchDirection}>
          Switch Dir ({languageDirection === "spa-eng" ? "S->E" : "E->S"})
        </button>
        <button
          onClick={selectNewPairCard}
          disabled={isLoadingData || !listForGame.length || showHardWordsView} // Use listForGame for disabled check
        >
          {isLoadingData && !currentPair ? "Loading..." : "New Card"}
        </button>
      </div>
      
      {modeChangeMessage && <p style={{ color: 'orange', textAlign: 'center', fontStyle: 'italic' }}>{modeChangeMessage}</p>}

      {/* ... (Status Messages, Main Content Area, Modals as before, ensure logic uses isLoadingData, dataError, gameError, currentPair etc. correctly) ... */}
      {isLoadingData && !currentPair && <p>Loading word list and preparing first card...</p>}
      {dataError && <div className="error-area"><p>Word List Error: {dataError}</p></div>}
      {gameError && !dataError && !isLoadingData && <div className="error-area"><p>Game Error: {gameError}</p></div>}


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
                            isMarkedHard={
                            currentPair &&
                            hardWordsList.some(
                                (word) =>
                                word.spanish === currentPair.spanish &&
                                word.english === currentPair.english
                            )
                            }
                            onEdit={() => openEditModal(currentPair)}
                        />
                        {showFeedback && feedbackSignal === "incorrect" && (
                            <div className="feedback-area">
                            <p>Incorrect. The correct answer is: "{lastCorrectAnswer}"</p>
                            <button
                                onClick={() => handleGetHint(true)}
                                disabled={isHintLoading}
                                style={{ marginRight: "10px" }}
                            >
                                {isHintLoading ? "Getting Info..." : "Show Hint / Related"}
                            </button>
                            <button onClick={switchToNextCard}>Next Card</button>
                            </div>
                        )}
                        {showFeedback && feedbackSignal === "correct" && (
                            <div
                            className="feedback-area"
                            style={{
                                borderColor: "var(--color-success)",
                                backgroundColor: "var(--bg-feedback-correct, #d4edda)",
                            }}
                            >
                            <p style={{ color: "var(--color-success-darker, #155724)" }}>
                                Correct!
                            </p>
                            <button onClick={switchToNextCard}>Next Card</button>
                            </div>
                        )}
                    </div>
                )}
                {!isLoadingData && !dataError && !gameError && !currentPair && listForGame.length > 0 && (
                    <p>No card available in the current list. Try "New Card" or change modes.</p>
                )}
                {!isLoadingData && !dataError && !gameError && !currentPair && listForGame.length === 0 && (
                     <p>The current word list is empty. {isInHardWordsMode ? "Add some hard words or switch to 'All Words' mode." : "Add words or check data source."}</p>
                )}
            </>
        )}

      {/* Modals */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        wordList={mainWordList} // Search always uses the main list
        onSelectResult={handleSelectWordFromSearch}
      />
      <AddWordModal
        isOpen={isAddWordModalOpen}
        onClose={() => setIsAddWordModalOpen(false)}
        onAddWord={handleAddWord}
      />
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