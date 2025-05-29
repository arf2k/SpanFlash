import { useState, useEffect, useRef } from "react";
import Flashcard from "./components/Flashcard";
import ScoreStack from "./components/ScoreStack";
import HardWordsView from "./components/HardWordsView";
import SearchModal from "./components/SearchModal";
import AddWordModal from "./components/AddWordModal";
import WordEditModal from "./components/WordEditModal";
import WordDetailsModal from "./components/WordDetailsModal";
import SettingsModal from "./components/SettingsModal"; 
import { getMwHint } from "./services/dictionaryServices.js";
import { getTatoebaExamples } from "./services/tatoebaServices.js";
import { db } from "./db";
import { useWordData } from "./hooks/useWordData";
import { useFlashcardGame } from "./hooks/useFlashcardGame";
import "./App.css";

function App() {
  // === Custom Hooks ===
  const {
    wordList: mainWordList,
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
  const [isInHardWordsMode, setIsInHardWordsMode] = useState(false);
  const [modeChangeMessage, setModeChangeMessage] = useState("");
  const [apiSuggestions, setApiSuggestions] = useState(null);

  const [tatoebaExamples, setTatoebaExamples] = useState([]);
  const [isLoadingTatoebaExamples, setIsLoadingTatoebaExamples] = useState(false);
  const [tatoebaError, setTatoebaError] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); // State for Settings Modal
  const [isAdminMode, setIsAdminMode] = useState(false); // State for Admin Mode

  // Determine which list to use for the game
  const listForGame = isInHardWordsMode ? hardWordsList : mainWordList;

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
    loadSpecificCard,
  } = useFlashcardGame(listForGame);

  // === Refs ===
  const incorrectScoreRef = useRef(null);
  const isInitialMountApp = useRef(true);
  const previousDataVersionRef = useRef(null);

  // === Effects ===

  // Effect to load admin mode setting from localStorage
  useEffect(() => {
    const adminSetting = localStorage.getItem('spanFlashAdminMode');
    if (adminSetting === 'true') {
      setIsAdminMode(true);
      // console.log("App.jsx: Admin mode loaded as TRUE from localStorage.");
    } else {
      setIsAdminMode(false);
      // console.log("App.jsx: Admin mode loaded as FALSE or not found in localStorage.");
    }
  }, []);


  // Effect for loading app-specific persistent data (scores, hard words)
  useEffect(() => {
    const loadAppSpecificData = async () => {
      // console.log("App.jsx: Loading app-specific data (score, hard words)...");
      try {
        const savedScoreState = await db.appState.get("userScore");
        if (savedScoreState) {
          setScore(savedScoreState);
        } else {
          const initialScore = { correct: 0, incorrect: 0 };
          await db.appState.put({ id: "userScore", ...initialScore });
          setScore(initialScore);
        }
      } catch (err) { console.error("Failed to load/initialize score:", err); }

      try {
        const loadedHardWords = await db.hardWords.toArray();
        setHardWordsList(loadedHardWords || []);
      } catch (err) { console.error("Failed to load hard words:", err); }
      isInitialMountApp.current = false;
    };
    loadAppSpecificData();
  }, [setScore]);

  // Effect to Select Initial/New Pair
  useEffect(() => {
    if (!isLoadingData && listForGame.length > 0 && !currentPair && !dataError && !gameError) {
      selectNewPairCard();
    }
  }, [ listForGame, isLoadingData, dataError, gameError, currentPair, selectNewPairCard ]);

  // Effect to reset hints, API suggestions, Tatoeba examples
  useEffect(() => {
    if (currentPair) {
      setHintData(null); setIsHintLoading(false); setApiSuggestions(null);
      setTatoebaExamples([]); setTatoebaError(null); setIsLoadingTatoebaExamples(false); 
    }
    if (!currentPair) {
      setHintData(null); setIsHintLoading(false); setApiSuggestions(null);
      setTatoebaExamples([]); setTatoebaError(null); setIsLoadingTatoebaExamples(false);
    }
  }, [currentPair]);

  // Effect to Reset Score on Data Version Change
  useEffect(() => {
    if (currentDataVersion !== null) {
      if (previousDataVersionRef.current === null) {
        previousDataVersionRef.current = currentDataVersion;
      } else if (currentDataVersion !== previousDataVersionRef.current) {
        if (isInitialMountApp.current === false) {
          const newScore = { correct: 0, incorrect: 0 }; setScore(newScore);
          db.appState.put({ id: "userScore", ...newScore })
            .catch(err => console.error("App.jsx: Failed to save reset score to DB", err));
        }
        previousDataVersionRef.current = currentDataVersion;
      }
    }
  }, [currentDataVersion, setScore]);

  // Effect for Saving Score to DB
  useEffect(() => {
    if (isInitialMountApp.current) return;
    const saveScoreToDB = async () => {
      try { const scoreToSave = score || { correct: 0, incorrect: 0 }; await db.appState.put({ id: "userScore", ...scoreToSave }); }
      catch (err) { console.error("Failed to save score to DB:", err); }
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
  const handleToggleAdminMode = () => {
    const newAdminState = !isAdminMode;
    setIsAdminMode(newAdminState);
    if (newAdminState) {
      localStorage.setItem('spanFlashAdminMode', 'true');
      console.log("Admin mode enabled (localStorage set).");
    } else {
      localStorage.removeItem('spanFlashAdminMode');
      console.log("Admin mode disabled (localStorage removed).");
    }
  };
  
  const handleToggleHardWordsMode = () => {
    setModeChangeMessage("");
    if (!isInHardWordsMode) {
      if (!hardWordsList || hardWordsList.length === 0) {
        setModeChangeMessage("Your hard words list is empty. Add some words as hard first!");
        setTimeout(() => setModeChangeMessage(""), 3000);
        return;
      }
    }
    setIsInHardWordsMode((prevMode) => !prevMode);
  };

  const handleMarkHard = async (pairToMark) => {
    if (!pairToMark?.spanish || !pairToMark?.english) return;
    const hardWordEntry = { spanish: pairToMark.spanish, english: pairToMark.english };
    try {
      await db.hardWords.put(hardWordEntry);
      const updatedHardWords = await db.hardWords.toArray();
      setHardWordsList(updatedHardWords);
    } catch (error) { console.error("Failed to save/update hard word:", error); }
  };

  const handleRemoveHardWord = async (pairToRemove) => {
    if (!pairToRemove?.spanish || !pairToRemove?.english) return;
    const compoundKey = [pairToRemove.spanish, pairToRemove.english];
    try {
      await db.hardWords.delete(compoundKey);
      const updatedHardWords = await db.hardWords.toArray();
      setHardWordsList(updatedHardWords);
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
    setApiSuggestions(null);
    if (forceLookup || !hintData) setHintData(null);
    try {
      const apiResponse = await getMwHint(wordForApi);
      console.log("Raw Hint Data from MW:", apiResponse);
      let parsedEngSynonyms = [];
      if (apiResponse && Array.isArray(apiResponse) && apiResponse.length > 0) {
        const firstResult = apiResponse[0];
        if (firstResult && typeof firstResult === "object" && firstResult.shortdef && Array.isArray(firstResult.shortdef) && firstResult.shortdef.length > 0) {
          const shortDefString = firstResult.shortdef[0];
          parsedEngSynonyms = shortDefString.split(/,| or /).map(s => {
            let cleaned = s.replace(/\(.*?\)/g, "").trim();
            if (cleaned.toLowerCase().startsWith("especially ")) cleaned = cleaned.substring(11).trim();
            return cleaned;
          }).filter(s => s && s.length > 1);
          if (parsedEngSynonyms.length > 0 && currentPair && currentPair.english) {
            const primaryEnglishLower = currentPair.english.toLowerCase().trim();
            parsedEngSynonyms = parsedEngSynonyms.filter(s => s.toLowerCase().trim() !== primaryEnglishLower);
          }
        }
      }
      if (parsedEngSynonyms.length > 0) {
        parsedEngSynonyms = [...new Set(parsedEngSynonyms)];
        setApiSuggestions({ wordId: currentPair.id, type: 'englishSynonyms', values: parsedEngSynonyms });
        console.log("App.jsx: API Suggested English Synonyms:", parsedEngSynonyms, "for ID:", currentPair.id);
      }
      let definitionData = null, suggestionsFromApi = null;
      if (Array.isArray(apiResponse) && apiResponse.length > 0) {
        if (typeof apiResponse[0] === "string") suggestionsFromApi = apiResponse;
        else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta?.id) definitionData = apiResponse[0];
        else setHintData({ type: "unknown", raw: apiResponse });
      } else if (typeof apiResponse === 'object' && !Array.isArray(apiResponse) && apiResponse !== null && apiResponse?.meta?.id) definitionData = apiResponse;
      else if (Array.isArray(apiResponse) && apiResponse.length === 0) setHintData({ type: "error", message: `No definition or suggestions found for "${wordForApi}".` });
      else setHintData({ type: "unknown", raw: apiResponse });
      if (definitionData) setHintData({ type: "definitions", data: definitionData });
      else if (suggestionsFromApi) setHintData({ type: "suggestions", suggestions: suggestionsFromApi });
    } catch (err) { console.error("Error in handleGetHint fetching/processing MW data:", err); setHintData({ type: "error", message: "Failed to fetch hint." });
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
      if (currentPair && currentPair.id === idToDelete) {
        selectNewPairCard();
      } else if (listForGame.filter(w => w.id !== idToDelete).length === 0) {
        selectNewPairCard();
      }
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

  const handleFetchTatoebaExamples = async (wordToFetch) => {
    if (!wordToFetch) { setTatoebaError("No Spanish word provided to fetch examples for."); return; }
    setIsLoadingTatoebaExamples(true);
    setTatoebaError(null);
    setTatoebaExamples([]);
    console.log(`App.jsx: Fetching Tatoeba examples for "${wordToFetch}"`);
    try {
      const examples = await getTatoebaExamples(wordToFetch);
      if (examples.length === 0) setTatoebaError(`No example sentences found for "${wordToFetch}" on Tatoeba.`);
      setTatoebaExamples(examples);
    } catch (error) {
      console.error("App.jsx: Error in handleFetchTatoebaExamples:", error);
      setTatoebaError(`Failed to fetch examples: ${error.message}`);
      setTatoebaExamples([]);
    } finally { setIsLoadingTatoebaExamples(false); }
  };

  const handleShowDetailsModal = () => {
    if (currentPair) {
      setTatoebaExamples([]); setTatoebaError(null); setIsLoadingTatoebaExamples(false);
      setIsDetailsModalOpen(true);
    } else console.warn("App.jsx: Tried to show details but no currentPair is set.");
  };

  const handleCloseDetailsModal = () => setIsDetailsModalOpen(false);

  return (
    <div className="App">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: "700px", marginBottom: "10px" }}>
        <h1>Spanish Flashcards</h1>
        <div> {/* Wrapper for version and settings button */}
            {currentDataVersion && (
              <p style={{ fontSize: "0.8rem", color: "#6c757d", margin: "0", display: "inline-block", marginRight: "15px" }}>
                Data v: {currentDataVersion} {isInHardWordsMode && "(Hard Mode)"}
              </p>
            )}
            <button 
                onClick={() => setIsSettingsModalOpen(true)} 
                title="Settings" 
                style={{ background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer', color: 'var(--text-muted)', padding: '0' }}
            >
                <span role="img" aria-label="settings icon">⚙️</span>
            </button>
        </div>
      </div>

      <div className="score-stacks-container">
        <ScoreStack type="correct" label="Correct" count={score.correct} icon="✅"/>
        <ScoreStack type="incorrect" label="Incorrect" count={score.incorrect} icon="❌" flashRef={incorrectScoreRef}/>
        <ScoreStack type="hard" label="Hard Words" count={hardWordsList.length} icon="⭐" onClick={handleToggleHardWordsView} />
      </div>

      <div className="controls">
        <button onClick={() => setIsAddWordModalOpen(true)} title="Add New Word" style={{ padding: "0.6rem 0.8rem" }} >
          <span role="img" aria-label="add icon">➕</span> Add Word
        </button>
        <button onClick={() => setIsSearchModalOpen(true)} title="Search Words" style={{ padding: "0.6rem 0.8rem" }} >
          <span role="img" aria-label="search icon">🔍</span> Search
        </button>
        {/* Export button is removed from here, now in SettingsModal */}
        <button onClick={handleToggleHardWordsMode} title={ isInHardWordsMode ? "Practice All Words" : "Practice Hard Words" } style={{padding: '0.6rem 0.8rem'}}>
            <span role="img" aria-label={isInHardWordsMode ? "list icon" : "brain icon"}>{isInHardWordsMode ? "📋" : "🧠"}</span> 
            {isInHardWordsMode ? "All Words" : "Hard Mode"}
        </button>
        <button onClick={switchDirection}>
          Switch Dir ({languageDirection === "spa-eng" ? "S->E" : "E->S"})
        </button>
        <button
          onClick={selectNewPairCard}
          disabled={isLoadingData || !listForGame.length || showHardWordsView}
        >
          {isLoadingData && !currentPair ? "Loading..." : "New Card"}
        </button>
      </div>
      
      {modeChangeMessage && <p style={{ color: 'orange', textAlign: 'center', fontStyle: 'italic' }}>{modeChangeMessage}</p>}
      {isLoadingData && !currentPair && (<p>Loading word list and preparing first card...</p>)}
      {dataError && <div className="error-area"><p>Word List Error: {dataError}</p></div>}
      {gameError && !dataError && !isLoadingData && (<div className="error-area"><p>Game Error: {gameError}</p></div>)}

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
                isMarkedHard={ currentPair && hardWordsList.some( (word) => word.spanish === currentPair.spanish && word.english === currentPair.english )}
                onEdit={() => openEditModal(currentPair)}
                onShowDetails={handleShowDetailsModal}
              />
              {showFeedback && feedbackSignal === "incorrect" && (
                 <div className="feedback-area">
                 <p>Incorrect. The correct answer is: "{lastCorrectAnswer}"</p>
                 <button onClick={() => handleGetHint(true)} disabled={isHintLoading} style={{ marginRight: "10px" }} >
                   {isHintLoading ? "Getting Info..." : "Show Hint / Related"}
                 </button>
                 <button onClick={switchToNextCard}>Next Card</button>
               </div>
              )}
              {showFeedback && feedbackSignal === "correct" && (
                <div className="feedback-area" style={{ borderColor: "var(--color-success)", backgroundColor: "var(--bg-feedback-correct, #d4edda)"}}>
                  <p style={{ color: "var(--color-success-darker, #155724)" }}>Correct!</p>
                  <button onClick={switchToNextCard}>Next Card</button>
                </div>
              )}
            </div>
          )}
          {!isLoadingData && !dataError && !gameError && !currentPair && listForGame.length > 0 && ( <p> No card available in the current list. Try "New Card" or change modes. </p> )}
          {!isLoadingData && !dataError && !gameError && !currentPair && listForGame.length === 0 && ( <p> The current word list is empty.{" "} {isInHardWordsMode ? "Add some hard words or switch to 'All Words' mode." : "Add words or check data source."} </p> )}
        </>
      )}

      {/* Modals */}
      <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} wordList={mainWordList} onSelectResult={handleSelectWordFromSearch} />
      <AddWordModal isOpen={isAddWordModalOpen} onClose={() => setIsAddWordModalOpen(false)} onAddWord={handleAddWord} />
      <WordEditModal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        wordToEdit={wordCurrentlyBeingEdited}
        onSaveWord={handleUpdateWord}
        onDeleteWord={handleDeleteWord}
        apiSuggestions={ apiSuggestions && wordCurrentlyBeingEdited && apiSuggestions.wordId === wordCurrentlyBeingEdited.id ? apiSuggestions : null }
      />
      <WordDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        pair={currentPair}
        onFetchExamples={() => currentPair && handleFetchTatoebaExamples(currentPair.spanish)}
        examples={tatoebaExamples}
        isLoadingExamples={isLoadingTatoebaExamples}
        examplesError={tatoebaError}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onExportWordList={handleExportWordList}
        isAdminMode={isAdminMode}
        onToggleAdminMode={handleToggleAdminMode}
      />
    </div>
  );
}

export default App;