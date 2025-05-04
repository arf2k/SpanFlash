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
             {/* UPDATED Hint Display Area - Conditional Render */}
             {/* ================================================ */}
             {/* Only render the hint div if hint is loading OR hint data exists */}
             {(isHintLoading || hint) && (
                 <div className="hint-display" style={{ marginTop: '15px', fontSize: '0.9rem', fontStyle: 'normal', borderTop: '1px solid #dee2e6', paddingTop: '10px', paddingBottom: '10px', minHeight: '1.5em' }}>
                     {isHintLoading ? (
                         <span>Loading hint...</span>
                     ) : hint ? ( // We know hint exists here because of the outer condition
                         <>
                             {hint.type === 'suggestions' && hint.suggestions?.length > 0 && ( <span>Did you mean: {hint.suggestions.join(', ')}?</span> )}
                             {hint.type === 'definitions' && hint.data ? (
                                <>
                                    <strong>Hint: </strong>
                                    {hint.data.fl && <em style={{marginRight: '5px'}}>({hint.data.fl})</em>}
                                    {hint.data.shortdef && hint.data.shortdef.length > 0 ? (
                                        hint.data.shortdef.map((def, index) => ( <span key={index}>{index > 0 && '; '} {def}</span> ))
                                    ) : ( <span style={{ fontStyle: 'italic' }}> (No short definition)</span> )}
                                </>
                             ) : null }
                             {hint.type === 'error' && ( <span style={{ color: 'orange' }}> Hint Error: {hint.message || 'Failed.'}</span> )}
                             {hint.type === 'unknown' && ( <span style={{ color: 'orange' }}> Unrecognized hint format.</span> )}
                         </>
                     ) : null } {/* Should not be reachable if outer condition is correct, but safe */}
                 </div>
             )}
             {/* ================================================ */}
             {/* END UPDATED Hint Display Area                  */}
             {/* ================================================ */}
        </div>
    );
 };

export default Flashcard;