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
    isMarkedHard,
 }) => {

    console.log('[Flashcard] Rendering with Pair:', pair, 'Direction:', direction, 'ShowFeedback:', showFeedback);
    const [answer, setAnswer] = useState('');
    useEffect(() => { console.log('[Flashcard] Effect: Resetting answer.'); setAnswer(''); }, [pair, showFeedback]);

    let wordToShow = '';
    let placeholderText = 'Type your answer...';
    if (pair) { if (direction === 'spa-eng') { wordToShow = pair.spanish; placeholderText = 'Type English...'; } else { wordToShow = pair.english; placeholderText = 'Type Spanish...'; } }
    console.log('[Flashcard] Calculated wordToShow:', wordToShow);

    const handleSubmit = (event) => { event.preventDefault(); if (!answer.trim() || showFeedback) return; console.log('[Flashcard] Submitting answer:', answer); onAnswerSubmit(answer); };

    const cardClassName = `flashcard ${feedbackSignal ? `flashcard--${feedbackSignal}` : ''}`.trim();
    const markIcon = isMarkedHard ? '★' : '☆';
    const markColor = isMarkedHard ? '#28a745' : '#ffc107';
    const markTitle = isMarkedHard ? 'Word marked as hard' : 'Mark this word as hard';

    return (
        <div className={cardClassName}>
            {/* Word Display Area */}
            {pair ? (
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <p className="flashcard-word">{wordToShow}</p>
                    {/* Mark as Hard Button */}
                    <button onClick={() => onMarkHard(pair)} title={markTitle} disabled={isMarkedHard} style={{ position: 'absolute', top: '0px', right: '0px', background: 'none', border: 'none', fontSize: '1.8em', lineHeight: '1', padding: '0 5px', cursor: isMarkedHard ? 'default' : 'pointer', color: markColor, opacity: isMarkedHard ? 0.6 : 1, }} >
                        {markIcon}
                    </button>
                </div>
            ) : ( <p>No card data.</p> )}

            {/* Answer Form */}
            {pair && !showFeedback && (
                <form onSubmit={handleSubmit} className="answer-form" style={{ marginTop: '10px' }}>
                    <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={placeholderText} className="answer-input" autoFocus required style={{ marginRight: '10px' }} />
                    <button type="submit" className="submit-button" disabled={!answer.trim()}>Check Answer</button>
                    <button type="button" onClick={onGetHint} className="hint-button" disabled={isHintLoading || (hint && hint.type !== 'error') || showFeedback || feedbackSignal === 'incorrect'} style={{ marginLeft: '10px' }}> {isHintLoading ? 'Getting Hint...' : 'Hint'} </button>
                </form>
            )}

            {/* ================================================ */}
            {/* UPDATED Hint Display Area                      */}
            {/* ================================================ */}
            <div className="hint-display" style={{ marginTop: '15px', fontSize: '0.9em', fontStyle: 'normal', /* Changed from italic */ borderTop: '1px solid #eee', paddingTop: '10px', minHeight: '1.5em' /* Slightly more height */ }}>
                 {isHintLoading ? (
                     <span>Loading hint...</span>
                 ) : hint ? (
                     <>
                         {/* Display Suggestions */}
                         {hint.type === 'suggestions' && hint.suggestions?.length > 0 && (
                            <span>Did you mean: {hint.suggestions.join(', ')}?</span>
                         )}

                         {/* Display Definitions (Improved Formatting) */}
                         {hint.type === 'definitions' && hint.data ? (
                            <>
                                <strong>Hint: </strong>
                                {/* Show Functional Label (Part of Speech) if available */}
                                {hint.data.fl && <em style={{marginRight: '5px'}}>({hint.data.fl})</em>}

                                {/* Process and display shortdef array */}
                                {hint.data.shortdef && hint.data.shortdef.length > 0 ? (
                                    hint.data.shortdef.map((def, index) => (
                                        // Display each short definition/translation
                                        // Add semicolon separator except for the first one
                                        <span key={index}>{index > 0 && '; '} {def}</span>
                                    ))
                                ) : (
                                    // Fallback if shortdef is missing or empty
                                    <span style={{ fontStyle: 'italic' }}> (No short definition available)</span>
                                )}
                            </>
                         ) : null } {/* End definitions block */}

                         {/* Display Errors */}
                         {hint.type === 'error' && (
                            <span style={{ color: 'orange' }}> Hint Error: {hint.message || 'Failed to load.'}</span>
                         )}

                         {/* Display Unknown Format */}
                         {hint.type === 'unknown' && (
                             <span style={{ color: 'orange' }}> Unrecognized hint format received.</span>
                         )}
                     </>
                 ) : (
                     // Render a non-breaking space to maintain height when no hint/loading
                     <span>&nbsp;</span>
                 )}
            </div>
            {/* ================================================ */}
            {/* END UPDATED Hint Display Area                  */}
            {/* ================================================ */}
        </div>
    );
 };

export default Flashcard;