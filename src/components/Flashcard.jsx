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
    isMarkedHard, // Use this prop
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

    // Determine button state based on prop
    const markIcon = isMarkedHard ? '★' : '☆'; // Filled vs Empty star
    const markColor = isMarkedHard ? '#28a745' : '#ffc107'; // Green vs Yellow/Orange
    const markTitle = isMarkedHard ? 'Word marked as hard' : 'Mark this word as hard';

    return (
        <div className={cardClassName}>
            {/* Word Display Area */}
            {pair ? (
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <p className="flashcard-word">{wordToShow}</p>
                    {/* Mark as Hard Button - Condition Removed */}
                    <button
                        onClick={() => onMarkHard(pair)}
                        title={markTitle}
                        disabled={isMarkedHard} // Disable if marked
                        style={{
                            position: 'absolute', top: '0px', right: '0px', background: 'none', border: 'none',
                            fontSize: '1.8em', lineHeight: '1', padding: '0 5px',
                            cursor: isMarkedHard ? 'default' : 'pointer', color: markColor, opacity: isMarkedHard ? 0.6 : 1,
                        }}
                    >
                        {markIcon}
                    </button>
                </div>
            ) : ( <p>No card data.</p> )}

            {/* Answer Form - Still conditional on !showFeedback */}
            {pair && !showFeedback && (
                <form onSubmit={handleSubmit} className="answer-form" style={{ marginTop: '10px' }}>
                    <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={placeholderText} className="answer-input" autoFocus required style={{ marginRight: '10px' }} />
                    <button type="submit" className="submit-button" disabled={!answer.trim()}>Check Answer</button>
                    <button type="button" onClick={onGetHint} className="hint-button" disabled={isHintLoading || (hint && hint.type !== 'error') || showFeedback || feedbackSignal === 'incorrect'} style={{ marginLeft: '10px' }}> {isHintLoading ? 'Getting Hint...' : 'Hint'} </button>
                </form>
            )}

             {/* Hint Display Area */}
             <div className="hint-display" style={{ marginTop: '15px', fontSize: '0.9em', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: '10px', minHeight: '1.2em' }}>
                 {isHintLoading ? <span>Loading hint...</span> : hint ? ( <> <strong>Hint:</strong> {hint.type === 'definitions' && hint.data?.fl && (<em> ({hint.data.fl})</em>)} {hint.type === 'definitions' && hint.data?.shortdef?.length > 0 ? (<span>: {hint.data.shortdef.join('; ')}</span>) : hint.type === 'definitions' ? <span>: Def details not found.</span> : null} {hint.type === 'suggestions' && hint.suggestions?.length > 0 && (<span> Did you mean: {hint.suggestions.join(', ')}?</span>)} {hint.type === 'error' && (<span style={{ color: 'orange' }}> {hint.message || 'Error hint.'}</span>)} {hint.type === 'unknown' && (<span style={{ color: 'orange' }}> Unrecognized hint.</span>)} </> ) : ( <span>&nbsp;</span> )}
             </div>
        </div>
    );
 };

export default Flashcard;