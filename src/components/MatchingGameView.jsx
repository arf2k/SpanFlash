import React, { useEffect, memo } from 'react'; 
import { useMatchingGame } from '../hooks/useMatchingGame'; 
import './MatchingGameView.css'; 

const MatchingGameView = ({ fullWordList, numPairsToDisplay = 6, onExitGame, onWordsUpdated }) => {
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
        allWordsCount,
        incorrectAttempt,
        lastUpdatedWords, 
        clearLastUpdatedWords 
    } = useMatchingGame(fullWordList, numPairsToDisplay);

useEffect(() => {
    if (lastUpdatedWords && lastUpdatedWords.length > 0) {
        if (onWordsUpdated) {
            onWordsUpdated(lastUpdatedWords);
        }
      
        clearLastUpdatedWords(); 
    }
}, [lastUpdatedWords, onWordsUpdated, clearLastUpdatedWords]);

    if (allWordsCount < numPairsToDisplay) {
        return (
            <div className="matching-game-container matching-game-error">
                <p>Not enough words in your list to start the matching game (need at least {numPairsToDisplay} pairs).</p>
                <button onClick={onExitGame} className="matching-game-button">Back to Flashcards</button>
            </div>
        );
    }

    if (activePairCount === 0 && allWordsCount >= numPairsToDisplay && spanishOptions.length === 0 && englishOptions.length === 0) {
        return (
            <div className="matching-game-container matching-game-message">
                <p>Preparing new words... or click "Start / New Round".</p>
                <button onClick={() => initializeNewRound(true)} className="matching-game-button">Start / New Round</button>
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
                                className={
                                    `match-item spanish-item 
                                    ${selectedSpanish?.id === item.id ? 'selected' : ''}
                                    ${item.matched ? 'matched' : ''}
                                    ${incorrectAttempt?.spanishId === item.id ? 'incorrect-selection' : ''}` 
                                }
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
                                className={
                                    `match-item english-item 
                                    ${selectedEnglish?.id === item.id ? 'selected' : ''}
                                    ${item.matched ? 'matched' : ''}
                                    ${incorrectAttempt?.englishId === item.id ? 'incorrect-selection' : ''}` 
                                }
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
                <button onClick={() => initializeNewRound(true)} className="matching-game-button">
                    New Round / Reshuffle
                </button>
                <button onClick={onExitGame} className="matching-game-button matching-game-exit-button">
                    Exit Game
                </button>
            </div>
        </div>
    );
};

export default memo(MatchingGameView);