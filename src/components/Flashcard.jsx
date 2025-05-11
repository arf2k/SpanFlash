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
    onEdit 
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
    const markColor = isMarkedHard ? '#28a745' : '#ffc107'; // Green if marked, yellow if not
    const markTitle = isMarkedHard ? 'Word marked as hard' : 'Mark this word as hard';

    return (
        <div className={cardClassName}>
            {pair ? (
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* Word Display Area */}
                        <p className="flashcard-word" style={{ marginRigth: '50px' /* Space for buttons */ }}>{wordToShow}</p>
                        
                        {/* Action Buttons Container */}
                        <div style={{ position: 'absolute', top: '0px', right: '0px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {/* Mark as Hard Button */}
                            <button
                                onClick={() => onMarkHard(pair)}
                                title={markTitle}
                                // disabled={isMarkedHard} // Allow unmarking by re-clicking if logic changes, or keep disabled
                                style={{
                                    background: 'none', border: 'none', fontSize: '1.8em',
                                    lineHeight: '1', padding: '0 5px', cursor: 'pointer',
                                    color: markColor, 
                                    // opacity: isMarkedHard ? 0.6 : 1,
                                }}
                            >
                                {markIcon}
                            </button>

                            {/* Edit Button - New */}
                            {onEdit && ( // Only render if onEdit prop is provided
                                <button
                                    onClick={onEdit} // Calls the function passed from App.jsx
                                    title="Edit this word"
                                    style={{
                                        background: 'none', border: 'none', fontSize: '1.3em', // Adjust size as needed
                                        lineHeight: '1', padding: '0 5px', cursor: 'pointer',
                                        color: 'var(--text-muted)', // Or your preferred icon color
                                    }}
                                >
                                    ✏️ {/* Edit Icon */}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <p>No card data.</p>
            )}

            {/* Answer Form */}
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
                        {isHintLoading ? 'Getting Hint...' : 'Hint'}
                    </button>
                </form>
            )}

            {/* Hint Display Area */}
            {(isHintLoading || hint) && (
                <div className="hint-display" style={{ marginTop: '15px', fontSize: '0.9rem', fontStyle: 'normal', borderTop: '1px solid #dee2e6', paddingTop: '10px', paddingBottom: '10px', minHeight: '1.5em' }}>
                    {isHintLoading ? (
                        <span>Loading hint...</span>
                    ) : hint ? (
                        <>
                            {hint.type === 'suggestions' && hint.suggestions?.length > 0 && (
                                <span>Did you mean: {hint.suggestions.join(', ')}?</span>
                            )}
                            {hint.type === 'definitions' && hint.data ? (
                                <>
                                    <strong>Hint: </strong>
                                    {hint.data.fl && <em style={{ marginRight: '5px' }}>({hint.data.fl})</em>}
                                    {hint.data.shortdef && hint.data.shortdef.length > 0 ? (
                                        hint.data.shortdef.map((def, index) => (
                                            <span key={index}>{index > 0 && '; '} {def}</span>
                                        ))
                                    ) : (
                                        <span style={{ fontStyle: 'italic' }}> (No short definition)</span>
                                    )}
                                </>
                            ) : null}
                            {hint.type === 'error' && (
                                <span style={{ color: 'orange' }}> Hint Error: {hint.message || 'Failed.'}</span>
                            )}
                            {hint.type === 'unknown' && (
                                <span style={{ color: 'orange' }}> Unrecognized hint format.</span>
                            )}
                        </>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default Flashcard;