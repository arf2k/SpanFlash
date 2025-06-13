import { useState, useEffect, useRef } from "react";
import Flashcard from "./components/Flashcard";
import ScoreStack from "./components/ScoreStack";
import HardWordsView from "./components/HardWordsView";
import SearchModal from "./components/SearchModal";
import AddWordModal from "./components/AddWordModal";
import WordEditModal from "./components/WordEditModal";
import WordDetailsModal from "./components/WordDetailsModal";
import SettingsModal from "./components/SettingsModal";
import MatchingGameView from "./components/MatchingGameView";
import FillInTheBlankGameView from "./components/FillInTheBlankGameView.jsx";
import { getMwHint } from "./services/dictionaryServices.js";
import { getTatoebaExamples } from "./services/tatoebaServices.js";
import { db } from "./db";
import { useWordData } from "./hooks/useWordData";
import { useFlashcardGame } from "./hooks/useFlashcardGame";
import "./App.css";
import { ConjugationService } from "./services/conjugationService.js";
import VerbConjugationGameView from "./components/VerbConjugationGameView.jsx";
import { useModalState } from "./hooks/useModalState";
import { useGameModes } from "./hooks/useGameModes";
import { useAppSettings } from "./hooks/useAppSettings";
import { createHardWordsHandlers } from "./handlers/hardWordsHandlers";
import { createModalHandlers } from "./handlers/modalHandlers";
import { createWordManagementHandlers } from "./handlers/wordManagementHandlers";
import { createGameModeHandlers } from "./handlers/gameModeHandlers";

