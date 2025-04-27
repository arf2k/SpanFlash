import { useState, useEffect } from 'react'; 
import Flashcard from './components/Flashcard';
import './App.css';

// Define constants
const TOTAL_CHUNKS = 23; 

function App() {
    // === State Variables ===
    const [currentPair, setCurrentPair] = useState(null); // Holds the current {english, spanish} object
    const [languageDirection, setLanguageDirection] = useState('spa-eng'); // 'spa-eng' or 'eng-spa'
    const [isLoading, setIsLoading] = useState(true); // True while fetching chunks/hints
    const [error, setError] = useState(null); // Stores any error messages
    const [score, setScore] = useState({ correct: 0, incorrect: 0 }); // Tracks the score
    const [hintData, setHintData] = useState(null); // Stores hint data from MW API
    const [showFeedback, setShowFeedback] = useState(false); // Track if showing feedback (after incorrect answer)
const [lastCorrectAnswer, setLastCorrectAnswer] = useState('');

   
     const fetchRandomPair = async () => {
      console.log("Attempting to fetch new pair....")
      setIsLoading(true);
      setError(null);
      setHintData(null);
      setCurrentPair(null);
      try {
        // 1. Select a random chunk file number (1 to TOTAL_CHUNKS)
        const randomChunkNum = Math.floor(Math.random() * TOTAL_CHUNKS) + 1;
        const chunkUrl = `/data_chunks/chunk_${randomChunkNum}.json`;
        console.log(`Workspaceing chunk file: ${chunkUrl}`);

        // 2. Fetch the selected JSON file from the public folder
        const response = await fetch(chunkUrl);

        // Check if the fetch was successful
        if (!response.ok) {
            // If response status is not 2xx, throw an error
            throw new Error(`Network response was not ok: ${response.status} ${response.statusText} while fetching ${chunkUrl}`);
        }

        // 3. Parse the JSON data from the response
        const currentChunkData = await response.json(); // This should be an array of {english, spanish} objects

        // 4. Check if data is valid and pick a random pair
        if (Array.isArray(currentChunkData) && currentChunkData.length > 0) {
            const randomIndex = Math.floor(Math.random() * currentChunkData.length);
            const pair = currentChunkData[randomIndex];
            console.log("Successfully selected pair:", pair);
            setCurrentPair(pair); // Update the state with the new pair
        } else {
            // Handle cases where the chunk file is empty or not an array
            throw new Error(`Loaded data from ${chunkUrl} is empty or invalid.`);
        }

    } catch (err) {
        // Handle any errors during fetch or processing
        console.error("Error fetching random pair:", err);
        setError(err.message || 'Failed to load flashcard data. Please try again.');
        setCurrentPair(null); // Reset current pair if an error occurred
    } finally {
        // This block runs regardless of success or error
        setIsLoading(false); // Stop loading indicator
        console.log("Fetching attempt finished.");
    }
}

// const handleAnswerSubmit = (userAnswer) => {
//   if (!currentPair || showFeedback) return; // Don't process if no pair or feedback is showing

//   console.log(`Checking answer: User submitted "${userAnswer}"`);

//   const correctAnswer = languageDirection === 'spa-eng'
//       ? currentPair.english
//       : currentPair.spanish;

//   const normalizedUserAnswer = userAnswer.toLowerCase().trim();
//   const normalizedCorrectAnswer = correctAnswer.toLowerCase().trim();

//   if (normalizedUserAnswer === normalizedCorrectAnswer) {
//       console.log("Correct Fetching next!");
//       setScore(prevScore => ({ ...prevScore, correct: prevScore.correct + 1 }));
//       // Correct: Fetch next card immediately (or add tiny delay later for feedback animation)
//       // We could briefly set a 'correct' feedback state here if needed for animation
//       fetchRandomPair(); // Proceed to next card
//   } else {
//       console.log(`Incorrect. Correct answer was: "${correctAnswer}"`);
//       setScore(prevScore => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
//       setLastCorrectAnswer(correctAnswer); // Store the correct answer to show it
//       console.log("Setting showFeedback=true"); // <-- Log before setting

//       setShowFeedback(true); // Set state to show feedback UI
//   }
// };
const handleAnswerSubmit = (userAnswer) => {
  if (!currentPair || showFeedback) return;

  console.log(`Checking answer: User submitted "${userAnswer}"`);

  const correctAnswer = languageDirection === 'spa-eng'
      ? currentPair.english
      : currentPair.spanish;

  const normalizedUserAnswer = userAnswer.toLowerCase().trim();
  const normalizedCorrectAnswer = correctAnswer.toLowerCase().trim();

  // --- ADD THIS LOG ---
  console.log(`Comparing: "<span class="math-inline">\{normalizedUserAnswer\}" vs "</span>{normalizedCorrectAnswer}"`);
  // --- END LOG ---

  if (normalizedUserAnswer === normalizedCorrectAnswer) {
      console.log("CORRECT branch executed. Fetching next card...");
      setScore(prevScore => ({ ...prevScore, correct: prevScore.correct + 1 }));
      fetchRandomPair();
  } else {
      console.log("INCORRECT branch executed. Setting showFeedback=true.");
      setScore(prevScore => ({ ...prevScore, incorrect: prevScore.incorrect + 1 }));
      setLastCorrectAnswer(correctAnswer);
      setShowFeedback(true);
  }
};
const handleNextCard = () => {
  setShowFeedback(false);      // Hide feedback UI
  setLastCorrectAnswer('');   // Clear stored answer
  fetchRandomPair();          // Fetch the next card
};

    
    // function handleGetHint() { ... }
   const switchLanguageDirection = () => { 
    setLanguageDirection(prevDirection => {
      const newDirection = prevDirection === 'spa-eng' ? 'eng-spa' : 'spa-eng';
      console.log(`Switching direction from ${prevDirection} to ${newDirection}`);
      return newDirection;
  });
  }

    useEffect(() => { 
      console.log("App component mounted. Fetching initial flashcard pair")
      fetchRandomPair();
     }, []);



// === Component Return ===
return (
  <div className="App">
      <h1>Spanish Flashcards</h1>
      <div className="controls">
            <button onClick={switchLanguageDirection}>
                Switch Direction (Current: {languageDirection === 'spa-eng' ? 'Spanish -> English' : 'English -> Spanish'})
            </button>
        </div>
      {/* Display Loading Message */}
      {isLoading && <p>Loading flashcard...</p>}

      {/* Display Error Message */}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {/* Display Flashcard Area (only if NOT loading, NO error, and pair exists) */}
      {!isLoading && !error && currentPair && (
          <div>
              <Flashcard
              pair={currentPair}
              direction={languageDirection}
              onAnswerSubmit={handleAnswerSubmit}
              showFeedback={showFeedback}
              />
         {/* --- Feedback and Manual Next Button --- */}
         {showFeedback && ( // Only show this block when feedback is active
                        <div className="feedback-area">
                            <p style={{ color: 'red', fontWeight: 'bold' }}>
                                Incorrect. The correct answer was: "{lastCorrectAnswer}"
                            </p>
                            <button onClick={handleNextCard}>
                                Next Card
                            </button>
                        </div>
                    )}
                    {/* --- End Feedback Area --- */}
          </div>
      )}

      {/* Fallback message if loading finished but no pair and no error */}
      {!isLoading && !error && !currentPair && (
          <p>No flashcard data available. Check console for errors or try refreshing.</p>
      )}

      {/* --- Debug State Display (Optional but helpful) --- */}
      <details style={{ marginTop: '20px' }}>
          <summary>Show Current State</summary>
          <pre style={{ textAlign: 'left', fontSize: '12px', opacity: 0.7, border: '1px solid #ccc', padding: '10px', background: '#f9f9f9' }}>
              isLoading: {JSON.stringify(isLoading)}{'\n'}
              Error: {JSON.stringify(error)}{'\n'}
              Current Pair: {JSON.stringify(currentPair, null, 2)}{'\n'}
              Score: {JSON.stringify(score)}{'\n'}
              Hint Data: {JSON.stringify(hintData, null, 2)}
          </pre>
      </details>
       {/* --- End Debug State Display --- */}
  </div>
);
}
export default App;
