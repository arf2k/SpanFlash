// src/App.jsx
import { useState, useEffect, useRef } from "react";
import Flashcard from "./components/Flashcard";
import ScoreStack from "./components/ScoreStack";
import HardWordsView from "./components/HardWordsView";
import { getMwHint } from "./services/dictionaryServices.js";
import { db } from "./db";
import "./App.css";

function App() {
    // === State Variables ===
    const [wordList, setWordList] = useState([]);
    const [currentPair, setCurrentPair] = useState(null);
    const [languageDirection, setLanguageDirection] = useState("spa-eng");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [hardWordsList, setHardWordsList] = useState([]);
    const [hintData, setHintData] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [feedbackSignal, setFeedbackSignal] = useState(null);
    const [showHardWordsView, setShowHardWordsView] = useState(false);
    const [dataVersion, setDataVersion] = useState(null); // <-- New state for displaying version

    // === Refs ===
    const incorrectScoreRef = useRef(null);
    const isInitialMountScore = useRef(true);

    // === Selection Logic ===
    const selectNewPair = (listToUse = wordList, manageLoadingState = false) => {
        console.log(
            `FUNC_START: selectNewPair (manageLoading: ${manageLoadingState})... List size: ${listToUse?.length}`
        );
        if (manageLoadingState) {
            setIsLoading(true);
        }
        setError(null);
        setHintData(null);
        setCurrentPair(null);
        setShowFeedback(false);
        setIsHintLoading(false);
        setFeedbackSignal(null);

        if (!listToUse || listToUse.length === 0) {
            console.warn("selectNewPair called with empty or undefined listToUse.");
            setCurrentPair(null);
            if (manageLoadingState) {
                setIsLoading(false);
            }
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
                console.warn("No valid pairs found in the list to select from.");
                setError("No valid flashcards available to display.");
                setCurrentPair(null);
            }
        } catch (err) {
            console.error("Error selecting/filtering pair in selectNewPair:", err);
            setError(err.message || "Failed to select a new pair.");
            setCurrentPair(null);
        } finally {
            if (manageLoadingState) {
                setIsLoading(false);
            }
        }
    };

    // === Initial Data Load useEffect (with Version Checking) ===
    useEffect(() => {
        const loadInitialData = async () => {
            console.log("App mounted. Loading initial data with version check...");
            setIsLoading(true);
            setError(null);
            setDataVersion(null); // Reset data version display

            setWordList([]); // Initialize to ensure clean state if loading fails

            let remoteVersion = null;
            let remoteWordsArray = [];

            try {
                console.log("Fetching remote word list (/scrapedSpan411.json) for version check...");
                const response = await fetch("/scrapedSpan411.json");
                if (!response.ok) {
                    throw new Error(`Failed to fetch word list: ${response.status} ${response.statusText}`);
                }
                const remoteJsonData = await response.json();

                if (typeof remoteJsonData.version !== 'string' || !Array.isArray(remoteJsonData.words)) {
                    console.error("Fetched JSON data structure is invalid. Expected { version: '...', words: [...] }", remoteJsonData);
                    throw new Error("Fetched word list data is not in the expected format.");
                }
                remoteVersion = remoteJsonData.version;
                remoteWordsArray = remoteJsonData.words;
                console.log(`Remote JSON version: '${remoteVersion}', contains ${remoteWordsArray.length} pairs.`);

                const localDataVersionState = await db.appState.get('dataVersion');
                const localVersion = localDataVersionState ? localDataVersionState.version : null;
                setDataVersion(localVersion); // Initially set to local, will update if remote is newer
                console.log(`Local stored data version: '${localVersion}'`);

                let wordsToSetInState = [];

                if (!localVersion || remoteVersion !== localVersion) {
                    console.log(
                        !localVersion ? 'No local data version found.' : `Remote version ('${remoteVersion}') differs from local ('${localVersion}').`
                    );
                    console.log('Refreshing local word database from remote source...');

                    const validRemoteWords = remoteWordsArray.filter(
                        (item) =>
                            item &&
                            typeof item.spanish === 'string' && item.spanish.trim().length > 0 &&
                            typeof item.english === 'string' && item.english.trim().length > 0
                    );

                    if (remoteWordsArray.length > 0 && validRemoteWords.length !== remoteWordsArray.length) {
                        console.warn(
                            "Some items were filtered out from remote JSON before DB population due to invalid structure or empty fields."
                        );
                    }
                    
                    if (validRemoteWords.length > 0) {
                        await db.allWords.clear();
                        await db.allWords.bulkPut(validRemoteWords);
                        await db.appState.put({ id: 'dataVersion', version: remoteVersion });
                        setDataVersion(remoteVersion); // Update displayed version
                        console.log(`Successfully populated IndexedDB with ${validRemoteWords.length} words. New local version: '${remoteVersion}'`);
                        wordsToSetInState = validRemoteWords;
                    } else if (remoteWordsArray.length > 0 && validRemoteWords.length === 0) {
                        console.error("Remote JSON contained word pairs, but all were invalid. Clearing local data.");
                        await db.allWords.clear();
                        await db.appState.put({ id: 'dataVersion', version: remoteVersion });
                        setDataVersion(remoteVersion);
                        wordsToSetInState = [];
                        setError("The new word list was empty or contained no valid words.");
                    } else {
                        console.warn("Remote JSON word list is empty. Clearing local data and setting version.");
                        await db.allWords.clear();
                        await db.appState.put({ id: 'dataVersion', version: remoteVersion });
                        setDataVersion(remoteVersion);
                        wordsToSetInState = [];
                    }
                } else {
                    console.log(`Data version '${localVersion}' is up to date. Loading words from local IndexedDB.`);
                    const currentLocalWords = await db.allWords.toArray();
                    wordsToSetInState = currentLocalWords;
                    // Edge case: versions match but local DB is empty and remote isn't.
                    if (wordsToSetInState.length === 0 && remoteWordsArray.length > 0) {
                        console.warn("Local DB is empty despite matching versions and non-empty remote. Re-populating from remote.");
                        const validRemoteWordsForRepopulate = remoteWordsArray.filter( /* same filter as above */ );
                        if (validRemoteWordsForRepopulate.length > 0) {
                            await db.allWords.bulkPut(validRemoteWordsForRepopulate);
                            wordsToSetInState = validRemoteWordsForRepopulate;
                        }
                    }
                }
                setWordList(wordsToSetInState);

            } catch (err) {
                console.error("MAJOR ERROR during initial data load or version check:", err);
                setError(`Failed to load word data: ${err.message}. Local data (if any) will be used.`);
                try {
                    console.warn("Attempting to load words from local DB as a fallback...");
                    const fallbackWords = await db.allWords.toArray();
                    setWordList(fallbackWords);
                    const localDataVersionState = await db.appState.get('dataVersion'); // Try to get local version for display
                    if (localDataVersionState) setDataVersion(localDataVersionState.version);

                    if (fallbackWords.length === 0) console.warn("Fallback: Local DB is also empty.");
                    else console.log(`Fallback: Loaded ${fallbackWords.length} words from local DB.`);
                } catch (dbError) {
                    console.error("Fallback failed: Error loading words from local DB:", dbError);
                }
            } finally {
                try {
                    const savedScoreState = await db.appState.get("userScore");
                    if (savedScoreState) {
                        setScore({ correct: savedScoreState.correct, incorrect: savedScoreState.incorrect });
                    } else {
                        await db.appState.put({ id: "userScore", correct: 0, incorrect: 0 });
                        setScore({ correct: 0, incorrect: 0 });
                    }
                } catch (scoreError) {
                    console.error("Failed to load/initialize score:", scoreError);
                }
                
                try {
                    const loadedHardWords = await db.hardWords.toArray();
                    setHardWordsList(loadedHardWords || []);
                } catch (hardWordsError) {
                    console.error("Failed to load hard words:", hardWordsError);
                }

                setIsLoading(false);
                isInitialMountScore.current = false;
                console.log("Initial data load sequence finished.");
            }
        };

        loadInitialData();
    }, []); // Runs once on mount

    // === useEffect to Select Initial/New Pair When Word List is Ready ===
    useEffect(() => {
        console.log(`Effect: wordList state updated. Length: ${wordList.length}. isLoading: ${isLoading}. currentPair: ${!!currentPair}. Error: ${!!error}`);
        if (!isLoading && wordList.length > 0 && !currentPair && !error) {
            console.log("wordList ready, no current pair, no error. Selecting initial pair.");
            selectNewPair(wordList);
        } else if (!isLoading && wordList.length === 0 && !error) {
            console.log("Word list is confirmed empty, not loading, and no error. No pair to select.");
            setCurrentPair(null); 
        }
    }, [wordList, isLoading, error]); // Rerun if wordList, isLoading, or error changes

    // === Saving Score useEffect ===
    useEffect(() => {
        if (isInitialMountScore.current) return;
        const saveScoreToDB = async () => {
            try {
                await db.appState.put({ id: "userScore", ...score });
                console.log("Score saved to DB:", score);
            } catch (err) {
                console.error("Failed to save score to DB:", err);
            }
        };
        saveScoreToDB();
    }, [score]);

    // === Incorrect Score Flash useEffect ===
    useEffect(() => {
        if (isInitialMountScore.current) return;
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
            setTimeout(() => selectNewPair(), 600); // Animation time
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
        selectNewPair(); // Get a new card for the new direction
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

    // === Handler to Close the Hard Words View ===
    const handleCloseHardWordsView = () => setShowHardWordsView(false);
    
    return (
        <div className="App">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '700px', marginBottom: '10px' }}>
                <h1>Spanish Flashcards</h1>
                {/* Data Version Display */}
                {dataVersion && (
                    <p style={{ fontSize: '0.8rem', color: '#6c757d', margin: '0' }}>
                        Data v: {dataVersion}
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
                    onClick={() => setShowHardWordsView((prev) => !prev)}
                />
            </div>

            <div className="controls">
                <button onClick={switchLanguageDirection}>
                    Switch Dir ({languageDirection === "spa-eng" ? "S->E" : "E->S"})
                </button>
                <button
                    onClick={() => selectNewPair(wordList, true)}
                    disabled={isLoading || !wordList.length || showHardWordsView}
                >
                    {isLoading && !currentPair ? "Loading..." : "New Card"}
                </button>
            </div>

            {isLoading && !currentPair && <p>Loading word list and preparing first card...</p>}
            {error && <div className="error-area"><p>{error}</p> <button onClick={() => { setError(null); loadInitialData(); }}>Try Reload</button></div>}


            {showHardWordsView ? (
                <HardWordsView
                    hardWordsList={hardWordsList}
                    onClose={handleCloseHardWordsView}
                    onRemoveWord={handleRemoveHardWord}
                />
            ) : (
                <>
                    {!isLoading && !error && currentPair && (
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
                    {!isLoading && !error && !currentPair && wordList.length > 0 && (
                        <p>No card available. Try "New Card" or ensure list has content.</p>
                    )}
                     {!isLoading && !error && !currentPair && wordList.length === 0 && (
                        <p>Word list is empty. Please check the data source.</p>
                    )}
                </>
            )}
        </div>
    );
}

export default App;