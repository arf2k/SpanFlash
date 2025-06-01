import React, { useEffect } from 'react';
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

   


    if (isLoadingNextQuestion && !currentQuestion) {
        return (
            <div className="fill-blank-game-container">
                <p className="loading-text">Loading question...</p>
                <button onClick={onExitGame} className="game-button exit-button">Exit Game</button>
            </div>
        );
    }

    if (gameMessage && !currentQuestion) {
        return (
            <div className="fill-blank-game-container game-message-container">
                <p>{gameMessage}</p>
                <button onClick={startNewGame} className="game-button">Try Again / New Game</button>
                <button onClick={onExitGame} className="game-button exit-button">Exit Game</button>
            </div>
        );
    }
    
    const handleChoiceClick = (choice) => {
        if (feedback.message) return; 
        submitUserChoice(choice);
    };

    return (
        <div className="fill-blank-game-container">
            <div className="fill-blank-header">
                <h2>Fill in the Blank</h2>
                <div className="fill-blank-score">Score: {gameScore}</div>
            </div>

            {currentQuestion ? (
                <div className="question-area">
                    <p className="sentence-display">
                        Sentence: <strong>{currentQuestion.originalSentenceEng}</strong> 
                        <br/>
                        <em>(Translate and fill in the blank for the Spanish sentence below)</em>
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
                                disabled={!!feedback.message || isLoadingNextQuestion} 
                            >
                                {choice}
                            </button>
                        ))}
                    </div>
                    {feedback.message && (
                        <div className={`feedback-message ${feedback.type === 'correct' ? 'correct' : 'incorrect'}`}>
                            <p>{feedback.message}</p>
                            {feedback.type === 'incorrect' && currentQuestion.targetPair && (
                                <p>The original sentence was: "<em>{currentQuestion.originalSentenceSpa}</em>"</p>
                            )}
                        </div>
                    )}
                     {isLoadingNextQuestion && <p className="loading-text">Loading next question...</p>}
                </div>
            ) : (
                 !isLoadingNextQuestion && <p>Click "Start Game" to begin.</p> // Should be covered by gameMessage state
            )}

            <div className="fill-blank-controls">
                <button 
                    onClick={startNewGame} 
                    className="game-button"
                    disabled={isLoadingNextQuestion}
                >
                    {currentQuestion ? "Next Question / Skip" : "Start Game"}
                </button>
                <button onClick={onExitGame} className="game-button exit-button">
                    Exit Game
                </button>
            </div>
        </div>
    );
};

export default FillInTheBlankGameView;