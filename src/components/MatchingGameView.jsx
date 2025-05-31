import React, { useEffect } from 'react';
import { useMatchingGame } from '../hooks/useMatchingGame'; 
import './MatchingGameView.css'; 

const MatchingGameView = ({ fullWordList, numPairsToDisplay = 6, onExitGame }) => {
    const {
        spanishOptions,
        englishOptions,
        selectedSpanish,
        selectedEnglish,
        gameScore,
        handleSpanishSelection,
        handleEnglishSelection,
        initializeNewRound, 
        activePairCount,
        allWordsCount
    } = useMatchingGame(fullWordList, numPairsToDisplay);

    useEffect(() => {
      
    }, [fullWordList]);

    if (allWordsCount < numPairsToDisplay) {
        return (
            <div className="matching-game-container matching-game-error">
                <p>Not enough words in your list to start the matching game (need at least {numPairsToDisplay} pairs).</p>
                <button onClick={onExitGame} className="matching-game-button">Back to Flashcards</button>
            </div>
        );
    }
    
    if (activePairCount < numPairsToDisplay && activePairCount > 0) {
       
    }
    if (activePairCount === 0 && allWordsCount >= numPairsToDisplay) {

        return (
            <div className="matching-game-container matching-game-message">
                <p>Preparing new words...</p>
                <button onClick={initializeNewRound} className="matching-game-button">Start / New Round</button>
                <button onClick={onExitGame} className="matching-game-button">Back to Flashcards</button>
            </div>
        );
    }


    return (
        <div className="matching-game-container">
            <div className="matching-game-header">
                <h2>Matching Game</h2>
                <div className="matching-game-score">Score: {gameScore}</div>
            </div>
            <div className="matching-game-board">
                <div className="matching-column">
                    <h3>Spanish</h3>
                    <ul>
                        {spanishOptions.map((item) => (
                            <li
                                key={`spa-${item.id}`}
                                className={`match-item spanish-item 
                                            ${selectedSpanish?.id === item.id ? 'selected' : ''}
                                            ${item.matched ? 'matched' : ''}`}
                                onClick={() => !item.matched && handleSpanishSelection(item)}
                                tabIndex={item.matched ? -1 : 0} 
                                onKeyDown={(e) => { if(!item.matched && (e.key === 'Enter' || e.key === ' ')) handleSpanishSelection(item);}}
                            >
                                {item.text}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="matching-column">
                    <h3>English</h3>
                    <ul>
                        {englishOptions.map((item) => (
                            <li
                                key={`eng-${item.id}`}
                                className={`match-item english-item 
                                            ${selectedEnglish?.id === item.id ? 'selected' : ''}
                                            ${item.matched ? 'matched' : ''}`}
                                onClick={() => !item.matched && handleEnglishSelection(item)}
                                tabIndex={item.matched ? -1 : 0}
                                onKeyDown={(e) => { if(!item.matched && (e.key === 'Enter' || e.key === ' ')) handleEnglishSelection(item);}}
                            >
                                {item.text}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="matching-game-controls">
                <button onClick={initializeNewRound} className="matching-game-button">
                    New Round / Reshuffle
                </button>
                <button onClick={onExitGame} className="matching-game-button matching-game-exit-button">
                    Exit Game
                </button>
            </div>
        </div>
    );
};

export default MatchingGameView;