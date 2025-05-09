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
    // REMOVED: const [maxWords, setMaxWords] = useState(5);
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [feedbackSignal, setFeedbackSignal] = useState(null);
    const [showHardWordsView, setShowHardWordsView] = useState(false);

    // === Refs ===
    const incorrectScoreRef = useRef(null);
    const isInitialMountScore = useRef(true);
    // REMOVED: const isInitialMountMaxWords = useRef(true);

    // === Selection Logic ===
    const selectNewPair = (listToUse = wordList, manageLoadingState = false) => {
        console.log(
            `FUNC_START: selectNewPair (manageLoading: ${manageLoadingState})... List size: ${listToUse?.length}`
        );
        if (manageLoadingState) {
            console.log("LOAD_MANAGE: Setting isLoading = true");
            setIsLoading(true);
        }
        setError(null);
        setHintData(null);
        setCurrentPair(null);
        setShowFeedback(false);
        setIsHintLoading(false);
        setFeedbackSignal(null);

        if (!listToUse || listToUse.length === 0) {
            console.error("ERROR: selectNewPair called with empty list.");
            setError("Word list empty.");
            setCurrentPair(null);
            if (manageLoadingState) {
                console.log("LOAD_MANAGE: Setting isLoading = false (empty list)");
                setIsLoading(false);
            }
            return;
        }

        try {
            console.log("TRY_BLOCK: Entered try block.");
            // REMOVED: maxWords logic was here
            console.log("TRY_BLOCK: Starting filter...");
            const filteredData = listToUse.filter((pair) => {
                // Keep basic validation: Ensure spanish and english fields exist and are strings
                if (
                    !pair?.spanish ||
                    !pair?.english ||
                    typeof pair.spanish !== "string" ||
                    typeof pair.english !== "string" ||
                    pair.spanish.trim().length === 0 || // Also check they are not empty strings
                    pair.english.trim().length === 0
                ) {
                    return false;
                }
                // REMOVED: Filtering based on word count (maxWords)
                return true; // Keep the pair if it has valid spanish/english strings
            });
            console.log("TRY_BLOCK: Filter completed.");
            console.log( // UPDATED Log message
                `TRY_BLOCK: Found ${filteredData.length} valid pairs.`
            );

            if (filteredData.length > 0) {
                const idx = Math.floor(Math.random() * filteredData.length);
                const pair = filteredData[idx];
                console.log("TRY_BLOCK: Setting current pair:", pair);
                setCurrentPair(pair);
            } else {
                 // UPDATED Error message
                const errMsg = `No valid pairs found in the list.`;
                console.warn("TRY_BLOCK: " + errMsg);
                setError(errMsg);
                setCurrentPair(null);
            }
        } catch (err) {
            console.error("CATCH_BLOCK: Error selecting/filtering pair:", err);
            setError(err.message || "Failed select pair.");
            setCurrentPair(null);
        } finally {
            if (manageLoadingState) {
                console.log("LOAD_MANAGE: Setting isLoading = false (from finally)");
                setIsLoading(false);
            }
            console.log("FUNC_END: selectNewPair finished.");
        }
    };

    // === Combined Initial Load useEffect (Refactored for IndexedDB) ===
    useEffect(() => {
        const loadInitialData = async () => {
            console.log("App mounted. Loading ALL initial data...");
            setIsLoading(true);
            setError(null);
            setWordList([]);
            setScore({ correct: 0, incorrect: 0 });
            setHardWordsList([]);
            setCurrentPair(null);

            let loadedList = [];

            try {
                // Check if word list exists in IndexedDB
                const wordCount = await db.allWords.count();
                console.log(`Found ${wordCount} words in IndexedDB 'allWords' table.`);

                if (wordCount > 0) {
                    // Load Word List from DB
                    console.log("Loading word list from DB...");
                    loadedList = await db.allWords.toArray();
                    if (!Array.isArray(loadedList) || loadedList.length === 0) {
                        throw new Error("Failed to load words from DB despite count > 0.");
                    }
                    console.log(
                        `Successfully loaded ${loadedList.length} pairs from DB.`
                    );
                    setWordList(loadedList); // Trigger state update
                } else {
                    // Fetch JSON and Populate DB
                    console.log("Word list DB empty. Fetching JSON...");
                    const response = await fetch("/scrapedSpan411.json"); // Ensure this path is correct
                    if (!response.ok) {
                        throw new Error(`Word list fetch failed: ${response.status}`);
                    }
                    const jsonData = await response.json();
                    if (!Array.isArray(jsonData)) {
                        throw new Error("Word list data invalid.");
                    }
                    console.log(`Workspaceed ${jsonData.length} pairs from JSON.`);

                    console.log("Populating 'allWords' table in IndexedDB...");
                    // Validate data structure slightly before bulk putting
                    const validJsonData = jsonData.filter(
                        (item) =>
                            item &&
                            typeof item.spanish === "string" && item.spanish.trim().length > 0 && // Added trim check
                            typeof item.english === "string" && item.english.trim().length > 0    // Added trim check
                    );
                    if (validJsonData.length !== jsonData.length) {
                        console.warn(
                            "Some items were filtered out from JSON before DB population due to missing/invalid/empty structure."
                        );
                    }
                    if (validJsonData.length > 0) {
                        await db.allWords.bulkPut(validJsonData); // Use validated data
                        console.log(
                            `Successfully populated DB with ${validJsonData.length} words.`
                        );
                        loadedList = validJsonData;
                        setWordList(loadedList); // Trigger state update
                    } else {
                        throw new Error(
                            "Fetched JSON data was empty or invalid after filtering."
                        );
                    }
                }

                // Load Score from DB
                console.log("Loading score from DB...");
                const savedScoreState = await db.appState.get("userScore");
                if (savedScoreState) {
                    setScore({ ...savedScoreState });
                } else {
                    await db.appState.put({ id: "userScore", correct: 0, incorrect: 0 });
                    setScore({ correct: 0, incorrect: 0 });
                } // Ensure score state matches DB default

                // Load Hard Words from DB
                console.log("Loading hard words from DB...");
                const loadedHardWords = await db.hardWords.toArray();
                if (loadedHardWords) {
                    setHardWordsList(loadedHardWords);
                    console.log(`Loaded ${loadedHardWords.length} hard words.`);
                }

                // Select the first pair (Moved selection logic outside this effect)
                // We rely on the wordList useEffect now

            } catch (err) {
                console.error("Error during initial data load/DB interaction:", err);
                setError(err.message || "Failed to initialize data.");
                setWordList([]);
                setCurrentPair(null);
                setScore({ correct: 0, incorrect: 0 });
                setHardWordsList([]);
            } finally {
                console.log("Setting isLoading false after initial sequence.");
                setIsLoading(false);
                isInitialMountScore.current = false;
            }
        };
        loadInitialData();
    }, []); // Empty array means run once on mount

    // === useEffect to Select Initial/New Pair When Word List Changes ===
    // This now handles selecting the first pair after initial load,
    // and potentially re-selecting if the wordList were to change dynamically later.
    useEffect(() => {
        console.log("Effect: wordList changed (or initial load finished). Length:", wordList.length);
        if (wordList.length > 0 && !currentPair && !error) { // Only select if list is ready, no current pair, and no error
             console.log("Effect: wordList ready, selecting initial pair.");
             selectNewPair(wordList);
        }
    }, [wordList]); // Dependency: only wordList

    // === Saving Score useEffect ===
    useEffect(() => {
        if (isInitialMountScore.current) return;
        const saveScoreToDB = async () => {
            try {
                await db.appState.put({ id: "userScore", ...score });
                console.log("Score saved.");
            } catch (err) {
                console.error("Failed save score:", err);
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
                console.log("ADDING flash INCORRECT score:", element);
                element.classList.add("score-flash-incorrect");
                const dur = 1000;
                setTimeout(() => {
                    if (element) {
                        console.log("REMOVING flash INCORRECT score:", element);
                        element.classList.remove("score-flash-incorrect");
                    }
                }, dur);
            }
        }
    }, [score.incorrect]); // Depends only on score.incorrect now

    // === Mark Hard Word Handler ===
    const handleMarkHard = async (pairToMark) => {
        if (!pairToMark?.spanish || !pairToMark?.english) return;
        console.log("Marking hard:", pairToMark);
        try {
            // Use the compound key directly for put (more robust for Dexie)
            await db.hardWords.put({
                spanish: pairToMark.spanish,
                english: pairToMark.english,
            }); // put handles both add and update

            // Update state only if it wasn't already marked (prevents duplicates in state)
            if (!hardWordsList.some(w => w.spanish === pairToMark.spanish && w.english === pairToMark.english)) {
                 setHardWordsList((prev) => [
                     ...prev,
                     { spanish: pairToMark.spanish, english: pairToMark.english },
                 ]);
                 console.log("Updated hardWordsList state (added).");
            } else {
                 console.log("Word already marked, state not changed.");
            }

        } catch (error) {
            console.error("Failed save hard word:", error);
        }
    };


    // === Remove Hard Word Handler ===
    const handleRemoveHardWord = async (pairToRemove) => {
        if (!pairToRemove?.spanish || !pairToRemove?.english) {
            console.error("Invalid pair to remove");
            return;
        }
        console.log("Attempting remove hard word:", pairToRemove);
        // Use the compound key for deletion
        const compoundKey = [pairToRemove.spanish, pairToRemove.english];
        try {
            await db.hardWords.delete(compoundKey);
            console.log("Removed word DB.");
            setHardWordsList((prev) =>
                prev.filter(
                    (p) =>
                        !(
                            p.spanish === pairToRemove.spanish &&
                            p.english === pairToRemove.english
                        )
                )
            );
            console.log("Updated hardWordsList state removal.");
        } catch (error) {
            console.error("Failed remove hard word:", error);
        }
    };

    // === Answer Submission Logic ===
    const handleAnswerSubmit = (userAnswer) => {
        console.log("--- App: handleAnswerSubmit CALLED with:", userAnswer);
        const punctuationRegex = /[.?!¡¿]+$/;
        const englishArticleRegex = /^(the|a|an)\s+/i;
        const toVerbRegex = /^to\s+/i;

        if (!currentPair || showFeedback) {
            return;
        }

        const correctAnswer =
            languageDirection === "spa-eng"
                ? currentPair.english
                : currentPair.spanish;

        // Normalize user answer
        let normUser = userAnswer
            .toLowerCase()
            .trim()
            .replace(punctuationRegex, "");

        // Normalize correct answer
        let normCorrect = correctAnswer
            .toLowerCase()
            .trim()
            .replace(punctuationRegex, "");

        // Apply specific English normalization only when translating Spa->Eng
        if (languageDirection === "spa-eng") {
            console.log("Normalizing English answer (articles/to)");
            normUser = normUser
                .replace(englishArticleRegex, "")
                .replace(toVerbRegex, "");
            normCorrect = normCorrect
                .replace(englishArticleRegex, "")
                .replace(toVerbRegex, "");
        }

        console.log(`Comparing: "${normUser}" vs "${normCorrect}"`);

        if (normUser === normCorrect) {
            console.log("CORRECT branch executed.");
            setScore((prev) => ({ ...prev, correct: prev.correct + 1 }));
            setFeedbackSignal("correct");
            // Slight delay before selecting next pair allows feedback animation to start
            setTimeout(() => {
                selectNewPair(); // Select next pair using the current full wordList
            }, 50); // Reduced delay slightly, adjust as needed
        } else {
            console.log("INCORRECT branch executed.");
            setScore((prev) => ({ ...prev, incorrect: prev.incorrect + 1 }));
            setLastCorrectAnswer(correctAnswer); // Store the original correct answer for display
            setShowFeedback(true);
            setFeedbackSignal("incorrect");
        }
    };


    // REMOVED: handleMaxWordsChange function

    // REMOVED: useEffect hook that depended on maxWords

    // === Language Switch ===
    const switchLanguageDirection = () => {
        console.log("[App Render] languageDirection state is:", languageDirection);
        setLanguageDirection((prev) =>
            prev === "spa-eng" ? "eng-spa" : "spa-eng"
        );
        // Reset state related to the current card/answer
        setShowFeedback(false);
        setLastCorrectAnswer("");
        setHintData(null);
        setFeedbackSignal(null);
        // Optionally select a new pair immediately upon switching direction
        // selectNewPair(); // Uncomment if you want a new card instantly on switch
    };

    // === Hint Logic ===
    const handleGetHint = async (forceLookup = false) => {
        console.log(
            `handleGetHint called. forceLookup: ${forceLookup}, showFeedback: ${showFeedback}, hintData exists: ${!!hintData}`
        );

        if (!currentPair || isHintLoading) {
            console.log("Hint blocked: No pair or loading.");
            return;
        }

        // Block hint if already showing feedback (incorrect answer) unless forceLookup is true (like clicking hint button in feedback)
        // Also block if hint button itself should be disabled (e.g., already have hint) unless forceLookup is true.
        if (!forceLookup && (showFeedback || (hintData && hintData.type !== 'error'))) {
            console.log("Hint blocked: Not forcing & blocked by existing state (feedback or loaded hint).");
            return;
        }


        const wordToLookup = currentPair.spanish; // Always look up Spanish word based on user feedback
        if (!wordToLookup) {
            console.error("Hint Error: Spanish word is missing in the current pair.");
            setHintData({ type: "error", message: "Internal error: Word missing." });
            return;
        }

        console.log(`Attempting hint for: "${wordToLookup}"`);
        const spanishArticleRegex = /^(el|la|los|las|un|una|unos|unas)\s+/i;
        let wordForApi = wordToLookup.replace(spanishArticleRegex, "").trim();

        // Prevent API call for empty strings after removing article
        if (!wordForApi) {
            console.warn(`Hint: Word for API became empty after removing article from "${wordToLookup}".`);
             setHintData({ type: "error", message: "Cannot look up article alone." });
            return;
        }

        console.log(`Sending to API: "${wordForApi}"`);
        setIsHintLoading(true);
        // Reset hint data only if forcing or no hint exists yet, otherwise keep existing hint while loading update
        if (forceLookup || !hintData) {
             setHintData(null);
             console.log("Hint data reset before fetch.");
        }

        try {
            const apiResponse = await getMwHint(wordForApi);
            console.log("Raw Hint Data:", apiResponse);
            let definitionData = null;
            let suggestions = null;

            if (Array.isArray(apiResponse) && apiResponse.length > 0) {
                if (typeof apiResponse[0] === "string") {
                    // It's a list of suggestions
                    suggestions = apiResponse;
                    console.log("API returned suggestions.");
                } else if (typeof apiResponse[0] === 'object' && apiResponse[0]?.meta?.id) {
                    // It's an array of definition objects, use the first one
                    definitionData = apiResponse[0];
                    console.log("API returned definitions array, using first entry.");
                } else {
                     // Unknown array content
                    console.warn("API returned array with unknown content structure:", apiResponse);
                    setHintData({ type: "unknown", raw: apiResponse });
                    return; // Exit early after setting unknown state
                }
            } else if (typeof apiResponse === 'object' && !Array.isArray(apiResponse) && apiResponse !== null && apiResponse?.meta?.id) {
                 // It's a single definition object (less common but possible)
                definitionData = apiResponse;
                console.log("API returned single definition object.");
            } else if (Array.isArray(apiResponse) && apiResponse.length === 0) {
                 // Empty array - word likely not found directly
                 console.log("API returned empty array, word not found?");
                 setHintData({ type: "error", message: `No definition found for "${wordForApi}".` });
                 return;
            } else {
                 // Completely unexpected format or null/undefined response
                 console.warn("API returned unexpected data format:", apiResponse);
                 setHintData({ type: "unknown", raw: apiResponse });
                 return; // Exit early
            }


            // Process the found data (prioritize definitions over suggestions if both somehow appear)
            if (definitionData) {
                setHintData({ type: "definitions", data: definitionData });
                console.log("Set hint data: definitions");
            } else if (suggestions) {
                setHintData({ type: "suggestions", suggestions: suggestions });
                console.log("Set hint data: suggestions");
            } else {
                // This case should ideally be covered above, but as a fallback
                console.warn("No definition or suggestion data could be processed.");
                setHintData({ type: "error", message: "Hint format error or not found." });
            }

        } catch (err) {
            console.error("Error in handleGetHint fetching/processing:", err);
            // Ensure hintData is set to an error state if fetch fails
            setHintData({ type: "error", message: "Failed to fetch hint." });
        } finally {
            setIsHintLoading(false);
             console.log("Finished handleGetHint.");
        }
    };


    // === Handler to Close the Hard Words View ===
    const handleCloseHardWordsView = () => {
        console.log("Closing Hard Words View");
        setShowHardWordsView(false);
    };

    // Log language direction before rendering return statement
    console.log("[App Render] languageDirection state is:", languageDirection);

    // === Component Return ===
    return (
        <div className="App">
            <h1>Spanish Flashcards</h1>
            {/* Score Stacks Area */}
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
                    onClick={() => {
                        console.log("Hard words stack clicked");
                        setShowHardWordsView((prev) => !prev); // Toggle the view
                        // Ensure flashcard view is hidden when hard words view is shown
                        if (!showHardWordsView) {
                            setShowFeedback(false); // Hide feedback if switching view
                            setHintData(null);    // Clear hint if switching view
                        }
                    }}
                />
            </div>

            {/* Controls Area - No changes needed here for maxWords removal */}
             <div className="controls">
                 <button onClick={switchLanguageDirection}>
                     Switch Dir ({languageDirection === "spa-eng" ? "S->E" : "E->S"})
                 </button>
                 <button
                     onClick={() => selectNewPair(wordList, true)} // Pass wordList explicitly
                     disabled={isLoading || !wordList.length || showHardWordsView} // Disable if showing hard words
                 >
                     {isLoading ? "Loading..." : "New Card"}
                 </button>
             </div>


            {/* Status Messages Area */}
            {isLoading && <p>Loading...</p>}
            {error && !isLoading && (
                <div className="error-area">
                    <p>Error: {error}</p>
                    <button
                        onClick={() => {
                            setError(null); // Clear error first
                            selectNewPair(wordList, true); // Try selecting again
                          }
                        }
                        disabled={isLoading || !wordList.length || showHardWordsView}
                    >
                        Try New Card
                    </button>
                </div>
            )}

             {/* Conditional Rendering for Main Content Area */}
             {showHardWordsView ? (
                 // === Hard Words View ===
                 <HardWordsView
                     hardWordsList={hardWordsList}
                     onClose={handleCloseHardWordsView}
                     onRemoveWord={handleRemoveHardWord} // Pass the remove handler
                 />
             ) : (
                  // === Flashcard / Feedback View ===
                 <>
                    {/* Show flashcard only if not loading, no error, and a pair is ready */}
                     {!isLoading && !error && currentPair && (
                         <div className="flashcard-area">
                             {(() => {
                                 // Determine if the current card is marked as hard
                                 const isCurrentCardMarked = hardWordsList.some(
                                     (word) =>
                                         word.spanish === currentPair.spanish &&
                                         word.english === currentPair.english
                                 );
                                 // Memoize or compute derived state if performance becomes an issue
                                 return (
                                     <Flashcard
                                         pair={currentPair}
                                         direction={languageDirection}
                                         onAnswerSubmit={handleAnswerSubmit}
                                         showFeedback={showFeedback} // Used to hide input form
                                         onGetHint={handleGetHint}
                                         hint={hintData}
                                         isHintLoading={isHintLoading}
                                         feedbackSignal={feedbackSignal} // For correct/incorrect animation
                                         onMarkHard={handleMarkHard} // Pass handler down
                                         isMarkedHard={isCurrentCardMarked} // Pass derived state down
                                     />
                                 );
                             })()}

                             {/* Show Feedback Area only when showFeedback is true */}
                             {showFeedback && (
                                 <div className="feedback-area">
                                     <p>
                                         Incorrect. The correct answer is: "{lastCorrectAnswer}"
                                     </p>
                                     {/* Button to get hint/info AFTER seeing the correct answer */}
                                     <button
                                        onClick={() => handleGetHint(true)} // Force lookup even if hint exists
                                        disabled={isHintLoading} // Only disable while loading
                                        className="hint-button" // Reuse styles maybe?
                                        style={{marginRight: '10px'}} // Add space
                                    >
                                        {isHintLoading ? "Getting Info..." : "Show Hint / Related"}
                                    </button>
                                    {/* Button to move to the next card from feedback */}
                                     <button
                                        onClick={() => selectNewPair(wordList)} // Just select the next one
                                        className="submit-button" // Reuse styles maybe?
                                    >
                                        Next Card
                                    </button>
                                 </div>
                             )}
                         </div>
                     )}

                    {/* Fallback Messages when no card is displayed */}
                    {!isLoading && !error && !currentPair && wordList.length > 0 && (
                        <p>No valid card available. Try 'New Card' or check filters if added later.</p>
                    )}
                    {!isLoading && !error && !currentPair && wordList.length === 0 && !isLoading && ( // Ensure not loading
                        <p>Word list is empty or failed to load. Cannot display cards.</p>
                    )}
                 </>
             )}
             {/* END Conditional Rendering */}
        </div>
    );
}

export default App;