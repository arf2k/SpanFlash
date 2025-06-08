// src/components/FillInTheBlankGameView.jsx
import React from 'react';
import { useFillInTheBlankGame } from '../hooks/useFillInTheBlankGame';
import './FillInTheBlankGameView.css'; 

const FillInTheBlankGameView = ({ wordList, numChoices = 4, onExitGame }) => {
    const {
        currentQuestion,
        isLoadingNextQuestion,
        gameMessage,
        gameScore,
        feedback,
        submitUserChoice,
        startNewGame 
    } = useFillInTheBlankGame(wordList, numChoices);
    
    const handleChoiceClick = (choice) => {
        if (feedback.message || isLoadingNextQuestion) return; 
        submitUserChoice(choice);
    };

    if (isLoadingNextQuestion && !currentQuestion) {
        return (
            <div className="fill-blank-game-container game-message-container">
                <p className="loading-text">Finding a great sentence...</p>
            </div>
        );
    }
    
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
                    {/* --- CORRECTED UI PROMPT --- */}
                    <p className="sentence-display">
                        Fill in the blank for the Spanish translation of: <strong>"{currentQuestion.targetPair.english}"</strong>
                    </p>
                    
                    <p className="sentence-with-blank">
                        {currentQuestion.sentenceWithBlank.split('_______').map((part, index, arr) => (
                            <React.Fragment key={index}>
                                {part}
                                {index < arr.length - 1 && <span className="blank-placeholder">_______</span>}
                            </React.Fragment>
                        ))}
                    </p>
                    {/* --- END CORRECTED UI PROMPT --- */}
                    
                    <div className="choices-container">
                        {currentQuestion.choices.map((choice, index) => (
                            <button
                                key={index}
                                onClick={() => handleChoiceClick(choice)}
                                className="choice-button"
                                disabled={!!feedback.message || isLoadingNextQuestion} 
                            >
                                {choice}
                            </button>
                        ))}
                    </div>

                    {feedback.message && (
                        <div className={`feedback-message ${feedback.type === 'correct' ? 'correct' : 'incorrect'}`}>
                            <p>{feedback.message}</p>
                        </div>
                    )}
                </div>
            ) : (
                 !isLoadingNextQuestion && <p>Click "Start New Game" to begin.</p>
            )}

            <div className="fill-blank-controls">
                <button 
                    onClick={startNewGame} 
                    className="game-button"
                    disabled={isLoadingNextQuestion}
                >
                    Start New Game / Skip
                </button>
                <button onClick={onExitGame} className="game-button exit-button">
                    Exit Game
                </button>
            </div>
        </div>
    );
};

export default FillInTheBlankGameView;