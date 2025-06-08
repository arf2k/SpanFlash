import React, { useEffect } from 'react'; 
import { useFillInTheBlankGame } from '../hooks/useFillInTheBlankGame';
import './FillInTheBlankGameView.css'; 

const FillInTheBlankGameView = ({ wordList, numChoices = 4, onExitGame, onWordsUpdated }) => { 
    const {
        currentQuestion,
        isLoading,
        gameMessage,
        gameScore,
        feedback,
        submitUserChoice,
        startNewGame,
        fetchNewQuestion,
        lastUpdatedWords,   
        clearLastUpdatedWords, 
    } = useFillInTheBlankGame(wordList, numChoices);
    
 
    useEffect(() => {
        if (lastUpdatedWords && lastUpdatedWords.length > 0) {
            if (onWordsUpdated) {
                onWordsUpdated(lastUpdatedWords);
            }
        
            clearLastUpdatedWords(); 
        }
    }, [lastUpdatedWords, onWordsUpdated, clearLastUpdatedWords]);
    
    const handleChoiceClick = (choice) => {
        if (feedback.message || isLoading) return; 
        submitUserChoice(choice);
    };

    const handleNextQuestionClick = () => {
        fetchNewQuestion();
    };

    if (isLoading) {
        return (
            <div className="fill-blank-game-container game-message-container">
                <p className="loading-text">Loading Question...</p>
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
                    <p className="sentence-display">
                        Fill in the blank for the Spanish translation of: <strong>"{currentQuestion.originalSentenceEng}"</strong>
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
                            <button onClick={handleNextQuestionClick} className="game-button next-question-button" autoFocus>
                                Next Question
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <p>Click "Start New Game" to begin.</p>
            )}

            <div className="fill-blank-controls">
                <button onClick={startNewGame} className="game-button" disabled={isLoading}>
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