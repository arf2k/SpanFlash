import React from 'react'; 
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
        allWordsCount,
        incorrectAttempt 
    } = useMatchingGame(fullWordList, numPairsToDisplay);

 

    if (allWordsCount < numPairsToDisplay) {
        return (
            <div className="matching-game-container matching-game-error">
                <p>Not enough words in your list to start the matching game (need at least {numPairsToDisplay} pairs).</p>
                <button onClick={onExitGame} className="matching-game-button">Back to Flashcards</button>
            </div>
        );
    }
    


    if (activePairCount === 0 && allWordsCount >= numPairsToDisplay && spanishOptions.length === 0 && englishOptions.length === 0) {
        // Show "Preparing" only if options are truly empty and we expect them.
        // This might indicate the initial initializeNewRound is still pending or failed to populate.
        return (
            <div className="matching-game-container matching-game-message">
                <p>Preparing new words... or click "Start / New Round".</p>
                {/* Ensure initializeNewRound(true) is called for a full reset by the button */}
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
                 {/* Ensure this calls initializeNewRound with true for a full reset */}
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

export default MatchingGameView;