function App() {
  // === App-specific State Variables ===
  const [hardWordsList, setHardWordsList] = useState([]);
  const [hintData, setHintData] = useState(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [showHardWordsView, setShowHardWordsView] = useState(false);

  const [wordCurrentlyBeingEdited, setWordCurrentlyBeingEdited] =
    useState(null);

  const [apiSuggestions, setApiSuggestions] = useState(null);

  const [tatoebaExamples, setTatoebaExamples] = useState([]);
  const [isLoadingTatoebaExamples, setIsLoadingTatoebaExamples] =
    useState(false);
  const [tatoebaError, setTatoebaError] = useState(null);

  // === Custom Hooks ===
  const {
    isAdminMode,
    setIsAdminMode,
    currentTheme,
    setCurrentTheme,
    toggleTheme,
    toggleAdminMode,
  } = useAppSettings();

  const {
    isInHardWordsMode,
    setIsInHardWordsMode,
    isMatchingGameModeActive,
    setIsMatchingGameModeActive,
    isFillInTheBlankModeActive,
    setIsFillInTheBlankModeActive,
    isVerbConjugationGameActive,
    setIsVerbConjugationGameActive,
    modeChangeMessage,
    setModeChangeMessage,
    isAnyGameActive,
  } = useGameModes();

  const {
    isSearchModalOpen,
    setIsSearchModalOpen,
    isAddWordModalOpen,
    setIsAddWordModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
  } = useModalState();
  const {
    wordList: mainWordList,
    initialCard,
    isLoadingData,
    dataError,
    currentDataVersion,
    setWordList,
  } = useWordData();

  const listForFlashcardGame = isInHardWordsMode ? hardWordsList : mainWordList;

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
    lastReviewedCard,
  } = useFlashcardGame(listForFlashcardGame, initialCard);

  // === Refs ===
  const incorrectScoreRef = useRef(null);
  const isInitialMountApp = useRef(true);
  const previousDataVersionRef = useRef(null);
  const matchingGameContainerRef = useRef(null);
  const fillInTheBlankGameContainerRef = useRef(null);
  const verbConjugationGameContainerRef = useRef(null);

  // === Handlers ===
  const {
    handleMarkHard,
    handleRemoveHardWord,
    handleToggleHardWordsMode,
    handleToggleHardWordsView,
  } = createHardWordsHandlers(
    hardWordsList,
    setHardWordsList,
    showHardWordsView,
    setShowHardWordsView,
    isInHardWordsMode,
    setIsInHardWordsMode,
    setModeChangeMessage,
    setGameShowFeedback
  );

  const {
    openEditModal,
    closeEditModal,
    handleShowDetailsModal,
    handleCloseDetailsModal,
    handleOpenAddWordModalFromSettings,
  } = createModalHandlers(
    setWordCurrentlyBeingEdited,
    setIsEditModalOpen,
    setTatoebaExamples,
    setTatoebaError,
    setIsLoadingTatoebaExamples,
    setIsDetailsModalOpen,
    setIsAddWordModalOpen,
    setIsSettingsModalOpen
  );

  const {
    handleAddWord,
    handleUpdateWord,
    handleDeleteWord,
    handleSelectWordFromSearch,
    handleExportWordList,
  } = createWordManagementHandlers(
    setWordList,
    currentPair,
    selectNewPairCard,
    listForFlashcardGame,
    setIsSearchModalOpen,
    loadSpecificCard,
    currentDataVersion,
    closeEditModal
  );

  const {
    handleToggleMatchingGameMode,
    handleToggleFillInTheBlankMode,
    handleToggleVerbConjugationGame,
    handleMatchingGameWordsUpdated,
  } = createGameModeHandlers(
    mainWordList,
    setModeChangeMessage,
    setShowHardWordsView,
    setIsSearchModalOpen,
    setIsAddWordModalOpen,
    setIsEditModalOpen,
    setIsDetailsModalOpen,
    setIsSettingsModalOpen,
    setIsMatchingGameModeActive,
    setIsFillInTheBlankModeActive,
    setIsVerbConjugationGameActive,
    setGameShowFeedback,
    setWordList
  );

  // === Effects ===
  useEffect(() => {
    document.body.dataset.theme = currentTheme;
    localStorage.setItem("flashcardAppTheme", currentTheme);
    console.log(
      `App.jsx: Theme changed to ${currentTheme} and saved to localStorage.`
    );
  }, [currentTheme]);

  useEffect(() => {
    const adminSetting = localStorage.getItem("spanFlashAdminMode");
    if (adminSetting === "true") {
      setIsAdminMode(true);
      console.log("App.jsx: Admin mode loaded as TRUE from localStorage.");
    } else {
      setIsAdminMode(false);
      console.log(
        "App.jsx: Admin mode loaded as FALSE or not found in localStorage."
      );
    }
  }, []);

  useEffect(() => {
    const loadAppSpecificData = async () => {
      if (!db || !db.appState || !db.hardWords) {
        console.error(
          "App.jsx: Database not initialized or missing required stores."
        );
        return;
      }
      try {
        const savedScoreState = await db.appState.get("userScore");
        if (savedScoreState) {
          setScore(savedScoreState);
        } else {
          const initialScore = { correct: 0, incorrect: 0 };
          await db.appState.put({ id: "userScore", ...initialScore });
          setScore(initialScore);
        }
      } catch (err) {
        console.error("Failed to load/initialize score:", err);
      }

      try {
        const loadedHardWords = await db.hardWords.toArray();
        setHardWordsList(loadedHardWords || []);
      } catch (err) {
        console.error("Failed to load hard words:", err);
      }
      isInitialMountApp.current = false;
    };
    loadAppSpecificData();
  }, [setScore]);

  useEffect(() => {
    setHintData(null);
    setIsHintLoading(false);
    setApiSuggestions(null);
    setTatoebaExamples([]);
    setTatoebaError(null);
    setIsLoadingTatoebaExamples(false);
  }, [
    currentPair,
    isMatchingGameModeActive,
    isFillInTheBlankModeActive,
    isVerbConjugationGameActive,
  ]);

  useEffect(() => {
    if (currentDataVersion !== null) {
      if (previousDataVersionRef.current === null) {
        previousDataVersionRef.current = currentDataVersion;
      } else if (currentDataVersion !== previousDataVersionRef.current) {
        if (isInitialMountApp.current === false) {
          const newScore = { correct: 0, incorrect: 0 };
          setScore(newScore);
          db.appState
            .put({ id: "userScore", ...newScore })
            .catch((err) =>
              console.error("App.jsx: Failed to save reset score to DB", err)
            );
        }
        previousDataVersionRef.current = currentDataVersion;
      }
    }
  }, [currentDataVersion, setScore]);

  useEffect(() => {
    if (isInitialMountApp.current) return;
    const saveScoreToDB = async () => {
      try {
        const scoreToSave = score || { correct: 0, incorrect: 0 };
        await db.appState.put({ id: "userScore", ...scoreToSave });
      } catch (err) {
        console.error("Failed to save score to DB:", err);
      }
    };
    saveScoreToDB();
  }, [score]);

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

  useEffect(() => {
    if (isMatchingGameModeActive && matchingGameContainerRef.current) {
      setTimeout(() => {
        if (matchingGameContainerRef.current) {
          matchingGameContainerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 50);
    }
  }, [isMatchingGameModeActive]);

  useEffect(() => {
    if (isFillInTheBlankModeActive && fillInTheBlankGameContainerRef.current) {
      setTimeout(() => {
        if (fillInTheBlankGameContainerRef.current) {
          fillInTheBlankGameContainerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 50);
    }
  }, [isFillInTheBlankModeActive]);
  useEffect(() => {
    if (
      isVerbConjugationGameActive &&
      verbConjugationGameContainerRef.current
    ) {
      setTimeout(() => {
        if (verbConjugationGameContainerRef.current) {
          verbConjugationGameContainerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 50);
    }
  }, [isVerbConjugationGameActive]);

  useEffect(() => {
    if (lastReviewedCard) {
      setWordList((prevWordList) =>
        prevWordList.map((word) =>
          word.id === lastReviewedCard.id ? lastReviewedCard : word
        )
      );
    }
  }, [lastReviewedCard, setWordList]);

  // === Event Handlers ===
  const handleToggleTheme = toggleTheme;

  const handleToggleAdminMode = () => {
    const newAdminState = !isAdminMode;
    toggleAdminMode();
    if (newAdminState) {
      localStorage.setItem("spanFlashAdminMode", "true");
      console.log("Admin mode enabled (localStorage set).");
    } else {
      localStorage.removeItem("spanFlashAdminMode");
      console.log("Admin mode disabled (localStorage removed).");
    }
  };

  const handleGetHint = async (forceLookup = false) => {
    if (!currentPair || isHintLoading) return;
    if (
      !forceLookup &&
      ((hintData && hintData.type !== "error") ||
        (showFeedback && feedbackSignal === "incorrect"))
    )
      return;
    const wordToLookup = currentPair.spanish;
    if (!wordToLookup) {
      setHintData({
        type: "error",
        message: "Internal error: Word missing for hint.",
      });
      return;
    }
    const spanishArticleRegex = /^(el|la|los|las|un|una|unos|unas)\s+/i;
    let wordForApi = wordToLookup.replace(spanishArticleRegex, "").trim();
    if (!wordForApi) {
      setHintData({
        type: "error",
        message: "Cannot look up article alone as hint.",
      });
      return;
    }
    setIsHintLoading(true);
    setApiSuggestions(null);
    if (forceLookup || !hintData) setHintData(null);
    try {
      const apiResponse = await getMwHint(wordForApi);
      console.log("Raw Hint Data from MW:", apiResponse);
      let parsedEngSynonyms = [];
      if (apiResponse && Array.isArray(apiResponse) && apiResponse.length > 0) {
        const firstResult = apiResponse[0];
        if (
          firstResult &&
          typeof firstResult === "object" &&
          firstResult.shortdef &&
          Array.isArray(firstResult.shortdef) &&
          firstResult.shortdef.length > 0
        ) {
          const shortDefString = firstResult.shortdef[0];
          parsedEngSynonyms = shortDefString
            .split(/,| or /)
            .map((s) => {
              let cleaned = s.replace(/\(.*?\)/g, "").trim();
              if (cleaned.toLowerCase().startsWith("especially "))
                cleaned = cleaned.substring(11).trim();
              return cleaned;
            })
            .filter((s) => s && s.length > 1);
          if (
            parsedEngSynonyms.length > 0 &&
            currentPair &&
            currentPair.english
          ) {
            const primaryEnglishLower = currentPair.english
              .toLowerCase()
              .trim();
            parsedEngSynonyms = parsedEngSynonyms.filter(
              (s) => s.toLowerCase().trim() !== primaryEnglishLower
            );
          }
        }
      }
      if (parsedEngSynonyms.length > 0) {
        parsedEngSynonyms = [...new Set(parsedEngSynonyms)];
        setApiSuggestions({
          wordId: currentPair.id,
          type: "englishSynonyms",
          values: parsedEngSynonyms,
        });
        console.log(
          "App.jsx: API Suggested English Synonyms:",
          parsedEngSynonyms,
          "for ID:",
          currentPair.id
        );
      }
      let definitionData = null,
        suggestionsFromApi = null;
      if (Array.isArray(apiResponse) && apiResponse.length > 0) {
        if (typeof apiResponse[0] === "string")
          suggestionsFromApi = apiResponse;
        else if (typeof apiResponse[0] === "object" && apiResponse[0]?.meta?.id)
          definitionData = apiResponse[0];
        else setHintData({ type: "unknown", raw: apiResponse });
      } else if (
        typeof apiResponse === "object" &&
        !Array.isArray(apiResponse) &&
        apiResponse !== null &&
        apiResponse?.meta?.id
      )
        definitionData = apiResponse;
      else if (Array.isArray(apiResponse) && apiResponse.length === 0)
        setHintData({
          type: "error",
          message: `No definition or suggestions found for "${wordForApi}".`,
        });
      else setHintData({ type: "unknown", raw: apiResponse });
      if (definitionData)
        setHintData({ type: "definitions", data: definitionData });
      else if (suggestionsFromApi)
        setHintData({ type: "suggestions", suggestions: suggestionsFromApi });
    } catch (err) {
      console.error("Error in handleGetHint fetching/processing MW data:", err);
      setHintData({ type: "error", message: "Failed to fetch hint." });
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleFetchTatoebaExamples = async (wordToFetch) => {
    if (!wordToFetch) {
      setTatoebaError("No Spanish word provided to fetch examples for.");
      return;
    }
    setIsLoadingTatoebaExamples(true);
    setTatoebaError(null);
    setTatoebaExamples([]);
    console.log(`App.jsx: Fetching Tatoeba examples for "${wordToFetch}"`);
    try {
      const examples = await getTatoebaExamples(wordToFetch);
      if (examples.length === 0)
        setTatoebaError(
          `No example sentences found for "${wordToFetch}" on Tatoeba.`
        );
      setTatoebaExamples(examples);
    } catch (error) {
      console.error("App.jsx: Error in handleFetchTatoebaExamples:", error);
      setTatoebaError(`Failed to fetch examples: ${error.message}`);
      setTatoebaExamples([]);
    } finally {
      setIsLoadingTatoebaExamples(false);
    }
  };

  return (
    <div className="App">
      {" "}
      {/* Single top-level div for the component */}
      {/* Header Section (Title, Version, Settings Button) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          maxWidth: "700px",
          marginBottom: "10px",
        }}
      >
        <h1>Xan's Spans</h1>
        <div>
          {currentDataVersion && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)", // Use CSS variable
                margin: "0",
                display: "inline-block",
                marginRight: "15px",
              }}
            >
              Data v: {currentDataVersion}{" "}
              {isInHardWordsMode &&
                !isMatchingGameModeActive &&
                !isFillInTheBlankModeActive &&
                !isVerbConjugationGameActive &&
                "(Hard Mode)"}
            </p>
          )}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            title="Settings"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5em",
              cursor: "pointer",
              color: "var(--text-muted)", // Use CSS variable
              padding: "0",
            }}
            disabled={isAnyGameActive}
          >
            <span role="img" aria-label="settings icon">
              ⚙️
            </span>
          </button>
        </div>
      </div>
      {/* Score Stacks - Conditionally Rendered */}
      {!isMatchingGameModeActive &&
        !isFillInTheBlankModeActive &&
        !isVerbConjugationGameActive && (
          <div className="score-stacks-container">
            <ScoreStack
              type="correct"
              label="Correct"
              count={score.correct}
              icon="✅"
            />
            <ScoreStack
              type="incorrect"
              label="Incorrect"
              count={score.incorrect}
              icon="❌"
              flashRef={incorrectScoreRef}
            />
            <ScoreStack
              type="hard"
              label="Hard Words"
              count={hardWordsList.length}
              icon="⭐"
              onClick={handleToggleHardWordsView}
            />
          </div>
        )}
      {/* Controls Section */}
      <div className="controls">
        <button
          onClick={handleToggleFillInTheBlankMode}
          title="Fill-in-the-Blank Game"
          style={{ padding: "0.6rem 0.8rem" }}
        >
          <span role="img" aria-label="pencil and paper icon">
            📝
          </span>{" "}
          Fill-in-Blank
        </button>

        <button
          onClick={handleToggleMatchingGameMode}
          title="Matching Game"
          style={{ padding: "0.6rem 0.8rem" }}
        >
          <span role="img" aria-label="game icon">
            🎮
          </span>{" "}
          Matching Game
        </button>
        <button
          onClick={() => setIsSearchModalOpen(true)}
          title="Search Words"
          style={{ padding: "0.6rem 0.8rem" }}
          disabled={isMatchingGameModeActive || isFillInTheBlankModeActive}
        >
          <span role="img" aria-label="search icon">
            🔍
          </span>{" "}
          Search
        </button>
        <button
          onClick={handleToggleVerbConjugationGame}
          title="Verb Conjugation Game"
          style={{ padding: "0.6rem 0.8rem" }}
          disabled={
            isMatchingGameModeActive ||
            isFillInTheBlankModeActive ||
            isVerbConjugationGameActive
          }
        >
          <span role="img" aria-label="verb conjugation icon">
            🔗
          </span>{" "}
          Conjugation
        </button>
        <button
          onClick={handleToggleHardWordsMode}
          title={
            isInHardWordsMode ? "Practice All Words" : "Practice Hard Words"
          }
          style={{ padding: "0.6rem 0.8rem" }}
          disabled={isAnyGameActive}
        >
          <span
            role="img"
            aria-label={isInHardWordsMode ? "list icon" : "brain icon"}
          >
            {isInHardWordsMode ? "📋" : "🧠"}
          </span>
          {isInHardWordsMode ? "All Words" : "Hard Mode"}
        </button>
        <button onClick={switchDirection} disabled={isAnyGameActive}>
          Switch Dir ({languageDirection === "spa-eng" ? "S->E" : "E->S"})
        </button>
        <button
          onClick={selectNewPairCard}
          disabled={
            isLoadingData ||
            !listForFlashcardGame.length ||
            showHardWordsView ||
            isAnyGameActive
          }
        >
          {isLoadingData && !currentPair ? "Loading..." : "New Card"}
        </button>
      </div>
      {/* Mode Change Message - This goes before the main content switcher */}
      {modeChangeMessage && (
        <p
          style={{ color: "orange", textAlign: "center", fontStyle: "italic" }}
        >
          {modeChangeMessage}
        </p>
      )}
      {/* Main Content Area: Game OR Flashcard/HardWords View */}
      {isVerbConjugationGameActive ? (
        <div
          ref={verbConjugationGameContainerRef}
          className="verb-conjugation-game-view-wrapper"
        >
          <VerbConjugationGameView
            wordList={mainWordList}
            onExitGame={handleToggleVerbConjugationGame}
          />
        </div>
      ) : isMatchingGameModeActive ? (
        <div
          ref={matchingGameContainerRef}
          className="matching-game-view-wrapper"
        >
          <MatchingGameView
            fullWordList={mainWordList}
            numPairsToDisplay={6}
            onExitGame={handleToggleMatchingGameMode}
          />
        </div>
      ) : isFillInTheBlankModeActive ? (
        <div
          ref={fillInTheBlankGameContainerRef}
          className="fill-in-blank-game-view-wrapper"
        >
          <FillInTheBlankGameView
            wordList={mainWordList}
            numChoices={4} // Or your desired number
            onExitGame={handleToggleFillInTheBlankMode}
          />
        </div>
      ) : (
        // Original Flashcard/HardWordsView display
        <>
          {isLoadingData && !currentPair && (
            <p>Loading word list and preparing first card...</p>
          )}
          {dataError && (
            <div className="error-area">
              <p>Word List Error: {dataError}</p>
            </div>
          )}
          {gameError && !dataError && !isLoadingData && (
            <div className="error-area">
              <p>Flashcard Game Error: {gameError}</p>
            </div>
          )}

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
                    onShowDetails={handleShowDetailsModal}
                  />
                  {showFeedback && feedbackSignal === "incorrect" && (
                    <div className="feedback-area">
                      <p>
                        Incorrect. The correct answer is: "{lastCorrectAnswer}"
                      </p>
                      <button
                        onClick={() => handleGetHint(true)}
                        disabled={isHintLoading}
                        style={{ marginRight: "10px" }}
                      >
                        {isHintLoading
                          ? "Getting Info..."
                          : "Show Hint / Related"}
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
                      <p
                        style={{
                          color: "var(--color-success-darker, #155724)",
                        }}
                      >
                        Correct!
                      </p>
                      <button onClick={switchToNextCard}>Next Card</button>
                    </div>
                  )}
                </div>
              )}
              {!isLoadingData &&
                !dataError &&
                !gameError &&
                !currentPair &&
                listForFlashcardGame.length > 0 && (
                  <p>
                    {" "}
                    No card available in the current list. Try "New Card" or
                    change modes.{" "}
                  </p>
                )}
              {!isLoadingData &&
                !dataError &&
                !gameError &&
                !currentPair &&
                listForFlashcardGame.length === 0 && (
                  <p>
                    {" "}
                    The current word list is empty.{" "}
                    {isInHardWordsMode
                      ? "Add some hard words or switch to 'All Words' mode."
                      : "Add words or check data source."}{" "}
                  </p>
                )}
            </>
          )}
        </>
      )}
      {/* Modals: Conditionally render to prevent overlap with game views */}
      {!isMatchingGameModeActive && !isFillInTheBlankModeActive && (
        <>
          <SearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
            wordList={mainWordList}
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
            apiSuggestions={
              apiSuggestions &&
              wordCurrentlyBeingEdited &&
              apiSuggestions.wordId === wordCurrentlyBeingEdited.id
                ? apiSuggestions
                : null
            }
          />
          <WordDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={handleCloseDetailsModal}
            pair={currentPair}
            onFetchExamples={() =>
              currentPair && handleFetchTatoebaExamples(currentPair.spanish)
            }
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
            currentTheme={currentTheme}
            onToggleTheme={handleToggleTheme}
            onTriggerAddWordModal={handleOpenAddWordModalFromSettings}
          />
        </>
      )}
    </div>
  );
}

export default App;
