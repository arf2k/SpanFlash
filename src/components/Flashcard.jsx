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
    onEdit,
    onShowDetails // Prop to trigger showing the details modal
}) => {
    const [answer, setAnswer] = useState('');

    // Effect to clear the answer input when a new card is shown or feedback appears/disappears
    useEffect(() => {
        setAnswer('');
    }, [pair, showFeedback]);

    let wordToShow = '';
    let placeholderText = 'Type your answer...';

    if (pair) {
        if (direction === 'spa-eng') {
            wordToShow = pair.spanish;
            placeholderText = 'Type English...';
        } else {
            wordToShow = pair.english;
            placeholderText = 'Type Spanish...';
        }
    }

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!answer.trim() || showFeedback) return;
        onAnswerSubmit(answer);
    };

    const cardClassName = `flashcard ${feedbackSignal ? `flashcard--${feedbackSignal}` : ''}`.trim();
    const markIcon = isMarkedHard ? '★' : '☆';
    const markColor = isMarkedHard ? '#28a745' : '#ffc107';
    const markTitle = isMarkedHard ? 'Word is marked as hard' : 'Mark this word as hard';

    return (
        <div className={cardClassName}>
            {pair ? (
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p className="flashcard-word" style={{ marginRight: '60px' /* Ensure space for all buttons */ }}>
                            {wordToShow}
                        </p>
                        <div style={{ position: 'absolute', top: '0px', right: '0px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button
                                onClick={() => onMarkHard(pair)}
                                title={markTitle}
                                style={{ background: 'none', border: 'none', fontSize: '1.8em', lineHeight: '1', padding: '0 5px', cursor: 'pointer', color: markColor }}
                            >
                                {markIcon}
                            </button>
                            {onEdit && (
                                <button
                                    onClick={onEdit}
                                    title="Edit this word"
                                    style={{ background: 'none', border: 'none', fontSize: '1.3em', lineHeight: '1', padding: '0 5px', cursor: 'pointer', color: 'var(--text-muted)' }}
                                >
                                    ✏️
                                </button>
                            )}
                            {/* "Show Details" Button - visible if a pair exists, not dependent on feedback state */}
                            {pair && onShowDetails && ( 
                                <button
                                    onClick={onShowDetails}
                                    title="Show more details & examples"
                                    style={{
                                        background: 'none', border: 'none', fontSize: '1.3em',
                                        lineHeight: '1', padding: '0 5px', cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    📖 {/* Book Icon */}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <p>No card data.</p>
            )}

            {/* Answer Form: Only shown if not showing feedback AND a pair exists */}
            {pair && !showFeedback && (
                <form onSubmit={handleSubmit} className="answer-form" style={{ marginTop: '10px' }}>
                    <input
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={placeholderText}
                        className="answer-input"
                        autoFocus
                        required
                        style={{ marginRight: '10px' }}
                    />
                    <button type="submit" className="submit-button" disabled={!answer.trim()}>Check Answer</button>
                    <button
                        type="button"
                        onClick={onGetHint}
                        className="hint-button"
                        disabled={isHintLoading || (hint && hint.type !== 'error') || (showFeedback && feedbackSignal === 'incorrect')}
                        style={{ marginLeft: '10px' }}
                    >
                        {isHintLoading ? 'Getting Hint...' : 'Hint (MW)'}
                    </button>
                </form>
            )}

            {/* Merriam-Webster Hint Display Area */}
            {(isHintLoading || hint) && ( 
                <div className="hint-display">
                     {isHintLoading && !hint && <span>Loading hint...</span>}
                     {hint && (
                        <>
                            {hint.type === 'suggestions' && hint.suggestions?.length > 0 && (<span>Did you mean: {hint.suggestions.join(', ')}?</span> )}
                            {hint.type === 'definitions' && hint.data ? (
                                <>
                                    <strong>Hint (MW): </strong>
                                    {hint.data.fl && <em style={{marginRight: '5px'}}>({hint.data.fl})</em>}
                                    {hint.data.shortdef && hint.data.shortdef.length > 0 ? (
                                        hint.data.shortdef.map((def, index) => ( <span key={index}>{index > 0 && '; '} {def}</span> ))
                                    ) : ( <span style={{ fontStyle: 'italic' }}> (No short definition)</span> )}
                                </>
                            ) : null }
                            {hint.type === 'error' && ( <span style={{ color: 'orange' }}> Hint Error: {hint.message || 'Failed.'}</span> )}
                            {hint.type === 'unknown' && ( <span style={{ color: 'orange' }}> Unrecognized hint format.</span> )}
                        </>
                     )}
                </div>
            )}
        </div>
    );
};

export default Flashcard;