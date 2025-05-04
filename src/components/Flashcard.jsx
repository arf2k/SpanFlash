// src/components/Flashcard.jsx
import React, { useState, useEffect } from 'react';

const Flashcard = ({
    pair,
    direction,
    onAnswerSubmit,
    showFeedback,
    onGetHint,
    hint,
    isHintLoading,
    feedbackSignal,
    onMarkHard,
    isMarkedHard, // Accept prop
 }) => {

    // ================================
    // ADDED LOG: Check incoming props
    // ================================
    console.log('[Flashcard] Rendering with Pair:', pair, 'Direction:', direction, 'ShowFeedback:', showFeedback);

    const [answer, setAnswer] = useState('');

    useEffect(() => {
        // Clear input when card changes or feedback is shown/hidden
        console.log('[Flashcard] Effect: Resetting answer input.');
        setAnswer('');
    }, [pair, showFeedback]); // Reset when feedback state changes too

    // --- Calculate wordToShow and placeholderText ---
    let wordToShow = '';
    let placeholderText = 'Type your answer...';
    if (pair) {
        // This logic calculates the word to display
        if (direction === 'spa-eng') {
            wordToShow = pair.spanish;
            placeholderText = 'Type the English translation...';
        } else if (direction === 'eng-spa') {
            wordToShow = pair.english;
            placeholderText = 'Type the Spanish translation...';
        }
    }
    // ================================
    // ADDED LOG: Check calculated word
    // ================================
    console.log('[Flashcard] Calculated wordToShow:', wordToShow);


    // Handle form submission
    const handleSubmit = (event) => {
        event.preventDefault();
        // Basic validation
        if (!answer.trim() || showFeedback) {
            console.log('[Flashcard] Submit blocked. Answer:', answer, 'ShowFeedback:', showFeedback);
            return;
        };
        console.log('[Flashcard] Submitting answer via prop:', answer);
        onAnswerSubmit(answer); // Call the function passed from App.jsx
    };

    // Determine dynamic className for the flashcard div based on feedbackSignal
    const cardClassName = `flashcard ${
        feedbackSignal ? `flashcard--${feedbackSignal}` : ''
    }`.trim();

    // Determine icon/color/title based on isMarkedHard prop
    const markIcon = isMarkedHard ? '★' : '☆'; // Filled vs Empty star
    const markColor = isMarkedHard ? '#28a745' : '#ffc107'; // Green vs Yellow/Orange
    const markTitle = isMarkedHard ? 'Word marked as hard' : 'Mark this word as hard';

    return (
        // --- Use the dynamic className ---
        <div className={cardClassName}>
            {/* Word Display Area */}
            {pair ? (
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                     {/* This paragraph should display the word */}
                    <p className="flashcard-word">{wordToShow}</p>
                    {/* Mark as Hard Button */}
                    {!showFeedback && (
                         <button
                             onClick={() => onMarkHard(pair)}
                             title={markTitle}
                             disabled={isMarkedHard}
                             style={{
                                 position: 'absolute',
                                 top: '0px',
                                 right: '0px',
                                 background: 'none',
                                 border: 'none',
                                 fontSize: '1.8em',
                                 lineHeight: '1',
                                 padding: '0 5px',
                                 cursor: isMarkedHard ? 'default' : 'pointer',
                                 color: markColor,
                                 opacity: isMarkedHard ? 0.6 : 1,
                             }}
                         >
                             {markIcon}
                         </button>
                    )}
                </div>
            ) : (
                // This should only show if pair prop is null/undefined
                <p>No card data.</p>
            )}
            {/* END Word Display Area */}


            {/* Answer Form - Renders if pair exists AND feedback is NOT showing */}
            {pair && !showFeedback && (
                <form onSubmit={handleSubmit} className="answer-form" style={{ marginTop: '10px' }}>
                    <input
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={placeholderText}
                        className="answer-input"
                        autoFocus // Automatically focus input
                        required // Basic HTML5 validation
                        style={{ marginRight: '10px' }}
                    />
                    <button type="submit" className="submit-button" disabled={!answer.trim()} /* Disable if input empty */ >
                        Check Answer
                    </button>
                    {/* Hint Button */}
                    <button
                        type="button"
                        onClick={onGetHint}
                        className="hint-button"
                        // Disable hint if loading, already have hint (unless error), feedback showing, or incorrect signal
                        disabled={isHintLoading || (hint && hint.type !== 'error') || showFeedback || feedbackSignal === 'incorrect'}
                        style={{ marginLeft: '10px' }}
                    >
                        {isHintLoading ? 'Getting Hint...' : 'Hint'}
                    </button>
                </form>
            )}

             {/* Hint Display Area */}
             <div className="hint-display" style={{ marginTop: '15px', fontSize: '0.9em', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: '10px', minHeight: '1.2em' }}>
                 {isHintLoading ? (
                     <span>Loading hint...</span>
                 ) : hint ? (
                     // Added null checks for safety on hint.data properties
                     <>
                         <strong>Hint:</strong>
                         {hint.type === 'definitions' && hint.data?.fl && (
                             <em> ({hint.data.fl})</em>
                         )}
                         {hint.type === 'definitions' && hint.data?.shortdef?.length > 0 ? (
                             <span>: {hint.data.shortdef.join('; ')}</span>
                         ) : hint.type === 'definitions' ? (
                             <span>: Definition details not found in expected format.</span>
                         ) : null}

                         {hint.type === 'suggestions' && hint.suggestions?.length > 0 && (
                            <span> Did you mean: {hint.suggestions.join(', ')}?</span>
                         )}

                         {hint.type === 'error' && (
                            <span style={{ color: 'orange' }}> {hint.message || 'Error fetching hint.'}</span>
                         )}

                         {hint.type === 'unknown' && (
                             <span style={{ color: 'orange' }}> Unrecognized hint format.</span>
                         )}
                     </>
                 ) : (
                     <span>&nbsp;</span> // Use non-breaking space for placeholder height
                 )}
             </div>
             {/* END Hint Display Area */}
        </div>
    );
 };

export default Flashcard;