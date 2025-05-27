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
    onShowDetails, 
}) => {
    const [answer, setAnswer] = useState('');

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
    const markTitle = isMarkedHard ? 'Word marked as hard' : 'Mark this word as hard';

    return (
        <div className={cardClassName}>
            {pair ? (
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p className="flashcard-word" style={{ marginRight: '60px' }}>{wordToShow}</p>
                        <div style={{ position: 'absolute', top: '0px', right: '0px', display: 'flex', flexDirection: 'column', gap: '8px' /* Increased gap slightly */ }}>
                            <button onClick={() => onMarkHard(pair)} title={markTitle} style={{ background: 'none', border: 'none', fontSize: '1.8em', lineHeight: '1', padding: '0 5px', cursor: 'pointer', color: markColor }}>
                                {markIcon}
                            </button>
                            {onEdit && (
                                <button onClick={onEdit} title="Edit this word" style={{ background: 'none', border: 'none', fontSize: '1.3em', lineHeight: '1', padding: '0 5px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                    ✏️
                                </button>
                            )}
                            {/* New "Show Details" Button - visible when card is flipped */}
                            {showFeedback && onShowDetails && (
                                <button
                                    onClick={onShowDetails}
                                    title="Show more details & examples"
                                    style={{
                                        background: 'none', border: 'none', fontSize: '1.3em',
                                        lineHeight: '1', padding: '0 5px', cursor: 'pointer',
                                        color: 'var(--text-muted)', marginTop: '0px' // Aligned with edit
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

            {/* Answer Form: Only show if not showing feedback */}
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
                        disabled={isHintLoading || (hint && hint.type !== 'error') || showFeedback || feedbackSignal === 'incorrect'}
                        style={{ marginLeft: '10px' }}
                    >
                        {isHintLoading ? 'Getting Hint...' : 'Hint (MW)'}
                    </button>
                </form>
            )}

            {/* MW Hint Display Area (still shown here when feedback is true or hint is loading) */}
            {(isHintLoading || hint) && ( // This can be shown alongside feedback or independently
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

            {/* REMOVED direct display of notes, synonyms, category from here.
              This will now be handled by WordDetailsModal.
              The "Show Examples (Tatoeba)" button is also removed from here;
              it will be inside WordDetailsModal.
            */}
        </div>
    );
};

export default Flashcard;