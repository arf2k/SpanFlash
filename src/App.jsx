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
import { db } from "./db";
import { useWordData } from "./hooks/useWordData";
import { useFlashcardGame } from "./hooks/useFlashcardGame";
import "./App.css";
import VerbConjugationGameView from "./components/VerbConjugationGameView.jsx";
import { useModalState } from "./hooks/useModalState";
import { useGameModes } from "./hooks/useGameModes";
import { useAppSettings } from "./hooks/useAppSettings";
import { createHardWordsHandlers } from "./handlers/hardWordsHandlers";
import { createModalHandlers } from "./handlers/modalHandlers";
import { createWordManagementHandlers } from "./handlers/wordManagementHandlers";
import { createGameModeHandlers } from "./handlers/gameModeHandlers";
import { createApiHandlers } from "./handlers/apiHandlers";
import AppHeader from "./components/AppHeader";
import FloatingGamesButton from "./components/FloatingGamesButton.jsx";
import { useSessionStats } from "./hooks/useSessionStats";
import StatsModal from "./components/StatsModal";
import VocabularyExtractionModal from "./components/VocabularyExtractionModal.jsx";
import ReviewExtractedWordsModal from "./components/ReviewExtractedWordsModal.jsx";
import { createVocabularyExtractionHandlers } from "./handlers/vocabularyExtractionHandlers.js";
import { useTurnstile } from "./hooks/useTurnstile";

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
  const [incompleteWords, setIncompleteWords] = useState([]);

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
    hasValidToken,
    ensureValidToken,
    isWidgetVisible,
    isLoading: isTurnstileLoading,
    error: turnstileError,
    sitekey,
    onTurnstileSuccess,
    onTurnstileError,
    hideWidget,
    resetWidget,
    setWidgetId,
  } = useTurnstile();

  const {
    sessionStats,
    todaysStats,
    allTimeStats,
    isLoadingAllTimeStats,
    loadAllTimeStats,
    viewMode,
    toggleViewMode,
    recordAnswer,
    startNewSession,
    getSessionAccuracy,
    getSessionDuration,
  } = useSessionStats();

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
    isStatsModalOpen,
    setIsStatsModalOpen,
    addWordFromSearch,
    setAddWordFromSearch,
    isVocabExtractionModalOpen,
    setIsVocabExtractionModalOpen,
    isReviewExtractedModalOpen,
    setIsReviewExtractedModalOpen,
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
    showFeedback,
    lastCorrectAnswer,
    feedbackSignal,
    gameError,
    selectNewPairCard,
    submitAnswer,
    switchDirection,
    switchToNextCard,
    setShowFeedback: setGameShowFeedback,
    loadSpecificCard,
    lastReviewedCard,
    celebrationState,
    clearCelebration,
  } = useFlashcardGame(listForFlashcardGame, initialCard, recordAnswer);

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
    handleAddWordFromSearch,
  } = createModalHandlers(
    setWordCurrentlyBeingEdited,
    setIsEditModalOpen,
    setTatoebaExamples,
    setTatoebaError,
    setIsLoadingTatoebaExamples,
    setIsDetailsModalOpen,
    setIsAddWordModalOpen,
    setIsSettingsModalOpen,
    setAddWordFromSearch,
    setIsSearchModalOpen
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

  const { handleGetHint, handleFetchTatoebaExamples } = createApiHandlers(
    currentPair,
    isHintLoading,
    setIsHintLoading,
    hintData,
    setHintData,
    showFeedback,
    feedbackSignal,
    setApiSuggestions,
    setIsLoadingTatoebaExamples,
    setTatoebaError,
    setTatoebaExamples,
    ensureValidToken
  );

  const {
    handleAddExtractedWords,
    handleVocabExtractionComplete,
    getIncompleteWords,
    handleCompleteWord,
    handleDeleteIncompleteWord,
  } = createVocabularyExtractionHandlers(
    setIsVocabExtractionModalOpen,
    setIsReviewExtractedModalOpen
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
    const loadAppSpecificData = async () => {
      if (!db || !db.hardWords) {
        console.error(
          "App.jsx: Database not initialized or missing required stores."
        );
        return;
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
  }, []);

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
            block: "center",
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
            block: "center",
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
  return (
    <div className="App">
      <AppHeader
        isInHardWordsMode={isInHardWordsMode}
        isAnyGameActive={isAnyGameActive}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        onStatsClick={() => setIsStatsModalOpen(true)}
        setIsVocabExtractionModalOpen={setIsVocabExtractionModalOpen}
        onSearchClick={() => setIsSearchModalOpen(true)}
      />

      {/* Score Stacks - COMMENTED OUT FOR STEP 1 LAYOUT CLEANUP */}
      {/* Will be preserved for Games Modal in Step 3 */}
      {/*
      {!isMatchingGameModeActive &&
        !isFillInTheBlankModeActive &&
        !isVerbConjugationGameActive && (
          <div className="score-stacks-container">
            <ScoreStack
              type="correct"
              label="Correct"
              count={sessionStats?.correctAnswers || 0}
              icon="✅"
            />
            <ScoreStack
              type="incorrect"
              label="Incorrect"
              count={sessionStats?.incorrectAnswers || 0}
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
      */}

      {/* Controls Section */}
      {/* TEMPORARILY COMMENTED OUT FOR STEP 1 TESTING */}
      {/*
{!isAnyGameActive && (
  <GameControls
    onFillInBlankToggle={handleToggleFillInTheBlankMode}
    onMatchingGameToggle={handleToggleMatchingGameMode}
    onVerbConjugationToggle={handleToggleVerbConjugationGame}
    onHardModeToggle={handleToggleHardWordsMode}
    onSearchClick={() => setIsSearchModalOpen(true)}
    onSwitchDirection={switchDirection}
    onNewCard={selectNewPairCard}
    isAnyGameActive={isAnyGameActive}
    isMatchingGameModeActive={isMatchingGameModeActive}
    isFillInTheBlankModeActive={isFillInTheBlankModeActive}
    isInHardWordsMode={isInHardWordsMode}
    languageDirection={languageDirection}
    isLoadingData={isLoadingData}
    listForFlashcardGame={listForFlashcardGame}
    showHardWordsView={showHardWordsView}
  />
)}
*/}

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
            recordAnswer={recordAnswer}
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
            recordAnswer={recordAnswer}
          />
        </div>
      ) : isFillInTheBlankModeActive ? (
        <div
          ref={fillInTheBlankGameContainerRef}
          className="fill-in-blank-game-view-wrapper"
        >
          <FillInTheBlankGameView
            wordList={mainWordList}
            numChoices={4}
            onExitGame={handleToggleFillInTheBlankMode}
            recordAnswer={recordAnswer}
          />
        </div>
      ) : (
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
                    onNewCard={selectNewPairCard}
                    onSwitchDirection={switchDirection}
                    celebrationState={celebrationState}
                    onCelebrationComplete={clearCelebration}
                  />
                  {showFeedback && feedbackSignal === "incorrect" && (
                    <div className="feedback-area">
                      <div className="feedback-header">
                        <div className="feedback-title">
                          <span className="feedback-icon">❌</span>
                          Incorrect
                        </div>
                        <div className="feedback-message">
                          Try again with the correct answer
                        </div>
                      </div>

                      <div className="feedback-correct-answer">
                        <span className="correct-answer-label">
                          Correct Answer
                        </span>
                        <div className="correct-answer-text">
                          {lastCorrectAnswer}
                        </div>
                      </div>

                      <div className="feedback-actions">
                        <button
                          onClick={() => handleGetHint(true)}
                          disabled={isHintLoading}
                          className="hint-button"
                        >
                          {isHintLoading
                            ? "Getting Info..."
                            : "Show Hint / Related"}
                        </button>
                        <button
                          onClick={switchToNextCard}
                          className="next-card-button"
                        >
                          Next Card
                        </button>
                      </div>
                    </div>
                  )}
                  {showFeedback && feedbackSignal === "correct" && (
                    <div className="feedback-area">
                      <div
                        className="feedback-header"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--color-success) 0%, var(--color-success-darker) 100%)",
                        }}
                      >
                        <div className="feedback-title">
                          <span className="feedback-icon">✅</span>
                          Correct!
                        </div>
                        <div className="feedback-message">
                          Great job! Keep it up
                        </div>
                      </div>

                      <div className="feedback-actions">
                        <button
                          onClick={switchToNextCard}
                          className="next-card-button"
                        >
                          Next Card
                        </button>
                      </div>
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
            onAddWord={handleAddWordFromSearch}
            isAdminMode={isAdminMode}
          />
          <AddWordModal
            isOpen={isAddWordModalOpen}
            onClose={() => {
              setIsAddWordModalOpen(false);
              setAddWordFromSearch(null);
            }}
            onAddWord={handleAddWord}
            initialSpanish={addWordFromSearch || ""}
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
          <StatsModal
            isOpen={isStatsModalOpen}
            onClose={() => setIsStatsModalOpen(false)}
            sessionStats={sessionStats}
            todaysStats={todaysStats}
            allTimeStats={allTimeStats}
            isLoadingAllTimeStats={isLoadingAllTimeStats}
            loadAllTimeStats={loadAllTimeStats}
            viewMode={viewMode}
            toggleViewMode={toggleViewMode}
            getSessionAccuracy={getSessionAccuracy}
            getSessionDuration={getSessionDuration}
            onNewSession={startNewSession}
          />
          <VocabularyExtractionModal
            isOpen={isVocabExtractionModalOpen}
            onClose={() => setIsVocabExtractionModalOpen(false)}
            existingVocabulary={mainWordList}
            onAddWords={handleVocabExtractionComplete}
          />
          <ReviewExtractedWordsModal
            isOpen={isReviewExtractedModalOpen}
            onClose={() => setIsReviewExtractedModalOpen(false)}
            incompleteWords={incompleteWords}
            onCompleteWord={handleCompleteWord}
            onDeleteWord={handleDeleteIncompleteWord}
            onRefreshIncompleteWords={async () => {
              const words = await getIncompleteWords();
              setIncompleteWords(words);
            }}
          />
        </>
      )}
      <FloatingGamesButton
        onFillInBlankToggle={handleToggleFillInTheBlankMode}
        onMatchingGameToggle={handleToggleMatchingGameMode}
        onVerbConjugationToggle={handleToggleVerbConjugationGame}
        onHardModeToggle={handleToggleHardWordsMode}
        isAnyGameActive={isAnyGameActive}
        isMatchingGameModeActive={isMatchingGameModeActive}
        isFillInTheBlankModeActive={isFillInTheBlankModeActive}
        isInHardWordsMode={isInHardWordsMode}
        languageDirection={languageDirection}
        isLoadingData={isLoadingData}
        listForFlashcardGame={listForFlashcardGame}
        showHardWordsView={showHardWordsView}
      />
      {currentDataVersion && (
        <div className="version-overlay">v: {currentDataVersion}</div>
      )}
      {isWidgetVisible && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 1000,
            background: "var(--bg-card)",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid var(--color-border)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div style={{ marginBottom: "10px", textAlign: "center" }}>
            <small style={{ color: "var(--text-muted)" }}>
              Verifying you're human...
            </small>
          </div>
          <div className="cf-turnstile"></div>

          {turnstileError && (
            <div
              style={{
                marginTop: "10px",
                textAlign: "center",
                color: "var(--text-error)",
              }}
            >
              <small>{turnstileError}</small>
              <br />
              <button
                onClick={resetWidget}
                style={{
                  background: "var(--color-warning)",
                  color: "white",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  marginTop: "5px",
                }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
