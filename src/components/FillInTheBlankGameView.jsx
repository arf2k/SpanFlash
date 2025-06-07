import React from 'react';
import { useFillInTheBlankGame } from '../hooks/useFillInTheBlankGame';
import './FillInTheBlankGameView.css'; 

const FillInTheBlankGameView = ({ wordList, numChoices = 4, onExitGame }) => {
    const {
        currentQuestion,
        isLoading,
        gameMessage,
        gameScore,
        feedback,
        submitUserChoice,
        startNewGame 
    } = useFillInTheBlankGame(wordList, numChoices);
    
    const handleChoiceClick = (choice) => {
        if (feedback.message || isLoading) return; 
        submitUserChoice(choice);
    };

    // Initial loading state or if queue is empty and fetching
    if (isLoading && !currentQuestion) {
        return (
            <div className="fill-blank-game-container game-message-container">
                <p className="loading-text">{gameMessage || "Preparing game..."}</p>
                <button onClick={onExitGame} className="game-button exit-button">Exit Game</button>
            </div>
        );
    }

    // State for when game can't start or something went wrong
    if (gameMessage && !currentQuestion) {
        return (
            <div className="fill-blank-game-container game-message-container">
                <p>{gameMessage}</p>
                <button onClick={startNewGame} className="game-button">Try Again</button>
                <button onClick={onExitGame} className="game-button exit-button">Exit Game</button>
            </div>
        );
    }

    return (
        <div className="fill-blank-game-container">
            <div className="fill-blank-header">
                <h2>Fill in the Blank</h2>
                <div className="fill-blank-score">Score: {gameScore}</div>
            </div>

            {currentQuestion ? (
                <div className="question-area">
                    {/* --- CORRECTED: Use the full English sentence as the prompt --- */}
                    <p className="sentence-display">
                        Translate and complete the Spanish sentence for: <strong>"{currentQuestion.originalSentenceEng}"</strong>
                    </p>
                    
                    <p className="sentence-with-blank">
                        {currentQuestion.sentenceWithBlank.split('_______').map((part, index, arr) => (
                            <React.Fragment key={index}>
                                {part}
                                {index < arr.length - 1 && <span className="blank-placeholder">_______</span>}
                            </React.Fragment>
                        ))}
                    </p>
                    <div className="choices-container">
                        {currentQuestion.choices.map((choice, index) => (
                            <button
                                key={index}
                                onClick={() => handleChoiceClick(choice)}
                                className="choice-button"
                                disabled={!!feedback.message || isLoading} 
                            >
                                {choice}
                            </button>
                        ))}
                    </div>
                    {feedback.message && (
                        <div className={`feedback-message ${feedback.type === 'correct' ? 'correct' : 'incorrect'}`}>
                            <p>{feedback.message}</p>
                            {feedback.type === 'incorrect' && (
                                <p>Original sentence: "<em>{currentQuestion.originalSentenceSpa}</em>"</p>
                            )}
                        </div>
                    )}
                     {isLoading && feedback.message && <p className="loading-text">Loading next question...</p>}
                </div>
            ) : (
                // This state should now only be hit if isLoading is false but there's no question, which is unlikely
                 <p className="loading-text">Getting question...</p>
            )}

            <div className="fill-blank-controls">
                <button 
                    onClick={startNewGame} 
                    className="game-button"
                    disabled={isLoading}
                >
                    Start New Game
                </button>
                <button onClick={onExitGame} className="game-button exit-button">
                    Exit Game
                </button>
            </div>
        </div>
    );
};

export default FillInTheBlankGameView;